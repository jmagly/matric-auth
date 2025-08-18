#!/bin/bash

# Quick start script for MATRIC Authentication with Vault integration
# This script starts all services including Vault and configures JWT authentication

set -e

# Load environment variables if .env.local exists
SCRIPT_DIR="$(dirname "$0")"
ENV_FILE="$SCRIPT_DIR/../.env.local"
if [ -f "$ENV_FILE" ]; then
    export $(grep -v '^#' "$ENV_FILE" | xargs)
fi

# Export for vault CLI and docker compose
export VAULT_ADDR="${VAULT_ADDR:-http://localhost:8200}"
export VAULT_TOKEN="${VAULT_TOKEN:-matric-dev-root-token}"
export VAULT_SKIP_VERIFY="${VAULT_SKIP_VERIFY:-true}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        log_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    log_success "Docker is running"
}

# Check if docker-compose is available
check_docker_compose() {
    if ! command -v docker-compose > /dev/null 2>&1; then
        log_error "docker-compose is not available. Please install docker-compose."
        exit 1
    fi
    log_success "docker-compose is available"
}

# Change to docker directory
change_to_docker_dir() {
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    DOCKER_DIR="$(dirname "$SCRIPT_DIR")/docker"
    
    if [ ! -d "$DOCKER_DIR" ]; then
        log_error "Docker directory not found: $DOCKER_DIR"
        exit 1
    fi
    
    cd "$DOCKER_DIR"
    log_info "Changed to docker directory: $DOCKER_DIR"
}

# Stop existing services
stop_services() {
    log_info "Stopping existing services..."
    docker-compose -f docker-compose.yml -f docker-compose.vault.yml down || true
    log_success "Services stopped"
}

# Start services with Vault
start_services() {
    log_info "Starting services with Vault integration..."
    
    # Pull latest images
    docker-compose -f docker-compose.yml -f docker-compose.vault.yml pull
    
    # Start services
    docker-compose -f docker-compose.yml -f docker-compose.vault.yml up -d
    
    log_success "Services started"
}

# Wait for services to be healthy
wait_for_services() {
    log_info "Waiting for services to become healthy..."
    
    # Wait for PostgreSQL
    log_info "Waiting for PostgreSQL..."
    until docker-compose exec postgres pg_isready -U keycloak > /dev/null 2>&1; do
        echo -n "."
        sleep 2
    done
    echo
    log_success "PostgreSQL is ready"
    
    # Wait for Keycloak
    log_info "Waiting for Keycloak..."
    until curl -f http://localhost:8081/realms/matric-dev > /dev/null 2>&1; do
        echo -n "."
        sleep 5
    done
    echo
    log_success "Keycloak is ready"
    
    # Wait for Vault
    log_info "Waiting for Vault..."
    until curl -f http://localhost:8200/v1/sys/health > /dev/null 2>&1; do
        echo -n "."
        sleep 3
    done
    echo
    log_success "Vault is ready"
}

# Show service status
show_status() {
    log_info "Service status:"
    docker-compose -f docker-compose.yml -f docker-compose.vault.yml ps
    
    echo
    log_info "Service URLs:"
    echo "  Keycloak Admin: http://localhost:8081/admin (admin/admin)"
    echo "  Keycloak Realm: http://localhost:8081/realms/matric-dev"
    echo "  Vault UI:       http://localhost:8200 (Token: matric-dev-root-token)"
    echo "  PostgreSQL:     localhost:5433 (keycloak/keycloak_dev_2024)"
    
    echo
    log_success "All services are running!"
}

# Show next steps
show_next_steps() {
    echo
    log_info "Next steps:"
    echo "1. Configure Keycloak client mappers (see VAULT-JWT-GUIDE.md)"
    echo "2. Test service authentication:"
    echo "   cd ../examples"
    echo "   python3 vault-service-auth.py"
    echo "   # or"
    echo "   npm install axios && node vault-service-auth.js"
    echo
    echo "3. View logs:"
    echo "   docker-compose -f docker-compose.yml -f docker-compose.vault.yml logs -f"
    echo
    echo "4. Stop services:"
    echo "   docker-compose -f docker-compose.yml -f docker-compose.vault.yml down"
    
    echo
    log_warning "Important:"
    echo "- This is a development setup with default credentials"
    echo "- Review VAULT-JWT-GUIDE.md for production considerations"
    echo "- Configure Keycloak custom claim mappers for full functionality"
}

# Main execution
main() {
    log_info "Starting MATRIC Authentication with Vault integration..."
    
    check_docker
    check_docker_compose
    change_to_docker_dir
    stop_services
    start_services
    wait_for_services
    show_status
    show_next_steps
    
    log_success "Setup completed successfully!"
}

# Execute main function
main "$@"