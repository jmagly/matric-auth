import React, { useState, useEffect } from 'react';
import keycloakService from './services/keycloak';
import apiService from './services/api';
import './App.css';

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [apiResponse, setApiResponse] = useState<string>('');
  const [apiError, setApiError] = useState<string>('');

  useEffect(() => {
    const initAuth = async () => {
      try {
        console.log('Initializing Keycloak...');
        const keycloak = await keycloakService.init();
        
        // Check if we have a code in the URL (returning from login)
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        
        if (code) {
          console.log('Auth code detected, processing authentication...');
          // Keycloak should handle this automatically, but we need to wait
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Force update state after init
        const isAuth = keycloakService.isAuthenticated();
        const userInfo = keycloakService.getUserInfo();
        
        console.log('Authentication status:', isAuth);
        console.log('User info:', userInfo);
        console.log('Token:', keycloakService.getToken());
        
        setIsAuthenticated(isAuth);
        setUser(userInfo);
        
        // Clean URL if we have code params
        if (code) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
        
        // Set up token refresh interval
        if (isAuth) {
          const interval = setInterval(() => {
            keycloak?.updateToken(30).then((refreshed) => {
              if (refreshed) {
                console.log('Token was refreshed');
                setUser(keycloakService.getUserInfo());
              }
            }).catch(() => {
              console.error('Failed to refresh token');
              setIsAuthenticated(false);
              setUser(null);
            });
          }, 30000);
          
          return () => clearInterval(interval);
        }
      } catch (error) {
        console.error('Auth initialization failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    // Listen for token refresh
    const handleTokenRefresh = () => {
      setUser(keycloakService.getUserInfo());
    };

    window.addEventListener('keycloak-token-refreshed', handleTokenRefresh);
    return () => {
      window.removeEventListener('keycloak-token-refreshed', handleTokenRefresh);
    };
  }, []);

  const handleLogin = () => {
    keycloakService.login();
  };

  const handleLogout = () => {
    keycloakService.logout();
  };

  const handleRegister = () => {
    keycloakService.register();
  };

  const handleAccountManagement = () => {
    keycloakService.accountManagement();
  };

  const testApiCall = async () => {
    setApiResponse('');
    setApiError('');
    
    try {
      // This will automatically include the auth token
      const response = await apiService.get('/test');
      setApiResponse(JSON.stringify(response, null, 2));
    } catch (error: any) {
      setApiError(error.message || 'API call failed');
      console.error('API call failed:', error);
    }
  };

  const testProtectedApiCall = async () => {
    setApiResponse('');
    setApiError('');
    
    try {
      // Mock API call - in real app, this would call your backend
      const token = keycloakService.getToken();
      if (token) {
        setApiResponse(`Token successfully attached to request:\n\nBearer ${token.substring(0, 50)}...`);
      } else {
        setApiError('No token available');
      }
    } catch (error: any) {
      setApiError(error.message || 'API call failed');
    }
  };

  if (isLoading) {
    return (
      <div className="loading">
        <h2>Loading authentication...</h2>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>🔐 MATRIC Static Site Auth Demo</h1>
        <p>Keycloak + React (Static Deployment Pattern)</p>
      </header>

      <main className="app-main">
        {isAuthenticated ? (
          <div className="authenticated-content">
            <div className="user-card">
              <h2>Welcome, {user?.preferred_username || user?.email}!</h2>
              
              <div className="user-details">
                <h3>User Information:</h3>
                <table>
                  <tbody>
                    <tr>
                      <td><strong>User ID:</strong></td>
                      <td>{user?.sub}</td>
                    </tr>
                    <tr>
                      <td><strong>Username:</strong></td>
                      <td>{user?.preferred_username}</td>
                    </tr>
                    <tr>
                      <td><strong>Email:</strong></td>
                      <td>{user?.email}</td>
                    </tr>
                    <tr>
                      <td><strong>Email Verified:</strong></td>
                      <td>{user?.email_verified ? 'Yes' : 'No'}</td>
                    </tr>
                    <tr>
                      <td><strong>Roles:</strong></td>
                      <td>{user?.realm_access?.roles?.join(', ') || 'None'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="role-check">
                <h3>Role-Based Access:</h3>
                <div className="roles">
                  <div className={`role-badge ${keycloakService.hasRole('admin') ? 'active' : 'inactive'}`}>
                    Admin: {keycloakService.hasRole('admin') ? '✓' : '✗'}
                  </div>
                  <div className={`role-badge ${keycloakService.hasRole('developer') ? 'active' : 'inactive'}`}>
                    Developer: {keycloakService.hasRole('developer') ? '✓' : '✗'}
                  </div>
                  <div className={`role-badge ${keycloakService.hasRole('viewer') ? 'active' : 'inactive'}`}>
                    Viewer: {keycloakService.hasRole('viewer') ? '✓' : '✗'}
                  </div>
                </div>
              </div>

              <div className="api-test">
                <h3>API Integration Test:</h3>
                <button onClick={testProtectedApiCall} className="btn btn-test">
                  Test API Call with Token
                </button>
                {apiResponse && (
                  <div className="api-response success">
                    <strong>Success:</strong>
                    <pre>{apiResponse}</pre>
                  </div>
                )}
                {apiError && (
                  <div className="api-response error">
                    <strong>Error:</strong> {apiError}
                  </div>
                )}
              </div>

              <div className="token-info">
                <h3>Token Information:</h3>
                <details>
                  <summary>View Token Details</summary>
                  <pre>{JSON.stringify(user, null, 2)}</pre>
                </details>
              </div>

              <div className="actions">
                <button onClick={handleAccountManagement} className="btn btn-secondary">
                  Manage Account
                </button>
                <button onClick={handleLogout} className="btn btn-danger">
                  Logout
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="public-content">
            <div className="login-card">
              <h2>Welcome to MATRIC</h2>
              <p>Static Site Authentication Demo</p>
              
              <div className="features">
                <h3>This demo shows:</h3>
                <ul>
                  <li>✓ PKCE-based authentication (no client secret)</li>
                  <li>✓ Automatic token refresh</li>
                  <li>✓ Role-based access control</li>
                  <li>✓ API integration with Bearer tokens</li>
                  <li>✓ Account management integration</li>
                  <li>✓ Works from CDN/static hosting</li>
                </ul>
              </div>

              <div className="test-accounts">
                <h3>Test Accounts:</h3>
                <div className="account-list">
                  <div className="account">
                    <strong>Admin:</strong> admin@matric.local / admin123
                  </div>
                  <div className="account">
                    <strong>Developer:</strong> developer@matric.local / dev123
                  </div>
                  <div className="account">
                    <strong>Viewer:</strong> viewer@matric.local / view123
                  </div>
                </div>
              </div>

              <div className="actions">
                <button onClick={handleLogin} className="btn btn-primary">
                  Login with Keycloak
                </button>
                <button onClick={handleRegister} className="btn btn-secondary">
                  Create New Account
                </button>
              </div>

              <div className="info">
                <p>
                  <strong>Note:</strong> This will redirect to Keycloak's login page.
                  After authentication, you'll be redirected back here.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>Keycloak URL: {process.env.REACT_APP_KEYCLOAK_URL}</p>
        <p>Realm: {process.env.REACT_APP_KEYCLOAK_REALM}</p>
        <p>Client: {process.env.REACT_APP_KEYCLOAK_CLIENT}</p>
      </footer>
    </div>
  );
}

export default App;