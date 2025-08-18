/**
 * Vault Service Authentication Example using Keycloak JWT (Node.js/JavaScript)
 * 
 * This example demonstrates how Node.js services can authenticate with HashiCorp Vault
 * using Keycloak-issued JWT tokens for tenant-scoped access to secrets.
 */

const axios = require('axios');

class VaultJWTClient {
    constructor(vaultConfig = {}, keycloakConfig = {}) {
        this.vaultConfig = {
            url: 'http://localhost:8200',
            jwtPath: 'auth/jwt/login',
            jwtRole: 'matric-service',
            ...vaultConfig
        };
        
        this.keycloakConfig = {
            url: 'http://localhost:8081',
            realm: 'matric-dev',
            clientId: 'matric-platform',
            clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || 'dev-secret',
            ...keycloakConfig
        };
        
        this.vaultToken = null;
        this.tokenExpiresAt = null;
        
        // Create axios instance with default config
        this.httpClient = axios.create({
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    /**
     * Obtain a JWT token from Keycloak with custom claims.
     * 
     * In a real implementation, this would be done through:
     * 1. Service account authentication
     * 2. Token exchange with custom claims
     * 3. Or direct client credentials flow with custom mappers
     */
    async getKeycloakToken(tenantId, userId) {
        const tokenUrl = `${this.keycloakConfig.url}/realms/${this.keycloakConfig.realm}/protocol/openid_connect/token`;
        
        const data = new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: this.keycloakConfig.clientId,
            client_secret: this.keycloakConfig.clientSecret,
            scope: 'openid profile'
        });
        
        try {
            const response = await this.httpClient.post(tokenUrl, data, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });
            
            return response.data.access_token;
        } catch (error) {
            throw new Error(`Failed to get Keycloak token: ${error.message}`);
        }
    }

    /**
     * Authenticate with Vault using JWT token and get Vault token.
     */
    async authenticateWithVault(jwtToken) {
        const authUrl = `${this.vaultConfig.url}/v1/${this.vaultConfig.jwtPath}`;
        
        const payload = {
            role: this.vaultConfig.jwtRole,
            jwt: jwtToken
        };
        
        try {
            const response = await this.httpClient.post(authUrl, payload);
            const authData = response.data;
            
            // Store vault token and expiration
            this.vaultToken = authData.auth.client_token;
            const leaseDuration = authData.auth.lease_duration;
            this.tokenExpiresAt = Date.now() + (leaseDuration * 1000) - 60000; // Refresh 1 minute early
            
            return authData;
        } catch (error) {
            throw new Error(`Failed to authenticate with Vault: ${error.message}`);
        }
    }

    /**
     * Ensure we have a valid Vault token, refreshing if necessary.
     */
    async ensureAuthenticated(tenantId, userId) {
        if (!this.vaultToken || !this.tokenExpiresAt || Date.now() >= this.tokenExpiresAt) {
            console.log(`Obtaining new Vault token for tenant ${tenantId}, user ${userId}`);
            const jwtToken = await this.getKeycloakToken(tenantId, userId);
            await this.authenticateWithVault(jwtToken);
        }
    }

    /**
     * Retrieve a secret from Vault with automatic authentication.
     */
    async getSecret(path, tenantId, userId) {
        await this.ensureAuthenticated(tenantId, userId);
        
        const secretUrl = `${this.vaultConfig.url}/v1/secret/data/${path}`;
        
        try {
            const response = await this.httpClient.get(secretUrl, {
                headers: {
                    'X-Vault-Token': this.vaultToken
                }
            });
            
            return response.data;
        } catch (error) {
            if (error.response?.status === 403) {
                throw new Error(`Access denied to secret: ${path}`);
            }
            throw new Error(`Failed to get secret: ${error.message}`);
        }
    }

    /**
     * Store a secret in Vault with automatic authentication.
     */
    async putSecret(path, data, tenantId, userId) {
        await this.ensureAuthenticated(tenantId, userId);
        
        const secretUrl = `${this.vaultConfig.url}/v1/secret/data/${path}`;
        const payload = { data };
        
        try {
            const response = await this.httpClient.post(secretUrl, payload, {
                headers: {
                    'X-Vault-Token': this.vaultToken
                }
            });
            
            return response.data;
        } catch (error) {
            if (error.response?.status === 403) {
                throw new Error(`Access denied to store secret: ${path}`);
            }
            throw new Error(`Failed to store secret: ${error.message}`);
        }
    }

    /**
     * List secrets at a given path with automatic authentication.
     */
    async listSecrets(path, tenantId, userId) {
        await this.ensureAuthenticated(tenantId, userId);
        
        const listUrl = `${this.vaultConfig.url}/v1/secret/metadata/${path}`;
        
        try {
            const response = await this.httpClient.get(listUrl, {
                headers: {
                    'X-Vault-Token': this.vaultToken
                },
                params: {
                    list: true
                }
            });
            
            return response.data;
        } catch (error) {
            if (error.response?.status === 403) {
                throw new Error(`Access denied to list secrets: ${path}`);
            }
            throw new Error(`Failed to list secrets: ${error.message}`);
        }
    }
}

class TenantService {
    constructor(tenantId, userId) {
        this.tenantId = tenantId;
        this.userId = userId;
        this.vaultClient = new VaultJWTClient();
    }

