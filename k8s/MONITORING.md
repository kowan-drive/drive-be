# MiniDrive Monitoring Stack

This guide covers the monitoring setup for MiniDrive using Prometheus, Loki, Tempo, and Grafana.

## Architecture

The monitoring stack consists of:

- **Prometheus**: Metrics collection and storage
- **Loki**: Log aggregation
- **Tempo**: Distributed tracing
- **Grafana**: Visualization and dashboards
- **Promtail**: Log collection agent (DaemonSet)

## Components

### Prometheus
- Collects metrics from Kubernetes pods, nodes, and services
- Stores metrics for 30 days
- Scrapes application metrics (if exposed)
- Scrapes container metrics via cAdvisor

### Loki
- Aggregates logs from all pods in the namespace
- Stores logs for 30 days (720h retention)
- Integrated with Grafana for log visualization

### Tempo
- Collects distributed traces via OTLP (OpenTelemetry Protocol)
- Stores traces for 1 hour (configurable)
- Integrated with Grafana for trace visualization

### Grafana
- Unified dashboard for metrics, logs, and traces
- Pre-configured datasources (Prometheus, Loki, Tempo)
- Pre-built MiniDrive monitoring dashboard
- Correlates metrics, logs, and traces

### Promtail
- DaemonSet that runs on each node
- Collects logs from pods
- Sends logs to Loki

## Deployment

### Step 1: Deploy Monitoring Stack

```bash
cd k8s

# Deploy in order
kubectl apply -f 10-prometheus-configmap.yaml
kubectl apply -f 11-prometheus-deployment.yaml
kubectl apply -f 12-loki-deployment.yaml
kubectl apply -f 13-tempo-deployment.yaml
kubectl apply -f 15-promtail-deployment.yaml
kubectl apply -f 14-grafana-datasources.yaml
kubectl apply -f 17-grafana-dashboards.yaml
kubectl apply -f 16-grafana-deployment.yaml

# Wait for services to be ready
kubectl wait --for=condition=ready pod -l app=prometheus -n minidrive --timeout=120s
kubectl wait --for=condition=ready pod -l app=loki -n minidrive --timeout=120s
kubectl wait --for=condition=ready pod -l app=tempo -n minidrive --timeout=120s
kubectl wait --for=condition=ready pod -l app=grafana -n minidrive --timeout=120s
```

### Step 2: Configure Grafana Admin Password

```bash
# Generate secure password
GRAFANA_PASSWORD=$(openssl rand -base64 32)

# Update secret
kubectl create secret generic grafana-admin \
  --namespace=minidrive \
  --from-literal=admin-user='admin' \
  --from-literal=admin-password="${GRAFANA_PASSWORD}" \
  --dry-run=client -o yaml | kubectl apply -f -

# Restart Grafana to pick up new password
kubectl rollout restart deployment/grafana -n minidrive

echo "Grafana password: ${GRAFANA_PASSWORD}"
```

### Step 3: Configure Ingress

Edit `18-monitoring-ingress.yaml` and update the domain:

```yaml
- host: grafana.your-domain.com  # Your domain
```

Apply ingress:

```bash
kubectl apply -f 18-monitoring-ingress.yaml
```

### Step 4: Access Grafana

1. Point DNS: `grafana.your-domain.com` → Ingress IP
2. Access: `https://grafana.your-domain.com`
3. Login:
   - Username: `admin`
   - Password: (from Step 2)

## Dashboard

### MiniDrive Monitoring Dashboard

The pre-built dashboard includes:

1. **Application Metrics**
   - CPU usage per pod
   - Memory usage per pod
   - Pod count statistics
   - HTTP request rate
   - HTTP request latency (95th percentile)

2. **Infrastructure Metrics**
   - PostgreSQL pod status
   - MinIO pod status
   - Storage usage (PostgreSQL & MinIO PVCs)
   - Network receive rate

3. **Logs**
   - Real-time application logs
   - Filterable by pod, namespace, container

4. **Traces** (when application sends traces)
   - Distributed trace visualization
   - Trace-to-log correlation

### Accessing the Dashboard

1. Login to Grafana
2. Navigate to **Dashboards** → **Browse**
3. Find **"MiniDrive Monitoring Dashboard"**
4. Or go directly: `https://grafana.your-domain.com/d/minidrive-monitoring`

## Metrics Collection

### Kubernetes Metrics (Automatic)

Prometheus automatically collects:
- Container CPU usage
- Container memory usage
- Network I/O
- Storage usage
- Pod status

### Application Metrics (Optional)

To expose custom application metrics:

1. **Add metrics endpoint to your application**

