#!/bin/bash

# Keycloak Validation Script for MATRIC Platform
# Usage: ./validate.sh [dev|prod]

set -euo pipefail

ENVIRONMENT="${1:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Validation functions
validate_environment() {
    if [[ "$ENVIRONMENT" != "dev" && "$ENVIRONMENT" != "prod" ]]; then
        log_error "Environment must be 'dev' or 'prod'"
        echo "Usage: $0 [dev|prod]"
        exit 1
    fi
}

check_keycloak_operator() {
    log_info "Validating Keycloak Operator..."
    
    if kubectl get deployment -n keycloak-system keycloak-operator &> /dev/null; then
        local status
        status=$(kubectl get deployment -n keycloak-system keycloak-operator -o jsonpath='{.status.readyReplicas}')
        if [[ "$status" == "1" ]]; then
            log_success "Keycloak Operator is running"
        else
            log_error "Keycloak Operator is not ready"
            return 1
        fi
    else
        log_error "Keycloak Operator not found"
        return 1
    fi
}

check_keycloak_instance() {
    local namespace="keycloak-$ENVIRONMENT"
    
    log_info "Validating Keycloak instance in $namespace..."
    
    if kubectl get keycloak keycloak -n "$namespace" &> /dev/null; then
        local ready
        ready=$(kubectl get keycloak keycloak -n "$namespace" -o jsonpath='{.status.ready}' 2>/dev/null || echo "false")
        
        if [[ "$ready" == "true" ]]; then
            log_success "Keycloak instance is ready"
        else
            log_warning "Keycloak instance is not ready"
            kubectl describe keycloak keycloak -n "$namespace"
            return 1
        fi
    else
        log_error "Keycloak instance not found in $namespace"
        return 1
    fi
}

check_pods() {
    local namespace="keycloak-$ENVIRONMENT"
    
    log_info "Validating Keycloak pods..."
    
    local expected_replicas
    if [[ "$ENVIRONMENT" == "dev" ]]; then
        expected_replicas=2
    else
        expected_replicas=3
    fi
    
    local running_pods
    running_pods=$(kubectl get pods -n "$namespace" -l app.kubernetes.io/name=keycloak --field-selector=status.phase=Running --no-headers | wc -l)
    
    if [[ "$running_pods" -ge "$expected_replicas" ]]; then
        log_success "$running_pods/$expected_replicas pods are running"
    else
        log_error "Only $running_pods/$expected_replicas pods are running"
        kubectl get pods -n "$namespace" -l app.kubernetes.io/name=keycloak
        return 1
    fi
}

check_services() {
    local namespace="keycloak-$ENVIRONMENT"
    
    log_info "Validating services..."
    
    local services=("keycloak-service" "keycloak-headless")
    for service in "${services[@]}"; do
        if kubectl get service "$service" -n "$namespace" &> /dev/null; then
            log_success "Service $service exists"
        else
            log_error "Service $service not found"
            return 1
        fi
    done
}

check_ingress() {
    local namespace="keycloak-$ENVIRONMENT"
    
    log_info "Validating ingress..."
    
    if kubectl get ingress keycloak-ingress -n "$namespace" &> /dev/null; then
        local ingress_class
        ingress_class=$(kubectl get ingress keycloak-ingress -n "$namespace" -o jsonpath='{.spec.ingressClassName}')
        
        if [[ "$ingress_class" == "nginx" ]]; then
            log_success "Ingress is configured with nginx class"
        else
            log_warning "Ingress class is not nginx: $ingress_class"
        fi
        
        # Check TLS configuration
        local tls_hosts
        tls_hosts=$(kubectl get ingress keycloak-ingress -n "$namespace" -o jsonpath='{.spec.tls[0].hosts[0]}')
        
        if [[ -n "$tls_hosts" ]]; then
            log_success "TLS is configured for host: $tls_hosts"
        else
            log_error "TLS is not configured"
            return 1
        fi
    else
        log_error "Ingress not found"
        return 1
    fi
}

