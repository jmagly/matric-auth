#!/bin/bash
# Script to create the matric-web client for static site authentication

KEYCLOAK_URL=${KEYCLOAK_URL:-http://localhost:8081}
REALM=${REALM:-matric-dev}

echo "🔐 Creating matric-web client in Keycloak..."
echo "=========================================="

# Wait for Keycloak to be ready
echo "⏳ Waiting for Keycloak..."
while ! curl -s -f "$KEYCLOAK_URL/admin/" > /dev/null 2>&1; do
    sleep 2
done
echo "✅ Keycloak is ready"

# Get admin token
echo "🔑 Getting admin token..."
TOKEN=$(curl -s -X POST "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=admin-cli" \
  -d "username=admin" \
  -d "password=admin" | jq -r '.access_token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
    echo "❌ Failed to get admin token"
    exit 1
fi

echo "✅ Admin token obtained"

# Create the matric-web client (public client for SPAs)
echo ""
echo "📝 Creating matric-web client..."

CLIENT_RESPONSE=$(curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM/clients" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "matric-web",
    "name": "MATRIC Web Application",
    "description": "Public client for MATRIC React applications",
    "enabled": true,
    "publicClient": true,
    "standardFlowEnabled": true,
    "implicitFlowEnabled": false,
    "directAccessGrantsEnabled": true,
    "serviceAccountsEnabled": false,
    "authorizationServicesEnabled": false,
    "protocol": "openid-connect",
    "attributes": {
      "pkce.code.challenge.method": "S256",
      "post.logout.redirect.uris": "+",
      "oauth2.device.authorization.grant.enabled": "false",
      "backchannel.logout.session.required": "true",
      "backchannel.logout.revoke.offline.tokens": "false"
    },
    "fullScopeAllowed": true,
    "nodeReRegistrationTimeout": -1,
    "defaultClientScopes": [
      "web-origins",
      "profile",
      "roles",
      "email"
    ],
    "optionalClientScopes": [
      "address",
      "phone",
      "offline_access",
      "microprofile-jwt"
    ],
    "redirectUris": [
      "http://localhost:3000/*",
      "http://localhost:3001/*",
      "http://localhost:5173/*",
      "http://localhost:5174/*",
      "http://localhost:4200/*",
      "http://localhost:8080/*",
      "http://127.0.0.1:3000/*",
      "http://127.0.0.1:5173/*"
    ],
    "webOrigins": [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:4200",
      "http://localhost:8080",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:5173"
    ]
  }')

# Check if client was created
if echo "$CLIENT_RESPONSE" | grep -q "Client matric-web already exists"; then
    echo "⚠️  Client matric-web already exists"
    
    # Get existing client ID
    CLIENT_ID=$(curl -s "$KEYCLOAK_URL/admin/realms/$REALM/clients?clientId=matric-web" \
      -H "Authorization: Bearer $TOKEN" | jq -r '.[0].id')
    
    if [ "$CLIENT_ID" != "null" ] && [ -n "$CLIENT_ID" ]; then
        echo "Updating existing client configuration..."
        
        # Update the existing client
        curl -s -X PUT "$KEYCLOAK_URL/admin/realms/$REALM/clients/$CLIENT_ID" \
          -H "Authorization: Bearer $TOKEN" \
          -H "Content-Type: application/json" \
          -d '{
            "id": "'$CLIENT_ID'",
            "clientId": "matric-web",
            "name": "MATRIC Web Application",
            "description": "Public client for MATRIC React applications",
            "enabled": true,
            "publicClient": true,
            "standardFlowEnabled": true,
            "implicitFlowEnabled": false,
            "directAccessGrantsEnabled": true,
            "serviceAccountsEnabled": false,
            "authorizationServicesEnabled": false,
            "protocol": "openid-connect",
            "attributes": {
              "pkce.code.challenge.method": "S256",
              "post.logout.redirect.uris": "+",
              "oauth2.device.authorization.grant.enabled": "false",
              "backchannel.logout.session.required": "true",
              "backchannel.logout.revoke.offline.tokens": "false"
            },
            "fullScopeAllowed": true,
            "redirectUris": [
              "http://localhost:3000/*",
              "http://localhost:3001/*",
              "http://localhost:5173/*",
              "http://localhost:5174/*",
              "http://localhost:4200/*",
              "http://localhost:8080/*",
              "http://127.0.0.1:3000/*",
              "http://127.0.0.1:5173/*"
            ],
            "webOrigins": [
              "http://localhost:3000",
              "http://localhost:3001",
              "http://localhost:5173",
              "http://localhost:5174",
              "http://localhost:4200",
              "http://localhost:8080",
              "http://127.0.0.1:3000",
              "http://127.0.0.1:5173"
            ]
          }'
        
        echo "✅ Client matric-web updated"
    fi
else
    echo "✅ Client matric-web created successfully"
fi

# Also create the matric-service client for backend services
echo ""
echo "📝 Creating matric-service client..."

SERVICE_RESPONSE=$(curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM/clients" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "matric-service",
    "name": "MATRIC Backend Services",
    "description": "Confidential client for MATRIC backend services",
    "enabled": true,
    "publicClient": false,
    "standardFlowEnabled": false,
    "implicitFlowEnabled": false,
    "directAccessGrantsEnabled": false,
    "serviceAccountsEnabled": true,
    "authorizationServicesEnabled": false,
    "protocol": "openid-connect",
    "secret": "matric-service-secret",
    "attributes": {
      "use.refresh.tokens": "true",
      "client_credentials.use_refresh_token": "true"
    },
    "fullScopeAllowed": true
  }')

if echo "$SERVICE_RESPONSE" | grep -q "Client matric-service already exists"; then
    echo "⚠️  Client matric-service already exists"
else
    echo "✅ Client matric-service created successfully"
fi

echo ""
echo "=========================================="
echo "✅ Client Configuration Complete!"
echo ""
echo "Clients created/updated:"
echo "  1. matric-web (Public Client for SPAs)"
echo "     - Uses PKCE for security"
echo "     - No client secret required"
echo "     - Configured for localhost development"
echo ""
echo "  2. matric-service (Confidential Client for Backend)"
echo "     - Service account enabled"
echo "     - Client secret: matric-service-secret"
echo "     - For machine-to-machine authentication"
echo ""
echo "Ready to test at http://localhost:3000"
echo ""