```typescript
// Example: Add to src/index.ts
import { prometheusRegistry } from '@hono/prometheus'; // or your metrics library

// Add metrics endpoint
index.get('/metrics', async (c) => {
  // Return Prometheus format metrics
  return c.text(await prometheusRegistry.metrics());
});
```

2. **Annotate pods** (already done in `08-app-deployment.yaml`):

```yaml
annotations:
  prometheus.io/scrape: "true"
  prometheus.io/port: "3001"
  prometheus.io/path: "/metrics"
```

3. **Prometheus will automatically discover and scrape**

### Common Metrics to Expose

- `http_requests_total` - Total HTTP requests
- `http_request_duration_seconds` - Request latency histogram
- `minio_operations_total` - MinIO operations count
- `database_queries_total` - Database query count
- `file_uploads_total` - File upload count
- `file_downloads_total` - File download count

## Log Collection

### Automatic Log Collection

Promtail (DaemonSet) automatically collects logs from:
- All pods in the `minidrive` namespace
- Container stdout/stderr
- Kubernetes system logs

### Viewing Logs in Grafana

1. Go to **Explore** in Grafana
2. Select **Loki** datasource
3. Use LogQL queries:

```logql
# All application logs
{namespace="minidrive", pod=~"minidrive-app-.*"}

# Error logs only
{namespace="minidrive", pod=~"minidrive-app-.*"} |= "error"

# Logs from specific pod
{namespace="minidrive", pod="minidrive-app-abc123"}

# Logs with specific label
{namespace="minidrive", container="app"}
```

### Log Retention

- Default: 30 days (720h)
- Configurable in `12-loki-deployment.yaml`:

```yaml
table_manager:
  retention_period: 720h  # Change this
```

## Distributed Tracing

### Setting Up Tracing

1. **Install OpenTelemetry SDK** in your application:

```bash
bun add @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/instrumentation
```

2. **Configure OTLP exporter**:

```typescript
// Example tracing setup
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-otlp-http';

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: 'http://tempo-service:4318/v1/traces',
  }),
  instrumentations: [/* your instrumentations */],
});

sdk.start();
```

3. **Traces will appear in Grafana**:
   - Go to **Explore** → Select **Tempo**
   - Search by service name, trace ID, or tags

### Trace-to-Log Correlation

Grafana automatically correlates traces with logs:
- Click on a span in a trace
- View related logs
- Jump from logs to traces

## Alerts (Optional)

### Setting Up Alertmanager

1. **Deploy Alertmanager**:

```bash
# Create alertmanager-config.yaml
kubectl create configmap alertmanager-config \
  --from-file=alertmanager.yml=alertmanager-config.yaml \
  -n minidrive
```

2. **Configure alerts in Prometheus**:

Edit `10-prometheus-configmap.yaml`:

```yaml
alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager-service:9093

rule_files:
  - "/etc/prometheus/alerts/*.yml"
```

3. **Create alert rules**:

```yaml
groups:
  - name: minidrive
    rules:
      - alert: HighCPUUsage
        expr: rate(container_cpu_usage_seconds_total{namespace="minidrive", pod=~"minidrive-app-.*"}[5m]) > 0.8
        for: 5m
        annotations:
          summary: "High CPU usage on {{ $labels.pod }}"
```

## Storage

### Persistent Volumes

Each component uses PVCs:

- **Prometheus**: 10Gi (30 days retention)
- **Loki**: 10Gi (30 days retention)
- **Tempo**: 10Gi (1 hour retention)
- **Grafana**: 5Gi (dashboards, settings)

### Scaling Storage

```bash
# Edit PVC (if storage class supports expansion)
kubectl edit pvc prometheus-pvc -n minidrive
# Change: storage: 20Gi

# Or create new PVC and migrate data
```

## Troubleshooting

### Prometheus Not Scraping

```bash
# Check Prometheus targets
kubectl port-forward -n minidrive svc/prometheus-service 9090:9090
# Open http://localhost:9090/targets

# Check Prometheus logs
kubectl logs -f deployment/prometheus -n minidrive
```

### Loki Not Receiving Logs

```bash
# Check Promtail logs
kubectl logs -f daemonset/promtail -n minidrive

# Check Loki logs
kubectl logs -f deployment/loki -n minidrive

# Test Loki API
kubectl port-forward -n minidrive svc/loki-service 3100:3100
curl http://localhost:3100/ready
```

### Grafana Not Loading Dashboard

```bash
# Check Grafana logs
kubectl logs -f deployment/grafana -n minidrive

# Verify datasources
kubectl get configmap grafana-datasources -n minidrive -o yaml

# Check dashboard configmap
kubectl get configmap grafana-dashboard-minidrive -n minidrive
```

