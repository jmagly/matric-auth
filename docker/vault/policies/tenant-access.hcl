# Tenant-scoped access policy template
# This policy allows access to tenant-specific secrets using templated paths
# The tenant_id comes from JWT claims and is automatically substituted

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