#!/bin/bash

echo "Checking Keycloak health..."

# Check if Keycloak is running
if curl -s http://localhost:8081/health/ready > /dev/null; then
    echo "✅ Keycloak is healthy and ready"
    
    # Check realm
    if curl -s http://localhost:8081/realms/matric-dev > /dev/null; then
        echo "✅ matric-dev realm is accessible"
    else
        echo "❌ matric-dev realm not found"
    fi
else
    echo "❌ Keycloak is not running or not ready"
    echo "Run ./scripts/start-keycloak.sh to start Keycloak"
fi