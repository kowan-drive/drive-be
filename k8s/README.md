# MiniDrive Kubernetes Deployment Guide

Complete guide for deploying MiniDrive backend to Kubernetes (k3s) with Traefik ingress, optimized for 8GB RAM and 60GB storage.

## Table of Contents

- [Quick Start](#quick-start)
- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Initial Setup](#initial-setup)
- [Deployment](#deployment)
- [Configuration Files](#configuration-files)
- [Monitoring Stack](#monitoring-stack)
- [Operations](#operations)
- [Troubleshooting](#troubleshooting)
- [Resource Management](#resource-management)

---

## Quick Start

**For experienced users - 5 steps to deploy:**

```bash
# 1. Build and push your Docker image
docker build -t your-registry/minidrive-app:v1.0.0 .
docker push your-registry/minidrive-app:v1.0.0

# 2. Update image reference in k8s/08-app-deployment.yaml
# Change: image: andrew4coding/minidrive-app:latest

# 3. Setup secrets
cd k8s
./setup-secrets.sh

# 4. Deploy everything
./deploy.sh

# 5. Configure DNS
# Point api-vibecloud.andrewaryo.com and grafana-vibecloud.andrewaryo.com to your ingress IP
```

**Verify deployment:**
```bash
kubectl get all -n minidrive
kubectl logs -f deployment/minidrive-app -n minidrive
```

---

## Architecture Overview

### Components

The deployment includes:

- **PostgreSQL** (1 replica) - User data and metadata storage
- **MinIO** (1 replica) - Object storage for files
- **MiniDrive App** (1 replica) - Backend application
- **Traefik Ingress** - External access (k3s default)
- **Monitoring Stack** (optional):
  - Prometheus - Metrics collection
  - Loki - Log aggregation
  - Tempo - Distributed tracing
  - Grafana - Visualization dashboard
  - Promtail - Log collection agent

### Resource Allocation

**Optimized for 8GB RAM / 60GB Storage:**

| Component | RAM Request | RAM Limit | Storage | CPU Request | CPU Limit |
|-----------|-------------|-----------|---------|-------------|-----------|
| App | 128Mi | 256Mi | - | 100m | 250m |
| PostgreSQL | 128Mi | 256Mi | 5Gi | 100m | 250m |
| MinIO | 128Mi | 512Mi | 15Gi | 100m | 500m |
| **Monitoring:** | | | | | |
| Prometheus | 256Mi | 1Gi | 5Gi | 100m | 500m |
| Loki | 128Mi | 512Mi | 3Gi | 100m | 500m |
| Tempo | 128Mi | 512Mi | 2Gi | 100m | 500m |
| Grafana | 128Mi | 512Mi | 2Gi | 100m | 500m |
| **Total** | **~1.2GB** | **~4.5GB** | **~32GB** | - | - |

### Domains

- **API**: `api-vibecloud.andrewaryo.com`
- **Grafana**: `grafana-vibecloud.andrewaryo.com`
- **MinIO Console**: `minio-vibecloud.andrewaryo.com` (optional)
- **Prometheus**: `prometheus-vibecloud.andrewaryo.com` (optional)

---

## Prerequisites

- **Kubernetes cluster**: v1.24+ (k3s recommended)
- **kubectl** configured to access your cluster
- **Docker** for building images
- **Docker registry** access (Docker Hub, GitHub Container Registry, etc.)
- **Domain names** pointing to your cluster
- **8GB RAM** and **60GB storage** available
- **Traefik** ingress controller (included with k3s)

### Verify Cluster

```bash
kubectl cluster-info
kubectl get nodes
kubectl get ingressclass  # Should show 'traefik'
```

---

## Initial Setup

### 1. Build and Push Docker Image

```bash
# Navigate to drive-be directory
cd /path/to/drive-be

# Build the Docker image
docker build -t your-registry/minidrive-app:v1.0.0 .

# Push to your registry
docker push your-registry/minidrive-app:v1.0.0

# Tag as latest
docker tag your-registry/minidrive-app:v1.0.0 your-registry/minidrive-app:latest
docker push your-registry/minidrive-app:latest
```

### 2. Update Image References

Edit `k8s/08-app-deployment.yaml` (lines 49 and 72):

```yaml
image: your-registry/minidrive-app:latest  # Update this
```

### 3. Setup Secrets

**Option A: Automated (Recommended)**

```bash
cd k8s
./setup-secrets.sh
```

**Option B: Manual**

```bash
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

**Save your passwords securely!**

### 4. Configure Frontend URL (Optional)

Edit `k8s/02-configmap.yaml` if you have a frontend:

```yaml
FRONTEND_URL: "https://your-frontend-domain.com"
PODS_APP_WHITELIST: "https://your-frontend-domain.com"
```

---

## Deployment

### Automated Deployment

```bash
cd k8s
./deploy.sh
```

### Manual Deployment

```bash
cd k8s

# Apply in order
kubectl apply -f 00-namespace.yaml
kubectl apply -f 02-configmap.yaml
kubectl apply -f 03-postgres-pvc.yaml
kubectl apply -f 04-minio-pvc.yaml
kubectl apply -f 05-postgres-deployment.yaml
kubectl apply -f 06-minio-deployment.yaml

# Wait for databases
kubectl wait --for=condition=ready pod -l app=postgres -n minidrive --timeout=120s
kubectl wait --for=condition=ready pod -l app=minio -n minidrive --timeout=120s

# Initialize MinIO bucket
kubectl apply -f 07-minio-init-job.yaml
kubectl wait --for=condition=complete job/minio-init -n minidrive --timeout=120s

# Deploy application
kubectl apply -f 08-app-deployment.yaml
kubectl wait --for=condition=ready pod -l app=minidrive -n minidrive --timeout=180s

# Apply ingress
kubectl apply -f 09-ingress.yaml
```

### DNS Configuration

Get your ingress IP:

```bash
kubectl get ingress -n minidrive
# or
kubectl get svc -n kube-system traefik
```

Create DNS A records:
- `api-vibecloud.andrewaryo.com` → Ingress IP
- `grafana-vibecloud.andrewaryo.com` → Ingress IP
- `minio-vibecloud.andrewaryo.com` → Ingress IP (optional)

### TLS/HTTPS Setup (Recommended)

**Using cert-manager:**

```bash
# Install cert-manager (if not installed)
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
```

Uncomment TLS sections in ingress files (`09-ingress.yaml`, `18-monitoring-ingress.yaml`) and apply.

---

## Configuration Files

### Deployment Order

1. `00-namespace.yaml` - Creates `minidrive` namespace
2. `01-secret.yaml` - Sensitive credentials (use `setup-secrets.sh` instead)
3. `02-configmap.yaml` - Non-sensitive configuration
4. `03-postgres-pvc.yaml` - PostgreSQL storage (5Gi)
5. `04-minio-pvc.yaml` - MinIO storage (15Gi)
6. `05-postgres-deployment.yaml` - PostgreSQL database
7. `06-minio-deployment.yaml` - MinIO object storage
8. `07-minio-init-job.yaml` - MinIO bucket initialization
9. `08-app-deployment.yaml` - MiniDrive application (1 replica)
10. `09-ingress.yaml` - Traefik ingress for API, MinIO, and Grafana

### Helper Scripts

- **`deploy.sh`** - Automated initial deployment
- **`rollout.sh`** - Manage updates and rollbacks
- **`setup-secrets.sh`** - Generate and apply secure secrets

---

## Monitoring Stack

### Deployment

```bash
cd k8s

# Deploy monitoring components
kubectl apply -f 10-prometheus-configmap.yaml
kubectl apply -f 11-prometheus-deployment.yaml
kubectl apply -f 12-loki-deployment.yaml
kubectl apply -f 13-tempo-deployment.yaml
kubectl apply -f 15-promtail-deployment.yaml
kubectl apply -f 14-grafana-datasources.yaml
kubectl apply -f 17-grafana-dashboards.yaml
kubectl apply -f 16-grafana-deployment.yaml
kubectl apply -f 18-monitoring-ingress.yaml

# Set Grafana password
GRAFANA_PASSWORD=$(openssl rand -base64 32)
kubectl create secret generic grafana-admin \
  --namespace=minidrive \
  --from-literal=admin-user='admin' \
  --from-literal=admin-password="${GRAFANA_PASSWORD}" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "Grafana password: ${GRAFANA_PASSWORD}"
```

### Access Grafana

URL: `https://grafana-vibecloud.andrewaryo.com`

**Login:**
- Username: `admin`
- Password: (from setup step above)

### Pre-built Dashboard

Navigate to **Dashboards** → **MiniDrive Monitoring Dashboard**

**Includes:**
- Application CPU & memory usage
- HTTP request metrics & latency
- PostgreSQL & MinIO pod status
- Storage usage
- Application logs (from Loki)
- Distributed traces (from Tempo)

### Monitoring Features

**Prometheus** (15-day retention):
- Metrics from all pods
- Container resource usage
- Kubernetes cluster metrics

**Loki** (15-day retention):
- Centralized logging
- Pod log aggregation
- LogQL query interface

**Tempo**:
- Distributed tracing via OTLP
- Trace-to-log correlation

**Promtail**:
- DaemonSet log collector
- Automatic pod discovery

### Resource Tuning

If monitoring uses too many resources, you can:

1. **Reduce retention periods** in config files
2. **Disable unused components** (e.g., Tempo if not using traces)
3. **Lower resource limits** further in deployment files

---

## Operations

### View Logs

```bash
# Application logs
kubectl logs -f deployment/minidrive-app -n minidrive

# PostgreSQL logs
kubectl logs deployment/postgres -n minidrive

# MinIO logs
kubectl logs deployment/minio -n minidrive

# All pods
kubectl get pods -n minidrive
kubectl logs <pod-name> -n minidrive
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
# or
kubectl set image deployment/minidrive-app app=your-registry/minidrive-app:v1.1.0 -n minidrive
kubectl rollout status deployment/minidrive-app -n minidrive
```

### Rollback

```bash
./rollout.sh undo
# or
kubectl rollout undo deployment/minidrive-app -n minidrive
```

### Scaling

**Note:** Due to RAM constraints, scaling beyond 1 replica may cause resource issues.

```bash
# Scale to 2 replicas (check RAM usage first!)
kubectl scale deployment/minidrive-app --replicas=2 -n minidrive

# Monitor resource usage
kubectl top pods -n minidrive
kubectl top nodes
```

### Update Secrets

```bash
./setup-secrets.sh
# Then restart pods
kubectl rollout restart deployment/minidrive-app -n minidrive
```

---

## Troubleshooting

### Check Pod Status

```bash
kubectl get pods -n minidrive
kubectl describe pod <pod-name> -n minidrive
kubectl logs <pod-name> -n minidrive
kubectl logs <pod-name> -n minidrive --previous  # Previous crashed container
```

### Common Issues

#### 1. ImagePullBackOff

```bash
# Check if image exists
docker pull your-registry/minidrive-app:latest

# For private registries, create secret
kubectl create secret docker-registry regcred \
  --docker-server=your-registry \
  --docker-username=your-username \
  --docker-password=your-password \
  --namespace=minidrive

# Add to deployment spec.template.spec.imagePullSecrets
```

#### 2. CrashLoopBackOff

```bash
# Check logs
kubectl logs -f deployment/minidrive-app -n minidrive

# Common causes:
# - Database not ready (check postgres logs)
# - MinIO not ready (check minio logs)
# - Missing environment variables
# - Incorrect DATABASE_URL
```

#### 3. OOMKilled (Out of Memory)

```bash
# Check resource usage
kubectl top pods -n minidrive

# Reduce other components or increase node RAM
# Consider disabling monitoring stack temporarily
```

#### 4. Ingress Not Working

```bash
# Check ingress status
kubectl get ingress -n minidrive
kubectl describe ingress minidrive-ingress -n minidrive

# Check Traefik logs (k3s)
kubectl logs -n kube-system -l app.kubernetes.io/name=traefik

# Verify DNS
nslookup api-vibecloud.andrewaryo.com
```

#### 5. Storage Issues

```bash
# Check PVC status
kubectl get pvc -n minidrive

# Check storage class (k3s uses 'local-path' by default)
kubectl get storageclass

# Check available storage on node
df -h
```

### Port Forwarding (Local Testing)

```bash
# Test application locally
kubectl port-forward -n minidrive deployment/minidrive-app 3001:3001
# Visit http://localhost:3001

# MinIO console
kubectl port-forward -n minidrive deployment/minio 9001:9001

# Grafana
kubectl port-forward -n minidrive deployment/grafana 3000:3000
```

### View Events

```bash
kubectl get events -n minidrive --sort-by='.lastTimestamp'
```

### Access Pod Shell

```bash
kubectl exec -it deployment/minidrive-app -n minidrive -- sh
```

---

## Resource Management

### Current Allocation

**Total Storage:** ~32GB (out of 60GB available)
- PostgreSQL: 5Gi
- MinIO: 15Gi
- Prometheus: 5Gi
- Loki: 3Gi
- Tempo: 2Gi
- Grafana: 2Gi

**Total RAM (Requests):** ~1.2GB (out of 8GB available)
**Total RAM (Limits):** ~4.5GB (out of 8GB available)

### Optimization Tips

**If running low on RAM:**
1. Disable monitoring stack (saves ~1GB)
2. Reduce app/postgres/minio limits further
3. Monitor with `kubectl top` frequently

**If running low on storage:**
1. Reduce retention periods (Prometheus, Loki)
2. Reduce PVC sizes (requires recreating PVCs)
3. Disable Tempo (uses 2Gi)

### Monitoring Resource Usage

```bash
# Node resources
kubectl top nodes

# Pod resources
kubectl top pods -n minidrive

# PVC usage (requires metrics-server)
kubectl get pvc -n minidrive
```

### Backup and Restore

**Backup PostgreSQL:**

```bash
kubectl exec deployment/postgres -n minidrive -- \
  pg_dump -U minidrive minidrive > backup-$(date +%Y%m%d).sql
```

**Restore PostgreSQL:**

```bash
kubectl exec -i deployment/postgres -n minidrive -- \
  psql -U minidrive minidrive < backup-20241214.sql
```

---

## Security Best Practices

1. **Never commit secrets** - Use `.gitignore` for `secrets.env` and modified secret files
2. **Use strong passwords** - Generated by `setup-secrets.sh` (32+ characters)
3. **Enable TLS/HTTPS** - Use cert-manager for automated certificates
4. **Rotate secrets regularly** - Use `setup-secrets.sh` to update
5. **Limit ingress access** - Consider using basic auth or VPN
6. **Keep images updated** - Regularly rebuild and update application images
7. **Monitor security advisories** - Watch for CVEs in base images

---

## Cleanup

**Delete everything:**

```bash
# Delete namespace (removes all resources)
kubectl delete namespace minidrive

# Or delete individually
kubectl delete -f k8s/
```

**Manual PVC deletion (if needed):**

```bash
kubectl get pvc -n minidrive
kubectl delete pvc postgres-pvc minio-pvc -n minidrive
```

---

## Quick Reference

### Common Commands

```bash
# View all resources
kubectl get all -n minidrive

# View logs (follow)
kubectl logs -f deployment/minidrive-app -n minidrive

# Restart deployment
kubectl rollout restart deployment/minidrive-app -n minidrive

# Scale deployment
kubectl scale deployment/minidrive-app --replicas=2 -n minidrive

# Execute command in pod
kubectl exec -it deployment/minidrive-app -n minidrive -- sh

# Port forward for local access
kubectl port-forward -n minidrive svc/minidrive-service 3001:80
```

### Environment Variables

**From ConfigMap (`02-configmap.yaml`):**
- `PORT`, `NODE_ENV`, `APP_URL`, `FRONTEND_URL`
- `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_BUCKET_NAME`
- `WEBAUTHN_RP_NAME`, `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN`

**From Secret (via `setup-secrets.sh`):**
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DATABASE_URL`
- `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`
- `MASTER_ENCRYPTION_KEY`, `SESSION_SECRET`

### Port Mapping

| Service | Internal Port | External Access |
|---------|--------------|-----------------|
| App | 3001 | Via Traefik ingress (80/443) |
| PostgreSQL | 5432 | Internal only (ClusterIP) |
| MinIO API | 9000 | Internal only (ClusterIP) |
| MinIO Console | 9001 | Via Traefik ingress (optional) |
| Grafana | 3000 | Via Traefik ingress (80/443) |
| Prometheus | 9090 | Via Traefik ingress (optional) |
| Loki | 3100 | Internal only (ClusterIP) |
| Tempo | 3200 | Internal only (ClusterIP) |

---

## K3s Specific Notes

- **Traefik** is the default ingress controller (no need to install)
- **local-path** is the default storage class (dynamic provisioning)
- **Lightweight** design perfect for 8GB RAM constraint
- **Single-node** deployment works well with this configuration

---

## Support

For issues:
1. Check logs: `kubectl logs -f deployment/minidrive-app -n minidrive`
2. Check events: `kubectl get events -n minidrive`
3. Review this troubleshooting guide
4. Check Grafana dashboards (if monitoring enabled)

---

**Last Updated**: December 2024  
**Kubernetes Version**: 1.24+ (k3s compatible)  
**Ingress**: Traefik  
**Optimized for**: 8GB RAM / 60GB Storage

