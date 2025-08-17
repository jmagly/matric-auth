// React + Keycloak for Static Site Deployment (CDN/S3/Netlify/Vercel)
// This implementation works for SPAs deployed as static files with no backend server

// 1. Install dependencies:
// npm install keycloak-js axios

// 2. Keycloak singleton service (services/keycloak.ts)
import Keycloak from 'keycloak-js';

class KeycloakService {
  private keycloak: Keycloak | null = null;
  private initialized = false;

  async init() {
    if (this.initialized) {
      return this.keycloak;
    }

    this.keycloak = new Keycloak({
      url: process.env.REACT_APP_KEYCLOAK_URL || 'http://localhost:8081',
      realm: process.env.REACT_APP_KEYCLOAK_REALM || 'matric-dev',
      clientId: process.env.REACT_APP_KEYCLOAK_CLIENT || 'matric-web',
    });

    try {
      const authenticated = await this.keycloak.init({
        onLoad: 'check-sso',
        checkLoginIframe: true,
        pkceMethod: 'S256', // Important for public clients (no client secret)
        silentCheckSsoFallback: false,
      });

      if (authenticated) {
        console.log('User is authenticated');
        this.setupTokenRefresh();
      } else {
        console.log('User is not authenticated');
      }

      this.initialized = true;
      return this.keycloak;
    } catch (error) {
      console.error('Failed to initialize Keycloak:', error);
      throw error;
    }
  }

  private setupTokenRefresh() {
    // Automatically refresh token when it expires
    setInterval(async () => {
      try {
        const refreshed = await this.keycloak?.updateToken(30);
        if (refreshed) {
          console.log('Token refreshed');
          // Store token in memory only (not localStorage for security)
          this.onTokenRefresh();
        }
      } catch (error) {
        console.error('Failed to refresh token:', error);
        this.logout();
      }
    }, 30000); // Check every 30 seconds
  }

  private onTokenRefresh() {
    // Emit event or update global state
    window.dispatchEvent(new CustomEvent('keycloak-token-refreshed', {
      detail: { token: this.keycloak?.token }
    }));
  }

  getKeycloak() {
    return this.keycloak;
  }

  isAuthenticated() {
    return this.keycloak?.authenticated || false;
  }

  getToken() {
    return this.keycloak?.token;
  }

  getUserInfo() {
    return this.keycloak?.tokenParsed;
  }

  hasRole(role: string) {
    return this.keycloak?.tokenParsed?.realm_access?.roles?.includes(role) || false;
  }

  login() {
    this.keycloak?.login();
  }

  logout() {
    this.keycloak?.logout({
      redirectUri: window.location.origin
    });
  }

  register() {
    this.keycloak?.register();
  }

  accountManagement() {
    this.keycloak?.accountManagement();
  }
}

export default new KeycloakService();

