# MATRIC Authentication System

A comprehensive authentication and secrets management system using Keycloak and HashiCorp Vault for the MATRIC platform.

## 🚀 Quick Start

```bash
# 1. Start all services
docker-compose -f docker-compose.yml -f docker-compose.vault.yml up -d

# 2. Run complete setup
./scripts/setup-complete-auth.sh

# 3. Test the configuration
./scripts/test-vault-jwt.sh
```

## 🏗️ Architecture

- **Keycloak**: OpenID Connect identity provider for user authentication
- **Vault**: Secrets management with JWT-based service authentication
- **Multi-tenant**: User and tenant-scoped access control
- **Production Ready**: Environment-based configuration with proper security

## 🔧 Services

| Service | URL | Credentials |
|---------|-----|-------------|
| Vault UI | http://localhost:8200/ui | Token: `matric-dev-root-token` |
| Keycloak Admin | http://localhost:8081/admin | admin/admin |
| Keycloak Realm | http://localhost:8081/realms/matric-dev | - |

## 🔐 Features

### ✅ Working Features

- **User-specific secrets**: `secret/users/{email}/*`
- **Tenant-scoped secrets**: `secret/tenants/{tenant-id}/*`
- **Role-based access**: 3 service roles with different permissions
- **Full CRUD operations**: Create, Read, Update, Delete secrets
- **Dynamic policies**: Identity templating for scalable access control
- **Environment configuration**: `.env.local` for local development

### 🚧 In Progress

- **JWT token validation**: Keycloak JWKS endpoint configuration
- **Real token authentication**: Full JWT flow testing

## 📋 Secret Structure

```
secret/
├── common/config              # Shared configuration
├── tenants/
│   ├── tenant-001/config      # Tenant-specific secrets
│   └── company-xyz/database   # Another tenant's secrets
└── users/
    ├── developer@matric.local/preferences  # User-specific secrets
    └── admin@matric.local/preferences      # Another user's secrets
```

## 🛡️ Security Policies

| Policy | Description | Access Pattern |
|--------|-------------|----------------|
| `user-secrets` | User's own secrets only | `secret/users/{{user}}/*` |
| `tenant-access` | User + tenant scoped | `secret/{users,tenants}/{{scope}}/*` |
| `service-admin` | Full access for admin services | `secret/*` |

## 🎯 Service Roles

| Role | Policy | Use Case | TTL |
|------|--------|----------|-----|
| `matric-service` | `tenant-access` | Standard service auth | 1h |
| `matric-admin-service` | `service-admin` | Admin operations | 1h |
| `matric-monitor-service` | `user-secrets` | Read-only monitoring | 30m |

## 🧪 Testing

```bash
# Run all tests
./scripts/test-vault-jwt.sh

# Test CRUD operations
vault kv get secret/users/developer@matric.local/preferences
vault kv put secret/users/developer@matric.local/preferences theme=light
vault kv delete secret/users/developer@matric.local/preferences

# List all secrets for a user
vault kv list secret/users/developer@matric.local/
```

## 🔧 Development

### Environment Configuration

Copy and modify `.env.local` for your environment:

```bash
cp .env.local.example .env.local
# Edit values as needed
```

### Available Scripts

- `./scripts/setup-complete-auth.sh` - Complete setup from scratch
- `./scripts/test-vault-jwt.sh` - Run all tests
- `./scripts/start-with-vault.sh` - Start services with Vault
- `./scripts/configure-vault-jwt.sh` - Configure JWT (when JWKS works)

## 📚 Integration Examples

See `/examples` directory for:
- `vault-service-auth.py` - Python FastAPI integration
- `vault-service-auth.js` - Node.js Express integration

## 🗺️ Architecture Documentation

See `ARCHITECTURE.md` for:
- C4 system diagrams
- Authentication sequence flows
- Security architecture
- Integration patterns

## 🏃‍♂️ Next Steps

1. **Complete JWT Configuration**: Fix Keycloak JWKS endpoint networking
2. **Real Token Testing**: Test authentication with actual Keycloak JWTs
3. **Service Integration**: Implement in MATRIC platform services
4. **Production Deployment**: Configure for production environments

## 🤝 Contributing

This system is designed for the MATRIC platform. When making changes:

1. Test with `./scripts/test-vault-jwt.sh`
2. Update documentation if adding features
3. Follow security best practices
4. Use environment variables for configuration

## 📄 License

Part of the MATRIC platform - see main repository for license information.