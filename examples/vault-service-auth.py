#!/usr/bin/env python3
"""
Vault Service Authentication Example using Keycloak JWT

This example demonstrates how services can authenticate with HashiCorp Vault
using Keycloak-issued JWT tokens for tenant-scoped access to secrets.
"""

import os
import json
import requests
import time
from typing import Dict, Any, Optional
from dataclasses import dataclass


@dataclass
class VaultConfig:
    """Vault configuration settings"""
    url: str = "http://localhost:8200"
    jwt_path: str = "auth/jwt/login"
    jwt_role: str = "matric-service"


@dataclass
class KeycloakConfig:
    """Keycloak configuration settings"""
    url: str = "http://localhost:8081"
    realm: str = "matric-dev"
    client_id: str = "matric-platform"
    client_secret: str = ""  # Set from environment
    username: str = ""  # Service account username
    password: str = ""  # Service account password


class VaultJWTClient:
    """
    Vault client that authenticates using Keycloak JWT tokens
    and provides tenant-scoped access to secrets.
    """
    
    def __init__(self, vault_config: VaultConfig, keycloak_config: KeycloakConfig):
        self.vault_config = vault_config
        self.keycloak_config = keycloak_config
        self.vault_token: Optional[str] = None
        self.token_expires_at: Optional[float] = None
        self.session = requests.Session()
    
    def get_keycloak_token(self, tenant_id: str, user_id: str) -> str:
        """
        Obtain a JWT token from Keycloak with custom claims.
        
        In a real implementation, this would be done through:
        1. Service account authentication
        2. Token exchange with custom claims
        3. Or direct client credentials flow with custom mappers
        """
        token_url = f"{self.keycloak_config.url}/realms/{self.keycloak_config.realm}/protocol/openid_connect/token"
        
        # Example using client credentials flow
        # In production, ensure the client has proper custom claim mappers
        data = {
            "grant_type": "client_credentials",
            "client_id": self.keycloak_config.client_id,
            "client_secret": self.keycloak_config.client_secret,
            "scope": "openid profile"
        }
        
        response = self.session.post(token_url, data=data)
        response.raise_for_status()
        
        token_data = response.json()
        return token_data["access_token"]
    
    def authenticate_with_vault(self, jwt_token: str) -> Dict[str, Any]:
        """
        Authenticate with Vault using JWT token and get Vault token.
        """
        auth_url = f"{self.vault_config.url}/v1/{self.vault_config.jwt_path}"
        
        payload = {
            "role": self.vault_config.jwt_role,
            "jwt": jwt_token
        }
        
        response = self.session.post(auth_url, json=payload)
        response.raise_for_status()
        
        auth_data = response.json()
        
        # Store vault token and expiration
        self.vault_token = auth_data["auth"]["client_token"]
        lease_duration = auth_data["auth"]["lease_duration"]
        self.token_expires_at = time.time() + lease_duration - 60  # Refresh 1 minute early
        
        return auth_data
    
    def ensure_authenticated(self, tenant_id: str, user_id: str) -> None:
        """
        Ensure we have a valid Vault token, refreshing if necessary.
        """
        if (self.vault_token is None or 
            self.token_expires_at is None or 
            time.time() >= self.token_expires_at):
            
            print(f"Obtaining new Vault token for tenant {tenant_id}, user {user_id}")
            jwt_token = self.get_keycloak_token(tenant_id, user_id)
            self.authenticate_with_vault(jwt_token)
    
    def get_secret(self, path: str, tenant_id: str, user_id: str) -> Dict[str, Any]:
        """
        Retrieve a secret from Vault with automatic authentication.
        """
        self.ensure_authenticated(tenant_id, user_id)
        
        secret_url = f"{self.vault_config.url}/v1/secret/data/{path}"
        headers = {"X-Vault-Token": self.vault_token}
        
        response = self.session.get(secret_url, headers=headers)
        response.raise_for_status()
        
        return response.json()
    
    def put_secret(self, path: str, data: Dict[str, Any], tenant_id: str, user_id: str) -> Dict[str, Any]:
        """
        Store a secret in Vault with automatic authentication.
        """
        self.ensure_authenticated(tenant_id, user_id)
        
        secret_url = f"{self.vault_config.url}/v1/secret/data/{path}"
        headers = {"X-Vault-Token": self.vault_token}
        payload = {"data": data}
        
        response = self.session.post(secret_url, json=payload, headers=headers)
        response.raise_for_status()
        
        return response.json()
    
    def list_secrets(self, path: str, tenant_id: str, user_id: str) -> Dict[str, Any]:
        """
        List secrets at a given path with automatic authentication.
        """
        self.ensure_authenticated(tenant_id, user_id)
        
        list_url = f"{self.vault_config.url}/v1/secret/metadata/{path}"
        headers = {"X-Vault-Token": self.vault_token}
        params = {"list": "true"}
        
        response = self.session.get(list_url, headers=headers, params=params)
        response.raise_for_status()
        
        return response.json()


