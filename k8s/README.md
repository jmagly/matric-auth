# Keycloak Deployment for MATRIC Platform

This directory contains comprehensive Kubernetes manifests for deploying Keycloak 26.3.2 in production for the MATRIC platform, with specific security configurations addressing CVE-2024-8698.

## Security Features

- **Keycloak 26.3.2** - Latest version with CVE-2024-8698 patches
- **SAML Disabled** - Security requirement per CVE-2024-8698
- **OIDC Only** - Limited to OpenID Connect protocols
- **TLS Enforced** - Production uses HTTPS only
- **Network Policies** - Strict ingress/egress controls
- **Security Headers** - Comprehensive HTTP security headers
- **Resource Limits** - Proper CPU/memory constraints

## Directory Structure

```
keycloak/
├── operator/                    # Keycloak Operator installation
│   ├── namespace.yaml
│   ├── crds.yaml
│   ├── rbac.yaml
│   ├── deployment.yaml
│   └── kustomization.yaml
├── base/                        # Base Keycloak configuration
│   ├── namespace.yaml
│   ├── secrets.yaml             # External Secrets integration
│   ├── configmap.yaml
│   ├── rbac.yaml
│   ├── keycloak.yaml            # Main Keycloak CRD
│   ├── service.yaml
│   ├── ingress.yaml
│   ├── networkpolicy.yaml
│   ├── realm-configmap.yaml     # MATRIC realm configuration
│   ├── realm-import.yaml        # Realm import CRD
│   ├── hpa.yaml                 # Horizontal Pod Autoscaler
│   ├── servicemonitor.yaml      # Prometheus monitoring
│   └── kustomization.yaml
└── overlays/
    ├── dev/                     # Development environment
    │   ├── kustomization.yaml
    │   ├── keycloak-patch.yaml
    │   ├── ingress-patch.yaml
    │   ├── secrets-patch.yaml
    │   └── hpa-patch.yaml
    └── prod/                    # Production environment
        ├── kustomization.yaml
        ├── keycloak-patch.yaml
        ├── ingress-patch.yaml
        ├── secrets-patch.yaml
        ├── hpa-patch.yaml
        └── networkpolicy-patch.yaml
```

## Prerequisites

### Required Operators and Components

1. **Keycloak Operator**
   ```bash
   kubectl apply -k operator/
   ```

2. **External Secrets Operator**
   ```bash
   helm repo add external-secrets https://charts.external-secrets.io
   helm install external-secrets external-secrets/external-secrets -n external-secrets-system --create-namespace
   ```

3. **Cert-Manager**
   ```bash
   helm repo add jetstack https://charts.jetstack.io
   helm install cert-manager jetstack/cert-manager --namespace cert-manager --create-namespace --set installCRDs=true
   ```

4. **Prometheus Operator** (for monitoring)
   ```bash
   helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
   helm install kube-prometheus-stack prometheus-community/kube-prometheus-stack -n monitoring --create-namespace
   ```

5. **NGINX Ingress Controller**
   ```bash
   helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
   helm install ingress-nginx ingress-nginx/ingress-nginx -n ingress-nginx --create-namespace
   ```

### External Dependencies

1. **PostgreSQL Database**
   - Development: `postgres-dev.database.svc.cluster.local:5432/keycloak_dev`
   - Production: `postgres-prod.database.svc.cluster.local:5432/keycloak_prod`

2. **HashiCorp Vault**
   - URL: `https://vault.matric.local`
   - Kubernetes auth enabled
   - Secrets stored under `keycloak/` and `keycloak-dev/`, `keycloak-prod/` paths

3. **DNS Configuration**
   - Development: `auth-dev.matric.local`
   - Production: `auth.matric.local`

## Deployment Instructions

### 1. Deploy Keycloak Operator

```bash
# Deploy the operator
kubectl apply -k /home/manitcor/dev/matric/repos/matric-infra/k8s/keycloak/operator/

# Verify operator deployment
kubectl get pods -n keycloak-system
kubectl logs -n keycloak-system deployment/keycloak-operator
```

### 2. Deploy Development Environment

```bash
# Deploy Keycloak to development
kubectl apply -k /home/manitcor/dev/matric/repos/matric-infra/k8s/keycloak/overlays/dev/

# Monitor deployment
kubectl get keycloak -n keycloak-dev
kubectl get pods -n keycloak-dev -w
```

### 3. Deploy Production Environment

```bash
# Deploy Keycloak to production
kubectl apply -k /home/manitcor/dev/matric/repos/matric-infra/k8s/keycloak/overlays/prod/

# Monitor deployment
kubectl get keycloak -n keycloak-prod
kubectl get pods -n keycloak-prod -w
```

## Validation Commands

### Health Checks

```bash
# Check Keycloak status
kubectl get keycloak -A
kubectl describe keycloak -n keycloak-prod

# Check pod health
kubectl get pods -n keycloak-prod -l app.kubernetes.io/name=keycloak
kubectl logs -n keycloak-prod -l app.kubernetes.io/name=keycloak --tail=100

# Health endpoints
kubectl port-forward -n keycloak-prod svc/keycloak-service 8080:8080
curl http://localhost:8080/health
curl http://localhost:8080/metrics
```

