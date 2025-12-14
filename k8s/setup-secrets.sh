#!/bin/bash

# MiniDrive Secrets Setup Script
# This script helps generate and apply secure secrets for Kubernetes

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    print_error "kubectl is not installed. Please install kubectl first."
    exit 1
fi

# Check if openssl is installed
if ! command -v openssl &> /dev/null; then
    print_error "openssl is not installed. Please install openssl first."
    exit 1
fi

print_info "MiniDrive Secrets Setup Script"
echo ""
print_warning "This script will generate secure random secrets for your deployment."
print_warning "The secrets will be stored ONLY in Kubernetes, not in files."
echo ""

# Ask for confirmation
read -p "Do you want to continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_info "Aborted."
    exit 0
fi

echo ""
print_step "Generating secure random secrets..."

# Generate secrets
POSTGRES_USER="minidrive"
POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d '/' | cut -c1-32)
POSTGRES_DB="minidrive"

MINIO_ROOT_USER="minioadmin"
MINIO_ROOT_PASSWORD=$(openssl rand -base64 32 | tr -d '/' | cut -c1-32)

GRAFANA_ADMIN_USER="admin"
GRAFANA_ADMIN_PASSWORD=$(openssl rand -base64 32 | tr -d '/' | cut -c1-32)

MASTER_ENCRYPTION_KEY=$(openssl rand -base64 48 | tr -d '/' | cut -c1-48)
SESSION_SECRET=$(openssl rand -base64 32 | tr -d '/' | cut -c1-32)

# Build DATABASE_URL
DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres-service:5432/${POSTGRES_DB}?schema=public"

print_info "Secrets generated successfully!"
echo ""

# Show (partial) generated secrets
print_info "Preview of generated secrets:"
echo "  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}..."
echo "  MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}..."
echo "  GRAFANA_ADMIN_PASSWORD: ${GRAFANA_ADMIN_PASSWORD}..."
echo "  MASTER_ENCRYPTION_KEY: ${MASTER_ENCRYPTION_KEY}..."
echo "  SESSION_SECRET: ${SESSION_SECRET}..."
echo ""

# Ask if user wants to save to file for backup
read -p "Do you want to save secrets to a local file for backup? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    SECRETS_FILE="secrets-backup-$(date +%Y%m%d-%H%M%S).txt"
    cat > "$SECRETS_FILE" <<EOF
# MiniDrive Secrets - Generated on $(date)
# KEEP THIS FILE SECURE AND DO NOT COMMIT TO GIT

================================
DATABASE CREDENTIALS
================================
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=${POSTGRES_DB}
DATABASE_URL=${DATABASE_URL}

================================
MINIO OBJECT STORAGE CREDENTIALS
================================
Login URL: http://minio-service:9001 (or via port-forward/ingress)
MINIO_ROOT_USER=${MINIO_ROOT_USER}
MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD}

================================
GRAFANA MONITORING CREDENTIALS
================================
Login URL: http://grafana-service:3000 (or via port-forward/ingress)
GRAFANA_ADMIN_USER=${GRAFANA_ADMIN_USER}
GRAFANA_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD}

================================
APPLICATION SECRETS
================================
MASTER_ENCRYPTION_KEY=${MASTER_ENCRYPTION_KEY}
SESSION_SECRET=${SESSION_SECRET}
EOF
    chmod 600 "$SECRETS_FILE"
    print_info "Secrets saved to: $SECRETS_FILE"
    print_warning "Keep this file secure and delete it after storing in a secure location!"
    echo ""
fi

# Check if namespace exists
if ! kubectl get namespace minidrive &> /dev/null; then
    print_step "Creating namespace..."
    kubectl create namespace minidrive
fi

# Check if secret already exists
if kubectl get secret minidrive-secrets -n minidrive &> /dev/null; then
    print_warning "Secret 'minidrive-secrets' already exists in the cluster."
    read -p "Do you want to UPDATE it with new values? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Aborted. Existing secrets were not modified."
        exit 0
    fi
    print_step "Updating existing secret..."
else
    print_step "Creating new secret..."
fi

# Create/Update Kubernetes secret for main application
kubectl create secret generic minidrive-secrets \
  --namespace=minidrive \
  --from-literal=POSTGRES_USER="${POSTGRES_USER}" \
  --from-literal=POSTGRES_PASSWORD="${POSTGRES_PASSWORD}" \
  --from-literal=POSTGRES_DB="${POSTGRES_DB}" \
  --from-literal=DATABASE_URL="${DATABASE_URL}" \
  --from-literal=MINIO_ROOT_USER="${MINIO_ROOT_USER}" \
  --from-literal=MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD}" \
  --from-literal=MASTER_ENCRYPTION_KEY="${MASTER_ENCRYPTION_KEY}" \
  --from-literal=SESSION_SECRET="${SESSION_SECRET}" \
  --dry-run=client -o yaml | kubectl apply -f -