    /**
     * Get tenant-specific configuration.
     */
    async getTenantConfig() {
        try {
            const result = await this.vaultClient.getSecret(
                `tenants/${this.tenantId}/config`,
                this.tenantId,
                this.userId
            );
            return result.data.data;
        } catch (error) {
            console.error(`Error getting tenant config: ${error.message}`);
            return {};
        }
    }

    /**
     * Get tenant-specific database configuration.
     */
    async getTenantDatabaseConfig() {
        try {
            const result = await this.vaultClient.getSecret(
                `tenants/${this.tenantId}/database`,
                this.tenantId,
                this.userId
            );
            return result.data.data;
        } catch (error) {
            console.error(`Error getting tenant database config: ${error.message}`);
            return {};
        }
    }

    /**
     * Get user-specific preferences.
     */
    async getUserPreferences() {
        try {
            const result = await this.vaultClient.getSecret(
                `users/${this.userId}/preferences`,
                this.tenantId,
                this.userId
            );
            return result.data.data;
        } catch (error) {
            console.error(`Error getting user preferences: ${error.message}`);
            return {};
        }
    }

    /**
     * Store a user-specific API key.
     */
    async storeUserApiKey(serviceName, apiKey) {
        try {
            await this.vaultClient.putSecret(
                `users/${this.userId}/api-keys`,
                { [serviceName]: apiKey },
                this.tenantId,
                this.userId
            );
            return true;
        } catch (error) {
            console.error(`Error storing user API key: ${error.message}`);
            return false;
        }
    }

    /**
     * Get common configuration (available to all services).
     */
    async getCommonConfig() {
        try {
            const result = await this.vaultClient.getSecret(
                'common/config',
                this.tenantId,
                this.userId
            );
            return result.data.data;
        } catch (error) {
            console.error(`Error getting common config: ${error.message}`);
            return {};
        }
    }

    /**
     * Initialize database connection using tenant-specific configuration.
     */
    async initializeDatabaseConnection() {
        const dbConfig = await this.getTenantDatabaseConfig();
        
        if (!dbConfig.host) {
            throw new Error('Database configuration not found');
        }
        
        // Example database connection setup
        console.log(`Connecting to database: ${dbConfig.host}`);
        console.log(`Username: ${dbConfig.username}`);
        // Don't log passwords in production
        console.log('Password: ***');
        
        return {
            host: dbConfig.host,
            username: dbConfig.username,
            password: dbConfig.password
        };
    }

    /**
     * Get service configuration with fallback to common config.
     */
    async getServiceConfig() {
        const [tenantConfig, commonConfig] = await Promise.all([
            this.getTenantConfig(),
            this.getCommonConfig()
        ]);
        
        return {
            ...commonConfig,
            ...tenantConfig
        };
    }
}

// Example usage
async function main() {
    const tenantId = 'tenant-001';
    const userId = 'user-123';
    
    console.log(`Initializing service for tenant ${tenantId}, user ${userId}`);
    
    const service = new TenantService(tenantId, userId);
    
    try {
        // Get tenant configuration
        console.log('\n--- Tenant Configuration ---');
        const tenantConfig = await service.getTenantConfig();
        console.log(JSON.stringify(tenantConfig, null, 2));
        
        // Get tenant database configuration
        console.log('\n--- Tenant Database Configuration ---');
        const dbConfig = await service.getTenantDatabaseConfig();
        // Don't print passwords in real applications
        const safeDbConfig = Object.fromEntries(
            Object.entries(dbConfig).map(([k, v]) => [k, k === 'password' ? '***' : v])
        );
        console.log(JSON.stringify(safeDbConfig, null, 2));
        
        // Get user preferences
        console.log('\n--- User Preferences ---');
        const userPrefs = await service.getUserPreferences();
        console.log(JSON.stringify(userPrefs, null, 2));
        
        // Get common configuration
        console.log('\n--- Common Configuration ---');
        const commonConfig = await service.getCommonConfig();
        console.log(JSON.stringify(commonConfig, null, 2));
        
        // Store a user API key
        console.log('\n--- Storing User API Key ---');
        const success = await service.storeUserApiKey('external_service', 'sk_new_api_key_12345');
        console.log(`API key stored: ${success}`);
        
        // Get combined service configuration
        console.log('\n--- Combined Service Configuration ---');
        const serviceConfig = await service.getServiceConfig();
        console.log(JSON.stringify(serviceConfig, null, 2));
        
        // Initialize database connection
        console.log('\n--- Database Connection ---');
        const dbConnection = await service.initializeDatabaseConnection();
        console.log('Database connection initialized');
        
        console.log('\n--- Testing Cross-Tenant Access (Should Fail) ---');
        // Try to access another tenant's secrets (should fail)
        const otherService = new TenantService('tenant-002', userId);
        const otherTenantConfig = await otherService.getTenantConfig();
        console.log(JSON.stringify(otherTenantConfig, null, 2));
        
    } catch (error) {
        console.error(`Error: ${error.message}`);
    }
}

// Export classes for use as modules
module.exports = {
    VaultJWTClient,
    TenantService
};

// Run example if this file is executed directly
if (require.main === module) {
    main().catch(console.error);
}