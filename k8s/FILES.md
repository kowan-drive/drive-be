# Kubernetes Configuration Files

This document describes all the Kubernetes configuration files for MiniDrive deployment.

## Configuration Files (Apply in Order)

### 1. `00-namespace.yaml`
Creates the `minidrive` namespace for all resources.

```bash
kubectl apply -f 00-namespace.yaml
```

### 2. `01-secret.yaml`
Contains sensitive credentials (template file - update before use):
- PostgreSQL credentials
- MinIO credentials  
- Encryption keys
- Session secrets

**⚠️ IMPORTANT**: Do not commit with real secrets! Use `setup-secrets.sh` instead.

```bash
# Option A: Use the helper script (recommended)
./setup-secrets.sh

# Option B: Edit and apply manually
kubectl apply -f 01-secret.yaml
```

### 3. `02-configmap.yaml`
Contains non-sensitive configuration:
- Server settings (PORT, NODE_ENV)
- URLs and domains
- CORS settings
- WebAuthn configuration
- MinIO settings

**⚠️ UPDATE**: Replace placeholder domains with your actual domains.

```bash
kubectl apply -f 02-configmap.yaml
```

### 4. `03-postgres-pvc.yaml`
Persistent Volume Claim for PostgreSQL (10Gi).

```bash
kubectl apply -f 03-postgres-pvc.yaml
```

### 5. `04-minio-pvc.yaml`
Persistent Volume Claim for MinIO (20Gi).

```bash
kubectl apply -f 04-minio-pvc.yaml
```

### 6. `05-postgres-deployment.yaml`
PostgreSQL deployment and service:
- 1 replica (stateful)
- Health checks (liveness/readiness probes)
- Resource limits
- ClusterIP service on port 5432

```bash
kubectl apply -f 05-postgres-deployment.yaml
kubectl wait --for=condition=ready pod -l app=postgres -n minidrive --timeout=120s
```

### 7. `06-minio-deployment.yaml`
MinIO deployment and service:
- 1 replica (stateful)
- API port 9000, Console port 9001
- Health checks
- Resource limits
- ClusterIP service

```bash
kubectl apply -f 06-minio-deployment.yaml
kubectl wait --for=condition=ready pod -l app=minio -n minidrive --timeout=120s
```

### 8. `07-minio-init-job.yaml`
Kubernetes Job to initialize MinIO:
- Waits for MinIO to be ready
- Creates the storage bucket
- Sets bucket policy to private

```bash
kubectl apply -f 07-minio-init-job.yaml
kubectl wait --for=condition=complete job/minio-init -n minidrive --timeout=120s
```

### 9. `08-app-deployment.yaml`
MiniDrive application deployment and service:
- 2 replicas (scalable)
- Init containers:
  - Wait for PostgreSQL
  - Wait for MinIO
  - Run Prisma migrations
- Health checks (HTTP probes)
- Resource limits
- ClusterIP service on port 80

**⚠️ UPDATE**: Replace `your-docker-registry/minidrive-app:latest` with your actual image.

```bash
kubectl apply -f 08-app-deployment.yaml
kubectl wait --for=condition=ready pod -l app=minidrive -n minidrive --timeout=180s
```

### 10. `09-ingress.yaml`
Ingress resources for external access:
- Main API ingress (api.your-domain.com)
- MinIO Console ingress (minio-console.your-domain.com)
- TLS/HTTPS configuration (optional, commented)
- Ingress controller annotations

**⚠️ UPDATE**: Replace placeholder domains with your actual domains.

```bash
kubectl apply -f 09-ingress.yaml
```

### 11. `10-prometheus-configmap.yaml`
Prometheus configuration:
- Scrape intervals and retention
- Kubernetes service discovery
- Application metrics scraping
- Container metrics (cAdvisor)

```bash
kubectl apply -f 10-prometheus-configmap.yaml
```

### 12. `11-prometheus-deployment.yaml`
Prometheus deployment:
- Service account with RBAC
- Persistent storage (10Gi, 30 days retention)
- Scrapes metrics from all components
- ClusterIP service on port 9090

