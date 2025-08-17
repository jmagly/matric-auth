#!/bin/bash

echo "Stopping Keycloak..."
cd ../docker
docker-compose down

echo "Keycloak stopped successfully"