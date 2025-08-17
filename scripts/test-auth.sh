#!/bin/bash
# Test script to verify Keycloak authentication is working

set -e

KEYCLOAK_URL=${KEYCLOAK_URL:-http://localhost:8081}
REALM=${REALM:-matric-dev}

echo "🔐 Testing Keycloak Authentication"
echo "==================================="
echo ""

# Function to test authentication
test_auth() {
    local username=$1
    local password=$2
    local expected_role=$3
    
    echo "Testing: $username (expecting role: $expected_role)"
    
    # Get token
    RESPONSE=$(curl -s -X POST "$KEYCLOAK_URL/realms/$REALM/protocol/openid-connect/token" \
      -H "Content-Type: application/x-www-form-urlencoded" \
      -d "grant_type=password" \
      -d "client_id=matric-dashboard" \
      -d "username=$username" \
      -d "password=$password")
    
    if echo "$RESPONSE" | grep -q "access_token"; then
        # Extract and decode token
        ACCESS_TOKEN=$(echo "$RESPONSE" | jq -r '.access_token')
        CLAIMS=$(echo "$ACCESS_TOKEN" | cut -d. -f2 | base64 -d 2>/dev/null)
        
        # Check for expected role
        if echo "$CLAIMS" | jq -e ".realm_access.roles | contains([\"$expected_role\"])" > /dev/null 2>&1; then
            echo "  ✅ Authentication successful - role verified"
        else
            echo "  ⚠️  Authentication successful - but role mismatch"
            echo "     Expected: $expected_role"
            echo "     Got: $(echo "$CLAIMS" | jq -c '.realm_access.roles')"
        fi
        
        # Check tenant_id
        TENANT=$(echo "$CLAIMS" | jq -r '.tenant_id // "not found"')
        echo "  📍 Tenant: $TENANT"
        
    else
        echo "  ❌ Authentication failed"
        echo "     Error: $(echo "$RESPONSE" | jq -r '.error_description // .error // "Unknown error"')"
    fi
    echo ""
}

# Check if Keycloak is running
echo "Checking Keycloak status..."
if curl -s -f "$KEYCLOAK_URL/health/ready" > /dev/null 2>&1; then
    echo "✅ Keycloak is running"
else
    echo "❌ Keycloak is not running or not ready"
    echo "   Run: ./scripts/keycloak/bootstrap-dev.sh"
    exit 1
fi
echo ""

# Check realm exists
echo "Checking realm configuration..."
if curl -s -f "$KEYCLOAK_URL/realms/$REALM" > /dev/null 2>&1; then
    echo "✅ Realm '$REALM' exists"
else
    echo "❌ Realm '$REALM' not found"
    exit 1
fi
echo ""

# Test each user
echo "Testing user authentication..."
echo "------------------------------"
test_auth "admin@matric.local" "admin123" "admin"
test_auth "developer@matric.local" "dev123" "developer"
test_auth "viewer@matric.local" "view123" "viewer"

# Test service account
echo "Testing service account..."
echo "-------------------------"
RESPONSE=$(curl -s -X POST "$KEYCLOAK_URL/realms/$REALM/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=matric-api-gateway" \
  -d "client_secret=dev-secret-change-in-production")

if echo "$RESPONSE" | grep -q "access_token"; then
    echo "✅ Service account authentication successful"
else
    echo "❌ Service account authentication failed"
fi
echo ""

# Test JWKS endpoint
echo "Testing JWKS endpoint..."
echo "-----------------------"
if curl -s -f "$KEYCLOAK_URL/realms/$REALM/protocol/openid-connect/certs" | jq -e '.keys | length > 0' > /dev/null 2>&1; then
    echo "✅ JWKS endpoint working"
else
    echo "❌ JWKS endpoint not working"
fi
echo ""

# Test OpenID configuration
echo "Testing OpenID configuration..."
echo "-------------------------------"
CONFIG=$(curl -s "$KEYCLOAK_URL/realms/$REALM/.well-known/openid-configuration")
if echo "$CONFIG" | jq -e '.issuer' > /dev/null 2>&1; then
    echo "✅ OpenID configuration available"
    echo "  • Issuer: $(echo "$CONFIG" | jq -r '.issuer')"
    echo "  • Token endpoint: $(echo "$CONFIG" | jq -r '.token_endpoint')"
    echo "  • JWKS URI: $(echo "$CONFIG" | jq -r '.jwks_uri')"
else
    echo "❌ OpenID configuration not available"
fi
echo ""

echo "==================================="
echo "🎉 Authentication tests complete!"
echo ""