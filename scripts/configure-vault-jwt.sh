#!/bin/bash

# Vault JWT Authentication Configuration for Keycloak Integration
# This script configures HashiCorp Vault JWT authentication method for service-to-service authentication
# using Keycloak-issued JWTs with dynamic tenant-scoped access.

set -e

# Load environment variables if .env.local exists
SCRIPT_DIR="$(dirname "$0")"
ENV_FILE="$SCRIPT_DIR/../.env.local"
if [ -f "$ENV_FILE" ]; then
    export $(grep -v '^#' "$ENV_FILE" | xargs)
fi

# Configuration variables with environment defaults
VAULT_ADDR="${VAULT_ADDR:-http://localhost:8200}"
VAULT_ROOT_TOKEN="${VAULT_TOKEN:-matric-dev-root-token}"
KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8081}"
KEYCLOAK_REALM="${KEYCLOAK_REALM:-matric-dev}"
KEYCLOAK_JWKS_URL="${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid_connect/certs"
KEYCLOAK_ISSUER="${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}"

# Export for vault CLI
export VAULT_ADDR
export VAULT_TOKEN="$VAULT_ROOT_TOKEN"
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

# Check if Vault is accessible
check_vault_status() {
    log_info "Checking Vault status..."
    if ! curl -s "${VAULT_ADDR}/v1/sys/health" > /dev/null 2>&1; then
        log_error "Vault is not accessible at ${VAULT_ADDR}"
        log_error "Please ensure Vault is running and accessible"
        exit 1
    fi
    log_success "Vault is accessible"
}

# Check if Keycloak is accessible
check_keycloak_status() {
    log_info "Checking Keycloak status..."
    if ! curl -s "${KEYCLOAK_JWKS_URL}" > /dev/null 2>&1; then
        log_error "Keycloak JWKS endpoint is not accessible at ${KEYCLOAK_JWKS_URL}"
        log_error "Please ensure Keycloak is running and the realm exists"
        exit 1
    fi
    log_success "Keycloak JWKS endpoint is accessible"
}

# Authenticate with Vault using root token
vault_auth() {
    log_info "Authenticating with Vault using root token..."
    export VAULT_TOKEN="${VAULT_ROOT_TOKEN}"
    
    # Verify authentication
    if ! vault auth -method=token "${VAULT_ROOT_TOKEN}" > /dev/null 2>&1; then
        log_error "Failed to authenticate with Vault using root token"
        exit 1
    fi
    log_success "Successfully authenticated with Vault"
}

# Enable JWT auth method if not already enabled
enable_jwt_auth() {
    log_info "Enabling JWT authentication method..."
    
    # Check if JWT auth method is already enabled
    if vault auth list | grep -q "^jwt/"; then
        log_warning "JWT authentication method is already enabled"
        return 0
    fi
    
    vault auth enable jwt
    log_success "JWT authentication method enabled"
}

# Configure JWT authentication method
configure_jwt_auth() {
    log_info "Configuring JWT authentication method..."
    
    vault write auth/jwt/config \
        jwks_url="${KEYCLOAK_JWKS_URL}" \
        bound_issuer="${KEYCLOAK_ISSUER}" \
        default_role="matric-service"
    
    log_success "JWT authentication method configured"
}

# Create tenant-scoped policies
create_tenant_policies() {
    log_info "Creating tenant-scoped policies..."
    
    # Create tenant access policy template
    cat > /tmp/tenant-policy.hcl << 'EOF'
# Tenant-scoped access policy template
# This policy allows access to tenant-specific secrets

# Allow access to tenant-specific secrets
path "secret/data/tenants/{{identity.entity.aliases.AUTH_JWT_ACCESSOR.metadata.tenant_id}}/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# Allow access to tenant metadata
path "secret/metadata/tenants/{{identity.entity.aliases.AUTH_JWT_ACCESSOR.metadata.tenant_id}}/*" {
  capabilities = ["list"]
}

# Allow access to user-specific secrets within tenant context
path "secret/data/users/{{identity.entity.aliases.AUTH_JWT_ACCESSOR.metadata.user_id}}/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# Allow access to user metadata
path "secret/metadata/users/{{identity.entity.aliases.AUTH_JWT_ACCESSOR.metadata.user_id}}/*" {
  capabilities = ["list"]
}

# Allow reading common configuration
path "secret/data/common/config" {
  capabilities = ["read"]
}

# Allow listing secrets at the root level for discovery
path "secret/metadata" {
  capabilities = ["list"]
}

# Allow reading own token information
path "auth/token/lookup-self" {
  capabilities = ["read"]
}

# Allow renewing own token
path "auth/token/renew-self" {
  capabilities = ["update"]
}
EOF

    vault policy write tenant-access /tmp/tenant-policy.hcl
    rm /tmp/tenant-policy.hcl
    log_success "Tenant access policy created"
    
    # Create service admin policy for broader access
    cat > /tmp/service-admin-policy.hcl << 'EOF'
# Service admin policy for privileged services
# This policy allows broader access for administrative services

# Allow access to all tenant secrets (for admin services)
path "secret/data/tenants/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# Allow access to all user secrets (for admin services)
path "secret/data/users/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# Allow access to common configuration
path "secret/data/common/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# Allow metadata operations
path "secret/metadata/*" {
  capabilities = ["list", "read"]
}

# Allow token operations
path "auth/token/lookup-self" {
  capabilities = ["read"]
}

path "auth/token/renew-self" {
  capabilities = ["update"]
}
EOF

    vault policy write service-admin /tmp/service-admin-policy.hcl
    rm /tmp/service-admin-policy.hcl
    log_success "Service admin policy created"
    
    # Create read-only policy for monitoring services
    cat > /tmp/read-only-policy.hcl << 'EOF'
# Read-only policy for monitoring and audit services

# Allow read access to all secrets for monitoring
path "secret/data/*" {
  capabilities = ["read"]
}

# Allow metadata read access
path "secret/metadata/*" {
  capabilities = ["list", "read"]
}

# Allow token operations
path "auth/token/lookup-self" {
  capabilities = ["read"]
}

path "auth/token/renew-self" {
  capabilities = ["update"]
}
EOF

    vault policy write read-only /tmp/read-only-policy.hcl
    rm /tmp/read-only-policy.hcl
    log_success "Read-only policy created"
}

