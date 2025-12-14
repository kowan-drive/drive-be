# MiniDrive Kubernetes Deployment Guide

This guide provides comprehensive instructions for deploying the MiniDrive backend application to Kubernetes.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Architecture Overview](#architecture-overview)
3. [Environment Variables Setup](#environment-variables-setup)
4. [Initial Deployment](#initial-deployment)
5. [Updating Secrets Securely](#updating-secrets-securely)
6. [Domain Configuration](#domain-configuration)
7. [Rolling Updates](#rolling-updates)
8. [Troubleshooting](#troubleshooting)
9. [Scaling](#scaling)
10. [Monitoring](#monitoring)

---

## Prerequisites

Before deploying, ensure you have:

- A Kubernetes cluster (v1.24+)
- `kubectl` configured to access your cluster
- Docker registry access (Docker Hub, GitHub Container Registry, etc.)
- Domain name(s) for your application
- Ingress controller installed (Traefik or nginx-ingress)
- (Optional) cert-manager for automatic TLS certificates

### Verify cluster access:

```bash
kubectl cluster-info
kubectl get nodes
```

---

## Architecture Overview

The MiniDrive deployment consists of:

- **PostgreSQL**: Database for user data and metadata (1 replica)
- **MinIO**: Object storage for file storage (1 replica)
- **MiniDrive App**: Backend application (2 replicas by default)
- **Services**: ClusterIP services for internal communication
- **Ingress**: External access to the application and MinIO console

### Persistent Storage:

- PostgreSQL: 10Gi PVC
- MinIO: 20Gi PVC

---

## Environment Variables Setup

### Step 1: Create a Secure Secrets File

Create a file named `secrets.env` (DO NOT commit this to Git):

```bash
# PostgreSQL credentials
POSTGRES_USER=minidrive
POSTGRES_PASSWORD=$(openssl rand -base64 32)
POSTGRES_DB=minidrive

# MinIO credentials
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=$(openssl rand -base64 32)

# Application secrets (at least 32 characters)
MASTER_ENCRYPTION_KEY=$(openssl rand -base64 48)
SESSION_SECRET=$(openssl rand -base64 32)
```

### Step 2: Generate Strong Secrets

Run these commands to generate secure random secrets:

```bash
echo "POSTGRES_PASSWORD=$(openssl rand -base64 32)"
echo "MINIO_ROOT_PASSWORD=$(openssl rand -base64 32)"
echo "MASTER_ENCRYPTION_KEY=$(openssl rand -base64 48)"
echo "SESSION_SECRET=$(openssl rand -base64 32)"
```

### Step 3: Add secrets.env to .gitignore

```bash
echo "secrets.env" >> .gitignore
echo "k8s/01-secret.yaml" >> .gitignore  # If you edit this file with real secrets
```

### Step 4: Create Kubernetes Secret

Method 1: Edit `01-secret.yaml` directly (then gitignore it):

```bash
# Edit the file with your generated secrets
vim k8s/01-secret.yaml

# Apply it
kubectl apply -f k8s/01-secret.yaml
```

Method 2: Create secret from command line (recommended):

```bash
kubectl create secret generic minidrive-secrets \
  --namespace=minidrive \
  --from-literal=POSTGRES_USER='minidrive' \
  --from-literal=POSTGRES_PASSWORD='YOUR_GENERATED_PASSWORD' \
  --from-literal=POSTGRES_DB='minidrive' \
  --from-literal=MINIO_ROOT_USER='minioadmin' \
  --from-literal=MINIO_ROOT_PASSWORD='YOUR_GENERATED_PASSWORD' \
  --from-literal=MASTER_ENCRYPTION_KEY='YOUR_GENERATED_KEY' \
  --from-literal=SESSION_SECRET='YOUR_GENERATED_SECRET' \
  --dry-run=client -o yaml | kubectl apply -f -
```

### Step 5: Update ConfigMap with Your Domain

Edit `k8s/02-configmap.yaml` and update:

```yaml
APP_URL: "https://api.your-domain.com"
FRONTEND_URL: "https://your-frontend-domain.com"
PODS_APP_WHITELIST: "https://your-frontend-domain.com"
WEBAUTHN_RP_ID: "your-domain.com"
WEBAUTHN_ORIGIN: "https://api.your-domain.com"
```

---

## Initial Deployment

### Step 1: Build and Push Docker Image

```bash
# Navigate to drive-be directory
cd drive-be

# Build the Docker image
docker build -t your-registry/minidrive-app:v1.0.0 .

# Push to your registry
docker push your-registry/minidrive-app:v1.0.0

# Tag as latest
docker tag your-registry/minidrive-app:v1.0.0 your-registry/minidrive-app:latest
docker push your-registry/minidrive-app:latest
```

### Step 2: Update Image References

Edit `k8s/08-app-deployment.yaml` and replace:

```yaml
image: your-docker-registry/minidrive-app:latest
```

with your actual image:

```yaml
image: your-registry/minidrive-app:latest
```

### Step 3: Apply Kubernetes Manifests

```bash
# Navigate to k8s directory
cd k8s

# Apply in order (important!)
kubectl apply -f 00-namespace.yaml
kubectl apply -f 01-secret.yaml  # Or skip if you used kubectl create secret
kubectl apply -f 02-configmap.yaml
kubectl apply -f 03-postgres-pvc.yaml
kubectl apply -f 04-minio-pvc.yaml
kubectl apply -f 05-postgres-deployment.yaml
kubectl apply -f 06-minio-deployment.yaml

# Wait for databases to be ready (about 30-60 seconds)
kubectl wait --for=condition=ready pod -l app=postgres -n minidrive --timeout=120s
kubectl wait --for=condition=ready pod -l app=minio -n minidrive --timeout=120s

# Create MinIO bucket
kubectl apply -f 07-minio-init-job.yaml

# Wait for job to complete
kubectl wait --for=condition=complete job/minio-init -n minidrive --timeout=120s

# Deploy the application
kubectl apply -f 08-app-deployment.yaml

# Wait for app to be ready
kubectl wait --for=condition=ready pod -l app=minidrive -n minidrive --timeout=180s

# Apply ingress (after configuring domain)
kubectl apply -f 09-ingress.yaml
```

### Step 4: Verify Deployment

```bash
# Check all resources
kubectl get all -n minidrive

# Check pod status
kubectl get pods -n minidrive

# Check logs if there are issues
kubectl logs -f deployment/minidrive-app -n minidrive

# Check PostgreSQL
kubectl logs -f deployment/postgres -n minidrive

# Check MinIO
kubectl logs -f deployment/minio -n minidrive
```

---

## Domain Configuration

### Step 1: Configure DNS

Point your domain to your Kubernetes cluster's ingress IP:

```bash
# Get ingress IP
kubectl get ingress -n minidrive

# Or get LoadBalancer IP
kubectl get svc -n ingress-nginx  # For nginx-ingress
kubectl get svc -n kube-system traefik  # For Traefik
```

Create DNS A records:
- `api.your-domain.com` → Ingress IP
- `minio-console.your-domain.com` → Ingress IP (optional)

### Step 2: Update Ingress Configuration

Edit `k8s/09-ingress.yaml`:

```yaml
spec:
  rules:
  - host: api.your-domain.com  # Your actual domain
```

### Step 3: Configure TLS (HTTPS)

#### Option A: Using cert-manager (Automated)

```bash
# Install cert-manager (if not already installed)
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Create ClusterIssuer for Let's Encrypt
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@example.com  # UPDATE THIS
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx  # or traefik
EOF
```

Update `09-ingress.yaml` with cert-manager annotations:

```yaml
metadata:
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  tls:
  - hosts:
    - api.your-domain.com
    secretName: minidrive-tls-cert
```

#### Option B: Using Existing Certificate

```bash
# Create TLS secret from your certificate files
kubectl create secret tls minidrive-tls-cert \
  --namespace=minidrive \
  --cert=path/to/tls.crt \
  --key=path/to/tls.key
```

### Step 4: Apply Updated Ingress

```bash
kubectl apply -f k8s/09-ingress.yaml
```

---

## Rolling Updates

### Step 1: Build New Version

```bash
# Build new version
docker build -t your-registry/minidrive-app:v1.1.0 .
docker push your-registry/minidrive-app:v1.1.0

# Update latest tag
docker tag your-registry/minidrive-app:v1.1.0 your-registry/minidrive-app:latest
docker push your-registry/minidrive-app:latest
```

### Step 2: Update Deployment

```bash
# Force rollout with new image
kubectl rollout restart deployment/minidrive-app -n minidrive

# Or update image directly
kubectl set image deployment/minidrive-app \
  app=your-registry/minidrive-app:v1.1.0 \
  -n minidrive
```

### Step 3: Monitor Rollout

```bash
# Watch rollout status
kubectl rollout status deployment/minidrive-app -n minidrive

# Check rollout history
kubectl rollout history deployment/minidrive-app -n minidrive

# View pods updating
kubectl get pods -n minidrive -w
```

### Step 4: Rollback if Needed

```bash
# Rollback to previous version
kubectl rollout undo deployment/minidrive-app -n minidrive

# Rollback to specific revision
kubectl rollout undo deployment/minidrive-app --to-revision=2 -n minidrive
```

---

## Updating Secrets Securely

### Method 1: Using kubectl (Recommended)

```bash
# Update a single secret value
kubectl create secret generic minidrive-secrets \
  --namespace=minidrive \
  --from-literal=SESSION_SECRET='new-secret-value' \
  --dry-run=client -o yaml | kubectl apply -f -

# Restart pods to pick up new secrets
kubectl rollout restart deployment/minidrive-app -n minidrive
```

### Method 2: Using Sealed Secrets (Advanced)

For production, consider using [Sealed Secrets](https://github.com/bitnami-labs/sealed-secrets):

```bash
# Install Sealed Secrets controller
kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.24.0/controller.yaml

# Create sealed secret
kubeseal --format=yaml < 01-secret.yaml > 01-secret-sealed.yaml

# Commit sealed secret (safe to commit)
git add k8s/01-secret-sealed.yaml
git commit -m "Add sealed secrets"
```

### Method 3: External Secrets Operator

For cloud providers, use [External Secrets Operator](https://external-secrets.io/) to sync from:
- AWS Secrets Manager
- Google Secret Manager
- Azure Key Vault
- HashiCorp Vault

---

## Troubleshooting

### Check Pod Status

```bash
# Get pod status
kubectl get pods -n minidrive

# Describe pod for events
kubectl describe pod <pod-name> -n minidrive

# Check logs
kubectl logs <pod-name> -n minidrive
kubectl logs -f deployment/minidrive-app -n minidrive
kubectl logs <pod-name> -n minidrive --previous  # Previous container logs
```

### Common Issues

#### 1. ImagePullBackOff

```bash
# Check if image exists and registry access
docker pull your-registry/minidrive-app:latest

# If using private registry, create imagePullSecret
kubectl create secret docker-registry regcred \
  --docker-server=your-registry \
  --docker-username=your-username \
  --docker-password=your-password \
  --namespace=minidrive

# Add to deployment:
# spec:
#   template:
#     spec:
#       imagePullSecrets:
#       - name: regcred
```

#### 2. CrashLoopBackOff

```bash
# Check application logs
kubectl logs -f deployment/minidrive-app -n minidrive

# Common causes:
# - Missing environment variables
# - Database connection issues
# - MinIO connection issues

# Check if databases are ready
kubectl get pods -n minidrive
```

#### 3. Database Connection Issues

```bash
# Test PostgreSQL connection from app pod
kubectl exec -it deployment/minidrive-app -n minidrive -- sh
nc -zv postgres-service 5432

# Check PostgreSQL logs
kubectl logs deployment/postgres -n minidrive

# Verify secret values
kubectl get secret minidrive-secrets -n minidrive -o jsonpath='{.data.POSTGRES_USER}' | base64 -d
```

#### 4. MinIO Connection Issues

```bash
# Check MinIO status
kubectl logs deployment/minio -n minidrive

# Test MinIO connectivity
kubectl exec -it deployment/minidrive-app -n minidrive -- sh
nc -zv minio-service 9000

# Check bucket creation job
kubectl logs job/minio-init -n minidrive
```

#### 5. Ingress Not Working

```bash
# Check ingress status
kubectl get ingress -n minidrive
kubectl describe ingress minidrive-ingress -n minidrive

# Check ingress controller logs
kubectl logs -n ingress-nginx deployment/ingress-nginx-controller
# or for Traefik:
kubectl logs -n kube-system deployment/traefik

# Verify DNS resolution
nslookup api.your-domain.com
```

### Debug Commands

```bash
# Get all events in namespace
kubectl get events -n minidrive --sort-by='.lastTimestamp'

# Execute commands in pod
kubectl exec -it deployment/minidrive-app -n minidrive -- sh

# Port forward for local testing
kubectl port-forward -n minidrive deployment/minidrive-app 3001:3001
kubectl port-forward -n minidrive deployment/minio 9001:9001

# Check resource usage
kubectl top pods -n minidrive
kubectl top nodes
```

---

## Scaling

### Horizontal Scaling (More Replicas)

```bash
# Scale application
kubectl scale deployment/minidrive-app --replicas=5 -n minidrive

# Or edit deployment
kubectl edit deployment/minidrive-app -n minidrive
# Change: spec.replicas: 5

# Auto-scaling with HPA
kubectl autoscale deployment minidrive-app \
  --cpu-percent=70 \
  --min=2 \
  --max=10 \
  -n minidrive
```

### Vertical Scaling (More Resources)

Edit `08-app-deployment.yaml`:

```yaml
resources:
  requests:
    memory: "512Mi"
    cpu: "500m"
  limits:
    memory: "1Gi"
    cpu: "1000m"
```

Apply changes:

```bash
kubectl apply -f k8s/08-app-deployment.yaml
```

### Storage Scaling

```bash
# For PostgreSQL
kubectl edit pvc postgres-pvc -n minidrive
# Increase storage size (if storage class supports it)

# For MinIO
kubectl edit pvc minio-pvc -n minidrive
```

---

## Monitoring

### Basic Monitoring

```bash
# Watch pod status
kubectl get pods -n minidrive -w

# Check resource usage
kubectl top pods -n minidrive
kubectl top nodes

# View logs
kubectl logs -f deployment/minidrive-app -n minidrive --tail=100
```

### Application Health Checks

The deployment includes:
- **Liveness Probe**: Restarts unhealthy pods
- **Readiness Probe**: Removes pod from service if not ready

Check probe status:

```bash
kubectl describe pod <pod-name> -n minidrive | grep -A 10 "Conditions:"
```

### Advanced Monitoring (Optional)

Consider installing:

1. **Prometheus + Grafana** for metrics
2. **ELK Stack** or **Loki** for log aggregation
3. **Jaeger** for distributed tracing

---

## Backup and Restore

### Backup PostgreSQL

```bash
# Create backup
kubectl exec deployment/postgres -n minidrive -- \
  pg_dump -U minidrive minidrive > backup-$(date +%Y%m%d).sql

# Or run backup job
cat <<EOF | kubectl apply -f -
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
  namespace: minidrive
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: postgres:16-alpine
            env:
            - name: POSTGRES_USER
              valueFrom:
                secretKeyRef:
                  name: minidrive-secrets
                  key: POSTGRES_USER
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: minidrive-secrets
                  key: POSTGRES_PASSWORD
            command:
            - sh
            - -c
            - |
              pg_dump -h postgres-service -U \$POSTGRES_USER minidrive > /backup/backup-\$(date +\%Y\%m\%d-\%H\%M).sql
            volumeMounts:
            - name: backup-storage
              mountPath: /backup
          restartPolicy: OnFailure
          volumes:
          - name: backup-storage
            persistentVolumeClaim:
              claimName: backup-pvc  # Create this PVC
EOF
```

### Restore PostgreSQL

```bash
# Restore from backup
kubectl exec -i deployment/postgres -n minidrive -- \
  psql -U minidrive minidrive < backup-20241214.sql
```

---

## Security Best Practices

1. **Never commit secrets to Git**
   - Use `.gitignore` for `secrets.env` and edited secret files
   - Use Sealed Secrets or External Secrets Operator

2. **Use strong secrets**
   - Generate with `openssl rand -base64 32` or similar
   - Minimum 32 characters for encryption keys

3. **Enable RBAC**
   - Create service accounts with minimal permissions
   - Use NetworkPolicies to restrict pod communication

4. **Regular Updates**
   - Keep images updated
   - Monitor security advisories

5. **TLS Everywhere**
   - Enable TLS for ingress
   - Consider service mesh for internal TLS

---

## Clean Up

To remove the entire deployment:

```bash
# Delete all resources
kubectl delete -f k8s/

# Or delete namespace (deletes everything)
kubectl delete namespace minidrive

# Note: PVCs may need manual deletion if using retain policy
kubectl get pvc -n minidrive
kubectl delete pvc <pvc-name> -n minidrive
```

---

## Quick Reference

### Common Commands

```bash
# View all resources
kubectl get all -n minidrive

# Restart deployment
kubectl rollout restart deployment/minidrive-app -n minidrive

# View logs
kubectl logs -f deployment/minidrive-app -n minidrive

# Scale
kubectl scale deployment/minidrive-app --replicas=3 -n minidrive

# Execute command in pod
kubectl exec -it deployment/minidrive-app -n minidrive -- sh

# Port forward
kubectl port-forward -n minidrive svc/minidrive-service 3001:80
```

### File Order for Deployment

1. `00-namespace.yaml` - Namespace
2. `01-secret.yaml` - Secrets
3. `02-configmap.yaml` - Configuration
4. `03-postgres-pvc.yaml` - PostgreSQL storage
5. `04-minio-pvc.yaml` - MinIO storage
6. `05-postgres-deployment.yaml` - PostgreSQL database
7. `06-minio-deployment.yaml` - MinIO object storage
8. `07-minio-init-job.yaml` - MinIO bucket initialization
9. `08-app-deployment.yaml` - Application
10. `09-ingress.yaml` - External access

---

## Support

For issues or questions:
- Check application logs: `kubectl logs -f deployment/minidrive-app -n minidrive`
- Review troubleshooting section above
- Check Kubernetes events: `kubectl get events -n minidrive`

---

**Last Updated**: December 2024
**Kubernetes Version**: 1.24+
**Application**: MiniDrive Backend
