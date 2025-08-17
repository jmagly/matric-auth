#!/usr/bin/env node
/**
 * Keycloak Integration Tests for MATRIC
 * 
 * Run with: node scripts/keycloak/integration-tests.js
 * 
 * Prerequisites:
 * - Keycloak running on http://localhost:8081
 * - Test realm and users configured
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

// Test configuration
const config = {
  keycloakUrl: process.env.KEYCLOAK_URL || 'http://localhost:8081',
  realm: process.env.REALM || 'matric-dev',
  clients: {
    dashboard: 'matric-dashboard',
    studio: 'matric-studio',
    apiGateway: 'matric-api-gateway'
  },
  users: {
    admin: { username: 'admin@matric.local', password: 'admin123', role: 'admin' },
    developer: { username: 'developer@matric.local', password: 'dev123', role: 'developer' },
    viewer: { username: 'viewer@matric.local', password: 'view123', role: 'viewer' }
  },
  apiGatewaySecret: 'dev-secret-change-in-production'
};

// Test results
let passed = 0;
let failed = 0;
const results = [];

// Helper function to make HTTP requests
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    
    const req = client.request({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      ...options
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data), headers: res.headers });
          } catch {
            resolve({ status: res.statusCode, data, headers: res.headers });
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    
    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

// Test runner
async function runTest(name, testFn) {
  process.stdout.write(`Testing: ${name}... `);
  try {
    await testFn();
    passed++;
    console.log('✅ PASSED');
    results.push({ test: name, status: 'PASSED' });
  } catch (error) {
    failed++;
    console.log(`❌ FAILED: ${error.message}`);
    results.push({ test: name, status: 'FAILED', error: error.message });
  }
}

// Test functions
async function testKeycloakHealth() {
  const response = await makeRequest(`${config.keycloakUrl}/health/ready`);
  if (response.status !== 200) {
    throw new Error('Health check failed');
  }
}

async function testRealmExists() {
  const response = await makeRequest(`${config.keycloakUrl}/realms/${config.realm}`);
  if (!response.data.realm || response.data.realm !== config.realm) {
    throw new Error('Realm not found or misconfigured');
  }
}

async function testOpenIDConfiguration() {
  const response = await makeRequest(`${config.keycloakUrl}/realms/${config.realm}/.well-known/openid-configuration`);
  
  // Verify required endpoints
  const required = ['issuer', 'authorization_endpoint', 'token_endpoint', 'jwks_uri', 'userinfo_endpoint'];
  for (const field of required) {
    if (!response.data[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
  
  // Verify PKCE support
  if (!response.data.code_challenge_methods_supported?.includes('S256')) {
    throw new Error('PKCE S256 not supported');
  }
}

async function testJWKSEndpoint() {
  const response = await makeRequest(`${config.keycloakUrl}/realms/${config.realm}/protocol/openid-connect/certs`);
  
  if (!response.data.keys || response.data.keys.length === 0) {
    throw new Error('No JWKS keys found');
  }
  
  // Verify RS256 key exists
  const rs256Key = response.data.keys.find(k => k.alg === 'RS256');
  if (!rs256Key) {
    throw new Error('No RS256 key found');
  }
}

async function testUserAuthentication(user) {
  const params = new URLSearchParams({
    grant_type: 'password',
    client_id: config.clients.dashboard,
    username: user.username,
    password: user.password
  });
  
  const response = await makeRequest(
    `${config.keycloakUrl}/realms/${config.realm}/protocol/openid-connect/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    }
  );
  
  if (!response.data.access_token) {
    throw new Error('No access token received');
  }
  
  // Decode and verify token claims
  const tokenPayload = JSON.parse(
    Buffer.from(response.data.access_token.split('.')[1], 'base64').toString()
  );
  
  // Verify expected role
  if (!tokenPayload.realm_access?.roles?.includes(user.role)) {
    throw new Error(`Expected role ${user.role} not found in token`);
  }
  
  // Verify email
  if (tokenPayload.email !== user.username) {
    throw new Error('Email mismatch in token');
  }
  
  return response.data.access_token;
}

async function testTokenRefresh() {
  // First get tokens
  const params = new URLSearchParams({
    grant_type: 'password',
    client_id: config.clients.dashboard,
    username: config.users.developer.username,
    password: config.users.developer.password
  });
  
  const authResponse = await makeRequest(
    `${config.keycloakUrl}/realms/${config.realm}/protocol/openid-connect/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    }
  );
  
  // Now refresh
  const refreshParams = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: config.clients.dashboard,
    refresh_token: authResponse.data.refresh_token
  });
  
  const refreshResponse = await makeRequest(
    `${config.keycloakUrl}/realms/${config.realm}/protocol/openid-connect/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: refreshParams.toString()
    }
  );
  
  if (!refreshResponse.data.access_token) {
    throw new Error('Token refresh failed');
  }
}

async function testServiceAccountAuth() {
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.clients.apiGateway,
    client_secret: config.apiGatewaySecret
  });
  
  const response = await makeRequest(
    `${config.keycloakUrl}/realms/${config.realm}/protocol/openid-connect/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    }
  );
  
  if (!response.data.access_token) {
    throw new Error('Service account authentication failed');
  }
}

async function testTokenIntrospection() {
  // Get a token first
  const params = new URLSearchParams({
    grant_type: 'password',
    client_id: config.clients.dashboard,
    username: config.users.developer.username,
    password: config.users.developer.password
  });
  
  const authResponse = await makeRequest(
    `${config.keycloakUrl}/realms/${config.realm}/protocol/openid-connect/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    }
  );
  
  // Introspect the token
  const introspectParams = new URLSearchParams({
    token: authResponse.data.access_token,
    client_id: config.clients.apiGateway,
    client_secret: config.apiGatewaySecret
  });
  
  const introspectResponse = await makeRequest(
    `${config.keycloakUrl}/realms/${config.realm}/protocol/openid-connect/token/introspect`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: introspectParams.toString()
    }
  );
  
  if (!introspectResponse.data.active) {
    throw new Error('Token introspection shows token as inactive');
  }
}

async function testLogout() {
  // Get tokens
  const params = new URLSearchParams({
    grant_type: 'password',
    client_id: config.clients.dashboard,
    username: config.users.viewer.username,
    password: config.users.viewer.password
  });
  
  const authResponse = await makeRequest(
    `${config.keycloakUrl}/realms/${config.realm}/protocol/openid-connect/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    }
  );
  
  // Logout
  const logoutParams = new URLSearchParams({
    client_id: config.clients.dashboard,
    refresh_token: authResponse.data.refresh_token
  });
  
  await makeRequest(
    `${config.keycloakUrl}/realms/${config.realm}/protocol/openid-connect/logout`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: logoutParams.toString()
    }
  );
  
  // Try to use refresh token after logout (should fail)
  const refreshParams = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: config.clients.dashboard,
    refresh_token: authResponse.data.refresh_token
  });
  
  try {
    await makeRequest(
      `${config.keycloakUrl}/realms/${config.realm}/protocol/openid-connect/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: refreshParams.toString()
      }
    );
    throw new Error('Refresh token still valid after logout');
  } catch (error) {
    // This is expected - token should be invalid
    if (!error.message.includes('400') && !error.message.includes('401')) {
      throw error;
    }
  }
}

async function testSAMLDisabled() {
  // Try to access SAML descriptor (should fail since SAML is disabled)
  try {
    await makeRequest(`${config.keycloakUrl}/realms/${config.realm}/protocol/saml/descriptor`);
    throw new Error('SAML endpoint accessible - security vulnerability!');
  } catch (error) {
    // Expected to fail
    if (!error.message.includes('404') && !error.message.includes('403')) {
      throw new Error('SAML not properly disabled');
    }
  }
}

// Main test suite
async function runTests() {
  console.log('🔐 Keycloak Integration Tests');
  console.log('==============================');
  console.log(`Target: ${config.keycloakUrl}`);
  console.log(`Realm: ${config.realm}`);
  console.log('');
  
  // Infrastructure tests
  console.log('Infrastructure Tests:');
  await runTest('Keycloak health check', testKeycloakHealth);
  await runTest('Realm exists', testRealmExists);
  await runTest('OpenID configuration', testOpenIDConfiguration);
  await runTest('JWKS endpoint', testJWKSEndpoint);
  console.log('');
  
  // Authentication tests
  console.log('Authentication Tests:');
  await runTest('Admin user authentication', () => testUserAuthentication(config.users.admin));
  await runTest('Developer user authentication', () => testUserAuthentication(config.users.developer));
  await runTest('Viewer user authentication', () => testUserAuthentication(config.users.viewer));
  await runTest('Token refresh flow', testTokenRefresh);
  await runTest('Service account authentication', testServiceAccountAuth);
  console.log('');
  
  // Advanced tests
  console.log('Advanced Tests:');
  await runTest('Token introspection', testTokenIntrospection);
  await runTest('Logout flow', testLogout);
  console.log('');
  
  // Security tests
  console.log('Security Tests:');
  await runTest('SAML disabled (CVE-2024-8698)', testSAMLDisabled);
  console.log('');
  
  // Summary
  console.log('==============================');
  console.log('Test Results Summary:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);
  console.log('');
  
  if (failed > 0) {
    console.log('Failed Tests:');
    results.filter(r => r.status === 'FAILED').forEach(r => {
      console.log(`  • ${r.test}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('🎉 All tests passed!');
    process.exit(0);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});