import React, { useState, useEffect } from 'react';
import Keycloak from 'keycloak-js';
import './App.css';

// Initialize Keycloak instance (done once)
const keycloak = new Keycloak({
    url: "http://localhost:8081",
    realm: "matric-dev",
    clientId: "matric-web"
});

function OfficialApp() {
    const [authenticated, setAuthenticated] = useState(false);
    const [initialized, setInitialized] = useState(false);
    const [userInfo, setUserInfo] = useState(null);

    useEffect(() => {
        // Initialize Keycloak exactly as shown in official docs
        const init = async () => {
            try {
                console.log('Starting Keycloak initialization...');
                const auth = await keycloak.init({
                    // Don't use onLoad to avoid automatic redirects
                    checkLoginIframe: false,
                    pkceMethod: 'S256'
                });
                
                console.log('Keycloak initialized. Authenticated:', auth);
                
                if (auth) {
                    console.log('User is authenticated');
                    console.log('Token:', keycloak.token);
                    console.log('User:', keycloak.tokenParsed);
                    setUserInfo(keycloak.tokenParsed);
                } else {
                    console.log('User is not authenticated');
                }
                
                setAuthenticated(auth);
                setInitialized(true);
                
                // Set up auto-refresh if authenticated
                if (auth) {
                    setInterval(async () => {
                        try {
                            const refreshed = await keycloak.updateToken(30);
                            if (refreshed) {
                                console.log('Token refreshed');
                            }
                        } catch (error) {
                            console.error('Failed to refresh token', error);
                            setAuthenticated(false);
                        }
                    }, 30000);
                }
            } catch (error) {
                console.error('Failed to initialize adapter:', error);
                setInitialized(true);
            }
        };
        
        init();
    }, []);

    const login = async () => {
        console.log('Starting login...');
        // Force fresh login by adding prompt=login
        keycloak.login({
            prompt: 'login',
            redirectUri: window.location.origin + '/'
        });
    };
    
    const clearSessionAndLogin = async () => {
        console.log('Clearing session and starting fresh login...');
        // Clear any existing session first
        try {
            await keycloak.logout({ redirectUri: window.location.origin + '/' });
        } catch (e) {
            console.log('No existing session to clear');
        }
        // Then force login
        setTimeout(() => {
            keycloak.login({
                prompt: 'login',
                redirectUri: window.location.origin + '/'
            });
        }, 100);
    };

    const logout = () => {
        console.log('Starting logout...');
        keycloak.logout();
    };

    if (!initialized) {
        return (
            <div className="app">
                <div className="loading">
                    <h2>Initializing Keycloak...</h2>
                </div>
            </div>
        );
    }

    if (!authenticated) {
        return (
            <div className="app">
                <header className="app-header">
                    <h1>🔐 MATRIC Auth Demo (Official Pattern)</h1>
                    <p>Using Keycloak JS adapter directly as per official docs</p>
                </header>
                <main className="app-main">
                    <div className="login-card">
                        <h2>Welcome to MATRIC</h2>
                        <p>You are not authenticated</p>
                        
                        <button onClick={login} className="btn btn-primary">
                            Login with Keycloak
                        </button>
                        
                        <button onClick={clearSessionAndLogin} className="btn btn-secondary" style={{marginTop: '10px'}}>
                            Clear Session & Login (Fresh)
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
                        
                        <div className="info">
                            <p><strong>Debug Info:</strong></p>
                            <p>Keycloak URL: http://localhost:8081</p>
                            <p>Realm: matric-dev</p>
                            <p>Client: matric-web</p>
                            <p>Initialized: {initialized ? 'Yes' : 'No'}</p>
                            <p>Current URL: {window.location.href}</p>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    // User is authenticated
    return (
        <div className="app">
            <header className="app-header">
                <h1>🔐 MATRIC Auth Demo (Official Pattern)</h1>
                <p>Successfully authenticated!</p>
            </header>
            <main className="app-main">
                <div className="user-card">
                    <h2>Welcome, {keycloak.tokenParsed?.preferred_username}! ✅</h2>
                    
                    <div className="user-details">
                        <h3>User Information:</h3>
                        <table>
                            <tbody>
                                <tr>
                                    <td><strong>Subject:</strong></td>
                                    <td>{keycloak.subject}</td>
                                </tr>
                                <tr>
                                    <td><strong>Username:</strong></td>
                                    <td>{keycloak.tokenParsed?.preferred_username}</td>
                                </tr>
                                <tr>
                                    <td><strong>Email:</strong></td>
                                    <td>{keycloak.tokenParsed?.email}</td>
                                </tr>
                                <tr>
                                    <td><strong>Token:</strong></td>
                                    <td>{keycloak.token?.substring(0, 30)}...</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    
                    <div className="role-check">
                        <h3>Realm Access:</h3>
                        <pre>{JSON.stringify(keycloak.realmAccess, null, 2)}</pre>
                    </div>
                    
                    <div className="actions">
                        <button onClick={() => keycloak.accountManagement()} className="btn btn-secondary">
                            Account Management
                        </button>
                        <button onClick={logout} className="btn btn-danger">
                            Logout
                        </button>
                    </div>
                    
                    <div className="token-info">
                        <details>
                            <summary>Full Token Details</summary>
                            <pre>{JSON.stringify(keycloak.tokenParsed, null, 2)}</pre>
                        </details>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default OfficialApp;