### Security Validation

```bash
# Verify SAML is disabled
kubectl exec -n keycloak-prod deployment/keycloak -- /opt/keycloak/bin/kc.sh show-config | grep features

# Check TLS configuration
curl -I https://auth.matric.local/auth/realms/matric
openssl s_client -connect auth.matric.local:443 -servername auth.matric.local

# Verify network policies
kubectl describe networkpolicy -n keycloak-prod
kubectl get networkpolicy -n keycloak-prod -o yaml
```

### Database Connectivity

```bash
# Check database connections
kubectl exec -n keycloak-prod deployment/keycloak -- /opt/keycloak/bin/kc.sh show-config | grep db

# Test database connectivity
kubectl exec -n keycloak-prod deployment/keycloak -- /bin/bash -c "
  psql \$KC_DB_URL_HOST:\$KC_DB_URL_PORT/\$KC_DB_URL_DATABASE -U \$KC_DB_USERNAME -c 'SELECT 1;'
"
```

### Monitoring and Metrics

```bash
# Check ServiceMonitor
kubectl get servicemonitor -n keycloak-prod
kubectl describe servicemonitor keycloak-metrics -n keycloak-prod

# Verify Prometheus targets
kubectl port-forward -n monitoring svc/prometheus-kube-prometheus-prometheus 9090:9090
# Open http://localhost:9090/targets

# Check HPA status
kubectl get hpa -n keycloak-prod
kubectl describe hpa keycloak-hpa -n keycloak-prod
```

### Realm Configuration

```bash
# Check realm import status
kubectl get keycloakrealmimport -n keycloak-prod
kubectl describe keycloakrealmimport matric-realm-import -n keycloak-prod

# Verify realm is accessible
curl https://auth.matric.local/auth/realms/matric/.well-known/openid_configuration
```

## Troubleshooting

### Common Issues

1. **Operator Not Ready**
   ```bash
   kubectl logs -n keycloak-system deployment/keycloak-operator
   kubectl get events -n keycloak-system --sort-by='.lastTimestamp'
   ```

2. **Database Connection Issues**
   ```bash
   kubectl get secrets -n keycloak-prod keycloak-db-secret -o yaml
   kubectl describe externalsecret -n keycloak-prod keycloak-db-secret
   ```

3. **TLS Certificate Issues**
   ```bash
   kubectl describe certificate -n keycloak-prod keycloak-tls-prod
   kubectl get certificaterequests -n keycloak-prod
   kubectl logs -n cert-manager deployment/cert-manager
   ```

4. **Ingress Issues**
   ```bash
   kubectl describe ingress -n keycloak-prod keycloak-ingress
   kubectl logs -n ingress-nginx deployment/ingress-nginx-controller
   ```

5. **Clustering Issues**
   ```bash
   kubectl logs -n keycloak-prod -l app.kubernetes.io/name=keycloak | grep -i cluster
   kubectl get pods -n keycloak-prod -o wide
   ```

### Performance Tuning

1. **HPA Tuning**
   ```bash
   # Adjust HPA thresholds
   kubectl patch hpa keycloak-hpa -n keycloak-prod --type='merge' -p='{"spec":{"metrics":[{"type":"Resource","resource":{"name":"cpu","target":{"type":"Utilization","averageUtilization":60}}}]}}'
   ```

2. **Resource Limits**
   ```bash
   # Check resource usage
   kubectl top pods -n keycloak-prod
   kubectl describe pod -n keycloak-prod -l app.kubernetes.io/name=keycloak
   ```

## Security Considerations

### CVE-2024-8698 Mitigation

- SAML authentication is explicitly disabled via `features-disabled: "saml"`
- Only OIDC protocols are enabled
- Version 26.3.2 includes security patches

### Network Security

- Strict NetworkPolicies limiting ingress/egress
- TLS enforced for all external communication
- Admin console access restricted to internal networks

### Secrets Management

- All secrets managed via External Secrets Operator
- Integration with HashiCorp Vault
- No hardcoded credentials in manifests

### Monitoring and Alerting

- Comprehensive Prometheus metrics
- AlertManager rules for critical issues
- Logging integration for audit trails

## Maintenance

### Updating Keycloak

1. Update the image tag in `base/kustomization.yaml`
2. Test in development environment first
3. Apply rolling update to production

### Backup and Recovery

1. Database backups managed by PostgreSQL operator
2. Realm configuration stored in Git
3. Vault secrets backed up separately

### Certificate Renewal

- Automatic renewal via cert-manager
- Monitor certificate expiration alerts
- Manual renewal process documented

## Environment-Specific Configurations

### Development
- 2 replicas minimum
- HTTP enabled for local development
- Relaxed network policies
- Debug logging enabled
- Self-signed certificates

### Production
- 3 replicas minimum
- HTTPS only
- Strict network policies
- INFO level logging
- Production certificates
- Enhanced security headers
- WAF protection