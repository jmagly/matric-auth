#!/bin/bash

# Keycloak Deployment Script for MATRIC Platform
# Usage: ./deploy.sh [dev|prod] [--dry-run]

set -euo pipefail

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENVIRONMENT="${1:-}"
DRY_RUN="${2:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Validation function
validate_environment() {
    if [[ "$ENVIRONMENT" != "dev" && "$ENVIRONMENT" != "prod" ]]; then
        log_error "Environment must be 'dev' or 'prod'"
        echo "Usage: $0 [dev|prod] [--dry-run]"
        exit 1
    fi
}

# Prerequisites check
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    local required_tools=("kubectl" "kustomize")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "$tool is required but not installed"
            exit 1
        fi
    done
    
    # Check kubectl connectivity
    if ! kubectl cluster-info &> /dev/null; then
        log_error "kubectl cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Check if operator is installed
check_operator() {
    log_info "Checking Keycloak Operator..."
    
    if ! kubectl get deployment -n keycloak-system keycloak-operator &> /dev/null; then
        log_warning "Keycloak Operator not found. Installing..."
        deploy_operator
    else
        log_success "Keycloak Operator is already installed"
    fi
}

# Deploy Keycloak Operator
deploy_operator() {
    log_info "Deploying Keycloak Operator..."
    
    if [[ "$DRY_RUN" == "--dry-run" ]]; then
        kubectl apply -k "$SCRIPT_DIR/operator/" --dry-run=client
    else
        kubectl apply -k "$SCRIPT_DIR/operator/"
        
        # Wait for operator to be ready
        log_info "Waiting for operator to be ready..."
        kubectl wait --for=condition=available --timeout=300s deployment/keycloak-operator -n keycloak-system
    fi
    
    log_success "Keycloak Operator deployed successfully"
}

# Validate external dependencies
validate_dependencies() {
    log_info "Validating external dependencies for $ENVIRONMENT..."
    
    local namespace="keycloak-$ENVIRONMENT"
    local db_host
    
    if [[ "$ENVIRONMENT" == "dev" ]]; then
        db_host="postgres-dev.database.svc.cluster.local"
    else
        db_host="postgres-prod.database.svc.cluster.local"
    fi
    
    # Check if External Secrets Operator is available
    if ! kubectl get crd externalsecrets.external-secrets.io &> /dev/null; then
        log_warning "External Secrets Operator not found. Please install it first."
    fi
    
    # Check if cert-manager is available
    if ! kubectl get crd certificates.cert-manager.io &> /dev/null; then
        log_warning "cert-manager not found. Please install it first."
    fi
    
    # Check if monitoring is available
    if ! kubectl get crd servicemonitors.monitoring.coreos.com &> /dev/null; then
        log_warning "Prometheus Operator not found. Monitoring may not work."
    fi
    
    log_success "Dependencies validation completed"
}

# Deploy Keycloak for specific environment
deploy_keycloak() {
    local namespace="keycloak-$ENVIRONMENT"
    
    log_info "Deploying Keycloak to $ENVIRONMENT environment..."
    
    # Create namespace if it doesn't exist
    if ! kubectl get namespace "$namespace" &> /dev/null; then
        log_info "Creating namespace $namespace..."
        if [[ "$DRY_RUN" != "--dry-run" ]]; then
            kubectl create namespace "$namespace"
        fi
    fi
    
    # Apply Kustomize configuration
    local overlay_dir="$SCRIPT_DIR/overlays/$ENVIRONMENT"
    
    if [[ "$DRY_RUN" == "--dry-run" ]]; then
        log_info "Dry run - showing what would be applied:"
        kubectl apply -k "$overlay_dir" --dry-run=client
    else
        kubectl apply -k "$overlay_dir"
        
        # Wait for Keycloak to be ready
        log_info "Waiting for Keycloak to be ready..."
        kubectl wait --for=condition=ready --timeout=600s keycloak/keycloak -n "$namespace" || {
            log_warning "Keycloak not ready within timeout. Checking status..."
            kubectl get keycloak -n "$namespace"
            kubectl describe keycloak -n "$namespace"
        }
    fi
    
    log_success "Keycloak deployed to $ENVIRONMENT environment"
}

