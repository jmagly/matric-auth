# HashiCorp Vault Configuration for MATRIC Development
# This configuration is for development purposes only
# DO NOT use in production environments

ui = true

# Disable mlock for development (not recommended for production)
disable_mlock = true

# Storage backend (file storage for development)
storage "file" {
  path = "/vault/data"
}

# Listener configuration
listener "tcp" {
  address = "0.0.0.0:8200"
  tls_disable = true
}

# API address
api_addr = "http://0.0.0.0:8200"

# Cluster address
cluster_addr = "http://0.0.0.0:8201"

# Logging configuration
log_level = "Info"
log_format = "standard"

# Telemetry (disabled for development)
telemetry {
  disable_hostname = true
}

# Default lease settings
default_lease_ttl = "24h"
max_lease_ttl = "720h"

# Raw storage endpoint (disabled for security)
raw_storage_endpoint = false

# Performance settings for development
cache_size = "32000"