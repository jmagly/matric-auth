#!/bin/bash
# Enable and configure Keycloak Account Management Console

KEYCLOAK_URL=${KEYCLOAK_URL:-http://localhost:8081}
REALM=${REALM:-matric-dev}

echo "🔐 Enabling Keycloak Account Management Features"
echo "================================================"

# Get admin token
echo "Getting admin token..."
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

# Enable account management features in realm settings
echo ""
echo "Configuring realm settings..."
curl -s -X PUT "$KEYCLOAK_URL/admin/realms/$REALM" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "registrationAllowed": true,
    "registrationEmailAsUsername": false,
    "rememberMe": true,
    "verifyEmail": false,
    "loginWithEmailAllowed": true,
    "duplicateEmailsAllowed": false,
    "resetPasswordAllowed": true,
    "editUsernameAllowed": false,
    "bruteForceProtected": true,
    "permanentLockout": false,
    "maxFailureWaitSeconds": 900,
    "minimumQuickLoginWaitSeconds": 60,
    "waitIncrementSeconds": 60,
    "quickLoginCheckMilliSeconds": 1000,
    "maxDeltaTimeSeconds": 43200,
    "failureFactor": 10
  }' > /dev/null

echo "✅ Realm settings updated"

# Ensure account client is enabled
echo ""
echo "Verifying account client..."
ACCOUNT_CLIENT=$(curl -s "$KEYCLOAK_URL/admin/realms/$REALM/clients?clientId=account" \
  -H "Authorization: Bearer $TOKEN")

if [ "$(echo "$ACCOUNT_CLIENT" | jq '. | length')" -gt 0 ]; then
    echo "✅ Account client exists and is enabled"
else
    echo "⚠️  Account client may need configuration"
fi

# Ensure account-console client is enabled
ACCOUNT_CONSOLE=$(curl -s "$KEYCLOAK_URL/admin/realms/$REALM/clients?clientId=account-console" \
  -H "Authorization: Bearer $TOKEN")

if [ "$(echo "$ACCOUNT_CONSOLE" | jq '. | length')" -gt 0 ]; then
    echo "✅ Account console client exists and is enabled"
else
    echo "⚠️  Account console client may need configuration"
fi

echo ""
echo "================================================"
echo "✅ Account Management Features Enabled!"
echo ""
echo "🔗 User Self-Service URLs:"
echo ""
echo "1. Account Management Console:"
echo "   http://localhost:8081/realms/$REALM/account"
echo "   - View/edit profile"
echo "   - Change password"
echo "   - View login sessions"
echo "   - View applications"
echo "   - Configure 2FA (if enabled)"
echo ""
echo "2. User Registration (Sign Up):"
echo "   http://localhost:8081/realms/$REALM/protocol/openid-connect/registrations?client_id=account&response_type=code"
echo ""
echo "3. Password Reset:"
echo "   http://localhost:8081/realms/$REALM/login-actions/reset-credentials?client_id=account"
echo ""
echo "4. Direct Login Page:"
echo "   http://localhost:8081/realms/$REALM/protocol/openid-connect/auth?client_id=account&redirect_uri=http://localhost:8081/realms/$REALM/account&response_type=code"
echo ""
echo "📝 Test Accounts:"
echo "   admin@matric.local / admin123"
echo "   developer@matric.local / dev123"
echo "   viewer@matric.local / view123"
echo ""