```bash
kubectl apply -f 11-prometheus-deployment.yaml
```

### 13. `12-loki-deployment.yaml`
Loki log aggregation:
- Persistent storage (10Gi, 30 days retention)
- Collects logs from all pods
- Integrated with Grafana

```bash
kubectl apply -f 12-loki-deployment.yaml
```

### 14. `13-tempo-deployment.yaml`
Tempo distributed tracing:
- OTLP receiver (gRPC and HTTP)
- Persistent storage (10Gi, 1 hour retention)
- Integrated with Grafana

```bash
kubectl apply -f 13-tempo-deployment.yaml
```

### 15. `14-grafana-datasources.yaml`
Grafana datasource configuration:
- Prometheus datasource
- Loki datasource
- Tempo datasource
- Trace-to-log correlation

```bash
kubectl apply -f 14-grafana-datasources.yaml
```

### 16. `15-promtail-deployment.yaml`
Promtail log collection:
- DaemonSet (runs on each node)
- Collects pod logs
- Sends logs to Loki
- Service account with RBAC

```bash
kubectl apply -f 15-promtail-deployment.yaml
```

### 17. `16-grafana-deployment.yaml`
Grafana dashboard:
- Persistent storage (5Gi)
- Pre-configured datasources
- Pre-built MiniDrive dashboard
- Admin credentials via secret

**⚠️ UPDATE**: Change Grafana admin password in secret.

```bash
kubectl apply -f 16-grafana-deployment.yaml
```

### 18. `17-grafana-dashboards.yaml`
Grafana dashboard provisioning:
- Dashboard provider configuration
- MiniDrive monitoring dashboard JSON
- Auto-loaded on Grafana startup

```bash
kubectl apply -f 17-grafana-dashboards.yaml
```

### 19. `18-monitoring-ingress.yaml`
Ingress for monitoring tools:
- Grafana dashboard (grafana.your-domain.com)
- Prometheus UI (prometheus.your-domain.com, optional)
- TLS/HTTPS configuration

**⚠️ UPDATE**: Replace placeholder domains with your actual domains.

```bash
kubectl apply -f 18-monitoring-ingress.yaml
```

## Helper Scripts

### `setup-secrets.sh`
Interactive script to generate and apply secure secrets.

Features:
- Generates cryptographically secure random secrets
- Creates Kubernetes secret directly (no file with secrets)
- Optional backup to local file
- Updates existing secrets
- Restarts deployments to apply new secrets

```bash
./setup-secrets.sh
```

### `deploy.sh`
Automated deployment script that applies all configurations in order.

Features:
- Applies all manifests in the correct order
- Waits for resources to be ready
- Validates deployment status
- Provides helpful output

```bash
./deploy.sh
```

### `rollout.sh`
Manages application updates and rollbacks.

Features:
- Rolling restart: `./rollout.sh restart`
- Update image: `./rollout.sh update v1.2.0`
- Check status: `./rollout.sh status`
- View history: `./rollout.sh history`
- Rollback: `./rollout.sh undo [revision]`
- Pause/resume: `./rollout.sh pause|resume`
- Scale: `./rollout.sh scale <replicas>`

```bash
./rollout.sh restart
./rollout.sh update v1.2.0
./rollout.sh undo
./rollout.sh scale 5
```

## Documentation

### `README.md`
Comprehensive deployment guide covering:
- Prerequisites and architecture
- Environment variables and secrets management
- Initial deployment steps
- Domain configuration and TLS setup
- Rolling updates and rollbacks
- Troubleshooting
- Scaling strategies
- Monitoring and backup

### `QUICKSTART.md`
Condensed quick-start guide for rapid deployment:
- 5-step deployment process
- Common operations
- Troubleshooting commands
- Security notes

### `MONITORING.md`
Complete monitoring stack documentation:
- Prometheus, Loki, Tempo, Grafana setup
- Dashboard configuration
- Metrics, logs, and traces
- Troubleshooting and tuning