check_certificates() {
    local namespace="keycloak-$ENVIRONMENT"
    
    log_info "Validating certificates..."
    
    local cert_name
    if [[ "$ENVIRONMENT" == "dev" ]]; then
        cert_name="keycloak-tls-dev"
    else
        cert_name="keycloak-tls-prod"
    fi
    
    if kubectl get certificate "$cert_name" -n "$namespace" &> /dev/null; then
        local ready
        ready=$(kubectl get certificate "$cert_name" -n "$namespace" -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')
        
        if [[ "$ready" == "True" ]]; then
            log_success "Certificate $cert_name is ready"
        else
            log_warning "Certificate $cert_name is not ready"
            kubectl describe certificate "$cert_name" -n "$namespace"
        fi
    else
        log_error "Certificate $cert_name not found"
        return 1
    fi
}

check_secrets() {
    local namespace="keycloak-$ENVIRONMENT"
    
    log_info "Validating secrets..."
    
    local secrets=("keycloak-db-secret" "keycloak-admin-secret")
    for secret in "${secrets[@]}"; do
        if kubectl get secret "$secret" -n "$namespace" &> /dev/null; then
            log_success "Secret $secret exists"
        else
            log_error "Secret $secret not found"
            return 1
        fi
    done
}

check_external_secrets() {
    local namespace="keycloak-$ENVIRONMENT"
    
    log_info "Validating External Secrets..."
    
    local external_secrets=("keycloak-db-secret" "keycloak-admin-secret")
    for es in "${external_secrets[@]}"; do
        if kubectl get externalsecret "$es" -n "$namespace" &> /dev/null; then
            local ready
            ready=$(kubectl get externalsecret "$es" -n "$namespace" -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "Unknown")
            
            if [[ "$ready" == "True" ]]; then
                log_success "ExternalSecret $es is ready"
            else
                log_warning "ExternalSecret $es is not ready: $ready"
                kubectl describe externalsecret "$es" -n "$namespace"
            fi
        else
            log_error "ExternalSecret $es not found"
            return 1
        fi
    done
}

check_hpa() {
    local namespace="keycloak-$ENVIRONMENT"
    
    log_info "Validating HPA..."
    
    if kubectl get hpa keycloak-hpa -n "$namespace" &> /dev/null; then
        local current_replicas
        current_replicas=$(kubectl get hpa keycloak-hpa -n "$namespace" -o jsonpath='{.status.currentReplicas}')
        local desired_replicas
        desired_replicas=$(kubectl get hpa keycloak-hpa -n "$namespace" -o jsonpath='{.status.desiredReplicas}')
        
        log_success "HPA: Current=$current_replicas, Desired=$desired_replicas"
    else
        log_error "HPA not found"
        return 1
    fi
}

check_network_policies() {
    local namespace="keycloak-$ENVIRONMENT"
    
    log_info "Validating Network Policies..."
    
    local policies=("keycloak-network-policy" "deny-all-default")
    if [[ "$ENVIRONMENT" == "prod" ]]; then
        policies+=("keycloak-network-policy-strict" "keycloak-admin-access-policy")
    fi
    
    for policy in "${policies[@]}"; do
        if kubectl get networkpolicy "$policy" -n "$namespace" &> /dev/null; then
            log_success "NetworkPolicy $policy exists"
        else
            log_warning "NetworkPolicy $policy not found"
        fi
    done
}

check_monitoring() {
    local namespace="keycloak-$ENVIRONMENT"
    
    log_info "Validating monitoring setup..."
    
    if kubectl get servicemonitor keycloak-metrics -n "$namespace" &> /dev/null; then
        log_success "ServiceMonitor exists"
    else
        log_warning "ServiceMonitor not found"
    fi
    
    if kubectl get prometheusrule keycloak-alerts -n "$namespace" &> /dev/null; then
        log_success "PrometheusRule exists"
    else
        log_warning "PrometheusRule not found"
    fi
}

check_realm_import() {
    local namespace="keycloak-$ENVIRONMENT"
    
    log_info "Validating realm import..."
    
    if kubectl get keycloakrealmimport matric-realm-import -n "$namespace" &> /dev/null; then
        local ready
        ready=$(kubectl get keycloakrealmimport matric-realm-import -n "$namespace" -o jsonpath='{.status.ready}' 2>/dev/null || echo "false")
        
        if [[ "$ready" == "true" ]]; then
            log_success "Realm import is ready"
        else
            log_warning "Realm import is not ready"
            kubectl describe keycloakrealmimport matric-realm-import -n "$namespace"
        fi
    else
        log_error "Realm import not found"
        return 1
    fi
}

test_health_endpoints() {
    local namespace="keycloak-$ENVIRONMENT"
    
    log_info "Testing health endpoints..."
    
    local pod_name
    pod_name=$(kubectl get pods -n "$namespace" -l app.kubernetes.io/name=keycloak -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    
    if [[ -n "$pod_name" ]]; then
        # Test health endpoint
        if kubectl exec -n "$namespace" "$pod_name" -- curl -sf http://localhost:8080/health &> /dev/null; then
            log_success "Health endpoint is responding"
        else
            log_error "Health endpoint is not responding"
            return 1
        fi
        
        # Test metrics endpoint
        if kubectl exec -n "$namespace" "$pod_name" -- curl -sf http://localhost:9990/metrics &> /dev/null; then
            log_success "Metrics endpoint is responding"
        else
            log_error "Metrics endpoint is not responding"
            return 1
        fi
    else
        log_error "No pods found to test"
        return 1
    fi
}

test_external_connectivity() {
    local namespace="keycloak-$ENVIRONMENT"
    local hostname
    
    if [[ "$ENVIRONMENT" == "dev" ]]; then
        hostname="auth-dev.matric.local"
    else
        hostname="auth.matric.local"
    fi
    
    log_info "Testing external connectivity to $hostname..."
    
    # Test OIDC discovery endpoint
    local discovery_url="https://$hostname/auth/realms/matric/.well-known/openid_configuration"
    
    if curl -sf "$discovery_url" &> /dev/null; then
        log_success "OIDC discovery endpoint is accessible"
    else
        log_error "OIDC discovery endpoint is not accessible"
        return 1
    fi
}

verify_security_configuration() {
    local namespace="keycloak-$ENVIRONMENT"
    
    log_info "Verifying security configuration..."
    
    local pod_name
    pod_name=$(kubectl get pods -n "$namespace" -l app.kubernetes.io/name=keycloak -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    
    if [[ -n "$pod_name" ]]; then
        # Check SAML is disabled
        if kubectl exec -n "$namespace" "$pod_name" -- /opt/keycloak/bin/kc.sh show-config 2>/dev/null | grep -q "features-disabled.*saml"; then
            log_success "SAML is properly disabled (CVE-2024-8698 mitigation)"
        else
            log_error "SAML status unclear - security risk!"
            return 1
        fi
        
        # Check OIDC is enabled
        if kubectl exec -n "$namespace" "$pod_name" -- /opt/keycloak/bin/kc.sh show-config 2>/dev/null | grep -q "features.*oidc"; then
            log_success "OIDC is enabled"
        else
            log_warning "OIDC configuration unclear"
        fi
        
        # Check TLS configuration in production
        if [[ "$ENVIRONMENT" == "prod" ]]; then
            if kubectl exec -n "$namespace" "$pod_name" -- /opt/keycloak/bin/kc.sh show-config 2>/dev/null | grep -q "http-enabled=false"; then
                log_success "HTTP is disabled in production"
            else
                log_error "HTTP should be disabled in production"
                return 1
            fi
        fi
    else
        log_error "No pods found for security validation"
        return 1
    fi
}

# Main validation function
run_validation() {
    local failed_checks=0
    
    echo "================================================"
    echo "Keycloak Validation Report - $ENVIRONMENT Environment"
    echo "================================================"
    
    # Array of validation functions
    local checks=(
        "check_keycloak_operator"
        "check_keycloak_instance"
        "check_pods"
        "check_services"
        "check_ingress"
        "check_certificates"
        "check_secrets"
        "check_external_secrets"
        "check_hpa"
        "check_network_policies"
        "check_monitoring"
        "check_realm_import"
        "test_health_endpoints"
        "verify_security_configuration"
    )
    
    # Run each check
    for check in "${checks[@]}"; do
        if ! $check; then
            ((failed_checks++))
        fi
        echo "----------------------------------------"
    done
    
    # External connectivity test (may fail in local environments)
    if test_external_connectivity; then
        log_success "External connectivity test passed"
    else
        log_warning "External connectivity test failed (may be expected in local environments)"
    fi
    
    echo "================================================"
    if [[ $failed_checks -eq 0 ]]; then
        log_success "All validation checks passed!"
        echo "Keycloak deployment in $ENVIRONMENT environment is healthy."
    else
        log_error "$failed_checks validation check(s) failed!"
        echo "Please review the failed checks above."
        exit 1
    fi
    echo "================================================"
}

# Script execution
if [[ $# -eq 0 ]]; then
    echo "Usage: $0 [dev|prod]"
    exit 1
fi

validate_environment
run_validation