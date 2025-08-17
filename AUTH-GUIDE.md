# MATRIC Authentication Guide

## Overview

MATRIC uses Keycloak 26.3.2 as its centralized Identity and Access Management (IAM) solution. This guide covers all authentication interfaces, user management features, and integration patterns.

## Quick Start

### Access Points

#### User Self-Service
- **Account Management**: http://localhost:8081/realms/matric-dev/account
  - View/edit profile
  - Change password
  - Manage sessions
  - Configure 2FA
  
- **User Registration**: http://localhost:8081/realms/matric-dev/protocol/openid-connect/registrations?client_id=account&response_type=code

- **Password Reset**: http://localhost:8081/realms/matric-dev/login-actions/reset-credentials?client_id=account

#### Admin Console
- **URL**: http://localhost:8081
- **Credentials**: admin / admin
- **Realm**: Switch to `matric-dev` to manage application users

#### Test Suite
- **Interactive Test Page**: Open `/test-auth-interfaces.html` in your browser
- **Test all authentication flows interactively**

## Test Accounts

| Username | Password | Role | Description |
|----------|----------|------|-------------|
| admin@matric.local | admin123 | admin | Full administrative access |
| developer@matric.local | dev123 | developer | Developer access |
| viewer@matric.local | view123 | viewer | Read-only access |

## Authentication Flows

### 1. ~~Password Grant (Direct Login)~~ DEPRECATED - SECURITY RISK

**⚠️ CRITICAL SECURITY WARNING:**
The Resource Owner Password Credentials (ROPC) grant is **DEPRECATED** and poses severe security risks:
- Exposes user credentials directly to the application
- Incompatible with MFA, SSO, and modern security features  
- Violates OAuth 2.1 and current security best practices
- Enables credential theft and phishing attacks

**NEVER USE THIS FLOW - Use Authorization Code + PKCE instead (see below)**
```javascript
// ⚠️ DO NOT USE - Shown only to recognize and remove this anti-pattern
// This exposes credentials and should NEVER be used in production
// const response = await fetch('...token', {
//   body: new URLSearchParams({
//     grant_type: 'password', // SECURITY RISK
//     username: 'user',       // EXPOSES CREDENTIALS
//     password: 'pass'        // EXPOSES CREDENTIALS  
//   })
// });
```

### 2. Authorization Code Flow with PKCE (SECURE - RECOMMENDED)
```javascript
// Step 1: Generate PKCE challenge
function generatePKCE() {
  const verifier = base64URLEncode(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = base64URLEncode(sha256(verifier));
  return { verifier, challenge };
}

const pkce = generatePKCE();
sessionStorage.setItem('pkce_verifier', pkce.verifier);

// Step 2: Redirect user to Keycloak login with PKCE
const authUrl = `http://localhost:8081/realms/matric-dev/protocol/openid-connect/auth?` +
  `client_id=matric-web&` +
  `redirect_uri=${encodeURIComponent(redirectUri)}&` +
  `response_type=code&` +
  `scope=openid profile email&` +
  `code_challenge=${pkce.challenge}&` +
  `code_challenge_method=S256`;

window.location.href = authUrl;

// Step 3: After redirect, exchange code for tokens with PKCE verifier
const tokenResponse = await fetch('http://localhost:8081/realms/matric-dev/protocol/openid-connect/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: 'matric-web',
    code: authorizationCode,
    redirect_uri: redirectUri,
    code_verifier: sessionStorage.getItem('pkce_verifier') // PKCE verifier
  })
});
```

### 3. Client Credentials (Service Accounts)
```javascript
// Machine-to-machine authentication
const response = await fetch('http://localhost:8081/realms/matric-dev/protocol/openid-connect/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: 'matric-service',
    client_secret: 'matric-service-secret'
  })
});
```

### 4. Refresh Token
```javascript
// Refresh an expired access token
const response = await fetch('http://localhost:8081/realms/matric-dev/protocol/openid-connect/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: 'matric-web',
    refresh_token: refreshToken
  })
});
```

## API Endpoints

### OpenID Connect Discovery
- **Configuration**: `GET /realms/matric-dev/.well-known/openid-configuration`
- **JWKS (Public Keys)**: `GET /realms/matric-dev/protocol/openid-connect/certs`

### Token Operations
- **Token Endpoint**: `POST /realms/matric-dev/protocol/openid-connect/token`
- **User Info**: `GET /realms/matric-dev/protocol/openid-connect/userinfo`
- **Token Introspection**: `POST /realms/matric-dev/protocol/openid-connect/token/introspect`
- **Logout**: `POST /realms/matric-dev/protocol/openid-connect/logout`

## Integration Examples

### React Integration
```typescript
// See examples/react-integration.tsx for full implementation
import { ReactKeycloakProvider } from '@react-keycloak/web';

