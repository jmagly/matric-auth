#!/bin/bash
# Script to verify users in Keycloak and provide admin console instructions

KEYCLOAK_URL=${KEYCLOAK_URL:-http://localhost:8081}
REALM=${REALM:-matric-dev}

echo "🔐 Keycloak User Verification Guide"
echo "===================================="
echo ""
echo "📌 IMPORTANT: The admin console shows different realms separately!"
echo ""
echo "To view your imported users in the Keycloak Admin Console:"
echo "1. Go to: $KEYCLOAK_URL"
echo "2. Login with: admin / admin"
echo "3. In the top-left corner, you'll see a dropdown that says 'master'"
echo "4. Click on it and select 'matric-dev' realm"
echo "5. Then go to Users in the left sidebar"
echo ""
echo "----------------------------------------"
echo "Verifying users via API..."
echo "----------------------------------------"

# Get admin token
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

# Check master realm users
echo ""
echo "Users in MASTER realm (admin users):"
MASTER_USERS=$(curl -s "$KEYCLOAK_URL/admin/realms/master/users" \
  -H "Authorization: Bearer $TOKEN")
echo "$MASTER_USERS" | jq -r '.[] | "  - \(.username) (\(.email // "no email"))"'

# Check matric-dev realm users  
echo ""
echo "Users in MATRIC-DEV realm (application users):"
APP_USERS=$(curl -s "$KEYCLOAK_URL/admin/realms/$REALM/users" \
  -H "Authorization: Bearer $TOKEN")
echo "$APP_USERS" | jq -r '.[] | "  - \(.username) (\(.email // "no email"))"'

echo ""
echo "----------------------------------------"
echo "Direct links:"
echo "  Master realm users: $KEYCLOAK_URL/admin/master/console/#/master/users"
echo "  Matric-dev realm users: $KEYCLOAK_URL/admin/master/console/#/matric-dev/users"
echo ""