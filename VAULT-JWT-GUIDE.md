# Vault JWT Authentication with Keycloak Integration

This guide explains how to configure HashiCorp Vault JWT authentication for service-to-service authentication using Keycloak-issued tokens with dynamic tenant-scoped access.

## Overview

The integration provides:

1. **JWT Authentication Method** - Services authenticate using Keycloak-issued JWTs
2. **Dynamic Tenant Scoping** - Access automatically scoped based on JWT claims (`tenant_id`, `user_id`)
3. **Policy Templates** - Policies that scale to hundreds of tenants without manual management
4. **Role-Based Access** - Different service roles with appropriate permissions
5. **Automatic Token Management** - Token refresh and renewal handled automatically

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Service A     │    │   Service B     │    │   Service C     │
│  (tenant-001)   │    │  (tenant-002)   │    │   (admin)       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │ JWT Token              │ JWT Token             │ JWT Token
         │ + tenant_id            │ + tenant_id           │ + admin role
         │ + user_id              │ + user_id             │
         ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    HashiCorp Vault                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ JWT Auth Method │  │   Policy Engine │  │  KV Store v2    │ │
│  │                 │  │                 │  │                 │ │
│  │ • Validates JWT │  │ • tenant-access │  │ • /tenants/     │ │
│  │ • Maps claims   │  │ • service-admin │  │ • /users/       │ │
│  │ • Issues token  │  │ • read-only     │  │ • /common/      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
         ▲
         │ JWKS/OIDC
         │
┌─────────────────────────────────────────────────────────────────┐
│                         Keycloak                                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Realm:        │  │  Custom Claim   │  │   Service       │ │
│  │  matric-dev     │  │   Mappers       │  │   Accounts      │ │
│  │                 │  │                 │  │                 │ │
│  │ • Clients       │  │ • tenant_id     │  │ • Credentials   │ │
│  │ • Roles         │  │ • user_id       │  │ • Roles         │ │
│  │ • Users         │  │ • roles         │  │ • Scopes        │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Start Services

```bash
# Start Keycloak and PostgreSQL
cd docker
docker-compose up -d

# Start Vault alongside existing services
docker-compose -f docker-compose.yml -f docker-compose.vault.yml up -d
```

### 2. Configure Vault (Automatic)

The `vault-init` service automatically configures Vault when started. To run manually:

```bash
# Make the script executable
chmod +x scripts/configure-vault-jwt.sh

# Run configuration script
./scripts/configure-vault-jwt.sh
```

### 3. Configure Keycloak

You need to add custom claim mappers to your Keycloak client:

1. **Access Keycloak Admin Console**: http://localhost:8081/admin
2. **Navigate to**: Clients → matric-platform → Client scopes → matric-platform-dedicated
3. **Add Mappers**:

   **Tenant ID Mapper**:
   - Name: `tenant-id-mapper`
   - Mapper Type: `User Attribute`
   - User Attribute: `tenant_id`
   - Token Claim Name: `tenant_id`
   - Claim JSON Type: `String`

   **User ID Mapper**:
   - Name: `user-id-mapper`
   - Mapper Type: `User Attribute`
   - User Attribute: `user_id`
   - Token Claim Name: `user_id`
   - Claim JSON Type: `String`

4. **Configure Service Roles**:
   - Create realm roles: `matric-service`, `matric-admin-service`, `matric-monitor-service`
   - Assign appropriate roles to service accounts

### 4. Test Authentication

```bash
# Test with Python example
cd examples
python3 vault-service-auth.py

# Test with Node.js example
npm install axios
node vault-service-auth.js
```

## Service Roles and Policies

### 1. Default Service Role (`matric-service`)

**Policy**: `tenant-access`
**Access**: 
- `secret/tenants/{tenant-id}/*` (read/write)
- `secret/users/{user-id}/*` (read/write)
- `secret/common/config` (read-only)

**Use Case**: Standard application services that need tenant-scoped access

### 2. Admin Service Role (`matric-admin-service`)

**Policy**: `service-admin`
**Access**:
- `secret/tenants/*` (full access)
- `secret/users/*` (full access)
- `secret/common/*` (full access)

**Use Case**: Administrative services, data migration tools, system management

### 3. Monitor Service Role (`matric-monitor-service`)

**Policy**: `read-only`
**Access**:
- `secret/*` (read-only)
- `sys/health`, `sys/metrics` (read-only)

**Use Case**: Monitoring, audit, backup services

## Secrets Organization