# Create JWT roles for different service types
create_jwt_roles() {
    log_info "Creating JWT roles..."
    
    # Default service role - tenant-scoped access
    vault write auth/jwt/role/matric-service \
        role_type="jwt" \
        bound_audiences="matric-platform" \
        bound_subject="*" \
        user_claim="sub" \
        user_claim_json_pointer="false" \
        claim_mappings="tenant_id=tenant_id,user_id=user_id,preferred_username=preferred_username" \
        token_policies="tenant-access" \
        token_ttl="15m" \
        token_max_ttl="1h" \
        bound_claims_type="glob" \
        bound_claims='{
            "realm_access": {
                "roles": ["matric-service"]
            }
        }'
    
    log_success "Default service role created"
    
    # Admin service role - broader access
    vault write auth/jwt/role/matric-admin-service \
        role_type="jwt" \
        bound_audiences="matric-platform" \
        bound_subject="*" \
        user_claim="sub" \
        user_claim_json_pointer="false" \
        claim_mappings="tenant_id=tenant_id,user_id=user_id,preferred_username=preferred_username" \
        token_policies="service-admin" \
        token_ttl="15m" \
        token_max_ttl="1h" \
        bound_claims_type="glob" \
        bound_claims='{
            "realm_access": {
                "roles": ["matric-admin-service"]
            }
        }'
    
    log_success "Admin service role created"
    
    # Monitoring service role - read-only access
    vault write auth/jwt/role/matric-monitor-service \
        role_type="jwt" \
        bound_audiences="matric-platform" \
        bound_subject="*" \
        user_claim="sub" \
        user_claim_json_pointer="false" \
        claim_mappings="tenant_id=tenant_id,user_id=user_id,preferred_username=preferred_username" \
        token_policies="read-only" \
        token_ttl="30m" \
        token_max_ttl="2h" \
        bound_claims_type="glob" \
        bound_claims='{
            "realm_access": {
                "roles": ["matric-monitor-service"]
            }
        }'
    
    log_success "Monitoring service role created"
}

# Create sample secrets structure
create_sample_secrets() {
    log_info "Creating sample secrets structure..."
    
    # Create common configuration
    vault kv put secret/common/config \
        database_url="postgresql://localhost:5432/matric" \
        redis_url="redis://localhost:6379" \
        log_level="info"
    
    # Create sample tenant secrets
    vault kv put secret/tenants/tenant-001/config \
        name="Acme Corporation" \
        plan="enterprise" \
        max_users="1000" \
        features='["analytics", "api_access", "sso"]'
    
    vault kv put secret/tenants/tenant-001/database \
        host="db.tenant-001.matric.internal" \
        username="tenant_001_user" \
        password="secure_tenant_password_001"
    
    vault kv put secret/tenants/tenant-002/config \
        name="Beta Solutions" \
        plan="professional" \
        max_users="100" \
        features='["analytics", "api_access"]'
    
    # Create sample user secrets
    vault kv put secret/users/user-123/preferences \
        theme="dark" \
        language="en" \
        notifications="true"
    
    vault kv put secret/users/user-123/api-keys \
        external_service_key="sk_test_12345" \
        webhook_secret="whsec_67890"
    
    log_success "Sample secrets structure created"
}

# Verify configuration
verify_configuration() {
    log_info "Verifying configuration..."
    
    # List auth methods
    echo "Enabled authentication methods:"
    vault auth list
    
    # List policies
    echo -e "\nCreated policies:"
    vault policy list | grep -E "(tenant-access|service-admin|read-only)"
    
    # List JWT roles
    echo -e "\nCreated JWT roles:"
    vault list auth/jwt/role
    
    # Show JWT config
    echo -e "\nJWT configuration:"
    vault read auth/jwt/config
    
    log_success "Configuration verification completed"
}

# Main execution
main() {
    log_info "Starting Vault JWT authentication configuration..."
    log_info "Vault Address: ${VAULT_ADDR}"
    log_info "Keycloak URL: ${KEYCLOAK_URL}"
    log_info "Keycloak Realm: ${KEYCLOAK_REALM}"
    
    check_vault_status
    check_keycloak_status
    vault_auth
    enable_jwt_auth
    configure_jwt_auth
    create_tenant_policies
    create_jwt_roles
    create_sample_secrets
    verify_configuration
    
    log_success "Vault JWT authentication configuration completed successfully!"
    
    echo -e "\n${GREEN}Next steps:${NC}"
    echo "1. Configure Keycloak clients with appropriate roles (matric-service, matric-admin-service, matric-monitor-service)"
    echo "2. Add custom claims (tenant_id, user_id) to JWT tokens in Keycloak"
    echo "3. Test service authentication using the provided examples"
    echo "4. Review and customize policies based on your specific requirements"
    
    echo -e "\n${YELLOW}Important notes:${NC}"
    echo "- Tokens have a TTL of 15-30 minutes and max TTL of 1-2 hours"
    echo "- Access is automatically scoped to tenant_id and user_id from JWT claims"
    echo "- Services can only access secrets within their tenant scope"
    echo "- Admin services have broader access across all tenants"
}

# Execute main function
main "$@"