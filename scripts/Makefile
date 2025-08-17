# Keycloak Development Makefile
# Easy commands for developers to work with Keycloak

.PHONY: help start stop restart clean test token logs shell status

# Default target
help:
	@echo "Keycloak Development Commands"
	@echo "============================="
	@echo ""
	@echo "  make start     - Start Keycloak and dependencies"
	@echo "  make stop      - Stop Keycloak services"
	@echo "  make restart   - Restart Keycloak"
	@echo "  make clean     - Stop and remove all data"
	@echo "  make test      - Run all tests"
	@echo "  make token     - Get a test token"
	@echo "  make logs      - Show Keycloak logs"
	@echo "  make shell     - Open shell in Keycloak container"
	@echo "  make status    - Check service status"
	@echo ""

# Start Keycloak
start:
	@echo "🚀 Starting Keycloak..."
	@./bootstrap-dev.sh

# Stop services
stop:
	@echo "🛑 Stopping Keycloak..."
	@cd .. && docker-compose -f docker/docker-compose.yml stop

# Restart services
restart: stop start

# Clean everything
clean:
	@echo "🧹 Cleaning Keycloak data..."
	@cd .. && docker-compose -f docker/docker-compose.yml down -v
	@echo "✅ All Keycloak data removed"

# Run tests
test:
	@echo "🧪 Running tests..."
	@./test-auth.sh
	@if command -v node > /dev/null; then \
		echo ""; \
		echo "Running integration tests..."; \
		node ../tests/integration.js; \
	fi

# Get a token
token:
	@./get-token.sh

# Show logs
logs:
	@docker logs matric-keycloak -f

# Open shell
shell:
	@docker exec -it matric-keycloak bash

# Check status
status:
	@echo "📊 Service Status"
	@echo "================="
	@echo ""
	@if docker ps | grep -q matric-keycloak; then \
		echo "✅ Keycloak: Running"; \
		echo "   URL: http://localhost:8081"; \
	else \
		echo "❌ Keycloak: Not running"; \
	fi
	@if docker ps | grep -q matric-postgres; then \
		echo "✅ PostgreSQL: Running"; \
	else \
		echo "❌ PostgreSQL: Not running"; \
	fi
	@if docker ps | grep -q matric-mailpit; then \
		echo "✅ Mailpit: Running"; \
		echo "   URL: http://localhost:8025"; \
	else \
		echo "❌ Mailpit: Not running"; \
	fi
	@echo ""

# Quick health check
health:
	@curl -s http://localhost:8081/health/ready | jq '.' || echo "Keycloak not responding"

# Export realm configuration
export:
	@echo "📤 Exporting realm configuration..."
	@docker exec matric-keycloak \
		/opt/keycloak/bin/kc.sh export \
		--file /tmp/realm-export.json \
		--realm matric-dev
	@docker cp matric-keycloak:/tmp/realm-export.json ../realms/matric-dev-$(shell date +%Y%m%d-%H%M%S).json
	@echo "✅ Realm exported to ../realms/matric-dev-$(shell date +%Y%m%d-%H%M%S).json"

# Import realm configuration
import:
	@echo "📥 Importing realm configuration..."
	@docker cp ../realms/matric-dev.json matric-keycloak:/tmp/realm-export.json
	@docker exec matric-keycloak \
		/opt/keycloak/bin/kc.sh import \
		--file /tmp/realm-export.json \
		--override true
	@echo "✅ Realm imported"