### `FILES.md` (this file)
Reference documentation for all configuration files.

### `.gitignore`
Protects sensitive files from being committed:
- `secrets.env`
- `01-secret.yaml.local`
- `*.backup`
- `*.local`

## Resource Summary

| Resource Type | Name | Purpose | Replicas | Storage |
|--------------|------|---------|----------|---------|
| Namespace | minidrive | Resource isolation | - | - |
| Secret | minidrive-secrets | Sensitive credentials | - | - |
| ConfigMap | minidrive-config | Configuration | - | - |
| PVC | postgres-pvc | PostgreSQL data | - | 10Gi |
| PVC | minio-pvc | MinIO data | - | 20Gi |
| Deployment | postgres | Database | 1 | - |
| Deployment | minio | Object storage | 1 | - |
| Deployment | minidrive-app | Application | 2 | - |
| Service | postgres-service | DB access | - | - |
| Service | minio-service | Storage access | - | - |
| Service | minidrive-service | App access | - | - |
| Job | minio-init | Bucket setup | 1 | - |
| Ingress | minidrive-ingress | External access | - | - |
| Ingress | minio-console-ingress | Admin access | - | - |
| Ingress | grafana-ingress | Grafana access | - | - |
| Deployment | prometheus | Metrics collection | 1 | 10Gi |
| Deployment | loki | Log aggregation | 1 | 10Gi |
| Deployment | tempo | Distributed tracing | 1 | 10Gi |
| Deployment | grafana | Dashboards | 1 | 5Gi |
| DaemonSet | promtail | Log collection | 1/node | - |
| Service | prometheus-service | Prometheus access | - | - |
| Service | loki-service | Loki access | - | - |
| Service | tempo-service | Tempo access | - | - |
| Service | grafana-service | Grafana access | - | - |

## Port Mapping

| Service | Internal Port | External Access |
|---------|--------------|----------------|
| PostgreSQL | 5432 | Internal only (ClusterIP) |
| MinIO API | 9000 | Internal only (ClusterIP) |
| MinIO Console | 9001 | Via ingress (optional) |
| MiniDrive App | 3001 | Via ingress (port 80/443) |
| Prometheus | 9090 | Internal only (ClusterIP) |
| Loki | 3100 | Internal only (ClusterIP) |
| Tempo | 3200 | Internal only (ClusterIP) |
| Grafana | 3000 | Via ingress (optional) |
| Prometheus | 9090 | Via ingress (optional) |
| Grafana | 3000 | Via ingress (port 80/443) |
| Loki | 3100 | Internal only (ClusterIP) |
| Tempo | 3200 | Internal only (ClusterIP) |
| Promtail | 3101 | Internal only (ClusterIP) |

## Environment Variables

### From Secret (01-secret.yaml)
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `DATABASE_URL`
- `MINIO_ROOT_USER`
- `MINIO_ROOT_PASSWORD`
- `MASTER_ENCRYPTION_KEY`
- `SESSION_SECRET`

### From ConfigMap (02-configmap.yaml)
- `PORT`
- `NODE_ENV`
- `APP_URL`
- `FRONTEND_URL`
- `PODS_APP_WHITELIST`
- `MINIO_ENDPOINT`
- `MINIO_PORT`
- `MINIO_USE_SSL`
- `MINIO_BUCKET_NAME`
- `WEBAUTHN_RP_NAME`
- `WEBAUTHN_RP_ID`
- `WEBAUTHN_ORIGIN`
- `SESSION_EXPIRY_HOURS`

## Deployment Order

1. Namespace (isolation)
2. Secrets & ConfigMaps (configuration)
3. PVCs (storage)
4. Databases (PostgreSQL, MinIO)
5. MinIO initialization (bucket creation)
6. Application (MiniDrive backend)
7. Ingress (external access)
8. Monitoring stack (Prometheus, Loki, Tempo, Promtail, Grafana) - optional

## Common Commands

