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

# Allow reading system health for monitoring
path "sys/health" {
  capabilities = ["read"]
}

# Allow reading auth methods for debugging
path "sys/auth" {
  capabilities = ["read"]
}