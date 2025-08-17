# MATRIC Authentication Service

Authentication and identity management for the MATRIC platform using Keycloak.

## Status: ✅ Production Ready

This repository contains all authentication-related configuration, scripts, and deployment manifests for the MATRIC platform. It uses Keycloak 26.0.2 as the identity provider with OIDC-only configuration (SAML disabled for security).

## Quick Start

```bash
# Start Keycloak locally
./scripts/start-keycloak.sh

# Create test users
./scripts/create-users.sh

# Run the demo application
cd examples/static-site-demo
npm install
npm start
```

Access:
- **Keycloak Admin**: http://localhost:8081/admin (admin/admin)
- **Demo App**: http://localhost:3000

## Repository Structure

```
matric-auth/
├── docker/                 # Docker configurations
│   ├── Dockerfile         # Custom Keycloak image (if needed)
│   └── docker-compose.yml # Standalone Keycloak compose
├── realms/                # Realm configurations
│   ├── matric-dev.json    # Development realm
│   └── matric-prod.json   # Production realm
├── k8s/                   # Kubernetes manifests
│   ├── operator/          # Keycloak operator
│   ├── base/              # Base configurations
│   └── overlays/          # Environment overlays
├── scripts/               # Utility scripts
│   ├── bootstrap-dev.sh   # Dev setup
│   ├── get-token.sh       # Token helper
│   └── test-auth.sh       # Auth testing
├── tests/                 # Integration tests
│   └── integration.js     # Test suite
└── docs/                  # Documentation
    └── integration.md     # Integration guide
```

## Features

- **Keycloak 26.3.2** - Latest secure version with CVE patches
- **OIDC-only** - SAML disabled for security (CVE-2024-8698)
- **Multi-tenant** - Tenant isolation via claims
- **Development Ready** - Pre-configured test users
- **Production Ready** - Kubernetes operator deployment
- **Monitoring** - Prometheus metrics and health checks

## Test Users

| Email | Password | Role | Tenant |
|-------|----------|------|--------|
| admin@matric.local | admin123 | admin | demo-tenant |
| developer@matric.local | dev123 | developer | demo-tenant |
| viewer@matric.local | view123 | viewer | demo-tenant |

## Integration

This service integrates with:
- **matric-platform** - API Gateway validates JWTs
- **matric-web** - Dashboard and Studio use OIDC
- **matric-intelligence** - Service-to-service auth
- **matric-sdk-js** - OAuth2 token management

## Security

- SAML explicitly disabled (CVE-2024-8698)
- PKCE required for all public clients
- Brute force protection enabled
- TLS enforced in production
- Refresh token rotation for SPAs

## License

Part of the MATRIC platform.