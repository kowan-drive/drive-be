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

MASTER_ENCRYPTION_KEY=$(openssl rand -base64 48 | tr -d '/' | cut -c1-48)
SESSION_SECRET=$(openssl rand -base64 32 | tr -d '/' | cut -c1-32)

# Build DATABASE_URL
DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres-service:5432/${POSTGRES_DB}?schema=public"

print_info "Secrets generated successfully!"
echo ""

# Show (partial) generated secrets
print_info "Preview of generated secrets (showing only first 8 characters):"
echo "  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:0:8}..."
echo "  MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:0:8}..."
echo "  MASTER_ENCRYPTION_KEY: ${MASTER_ENCRYPTION_KEY:0:8}..."
echo "  SESSION_SECRET: ${SESSION_SECRET:0:8}..."
echo ""

# Ask if user wants to save to file for backup
read -p "Do you want to save secrets to a local file for backup? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    SECRETS_FILE="secrets-backup-$(date +%Y%m%d-%H%M%S).txt"
    cat > "$SECRETS_FILE" <<EOF
# MiniDrive Secrets - Generated on $(date)
# KEEP THIS FILE SECURE AND DO NOT COMMIT TO GIT

POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=${POSTGRES_DB}
DATABASE_URL=${DATABASE_URL}

MINIO_ROOT_USER=${MINIO_ROOT_USER}
MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD}

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

# Create/Update Kubernetes secret
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

print_info "Secret created/updated successfully in Kubernetes!"
echo ""

# Ask if user wants to restart deployments to pick up new secrets
read -p "Do you want to restart deployments to pick up the new secrets? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if kubectl get deployment minidrive-app -n minidrive &> /dev/null; then
        print_step "Restarting minidrive-app deployment..."
        kubectl rollout restart deployment/minidrive-app -n minidrive
        print_info "Deployment restarted. Monitoring rollout..."
        kubectl rollout status deployment/minidrive-app -n minidrive
    else
        print_warning "minidrive-app deployment not found. Skipping restart."
    fi
fi

echo ""
print_info "Setup complete!"
echo ""
print_warning "Remember to:"
echo "  1. Store the backup file (if created) in a secure password manager"
echo "  2. Delete the local backup file after storing it securely"
echo "  3. Never commit secrets to version control"

# Offer to view the secret (base64 encoded)
echo ""
read -p "Do you want to view the secret in Kubernetes? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    kubectl get secret minidrive-secrets -n minidrive -o yaml
fi