// 3. React Context for Auth State (contexts/AuthContext.tsx)
import React, { createContext, useContext, useState, useEffect } from 'react';
import keycloakService from '../services/keycloak';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: any;
  login: () => void;
  logout: () => void;
  register: () => void;
  hasRole: (role: string) => boolean;
  getToken: () => string | undefined;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const initAuth = async () => {
      try {
        await keycloakService.init();
        setIsAuthenticated(keycloakService.isAuthenticated());
        setUser(keycloakService.getUserInfo());
      } catch (error) {
        console.error('Auth initialization failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    // Listen for token refresh events
    const handleTokenRefresh = () => {
      setUser(keycloakService.getUserInfo());
    };

    window.addEventListener('keycloak-token-refreshed', handleTokenRefresh);
    return () => {
      window.removeEventListener('keycloak-token-refreshed', handleTokenRefresh);
    };
  }, []);

  const value: AuthContextType = {
    isAuthenticated,
    isLoading,
    user,
    login: () => keycloakService.login(),
    logout: () => keycloakService.logout(),
    register: () => keycloakService.register(),
    hasRole: (role: string) => keycloakService.hasRole(role),
    getToken: () => keycloakService.getToken(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// 4. API Service with Auth (services/api.ts)
import axios, { AxiosInstance } from 'axios';
import keycloakService from './keycloak';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3000/api',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      async (config) => {
        const token = keycloakService.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor to handle 401s
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            // Try to refresh the token
            const keycloak = keycloakService.getKeycloak();
            const refreshed = await keycloak?.updateToken(5);
            
            if (refreshed) {
              // Retry the original request with new token
              originalRequest.headers.Authorization = `Bearer ${keycloak?.token}`;
              return this.api(originalRequest);
            }
          } catch (refreshError) {
            // Refresh failed, redirect to login
            keycloakService.logout();
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // Public methods for API calls
  async get<T>(url: string, params?: any): Promise<T> {
    const response = await this.api.get(url, { params });
    return response.data;
  }

  async post<T>(url: string, data?: any): Promise<T> {
    const response = await this.api.post(url, data);
    return response.data;
  }

  async put<T>(url: string, data?: any): Promise<T> {
    const response = await this.api.put(url, data);
    return response.data;
  }

  async delete<T>(url: string): Promise<T> {
    const response = await this.api.delete(url);
    return response.data;
  }
}

export default new ApiService();

// 5. Main App Component (App.tsx)
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import HomePage from './pages/HomePage';
import DashboardPage from './pages/DashboardPage';
import AdminPage from './pages/AdminPage';
import LoginPage from './pages/LoginPage';

// Protected Route Component
const ProtectedRoute: React.FC<{ 
  children: React.ReactNode;
  requiredRole?: string;
}> = ({ children, requiredRole }) => {
  const { isAuthenticated, isLoading, hasRole } = useAuth();

  if (isLoading) {
    return <div>Loading authentication...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          } />
          
          <Route path="/admin" element={
            <ProtectedRoute requiredRole="admin">
              <AdminPage />
            </ProtectedRoute>
          } />
          
          <Route path="/unauthorized" element={
            <div>You don't have permission to access this page.</div>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

// 6. Login Page Component (pages/LoginPage.tsx)
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const LoginPage: React.FC = () => {
  const { isAuthenticated, login, register } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="login-page">
      <div className="login-container">
        <h1>Welcome to MATRIC</h1>
        <p>Please login to continue</p>
        
        <div className="login-buttons">
          <button onClick={login} className="btn btn-primary">
            Login with Keycloak
          </button>
          
          <button onClick={register} className="btn btn-secondary">
            Create New Account
          </button>
        </div>
        
        <div className="login-info">
          <p>This will redirect you to the secure Keycloak login page.</p>
          <p>After authentication, you'll be redirected back to the application.</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

// 7. Dashboard Component with API Calls (pages/DashboardPage.tsx)
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

interface DashboardData {
  workflows: any[];
  metrics: any;
}

const DashboardPage: React.FC = () => {
  const { user, logout, hasRole } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // These API calls will automatically include the auth token
        const [workflows, metrics] = await Promise.all([
          api.get<any[]>('/workflows'),
          api.get<any>('/metrics'),
        ]);
        
        setData({ workflows, metrics });
      } catch (err) {
        setError('Failed to load dashboard data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleCreateWorkflow = async () => {
    try {
      const newWorkflow = await api.post('/workflows', {
        name: 'New Workflow',
        description: 'Created from dashboard',
      });
      
      setData(prev => prev ? {
        ...prev,
        workflows: [...prev.workflows, newWorkflow]
      } : null);
    } catch (err) {
      console.error('Failed to create workflow:', err);
    }
  };

  if (loading) return <div>Loading dashboard...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="dashboard">
      <header>
        <h1>Dashboard</h1>
        <div className="user-info">
          <span>Welcome, {user?.preferred_username}!</span>
          <button onClick={() => keycloakService.accountManagement()}>
            My Account
          </button>
          <button onClick={logout}>Logout</button>
        </div>
      </header>

      <main>
        <section className="metrics">
          <h2>Metrics</h2>
          <pre>{JSON.stringify(data?.metrics, null, 2)}</pre>
        </section>

        <section className="workflows">
          <h2>Workflows</h2>
          {hasRole('developer') && (
            <button onClick={handleCreateWorkflow}>Create New Workflow</button>
          )}
          <ul>
            {data?.workflows.map((workflow, index) => (
              <li key={index}>{workflow.name}</li>
            ))}
          </ul>
        </section>

        <section className="user-roles">
          <h2>Your Roles</h2>
          <ul>
            {user?.realm_access?.roles?.map((role: string) => (
              <li key={role}>{role}</li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
};

export default DashboardPage;

// 8. Environment Configuration (.env)
/*
# Keycloak Configuration for Static Site
REACT_APP_KEYCLOAK_URL=http://localhost:8081
REACT_APP_KEYCLOAK_REALM=matric-dev
REACT_APP_KEYCLOAK_CLIENT=matric-web

# Backend API URL
REACT_APP_API_URL=http://localhost:3000/api

# For production:
# REACT_APP_KEYCLOAK_URL=https://auth.your-domain.com
# REACT_APP_API_URL=https://api.your-domain.com/api
*/

// 9. Deployment Configuration (public/keycloak.json)
// Alternative to environment variables - can be dynamically loaded
/*
{
  "realm": "matric-dev",
  "auth-server-url": "http://localhost:8081",
  "ssl-required": "external",
  "resource": "matric-web",
  "public-client": true,
  "confidential-port": 0
}
*/

// 10. Build and Deploy Script (package.json additions)
/*
{
  "scripts": {
    "build:staging": "REACT_APP_ENV=staging npm run build",
    "build:production": "REACT_APP_ENV=production npm run build",
    "deploy:s3": "aws s3 sync build/ s3://your-bucket-name --delete",
    "deploy:netlify": "netlify deploy --prod --dir=build",
    "deploy:vercel": "vercel --prod"
  }
}
*/

// 11. CORS Configuration Note
/*
IMPORTANT: For static site deployment, ensure your Keycloak client configuration includes:

1. Valid Redirect URIs:
   - http://localhost:3000/*
   - https://your-production-domain.com/*
   
2. Web Origins (for CORS):
   - http://localhost:3000
   - https://your-production-domain.com
   
3. Client Settings:
   - Access Type: public (no client secret needed)
   - Standard Flow Enabled: ON
   - Direct Access Grants Enabled: OFF (more secure for SPAs)
   - PKCE: Required (for enhanced security)
*/

// 12. Security Headers for Static Hosting (netlify.toml example)
/*
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    X-XSS-Protection = "1; mode=block"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Content-Security-Policy = "default-src 'self'; connect-src 'self' http://localhost:8081 http://localhost:3000 https://your-api.com; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
*/