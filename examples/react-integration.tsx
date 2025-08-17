// React + Keycloak Integration Example
// This shows how to integrate Keycloak authentication in a React application

// 1. Install dependencies:
// npm install keycloak-js @react-keycloak/web

// 2. Keycloak configuration (keycloak.ts)
import Keycloak from 'keycloak-js';

const keycloakConfig = {
  url: 'http://localhost:8081',
  realm: 'matric-dev',
  clientId: 'matric-web',
};

const keycloak = new Keycloak(keycloakConfig);

export default keycloak;

// 3. Main App component with Keycloak provider (App.tsx)
import React from 'react';
import { ReactKeycloakProvider } from '@react-keycloak/web';
import keycloak from './keycloak';
import AuthenticatedApp from './AuthenticatedApp';

const App: React.FC = () => {
  return (
    <ReactKeycloakProvider
      authClient={keycloak}
      initOptions={{
        onLoad: 'check-sso',
        silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
        checkLoginIframe: false,
      }}
      onEvent={(event, error) => {
        console.log('Keycloak event:', event, error);
      }}
      onTokens={(tokens) => {
        console.log('Keycloak tokens refreshed');
      }}
    >
      <AuthenticatedApp />
    </ReactKeycloakProvider>
  );
};

export default App;

// 4. Authenticated App component (AuthenticatedApp.tsx)
import React from 'react';
import { useKeycloak } from '@react-keycloak/web';

const AuthenticatedApp: React.FC = () => {
  const { keycloak, initialized } = useKeycloak();

  if (!initialized) {
    return <div>Loading authentication...</div>;
  }

  return (
    <div className="app">
      <header>
        <h1>MATRIC Platform</h1>
        {keycloak.authenticated ? (
          <div className="user-info">
            <span>Welcome, {keycloak.tokenParsed?.preferred_username}!</span>
            <button onClick={() => keycloak.logout()}>Logout</button>
            <button onClick={() => keycloak.accountManagement()}>My Account</button>
          </div>
        ) : (
          <button onClick={() => keycloak.login()}>Login</button>
        )}
      </header>

      <main>
        {keycloak.authenticated ? (
          <AuthenticatedContent />
        ) : (
          <PublicContent />
        )}
      </main>
    </div>
  );
};

// 5. Protected component example
const AuthenticatedContent: React.FC = () => {
  const { keycloak } = useKeycloak();
  
  const hasRole = (role: string) => {
    return keycloak.tokenParsed?.realm_access?.roles?.includes(role) || false;
  };

  const callProtectedAPI = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/protected', {
        headers: {
          'Authorization': `Bearer ${keycloak.token}`,
        },
      });
      const data = await response.json();
      console.log('API Response:', data);
    } catch (error) {
      console.error('API Error:', error);
    }
  };

  return (
    <div>
      <h2>Protected Content</h2>
      
      <div className="user-details">
        <h3>User Information:</h3>
        <ul>
          <li>Username: {keycloak.tokenParsed?.preferred_username}</li>
          <li>Email: {keycloak.tokenParsed?.email}</li>
          <li>User ID: {keycloak.tokenParsed?.sub}</li>
          <li>Roles: {keycloak.tokenParsed?.realm_access?.roles?.join(', ')}</li>
        </ul>
      </div>

      <div className="role-based-content">
        {hasRole('admin') && (
          <div className="admin-section">
            <h3>Admin Section</h3>
            <p>Only visible to users with admin role</p>
          </div>
        )}
        
        {hasRole('developer') && (
          <div className="developer-section">
            <h3>Developer Section</h3>
            <p>Only visible to users with developer role</p>
          </div>
        )}
        
        {hasRole('viewer') && (
          <div className="viewer-section">
            <h3>Viewer Section</h3>
            <p>Only visible to users with viewer role</p>
          </div>
        )}
      </div>

      <div className="actions">
        <button onClick={callProtectedAPI}>Call Protected API</button>
        <button onClick={() => keycloak.updateToken(30)}>Refresh Token</button>
      </div>
    </div>
  );
};

const PublicContent: React.FC = () => {
  const { keycloak } = useKeycloak();
  
  return (
    <div>
      <h2>Welcome to MATRIC</h2>
      <p>Please login to access the platform</p>
      <div className="login-options">
        <button onClick={() => keycloak.login()}>Login</button>
        <button onClick={() => keycloak.register()}>Register New Account</button>
        <button 
          onClick={() => {
            window.location.href = 'http://localhost:8081/realms/matric-dev/login-actions/reset-credentials?client_id=matric-web';
          }}
        >
          Forgot Password?
        </button>
      </div>
    </div>
  );
};

// 6. Custom hook for Keycloak (useAuth.ts)
import { useKeycloak as useKeycloakBase } from '@react-keycloak/web';
import { useCallback } from 'react';

export const useAuth = () => {
  const { keycloak, initialized } = useKeycloakBase();

  const login = useCallback(() => {
    keycloak.login();
  }, [keycloak]);

  const logout = useCallback(() => {
    keycloak.logout();
  }, [keycloak]);

  const register = useCallback(() => {
    keycloak.register();
  }, [keycloak]);

  const hasRole = useCallback((role: string) => {
    return keycloak.tokenParsed?.realm_access?.roles?.includes(role) || false;
  }, [keycloak]);

  const getToken = useCallback(() => {
    return keycloak.token;
  }, [keycloak]);

  const refreshToken = useCallback(async () => {
    try {
      const refreshed = await keycloak.updateToken(30);
      if (refreshed) {
        console.log('Token refreshed');
      }
      return refreshed;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      logout();
      return false;
    }
  }, [keycloak, logout]);

  return {
    isAuthenticated: keycloak.authenticated,
    initialized,
    user: keycloak.tokenParsed,
    login,
    logout,
    register,
    hasRole,
    getToken,
    refreshToken,
    keycloak,
  };
};

// 7. Axios interceptor example (api.ts)
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
});

// Add auth token to requests
api.interceptors.request.use(
  async (config) => {
    const keycloak = (window as any).keycloak;
    if (keycloak && keycloak.authenticated) {
      // Refresh token if needed
      try {
        await keycloak.updateToken(30);
        config.headers.Authorization = `Bearer ${keycloak.token}`;
      } catch (error) {
        console.error('Failed to refresh token:', error);
        keycloak.logout();
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const keycloak = (window as any).keycloak;
      if (keycloak) {
        keycloak.logout();
      }
    }
    return Promise.reject(error);
  }
);

export default api;