const keycloak = new Keycloak({
  url: 'http://localhost:8081',
  realm: 'matric-dev',
  clientId: 'matric-web',
});

<ReactKeycloakProvider authClient={keycloak}>
  <App />
</ReactKeycloakProvider>
```

### Express/Node.js Integration
```typescript
// See examples/express-integration.ts for full implementation
import Keycloak from 'keycloak-connect';

const keycloak = new Keycloak({}, {
  realm: 'matric-dev',
  'auth-server-url': 'http://localhost:8081',
  resource: 'matric-service',
  'bearer-only': true,
});

app.use(keycloak.middleware());
app.get('/api/protected', keycloak.protect(), handler);
```

## User Management Features

### Self-Service Capabilities
1. **Profile Management**
   - Update personal information
   - Change email address
   - Manage linked accounts

2. **Password Management**
   - Change password
   - Reset forgotten password
   - Password policy enforcement

3. **Session Management**
   - View active sessions
   - Logout from specific devices
   - Logout from all devices

4. **Application Access**
   - View authorized applications
   - Revoke application access
   - Review permissions

### Admin Capabilities
1. **User Administration**
   - Create/delete users
   - Reset passwords
   - Enable/disable accounts
   - Assign roles and groups

2. **Role Management**
   - Create custom roles
   - Assign permissions
   - Role hierarchy

3. **Security Settings**
   - Configure password policies
   - Set up brute force protection
   - Enable 2FA/MFA
   - Configure session timeouts

## Security Best Practices

### Token Management
- Access tokens expire in 5 minutes (configurable)
- Refresh tokens expire in 30 minutes (configurable)
- Always validate tokens on the backend
- Use HTTPS in production

### CORS Configuration
```javascript
// Configure CORS for your frontend domain
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://your-production-domain.com'
];
```

### Role-Based Access Control (RBAC)
```typescript
// Check user roles in your application
if (token.realm_access?.roles?.includes('admin')) {
  // Admin functionality
}
```

## Troubleshooting

### Common Issues

1. **Users not visible in admin console**
   - Make sure you're viewing the correct realm (matric-dev, not master)
   - Check realm selector in top-left corner

2. **Authentication fails with "Client not allowed for direct access grants"**  
   - This is intentional! Direct Access Grants (password grant) is disabled for security
   - Use Authorization Code Flow with PKCE instead - see section 2 above

3. **CORS errors**
   - Add your frontend URL to Web Origins in client configuration

4. **Token validation fails**
   - Ensure clock synchronization between client and server
   - Check token expiration settings

### Useful Scripts

```bash
# Verify users in both realms
./scripts/verify-users.sh

# Create test users
./scripts/create-users.sh

# Enable account management features
./scripts/enable-account-console.sh

# Test authentication
./scripts/test-auth.sh
```

## Docker Commands

```bash
# Start Keycloak
docker-compose -f docker/docker-compose.yml up -d

# View logs
docker logs -f matric-keycloak

# Stop Keycloak
docker-compose -f docker/docker-compose.yml down

# Reset everything (careful!)
docker-compose -f docker/docker-compose.yml down -v
```

## Environment Variables

```bash
# Keycloak configuration
KC_BOOTSTRAP_ADMIN_USERNAME=admin
KC_BOOTSTRAP_ADMIN_PASSWORD=admin
KC_DB=postgres
KC_DB_URL=jdbc:postgresql://postgres:5432/keycloak
KC_DB_USERNAME=keycloak
KC_DB_PASSWORD=keycloak_dev_2024
```

## Next Steps

1. **Configure Email**
   - Set up SMTP for password reset emails
   - Configure email templates

2. **Enable 2FA**
   - Configure OTP authentication
   - Set up backup codes

3. **Custom Claims**
   - Add tenant_id to tokens
   - Include user metadata

4. **Production Setup**
   - Enable HTTPS
   - Configure proper secrets
   - Set up high availability
   - Enable audit logging

## Support

For issues or questions:
1. Check the [Keycloak documentation](https://www.keycloak.org/documentation)
2. Review the test suite at `/test-auth-interfaces.html`
3. Examine integration examples in `/examples/`