print_info "Main application secret created/updated successfully!"

# Create/Update Grafana admin secret
print_step "Creating Grafana admin secret..."

# Check if grafana-admin secret already exists
if kubectl get secret grafana-admin -n minidrive &> /dev/null; then
    print_warning "Grafana admin secret already exists. It will be updated."
fi

kubectl create secret generic grafana-admin \
  --namespace=minidrive \
  --from-literal=admin-user="${GRAFANA_ADMIN_USER}" \
  --from-literal=admin-password="${GRAFANA_ADMIN_PASSWORD}" \
  --dry-run=client -o yaml | kubectl apply -f -

print_info "Grafana admin secret created/updated successfully!"

# Automatically restart Grafana to pick up new credentials
if kubectl get deployment grafana -n minidrive &> /dev/null; then
    print_step "Restarting Grafana to apply new credentials..."
    print_warning "Grafana's admin password is set on first startup and stored in its database."
    print_warning "To apply new credentials, we need to reset Grafana's database."
    read -p "Do you want to DELETE Grafana's data and restart with new credentials? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Delete the pod to stop it
        kubectl delete pod -l app=grafana -n minidrive 2>/dev/null || true
        # Delete the PVC to remove stored data
        kubectl delete pvc grafana-pvc -n minidrive 2>/dev/null || true
        print_info "Grafana data deleted. Recreating..."
        # Recreate the PVC
        kubectl apply -f 16-grafana-deployment.yaml
        print_info "Waiting for Grafana to be ready with new credentials..."
        kubectl wait --for=condition=ready pod -l app=grafana -n minidrive --timeout=180s || print_warning "Grafana taking longer than expected to start"
    else
        print_warning "Skipping Grafana reset. Old credentials will still be active."
        print_info "To manually reset Grafana password, run:"
        echo "  kubectl exec -it -n minidrive deployment/grafana -- grafana-cli admin reset-admin-password \${NEW_PASSWORD}"
    fi
fi
echo ""

# Display all credentials clearly
echo ""
print_info "============================================"
print_info "IMPORTANT: YOUR LOGIN CREDENTIALS"
print_info "============================================"
echo ""
echo -e "${BLUE}MinIO Object Storage Console:${NC}"
echo "  URL: http://minio-service:9001 (access via port-forward or ingress)"
echo "  Username: ${MINIO_ROOT_USER}"
echo "  Password: ${MINIO_ROOT_PASSWORD}"
echo ""
echo -e "${BLUE}Grafana Monitoring Dashboard:${NC}"
echo "  URL: http://grafana-service:3000 (access via port-forward or ingress)"
echo "  Username: ${GRAFANA_ADMIN_USER}"
echo "  Password: ${GRAFANA_ADMIN_PASSWORD}"
echo ""
echo -e "${BLUE}PostgreSQL Database:${NC}"
echo "  Username: ${POSTGRES_USER}"
echo "  Password: ${POSTGRES_PASSWORD}"
echo "  Database: ${POSTGRES_DB}"
echo ""
print_info "============================================"
echo ""

# Ask if user wants to restart deployments to pick up new secrets
read -p "Do you want to restart other deployments (minidrive-app, minio) to pick up new secrets? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if kubectl get deployment minidrive-app -n minidrive &> /dev/null; then
        print_step "Restarting minidrive-app deployment..."
        kubectl rollout restart deployment/minidrive-app -n minidrive
    fi
    if kubectl get deployment minio -n minidrive &> /dev/null; then
        print_step "Restarting minio deployment..."
        kubectl rollout restart deployment/minio -n minidrive
    fi
    print_info "Deployments restarted. Waiting for rollout..."
    sleep 3
fi

echo ""
print_info "Setup complete!"
echo ""
print_warning "IMPORTANT NOTES:"
echo "  1. Grafana has been restarted with new credentials"
echo "  2. If you previously logged into Grafana with old credentials, you may need to:"
echo "     - Clear your browser cache/cookies for the Grafana URL"
echo "     - Or access Grafana in an incognito/private window"
echo "  3. Store all credentials shown above in a secure password manager"
echo "  4. Store the backup file (if created) in a secure location"
echo "  5. Delete the local backup file after storing it securely"
echo "  6. Never commit secrets to version control"
echo ""
print_info "To access services locally, use port-forward:"
echo "  kubectl port-forward -n minidrive svc/grafana-service 3000:3000"
echo "  kubectl port-forward -n minidrive svc/minio-service 9001:9001"