### High Resource Usage

```bash
# Check resource usage
kubectl top pods -n minidrive

# Adjust resource limits in deployments:
# - 11-prometheus-deployment.yaml
# - 12-loki-deployment.yaml
# - 16-grafana-deployment.yaml
```

## Security

### Grafana Access

1. **Change default password** (see Step 2 above)
2. **Enable authentication**:
   - OAuth (GitHub, Google, etc.)
   - LDAP
   - Basic Auth via Ingress

3. **Restrict access**:
   - Use Ingress annotations for basic auth
   - Use NetworkPolicies
   - Use VPN/private network

### Prometheus Access

- Consider restricting Prometheus ingress
- Use RBAC to limit Prometheus service account
- Use NetworkPolicies

### Log Data

- Logs may contain sensitive information
- Consider log sanitization
- Use log retention policies
- Encrypt PVCs if needed

## Performance Tuning

### Prometheus

```yaml
# In 11-prometheus-deployment.yaml
args:
  - '--storage.tsdb.retention.time=15d'  # Reduce retention
  - '--storage.tsdb.max-block-duration=2h'  # Smaller blocks
```

### Loki

```yaml
# In 12-loki-deployment.yaml
limits_config:
  ingestion_rate_mb: 8  # Reduce if needed
  ingestion_burst_size_mb: 16
```

### Tempo

```yaml
# In 13-tempo-deployment.yaml
overrides:
  defaults:
    ingestion_rate_limit: 5000  # Reduce if needed
```

## Backup

### Grafana Dashboards

```bash
# Export dashboards
kubectl exec -n minidrive deployment/grafana -- \
  grafana-cli admin export-dashboard <dashboard-id> > dashboard.json

# Or use Grafana API
curl -u admin:password \
  http://grafana-service:3000/api/dashboards/uid/minidrive-monitoring
```

### Prometheus Data

```bash
# Backup Prometheus data
kubectl exec -n minidrive deployment/prometheus -- \
  tar czf /tmp/prometheus-backup.tar.gz /prometheus

kubectl cp minidrive/prometheus-xxx:/tmp/prometheus-backup.tar.gz \
  ./prometheus-backup.tar.gz
```

## Cleanup

```bash
# Delete monitoring stack
kubectl delete -f 18-monitoring-ingress.yaml
kubectl delete -f 16-grafana-deployment.yaml
kubectl delete -f 17-grafana-dashboards.yaml
kubectl delete -f 14-grafana-datasources.yaml
kubectl delete -f 15-promtail-deployment.yaml
kubectl delete -f 13-tempo-deployment.yaml
kubectl delete -f 12-loki-deployment.yaml
kubectl delete -f 11-prometheus-deployment.yaml
kubectl delete -f 10-prometheus-configmap.yaml

# Delete PVCs (data will be lost)
kubectl delete pvc prometheus-pvc loki-pvc tempo-pvc grafana-pvc -n minidrive
```

## Quick Reference

### Access URLs (via port-forward)

```bash
# Grafana
kubectl port-forward -n minidrive svc/grafana-service 3000:3000
# http://localhost:3000

# Prometheus
kubectl port-forward -n minidrive svc/prometheus-service 9090:9090
# http://localhost:9090

# Loki
kubectl port-forward -n minidrive svc/loki-service 3100:3100
# http://localhost:3100

# Tempo
kubectl port-forward -n minidrive svc/tempo-service 3200:3200
# http://localhost:3200
```

### Common Queries

**Prometheus:**
```promql
# CPU usage
rate(container_cpu_usage_seconds_total{namespace="minidrive"}[5m])

# Memory usage
container_memory_working_set_bytes{namespace="minidrive"}

# Pod count
count(kube_pod_info{namespace="minidrive"})
```

**Loki (LogQL):**
```logql
# Error logs
{namespace="minidrive"} |= "error"

# Logs from last hour
{namespace="minidrive"} [1h]
```

**Tempo:**
- Search by service name: `service.name=minidrive-app`
- Search by trace ID: `traceID=abc123...`
- Search by tags: `http.method=GET`

## Next Steps

1. **Add custom application metrics**
2. **Set up alerting** (Alertmanager)
3. **Configure log retention** based on needs
4. **Add more dashboards** for specific use cases
5. **Set up trace sampling** for high-traffic scenarios
6. **Configure backup** for monitoring data

---

**Last Updated**: December 2024  
**Grafana Version**: 10.2.2  
**Prometheus Version**: 2.48.0  
**Loki Version**: 2.9.2  
**Tempo Version**: 2.3.1
