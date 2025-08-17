#!/bin/bash
# Helper script to get an access token for testing

KEYCLOAK_URL=${KEYCLOAK_URL:-http://localhost:8081}
REALM=${REALM:-matric-dev}
CLIENT_ID=${CLIENT_ID:-matric-dashboard}
USERNAME=${1:-developer@matric.local}
PASSWORD=${2:-dev123}

if [ "$#" -eq 0 ]; then
    echo "Usage: $0 [username] [password]"
    echo ""
    echo "Available users:"
    echo "  admin@matric.local / admin123"
    echo "  developer@matric.local / dev123"
    echo "  viewer@matric.local / view123"
    echo ""
    echo "Using default: developer@matric.local"
    echo ""
fi

# Get token
RESPONSE=$(curl -s -X POST "$KEYCLOAK_URL/realms/$REALM/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=$CLIENT_ID" \
  -d "username=$USERNAME" \
  -d "password=$PASSWORD")

# Check if successful
if echo "$RESPONSE" | grep -q "access_token"; then
    ACCESS_TOKEN=$(echo "$RESPONSE" | jq -r '.access_token')
    REFRESH_TOKEN=$(echo "$RESPONSE" | jq -r '.refresh_token')
    
    echo "✅ Token obtained successfully!"
    echo ""
    echo "Access Token (copy this for API calls):"
    echo "========================================="
    echo "$ACCESS_TOKEN"
    echo ""
    echo "Token Claims:"
    echo "============="
    echo "$ACCESS_TOKEN" | cut -d. -f2 | base64 -d 2>/dev/null | jq '.' 2>/dev/null || echo "Could not decode token"
    echo ""
    echo "To use in curl:"
    echo "curl -H \"Authorization: Bearer $ACCESS_TOKEN\" http://localhost:3001/api/..."
    echo ""
    echo "Refresh Token (for renewing access):"
    echo "===================================="
    echo "$REFRESH_TOKEN"
else
    echo "❌ Failed to get token"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
    exit 1
fi