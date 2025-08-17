#!/bin/bash
# Bootstrap script for Keycloak development environment
# This script sets up Keycloak with initial configuration for local development

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🔐 MATRIC Keycloak Development Bootstrap"
echo "========================================="
echo ""

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null && ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker or docker-compose not found"
    echo "Please install Docker Desktop or Docker Engine"
    exit 1
fi

# Use docker compose or docker-compose based on what's available
if command -v docker &> /dev/null && docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

cd "$PROJECT_ROOT"

# Function to wait for service
wait_for_service() {
    local service=$1
    local url=$2
    local max_attempts=30
    local attempt=1
    
    echo "⏳ Waiting for $service to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -f "$url" > /dev/null 2>&1; then
            echo "✅ $service is ready!"
            return 0
        fi
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo ""
    echo "❌ $service failed to start after $max_attempts attempts"
    return 1
}

# Start services
echo "🚀 Starting development services..."
echo ""

# Start Keycloak and PostgreSQL
$DOCKER_COMPOSE -f docker/docker-compose.yml up -d

# Wait for PostgreSQL
echo "⏳ Waiting for PostgreSQL..."
sleep 5

# Wait for Keycloak to be ready
wait_for_service "Keycloak" "http://localhost:8081/health/ready"

echo ""
echo "🎉 Keycloak Development Environment Ready!"
echo "=========================================="
echo ""
echo "📌 Access Points:"
echo "  • Keycloak Admin Console: http://localhost:8081"
echo "  • Admin credentials: admin / admin"
echo "  • Mailpit (emails): http://localhost:8025"
echo ""
echo "👥 Test Users (all passwords are temporary):"
echo "  • admin@matric.local / admin123 (admin role)"
echo "  • developer@matric.local / dev123 (developer role)"
echo "  • viewer@matric.local / view123 (viewer role)"
echo ""
echo "🔧 Useful Commands:"
echo "  • View logs: docker logs matric-keycloak -f"
echo "  • Stop services: docker-compose -f docker/docker-compose.yml down"
echo "  • Reset everything: docker-compose -f docker/docker-compose.yml down -v"
echo "  • Access Keycloak CLI: docker exec -it matric-keycloak /opt/keycloak/bin/kcadm.sh"
echo ""
echo "📚 Next Steps:"
echo "  1. Visit http://localhost:8081 and login as admin"
echo "  2. Explore the 'matric-dev' realm configuration"
echo "  3. Test login with one of the test users"
echo "  4. Check emails in Mailpit at http://localhost:8025"
echo ""
echo "💡 Tip: The realm configuration is automatically imported from:"
echo "  $PROJECT_ROOT/realms/matric-dev.json"
echo ""