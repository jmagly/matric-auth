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

# Allow reading system health
path "sys/health" {
  capabilities = ["read"]
}

# Allow reading system metrics
path "sys/metrics" {
  capabilities = ["read"]
}

# Allow reading auth methods
path "sys/auth" {
  capabilities = ["read"]
}

# Allow reading mount points
path "sys/mounts" {
  capabilities = ["read"]
}