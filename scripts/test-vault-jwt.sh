#!/bin/bash

# Test script for Vault JWT authentication with Keycloak
# This script verifies that the JWT authentication is working correctly

set -e

# Load environment variables if .env.local exists
SCRIPT_DIR="$(dirname "$0")"
ENV_FILE="$SCRIPT_DIR/../.env.local"
if [ -f "$ENV_FILE" ]; then
    export $(grep -v '^#' "$ENV_FILE" | xargs)
fi

# Configuration with environment variable defaults
VAULT_ADDR="${VAULT_ADDR:-http://localhost:8200}"
VAULT_TOKEN="${VAULT_TOKEN:-matric-dev-root-token}"
KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8081}"
KEYCLOAK_REALM="${KEYCLOAK_REALM:-matric-dev}"

# Export for vault CLI
export VAULT_ADDR
export VAULT_TOKEN
export VAULT_SKIP_VERIFY="${VAULT_SKIP_VERIFY:-true}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Test Vault connectivity
test_vault_connectivity() {
    log_info "Testing Vault connectivity..."
    
    if curl -s "${VAULT_ADDR}/v1/sys/health" > /dev/null; then
        log_success "Vault is accessible"
    else
        log_error "Vault is not accessible at ${VAULT_ADDR}"
        return 1
    fi
}

# Test Keycloak connectivity
test_keycloak_connectivity() {
    log_info "Testing Keycloak connectivity..."
    
    if curl -s "${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}" > /dev/null; then
        log_success "Keycloak realm is accessible"
    else
        log_error "Keycloak realm is not accessible at ${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}"
        return 1
    fi
}

# Test Vault authentication methods
test_vault_auth_methods() {
    log_info "Testing Vault authentication methods..."
    
    export VAULT_TOKEN="${VAULT_TOKEN}"
    
    if vault auth list | grep -q "jwt/"; then
        log_success "JWT authentication method is enabled"
    else
        log_error "JWT authentication method is not enabled"
        return 1
    fi
}

# Test Vault policies
test_vault_policies() {
    log_info "Testing Vault policies..."
    
    local policies=("tenant-access" "service-admin" "read-only")
    
    for policy in "${policies[@]}"; do
        if vault policy read "$policy" > /dev/null 2>&1; then
            log_success "Policy '$policy' exists"
        else
            log_error "Policy '$policy' does not exist"
            return 1
        fi
    done
}

# Test JWT roles
test_jwt_roles() {
    log_info "Testing JWT roles..."
    
    local roles=("matric-service" "matric-admin-service" "matric-monitor-service")
    
    for role in "${roles[@]}"; do
        if vault read "auth/jwt/role/$role" > /dev/null 2>&1; then
            log_success "JWT role '$role' exists"
        else
            log_error "JWT role '$role' does not exist"
            return 1
        fi
    done
}

# Test sample secrets
test_sample_secrets() {
    log_info "Testing sample secrets..."
    
    local secrets=("secret/common/config" "secret/tenants/tenant-001/config" "secret/users/user-123/preferences")
    
    for secret in "${secrets[@]}"; do
        if vault kv get "$secret" > /dev/null 2>&1; then
            log_success "Secret '$secret' exists"
        else
            log_warning "Secret '$secret' does not exist (this may be expected)"
        fi
    done
}

# Test JWT configuration
test_jwt_config() {
    log_info "Testing JWT configuration..."
    
    local jwt_config
    jwt_config=$(vault read -format=json auth/jwt/config)
    
    local jwks_url
    jwks_url=$(echo "$jwt_config" | jq -r '.data.jwks_url')
    
    if [ "$jwks_url" != "null" ] && [ -n "$jwks_url" ]; then
        log_success "JWT JWKS URL is configured: $jwks_url"
        
        # Test JWKS endpoint
        if curl -s "$jwks_url" > /dev/null; then
            log_success "JWKS endpoint is accessible"
        else
            log_warning "JWKS endpoint is not accessible (Keycloak may not be fully ready)"
        fi
    else
        log_error "JWT JWKS URL is not configured"
        return 1
    fi
    
    local bound_issuer
    bound_issuer=$(echo "$jwt_config" | jq -r '.data.bound_issuer')
    
    if [ "$bound_issuer" != "null" ] && [ -n "$bound_issuer" ]; then
        log_success "JWT bound issuer is configured: $bound_issuer"
    else
        log_error "JWT bound issuer is not configured"
        return 1
    fi
}

# Test token authentication (mock)
test_mock_jwt_auth() {
    log_info "Testing mock JWT authentication..."
    
    # Create a simple test to verify the role exists and can be queried
    if vault read auth/jwt/role/matric-service > /dev/null 2>&1; then
        log_success "JWT role 'matric-service' is accessible"
    else
        log_error "JWT role 'matric-service' is not accessible"
        return 1
    fi
    
    log_warning "Note: Full JWT authentication test requires a valid Keycloak token"
    log_info "Use the Python or Node.js examples to test actual JWT authentication"
}

# Display configuration summary
show_configuration_summary() {
    log_info "Configuration Summary:"
    echo "  Vault Address: $VAULT_ADDR"
    echo "  Keycloak URL: $KEYCLOAK_URL"
    echo "  Keycloak Realm: $KEYCLOAK_REALM"
    echo
    
    log_info "Available JWT Roles:"
    vault list auth/jwt/role | sed 's/^/  /'
    echo
    
    log_info "Available Policies:"
    vault policy list | grep -E "(tenant-access|service-admin|read-only)" | sed 's/^/  /'
    echo
    
    log_info "JWT Configuration:"
    vault read auth/jwt/config | grep -E "(jwks_url|bound_issuer)" | sed 's/^/  /'
}

# Main test execution
main() {
    log_info "Starting Vault JWT authentication tests..."
    
    local exit_code=0
    
    test_vault_connectivity || exit_code=1
    test_keycloak_connectivity || exit_code=1
    test_vault_auth_methods || exit_code=1
    test_vault_policies || exit_code=1
    test_jwt_roles || exit_code=1
    test_sample_secrets || true  # Don't fail on missing sample secrets
    test_jwt_config || exit_code=1
    test_mock_jwt_auth || exit_code=1
    
    echo
    show_configuration_summary
    
    if [ $exit_code -eq 0 ]; then
        log_success "All tests passed! Vault JWT authentication is configured correctly."
        echo
        log_info "Next steps:"
        echo "1. Configure Keycloak client mappers (tenant_id, user_id)"
        echo "2. Test with example scripts:"
        echo "   cd ../examples"
        echo "   python3 vault-service-auth.py"
        echo "   node vault-service-auth.js"
    else
        log_error "Some tests failed. Please check the configuration."
        echo
        log_info "To reconfigure Vault JWT authentication:"
        echo "   ./configure-vault-jwt.sh"
    fi
    
    exit $exit_code
}

# Execute main function
main "$@"