class TenantService:
    """
    Example service that uses Vault for tenant-scoped secret management.
    """
    
    def __init__(self, tenant_id: str, user_id: str):
        self.tenant_id = tenant_id
        self.user_id = user_id
        
        # Initialize Vault client
        vault_config = VaultConfig()
        keycloak_config = KeycloakConfig(
            client_secret=os.getenv("KEYCLOAK_CLIENT_SECRET", "dev-secret"),
        )
        
        self.vault_client = VaultJWTClient(vault_config, keycloak_config)
    
    def get_tenant_config(self) -> Dict[str, Any]:
        """Get tenant-specific configuration."""
        try:
            result = self.vault_client.get_secret(
                f"tenants/{self.tenant_id}/config",
                self.tenant_id,
                self.user_id
            )
            return result["data"]["data"]
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 403:
                print(f"Access denied to tenant {self.tenant_id} config")
                return {}
            raise
    
    def get_tenant_database_config(self) -> Dict[str, Any]:
        """Get tenant-specific database configuration."""
        try:
            result = self.vault_client.get_secret(
                f"tenants/{self.tenant_id}/database",
                self.tenant_id,
                self.user_id
            )
            return result["data"]["data"]
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 403:
                print(f"Access denied to tenant {self.tenant_id} database config")
                return {}
            raise
    
    def get_user_preferences(self) -> Dict[str, Any]:
        """Get user-specific preferences."""
        try:
            result = self.vault_client.get_secret(
                f"users/{self.user_id}/preferences",
                self.tenant_id,
                self.user_id
            )
            return result["data"]["data"]
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 403:
                print(f"Access denied to user {self.user_id} preferences")
                return {}
            raise
    
    def store_user_api_key(self, service_name: str, api_key: str) -> bool:
        """Store a user-specific API key."""
        try:
            self.vault_client.put_secret(
                f"users/{self.user_id}/api-keys",
                {service_name: api_key},
                self.tenant_id,
                self.user_id
            )
            return True
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 403:
                print(f"Access denied to store API key for user {self.user_id}")
                return False
            raise
    
    def get_common_config(self) -> Dict[str, Any]:
        """Get common configuration (available to all services)."""
        try:
            result = self.vault_client.get_secret(
                "common/config",
                self.tenant_id,
                self.user_id
            )
            return result["data"]["data"]
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 403:
                print("Access denied to common config")
                return {}
            raise


def main():
    """
    Example usage of the VaultJWTClient for tenant-scoped access.
    """
    # Example tenant and user IDs
    tenant_id = "tenant-001"
    user_id = "user-123"
    
    print(f"Initializing service for tenant {tenant_id}, user {user_id}")
    
    # Initialize tenant service
    service = TenantService(tenant_id, user_id)
    
    try:
        # Get tenant configuration
        print("\n--- Tenant Configuration ---")
        tenant_config = service.get_tenant_config()
        print(json.dumps(tenant_config, indent=2))
        
        # Get tenant database configuration
        print("\n--- Tenant Database Configuration ---")
        db_config = service.get_tenant_database_config()
        # Don't print passwords in real applications
        safe_db_config = {k: v if k != "password" else "***" for k, v in db_config.items()}
        print(json.dumps(safe_db_config, indent=2))
        
        # Get user preferences
        print("\n--- User Preferences ---")
        user_prefs = service.get_user_preferences()
        print(json.dumps(user_prefs, indent=2))
        
        # Get common configuration
        print("\n--- Common Configuration ---")
        common_config = service.get_common_config()
        print(json.dumps(common_config, indent=2))
        
        # Store a user API key
        print("\n--- Storing User API Key ---")
        success = service.store_user_api_key("external_service", "sk_new_api_key_12345")
        print(f"API key stored: {success}")
        
        print("\n--- Testing Cross-Tenant Access (Should Fail) ---")
        # Try to access another tenant's secrets (should fail)
        other_service = TenantService("tenant-002", user_id)
        other_tenant_config = other_service.get_tenant_config()
        print(json.dumps(other_tenant_config, indent=2))
        
    except requests.exceptions.RequestException as e:
        print(f"Request error: {e}")
    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    main()