```
secret/
├── tenants/
│   ├── tenant-001/
│   │   ├── config          # Tenant configuration
│   │   ├── database        # Database credentials
│   │   ├── api-keys        # External API keys
│   │   └── certificates    # SSL certificates
│   └── tenant-002/
│       └── ...
├── users/
│   ├── user-123/
│   │   ├── preferences     # User preferences
│   │   ├── api-keys        # Personal API keys
│   │   └── tokens          # OAuth tokens
│   └── user-456/
│       └── ...
└── common/
    ├── config              # Global configuration
    ├── service-accounts    # Service credentials
    └── certificates        # Shared certificates
```

## Implementation Examples

### Python Service

```python
from vault_service_auth import TenantService

# Initialize service with tenant context
service = TenantService("tenant-001", "user-123")

# Get tenant-specific database config
db_config = service.get_tenant_database_config()

# Store user API key
service.store_user_api_key("external_service", "sk_12345")
```

### Node.js Service

```javascript
const { TenantService } = require('./vault-service-auth');

// Initialize service with tenant context
const service = new TenantService('tenant-001', 'user-123');

// Get tenant configuration
const config = await service.getTenantConfig();

// Initialize database connection
const dbConnection = await service.initializeDatabaseConnection();
```

## Token Lifecycle

1. **Token Request**: Service requests JWT from Keycloak using client credentials
2. **Claim Injection**: Keycloak adds `tenant_id`, `user_id`, and roles to JWT
3. **Vault Authentication**: Service presents JWT to Vault JWT auth method
4. **Policy Application**: Vault applies appropriate policy based on role
5. **Scoped Access**: Policy templates substitute claim values for dynamic scoping
6. **Token Renewal**: Vault tokens automatically renewed before expiration

## Security Considerations

### Development Environment

- Root token: `matric-dev-root-token` (change in production)
- TLS disabled (enable in production)
- Permissive CORS settings (restrict in production)

### Production Recommendations

1. **Enable TLS**:
   ```hcl
   listener "tcp" {
     address = "0.0.0.0:8200"
     tls_cert_file = "/path/to/cert.pem"
     tls_key_file = "/path/to/key.pem"
   }
   ```

2. **Use External Storage**:
   ```hcl
   storage "postgresql" {
     connection_url = "postgres://vault:password@localhost/vault"
   }
   ```

3. **Enable Audit Logging**:
   ```bash
   vault audit enable file file_path=/vault/logs/audit.log
   ```

4. **Rotate Tokens**:
   - Implement regular token rotation
   - Use short-lived tokens (15-30 minutes)
   - Monitor token usage

## Scaling to Hundreds of Tenants

The configuration automatically scales without manual intervention:

1. **Dynamic Policies**: Use templated paths with JWT claims
2. **No Per-Tenant Policies**: Single policy works for all tenants
3. **Automatic Scoping**: Access automatically limited by JWT claims
4. **Efficient Storage**: Hierarchical secret organization
5. **Role-Based Access**: Different service types get appropriate permissions

## Troubleshooting

### Common Issues

1. **JWT Validation Fails**:
   - Verify Keycloak is accessible from Vault
   - Check JWKS URL configuration
   - Ensure token audience matches configuration

2. **Access Denied**:
   - Verify JWT contains required claims (`tenant_id`, `user_id`)
   - Check role assignments in Keycloak
   - Confirm policy allows access to requested path

3. **Token Expired**:
   - Implement automatic token renewal
   - Check token TTL settings
   - Monitor token lifecycle

### Debug Commands

```bash
# Check Vault status
vault status

# List auth methods
vault auth list

# Check JWT configuration
vault read auth/jwt/config

# Test token
vault write auth/jwt/login role=matric-service jwt=$JWT_TOKEN

# Check policies
vault policy list
vault policy read tenant-access
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VAULT_ADDR` | `http://localhost:8200` | Vault server address |
| `VAULT_ROOT_TOKEN` | `matric-dev-root-token` | Vault root token |
| `KEYCLOAK_URL` | `http://localhost:8081` | Keycloak server URL |
| `KEYCLOAK_REALM` | `matric-dev` | Keycloak realm name |
| `KEYCLOAK_CLIENT_SECRET` | `dev-secret` | Client secret for authentication |

## Monitoring and Metrics

Vault provides comprehensive metrics and monitoring:

```bash
# Health check
curl http://localhost:8200/v1/sys/health

# Metrics (Prometheus format)
curl http://localhost:8200/v1/sys/metrics

# Audit logs
tail -f /vault/logs/audit.log
```

## Next Steps

1. **Production Deployment**: Review security configurations
2. **Custom Policies**: Create application-specific policies
3. **Monitoring Setup**: Configure monitoring and alerting
4. **Backup Strategy**: Implement regular backups
5. **Disaster Recovery**: Plan for failover scenarios

For more detailed configuration options and advanced features, refer to the HashiCorp Vault documentation and Keycloak integration guides.