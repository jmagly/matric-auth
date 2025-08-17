#!/bin/bash
# Script to create test users in Keycloak

KEYCLOAK_URL=${KEYCLOAK_URL:-http://localhost:8081}
REALM=${REALM:-matric-dev}

echo "🔐 Creating test users in Keycloak..."
echo "===================================="

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

# Function to create a user
create_user() {
    local email=$1
    local firstname=$2
    local lastname=$3
    local password=$4
    local role=$5
    
    echo "Creating user: $email with role: $role"
    
    # Create user
    curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM/users" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"username\": \"$email\",
        \"email\": \"$email\",
        \"emailVerified\": true,
        \"enabled\": true,
        \"firstName\": \"$firstname\",
        \"lastName\": \"$lastname\",
        \"credentials\": [{
          \"type\": \"password\",
          \"value\": \"$password\",
          \"temporary\": false
        }],
        \"realmRoles\": [\"$role\"],
        \"groups\": [\"/tenant-demo\"]
      }"
    
    # Check if user was created
    USER_ID=$(curl -s "$KEYCLOAK_URL/admin/realms/$REALM/users?username=$email" \
      -H "Authorization: Bearer $TOKEN" | jq -r '.[0].id')
    
    if [ "$USER_ID" != "null" ] && [ -n "$USER_ID" ]; then
        echo "  ✅ User created: $email (ID: $USER_ID)"
        
        # Assign realm role
        ROLE_ID=$(curl -s "$KEYCLOAK_URL/admin/realms/$REALM/roles/$role" \
          -H "Authorization: Bearer $TOKEN" | jq -r '.id')
        
        if [ "$ROLE_ID" != "null" ] && [ -n "$ROLE_ID" ]; then
            curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM/users/$USER_ID/role-mappings/realm" \
              -H "Authorization: Bearer $TOKEN" \
              -H "Content-Type: application/json" \
              -d "[{\"id\": \"$ROLE_ID\", \"name\": \"$role\"}]"
            echo "  ✅ Role assigned: $role"
        fi
    else
        echo "  ⚠️  User may already exist: $email"
    fi
    echo ""
}

# Create the users
echo ""
echo "📝 Creating test users..."
echo "------------------------"

create_user "admin@matric.local" "Admin" "User" "admin123" "admin"
create_user "developer@matric.local" "Dev" "User" "dev123" "developer"
create_user "viewer@matric.local" "View" "User" "view123" "viewer"

echo ""
echo "🎉 User creation complete!"
echo ""
echo "Test the users:"
echo "  admin@matric.local / admin123"
echo "  developer@matric.local / dev123"
echo "  viewer@matric.local / view123"
echo ""