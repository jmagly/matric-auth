import React, { useState, useEffect } from 'react';
import UserService from './services/UserService';
import './App.css';

function WorkingApp() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(UserService.isLoggedIn());
  }, []);

  const handleLogin = () => {
    UserService.doLogin();
  };

  const handleLogout = () => {
    UserService.doLogout();
  };

  const handleManageAccount = () => {
    window.location.href = 'http://localhost:8081/realms/matric-dev/account';
  };

  if (!isLoggedIn) {
    return (
      <div className="app">
        <header className="app-header">
          <h1>🔐 MATRIC Auth Demo (Working Pattern)</h1>
          <p>Based on proven Keycloak integration pattern</p>
        </header>
        <main className="app-main">
          <div className="login-card">
            <h2>Welcome to MATRIC</h2>
            <p>Please login to continue</p>
            
            <button onClick={handleLogin} className="btn btn-primary">
              Login with Keycloak
            </button>
            
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
          </div>
        </main>
      </div>
    );
  }

  const username = UserService.getUsername();
  const email = UserService.getEmail();
  const tokenParsed = UserService.getTokenParsed();

  return (
    <div className="app">
      <header className="app-header">
        <h1>🔐 MATRIC Auth Demo (Working Pattern)</h1>
        <p>Successfully authenticated with Keycloak</p>
      </header>
      <main className="app-main">
        <div className="user-card">
          <h2>Welcome, {username}! ✅</h2>
          
          <div className="user-details">
            <h3>User Information:</h3>
            <table>
              <tbody>
                <tr>
                  <td><strong>Username:</strong></td>
                  <td>{username}</td>
                </tr>
                <tr>
                  <td><strong>Email:</strong></td>
                  <td>{email}</td>
                </tr>
                <tr>
                  <td><strong>User ID:</strong></td>
                  <td>{tokenParsed?.sub}</td>
                </tr>
                <tr>
                  <td><strong>Session:</strong></td>
                  <td>{tokenParsed?.session_state?.substring(0, 8)}...</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="role-check">
            <h3>Role-Based Access:</h3>
            <div className="roles">
              <div className={`role-badge ${UserService.hasRole(['admin']) ? 'active' : 'inactive'}`}>
                Admin: {UserService.hasRole(['admin']) ? '✓' : '✗'}
              </div>
              <div className={`role-badge ${UserService.hasRole(['developer']) ? 'active' : 'inactive'}`}>
                Developer: {UserService.hasRole(['developer']) ? '✓' : '✗'}
              </div>
              <div className={`role-badge ${UserService.hasRole(['viewer']) ? 'active' : 'inactive'}`}>
                Viewer: {UserService.hasRole(['viewer']) ? '✓' : '✗'}
              </div>
            </div>
          </div>

          <div className="api-test">
            <h3>Token Status:</h3>
            <div className="token-display">
              <strong>Token Present:</strong> ✅<br/>
              <strong>Token Type:</strong> Bearer<br/>
              <strong>Expires:</strong> {new Date(tokenParsed?.exp * 1000).toLocaleTimeString()}
            </div>
          </div>

          <div className="token-info">
            <h3>Token Claims:</h3>
            <details>
              <summary>View Full Token Details</summary>
              <pre>{JSON.stringify(tokenParsed, null, 2)}</pre>
            </details>
          </div>

          <div className="actions">
            <button onClick={handleManageAccount} className="btn btn-secondary">
              Manage Account
            </button>
            <button onClick={handleLogout} className="btn btn-danger">
              Logout
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default WorkingApp;