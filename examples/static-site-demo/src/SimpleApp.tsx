import React, { useState, useEffect, useRef } from 'react';
import keycloakService from './services/keycloak-simple';
import './App.css';

function SimpleApp() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);
  const initRef = useRef(false);

  useEffect(() => {
    // Prevent double initialization in React StrictMode
    if (initRef.current) return;
    initRef.current = true;
    
    const init = async () => {
      console.log('🚀 Starting app initialization...');
      
      try {
        const authenticated = await keycloakService.init();
        console.log('Init complete. Authenticated:', authenticated);
        
        setIsAuthenticated(authenticated);
        
        if (authenticated) {
          const userData = keycloakService.getUser();
          console.log('User data:', userData);
          setUser(userData);
        }
      } catch (error) {
        console.error('Init failed:', error);
      }
      
      setIsLoading(false);
    };

    init();
  }, []);

  if (isLoading) {
    return (
      <div className="loading">
        <h2>Initializing...</h2>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="app">
        <header className="app-header">
          <h1>🔐 MATRIC Auth Demo (Simple)</h1>
        </header>
        <main className="app-main">
          <div className="login-card">
            <h2>Not Logged In</h2>
            <p>Click below to login with Keycloak</p>
            <button 
              onClick={() => keycloakService.login()} 
              className="btn btn-primary"
            >
              Login with Keycloak
            </button>
            
            <div className="test-accounts">
              <h3>Test Accounts:</h3>
              <div className="account">admin@matric.local / admin123</div>
              <div className="account">developer@matric.local / dev123</div>
              <div className="account">viewer@matric.local / view123</div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>🔐 MATRIC Auth Demo (Simple)</h1>
      </header>
      <main className="app-main">
        <div className="user-card">
          <h2>✅ Logged In Successfully!</h2>
          
          <div className="user-details">
            <h3>User Information:</h3>
            <table>
              <tbody>
                <tr>
                  <td><strong>Username:</strong></td>
                  <td>{user?.preferred_username || 'N/A'}</td>
                </tr>
                <tr>
                  <td><strong>Email:</strong></td>
                  <td>{user?.email || 'N/A'}</td>
                </tr>
                <tr>
                  <td><strong>User ID:</strong></td>
                  <td>{user?.sub || 'N/A'}</td>
                </tr>
                <tr>
                  <td><strong>Roles:</strong></td>
                  <td>{user?.realm_access?.roles?.join(', ') || 'None'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="role-check">
            <h3>Role Check:</h3>
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

          <div className="token-info">
            <h3>Authentication Details:</h3>
            <details>
              <summary>View Token Claims</summary>
              <pre>{JSON.stringify(user, null, 2)}</pre>
            </details>
          </div>

          <div className="actions">
            <button 
              onClick={() => keycloakService.accountManagement()} 
              className="btn btn-secondary"
            >
              Manage Account
            </button>
            <button 
              onClick={() => keycloakService.logout()} 
              className="btn btn-danger"
            >
              Logout
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default SimpleApp;