```bash
# View all resources
kubectl get all -n minidrive

# Check pod status
kubectl get pods -n minidrive

# View logs
kubectl logs -f deployment/minidrive-app -n minidrive

# Describe resource
kubectl describe pod <pod-name> -n minidrive

# Execute command in pod
kubectl exec -it deployment/minidrive-app -n minidrive -- sh

# Port forward for local testing
kubectl port-forward -n minidrive deployment/minidrive-app 3001:3001

# Scale application
kubectl scale deployment/minidrive-app --replicas=5 -n minidrive

# Restart deployment
kubectl rollout restart deployment/minidrive-app -n minidrive

# Rollback deployment
kubectl rollout undo deployment/minidrive-app -n minidrive

# View events
kubectl get events -n minidrive --sort-by='.lastTimestamp'
```

## Security Best Practices

1. **Never commit secrets to Git**
   - Use `.gitignore` for sensitive files
   - Use `setup-secrets.sh` to generate secrets
   - Store backups in a secure password manager

2. **Use strong secrets**
   - Minimum 32 characters for passwords
   - Minimum 48 characters for encryption keys
   - Use cryptographically secure random generation

3. **Enable TLS/HTTPS**
   - Use cert-manager for automated certificates
   - Or provide your own TLS certificates
   - Never expose services without TLS in production

4. **Follow least privilege**
   - Use RBAC for service accounts
   - Limit pod-to-pod communication with NetworkPolicies
   - Run containers as non-root (if possible)

5. **Regular updates**
   - Keep container images updated
   - Monitor security advisories
   - Regularly rotate secrets

## Troubleshooting Quick Reference

| Issue | Command | Solution |
|-------|---------|----------|
| Pod not starting | `kubectl describe pod <pod> -n minidrive` | Check events and logs |
| ImagePullBackOff | `kubectl describe pod <pod> -n minidrive` | Check image name and registry access |
| CrashLoopBackOff | `kubectl logs <pod> -n minidrive` | Check application logs and config |
| Database connection | `kubectl logs deployment/postgres -n minidrive` | Verify PostgreSQL is running |
| Storage issues | `kubectl get pvc -n minidrive` | Check PVC status and storage class |
| Ingress not working | `kubectl describe ingress -n minidrive` | Check ingress controller and DNS |

## Clean Up

```bash
# Delete everything
kubectl delete namespace minidrive

# Or delete individually (in reverse order)
kubectl delete -f 09-ingress.yaml
kubectl delete -f 08-app-deployment.yaml
kubectl delete -f 07-minio-init-job.yaml
kubectl delete -f 06-minio-deployment.yaml
kubectl delete -f 05-postgres-deployment.yaml
kubectl delete -f 04-minio-pvc.yaml
kubectl delete -f 03-postgres-pvc.yaml
kubectl delete -f 02-configmap.yaml
kubectl delete -f 01-secret.yaml
kubectl delete -f 00-namespace.yaml

# PVCs might need manual deletion
kubectl get pvc -n minidrive
kubectl delete pvc postgres-pvc minio-pvc -n minidrive
```

## Next Steps

After deployment:

1. **Configure DNS** - Point your domain to the ingress IP
2. **Enable TLS** - Setup cert-manager or upload certificates
3. **Monitor** - Monitoring stack is ready (see [MONITORING.md](./MONITORING.md))
4. **Backup** - Configure automated database backups
5. **CI/CD** - Setup automated deployments
6. **Autoscaling** - Configure HPA for dynamic scaling
7. **Change Grafana password** - Update default admin credentials

## Support

For issues or questions:
- Check [README.md](./README.md) for detailed documentation
- Check [QUICKSTART.md](./QUICKSTART.md) for quick reference
- Check [MONITORING.md](./MONITORING.md) for monitoring setup
- Review pod logs: `kubectl logs -f deployment/minidrive-app -n minidrive`
- Check events: `kubectl get events -n minidrive`

---

**Last Updated**: December 2024  
**Kubernetes Version**: 1.24+  
**Application**: MiniDrive Backend
