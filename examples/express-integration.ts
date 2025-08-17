// Express + Keycloak Integration Example
// This shows how to protect Express APIs with Keycloak

// 1. Install dependencies:
// npm install express keycloak-connect express-session jsonwebtoken jwks-rsa

import express from 'express';
import session from 'express-session';
import Keycloak from 'keycloak-connect';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const app = express();

// Session configuration (required for keycloak-connect)
const memoryStore = new session.MemoryStore();
app.use(session({
  secret: 'some-secret-key',
  resave: false,
  saveUninitialized: true,
  store: memoryStore,
}));

// Keycloak configuration
const keycloakConfig = {
  realm: 'matric-dev',
  'auth-server-url': 'http://localhost:8081',
  'ssl-required': 'external',
  resource: 'matric-service',
  'bearer-only': true,
  'confidential-port': 0,
};

const keycloak = new Keycloak({ store: memoryStore }, keycloakConfig);

// Initialize Keycloak middleware
app.use(keycloak.middleware());

// ============================================
// Method 1: Using keycloak-connect middleware
// ============================================

// Public endpoint - no authentication required
app.get('/api/public', (req, res) => {
  res.json({ message: 'This is a public endpoint' });
});

// Protected endpoint - requires authentication
app.get('/api/protected', 
  keycloak.protect(),
  (req, res) => {
    res.json({ 
      message: 'This is a protected endpoint',
      user: (req as any).kauth.grant.access_token.content
    });
  }
);

// Role-based protection
app.get('/api/admin',
  keycloak.protect('realm:admin'),
  (req, res) => {
    res.json({ 
      message: 'Admin only endpoint',
      user: (req as any).kauth.grant.access_token.content
    });
  }
);

app.get('/api/developer',
  keycloak.protect('realm:developer'),
  (req, res) => {
    res.json({ 
      message: 'Developer only endpoint',
      user: (req as any).kauth.grant.access_token.content
    });
  }
);

// Check multiple roles
app.get('/api/admin-or-developer',
  keycloak.protect((token: any) => {
    return token.hasRole('admin') || token.hasRole('developer');
  }),
  (req, res) => {
    res.json({ 
      message: 'Admin or Developer endpoint',
      user: (req as any).kauth.grant.access_token.content
    });
  }
);

// ============================================
// Method 2: Manual JWT validation
// ============================================

// JWKS client for fetching public keys
const jwksUri = 'http://localhost:8081/realms/matric-dev/protocol/openid-connect/certs';
const client = jwksClient({
  jwksUri,
  requestHeaders: {}, // Optional
  timeout: 30000, // 30 seconds
});

function getKey(header: any, callback: any) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      return callback(err);
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

// Custom JWT validation middleware
const validateJWT = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const token = authHeader.split(' ')[1];
  
  jwt.verify(token, getKey, {
    algorithms: ['RS256'],
    issuer: 'http://localhost:8081/realms/matric-dev',
  }, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid token', details: err.message });
    }
    
    (req as any).user = decoded;
    next();
  });
};

// Custom role checking middleware
const requireRole = (role: string) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = (req as any).user;
    
    if (!user || !user.realm_access || !user.realm_access.roles.includes(role)) {
      return res.status(403).json({ error: `Requires ${role} role` });
    }
    
    next();
  };
};

// Using custom JWT validation
app.get('/api/v2/protected', validateJWT, (req, res) => {
  res.json({
    message: 'Protected with manual JWT validation',
    user: (req as any).user,
  });
});

app.get('/api/v2/admin', validateJWT, requireRole('admin'), (req, res) => {
  res.json({
    message: 'Admin endpoint with manual validation',
    user: (req as any).user,
  });
});

// ============================================
// Method 3: Service Account (Client Credentials)
// ============================================

import axios from 'axios';

// Function to get service account token
async function getServiceAccountToken() {
  try {
    const response = await axios.post(
      'http://localhost:8081/realms/matric-dev/protocol/openid-connect/token',
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: 'matric-service',
        client_secret: 'matric-service-secret',
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    
    return response.data.access_token;
  } catch (error) {
    console.error('Failed to get service account token:', error);
    throw error;
  }
}

// Use service account to call another service
app.get('/api/call-external-service', async (req, res) => {
  try {
    const token = await getServiceAccountToken();
    
    // Call external service with service account token
    const response = await axios.get('http://external-service/api/data', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    res.json({
      message: 'Data from external service',
      data: response.data,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to call external service' });
  }
});

// ============================================
// User Management Endpoints
// ============================================

// Get user info from token
app.get('/api/me', keycloak.protect(), (req, res) => {
  const token = (req as any).kauth.grant.access_token.content;
  
  res.json({
    id: token.sub,
    username: token.preferred_username,
    email: token.email,
    name: token.name,
    roles: token.realm_access?.roles || [],
    tenant: token.tenant_id, // Custom claim if configured
  });
});

// Logout endpoint
app.post('/api/logout', keycloak.protect(), async (req, res) => {
  try {
    const token = (req as any).kauth.grant.access_token.token;
    
    // Invalidate the session in Keycloak
    await axios.post(
      `http://localhost:8081/realms/matric-dev/protocol/openid-connect/logout`,
      new URLSearchParams({
        client_id: 'matric-service',
        client_secret: 'matric-service-secret',
        refresh_token: (req as any).kauth.grant.refresh_token.token,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to logout' });
  }
});

// ============================================
// WebSocket Authentication Example
// ============================================

import { Server } from 'socket.io';
import http from 'http';

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    credentials: true,
  },
});

// WebSocket authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication required'));
    }
    
    // Verify the token
    jwt.verify(token, getKey, {
      algorithms: ['RS256'],
      issuer: 'http://localhost:8081/realms/matric-dev',
    }, (err, decoded) => {
      if (err) {
        return next(new Error('Invalid token'));
      }
      
      (socket as any).user = decoded;
      next();
    });
  } catch (error) {
    next(new Error('Authentication failed'));
  }
});

io.on('connection', (socket) => {
  const user = (socket as any).user;
  console.log(`User ${user.preferred_username} connected via WebSocket`);
  
  socket.on('message', (data) => {
    // Handle authenticated WebSocket messages
    socket.emit('response', {
      message: `Hello ${user.preferred_username}`,
      data,
    });
  });
  
  socket.on('disconnect', () => {
    console.log(`User ${user.preferred_username} disconnected`);
  });
});

// ============================================
// Error handling
// ============================================

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err.status === 401) {
    res.status(401).json({ error: 'Unauthorized' });
  } else if (err.status === 403) {
    res.status(403).json({ error: 'Forbidden' });
  } else {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Protected endpoints require Bearer token from Keycloak`);
});