# Validate deployment
validate_deployment() {
    local namespace="keycloak-$ENVIRONMENT"
    
    log_info "Validating deployment..."
    
    # Check Keycloak status
    local keycloak_status
    keycloak_status=$(kubectl get keycloak keycloak -n "$namespace" -o jsonpath='{.status.ready}' 2>/dev/null || echo "false")
    
    if [[ "$keycloak_status" == "true" ]]; then
        log_success "Keycloak is ready"
    else
        log_warning "Keycloak is not ready yet"
        kubectl get keycloak -n "$namespace"
    fi
    
    # Check pods
    local running_pods
    running_pods=$(kubectl get pods -n "$namespace" -l app.kubernetes.io/name=keycloak --field-selector=status.phase=Running --no-headers | wc -l)
    
    log_info "Running pods: $running_pods"
    
    # Check services
    kubectl get services -n "$namespace"
    
    # Check ingress
    kubectl get ingress -n "$namespace"
    
    # Check HPA
    kubectl get hpa -n "$namespace"
    
    log_success "Deployment validation completed"
}

# Health checks
run_health_checks() {
    local namespace="keycloak-$ENVIRONMENT"
    
    log_info "Running health checks..."
    
    # Get a pod to run health checks against
    local pod_name
    pod_name=$(kubectl get pods -n "$namespace" -l app.kubernetes.io/name=keycloak -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    
    if [[ -n "$pod_name" ]]; then
        log_info "Testing health endpoint on pod $pod_name..."
        
        # Test health endpoint
        if kubectl exec -n "$namespace" "$pod_name" -- curl -f http://localhost:8080/health &> /dev/null; then
            log_success "Health endpoint is responding"
        else
            log_warning "Health endpoint is not responding"
        fi
        
        # Test metrics endpoint
        if kubectl exec -n "$namespace" "$pod_name" -- curl -f http://localhost:9990/metrics &> /dev/null; then
            log_success "Metrics endpoint is responding"
        else
            log_warning "Metrics endpoint is not responding"
        fi
        
        # Check SAML is disabled (security requirement)
        log_info "Verifying SAML is disabled..."
        if kubectl exec -n "$namespace" "$pod_name" -- /opt/keycloak/bin/kc.sh show-config 2>/dev/null | grep -q "features-disabled.*saml"; then
            log_success "SAML is properly disabled"
        else
            log_warning "SAML status unclear - manual verification needed"
        fi
    else
        log_warning "No pods found for health checks"
    fi
}

# Cleanup function
cleanup() {
    local namespace="keycloak-$ENVIRONMENT"
    
    log_warning "Cleaning up Keycloak deployment in $ENVIRONMENT..."
    
    read -p "Are you sure you want to delete the Keycloak deployment? [y/N] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        kubectl delete -k "$SCRIPT_DIR/overlays/$ENVIRONMENT" || true
        kubectl delete namespace "$namespace" --ignore-not-found=true
        log_success "Cleanup completed"
    else
        log_info "Cleanup cancelled"
    fi
}

# Show help
show_help() {
    cat << EOF
Keycloak Deployment Script for MATRIC Platform

Usage: $0 [COMMAND] [ENVIRONMENT] [OPTIONS]

Commands:
    deploy      Deploy Keycloak (default)
    validate    Validate existing deployment
    health      Run health checks
    cleanup     Remove Keycloak deployment
    help        Show this help

Environment:
    dev         Development environment
    prod        Production environment

Options:
    --dry-run   Show what would be applied without making changes

Examples:
    $0 deploy dev                # Deploy to development
    $0 deploy prod --dry-run     # Dry run production deployment
    $0 validate prod             # Validate production deployment
    $0 health dev                # Run health checks on development
    $0 cleanup dev               # Remove development deployment

Security Features:
    - Keycloak 26.3.2 (CVE-2024-8698 patched)
    - SAML disabled (security requirement)
    - OIDC only configuration
    - TLS enforced in production
    - Network policies implemented
    - External secrets integration
EOF
}

# Main execution
main() {
    local command="${1:-deploy}"
    
    case "$command" in
        "deploy")
            validate_environment
            check_prerequisites
            validate_dependencies
            check_operator
            deploy_keycloak
            validate_deployment
            run_health_checks
            
            log_success "Keycloak deployment completed successfully!"
            log_info "Access URLs:"
            if [[ "$ENVIRONMENT" == "dev" ]]; then
                log_info "  Development: https://auth-dev.matric.local"
            else
                log_info "  Production: https://auth.matric.local"
            fi
            ;;
        "validate")
            validate_environment
            validate_deployment
            ;;
        "health")
            validate_environment
            run_health_checks
            ;;
        "cleanup")
            validate_environment
            cleanup
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            log_error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

# Handle script arguments
if [[ $# -eq 0 ]]; then
    show_help
    exit 1
fi

# Execute main function with all arguments
main "$@"