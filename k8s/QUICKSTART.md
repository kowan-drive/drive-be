# MiniDrive Kubernetes Quick Start Guide

This is a quick reference for deploying MiniDrive to Kubernetes. For detailed documentation, see [README.md](./README.md).

## Prerequisites

- Kubernetes cluster (v1.24+)
- kubectl configured
- Docker registry access
- Domain name

## Quick Deployment (5 Steps)

### 1. Build and Push Docker Image

```bash
cd /path/to/drive-be
docker build -t your-registry/minidrive-app:v1.0.0 .
docker push your-registry/minidrive-app:v1.0.0
docker tag your-registry/minidrive-app:v1.0.0 your-registry/minidrive-app:latest
docker push your-registry/minidrive-app:latest
```

### 2. Update Image in Deployment

Edit `k8s/08-app-deployment.yaml`:

```yaml
image: your-registry/minidrive-app:latest  # Change this line
```

### 3. Configure Your Domain

Edit `k8s/02-configmap.yaml`:

```yaml
APP_URL: "https://api.your-domain.com"
FRONTEND_URL: "https://your-frontend.com"
PODS_APP_WHITELIST: "https://your-frontend.com"
WEBAUTHN_RP_ID: "your-domain.com"
WEBAUTHN_ORIGIN: "https://api.your-domain.com"
```

Edit `k8s/09-ingress.yaml`:

```yaml
- host: api.your-domain.com  # Change this
```

### 4. Setup Secrets (Choose One)

**Option A: Automated (Recommended)**

```bash
cd k8s
./setup-secrets.sh
```

**Option B: Manual**

```bash
cd k8s

# Generate secrets
POSTGRES_PWD=$(openssl rand -base64 32)
MINIO_PWD=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 48)
SESSION_SECRET=$(openssl rand -base64 32)

# Create Kubernetes secret
kubectl create secret generic minidrive-secrets \
  --namespace=minidrive \
  --from-literal=POSTGRES_USER='minidrive' \
  --from-literal=POSTGRES_PASSWORD="${POSTGRES_PWD}" \
  --from-literal=POSTGRES_DB='minidrive' \
  --from-literal=DATABASE_URL="postgresql://minidrive:${POSTGRES_PWD}@postgres-service:5432/minidrive?schema=public" \
  --from-literal=MINIO_ROOT_USER='minioadmin' \
  --from-literal=MINIO_ROOT_PASSWORD="${MINIO_PWD}" \
  --from-literal=MASTER_ENCRYPTION_KEY="${ENCRYPTION_KEY}" \
  --from-literal=SESSION_SECRET="${SESSION_SECRET}" \
  --dry-run=client -o yaml | kubectl apply -f -
```

### 5. Deploy Everything

```bash
cd k8s
./deploy.sh
```

**Or manually:**

```bash
kubectl apply -f 00-namespace.yaml
kubectl apply -f 02-configmap.yaml
kubectl apply -f 03-postgres-pvc.yaml
kubectl apply -f 04-minio-pvc.yaml
kubectl apply -f 05-postgres-deployment.yaml
kubectl apply -f 06-minio-deployment.yaml

# Wait for databases
kubectl wait --for=condition=ready pod -l app=postgres -n minidrive --timeout=120s
kubectl wait --for=condition=ready pod -l app=minio -n minidrive --timeout=120s

kubectl apply -f 07-minio-init-job.yaml
kubectl wait --for=condition=complete job/minio-init -n minidrive --timeout=120s

kubectl apply -f 08-app-deployment.yaml
kubectl wait --for=condition=ready pod -l app=minidrive -n minidrive --timeout=180s

kubectl apply -f 09-ingress.yaml
```

## Configure DNS

Get your ingress IP:

```bash
kubectl get ingress -n minidrive
```

Point your domain A record:
- `api.your-domain.com` → Ingress IP

## Setup TLS/HTTPS

### Using cert-manager (Automated)

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Create Let's Encrypt issuer
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: traefik
EOF

# Update ingress to use cert-manager
# Add to 09-ingress.yaml metadata.annotations:
#   cert-manager.io/cluster-issuer: "letsencrypt-prod"
# Add to spec:
#   tls:
#   - hosts:
#     - api.your-domain.com
#     secretName: minidrive-tls-cert

kubectl apply -f k8s/09-ingress.yaml
```

## Verify Deployment

```bash
# Check all resources
kubectl get all -n minidrive

# Check pods
kubectl get pods -n minidrive

# Check logs
kubectl logs -f deployment/minidrive-app -n minidrive

# Test the API
curl https://api.your-domain.com
```

## Common Operations

### View Logs

```bash
kubectl logs -f deployment/minidrive-app -n minidrive
```

### Restart Application

```bash
./rollout.sh restart
# or
kubectl rollout restart deployment/minidrive-app -n minidrive
```

### Update to New Version

```bash
# Build and push new version
docker build -t your-registry/minidrive-app:v1.1.0 .
docker push your-registry/minidrive-app:v1.1.0

# Deploy
./rollout.sh update v1.1.0
```

### Scale Application

```bash
./rollout.sh scale 5
# or
kubectl scale deployment/minidrive-app --replicas=5 -n minidrive
```

### Update Secrets

```bash
./setup-secrets.sh
```

### Rollback

```bash
./rollout.sh undo
# or
kubectl rollout undo deployment/minidrive-app -n minidrive
```

## Troubleshooting

### Check Pod Status

```bash
kubectl get pods -n minidrive
kubectl describe pod <pod-name> -n minidrive
```

### View Logs

```bash
kubectl logs <pod-name> -n minidrive
kubectl logs -f deployment/minidrive-app -n minidrive
kubectl logs deployment/postgres -n minidrive
kubectl logs deployment/minio -n minidrive
```

### Check Events

```bash
kubectl get events -n minidrive --sort-by='.lastTimestamp'
```

### Port Forward (Local Testing)

```bash
kubectl port-forward -n minidrive deployment/minidrive-app 3001:3001
kubectl port-forward -n minidrive deployment/minio 9001:9001
```

### Access Pod Shell

```bash
kubectl exec -it deployment/minidrive-app -n minidrive -- sh
```

## Cleanup

```bash
kubectl delete namespace minidrive
# Manual PVC cleanup if needed
kubectl delete pvc postgres-pvc minio-pvc -n minidrive
```

## Helper Scripts

- `deploy.sh` - Initial deployment
- `rollout.sh` - Manage updates and rollbacks
- `setup-secrets.sh` - Generate and apply secrets

## Important Security Notes

1. **Never commit secrets** to version control
2. Use **strong passwords** (generated by `setup-secrets.sh`)
3. Store backup secrets in a **secure password manager**
4. Enable **TLS/HTTPS** before going to production
5. Regularly **rotate secrets**

## Next Steps

- Setup monitoring (Prometheus/Grafana)
- Configure backup strategy
- Setup CI/CD pipeline
- Configure autoscaling (HPA)

For detailed documentation, see [README.md](./README.md)
