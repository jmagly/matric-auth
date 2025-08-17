# SSO Strategies for Single Page Applications

## The Redirect Loop Problem

SPAs often encounter redirect loops when implementing SSO because:
1. The app checks for existing authentication on load
2. If not authenticated, it redirects to the identity provider
3. After login, it redirects back to the app
4. The app loads again and checks authentication
5. If the session isn't properly established, it starts over

## Strategy Comparison

### 1. **Manual Login (Recommended for SPAs)**
```typescript
keycloak.init({
  // No onLoad parameter - don't automatically check SSO
  checkLoginIframe: false,
  pkceMethod: 'S256'
})
```

**Pros:**
- No redirect loops
- User controls when to login
- Clean user experience
- Works reliably across all browsers

**Cons:**
- No automatic SSO
- User must click login even if authenticated elsewhere

**When to use:**
- Public-facing SPAs
- Applications where users expect explicit login
- When redirect loops are problematic

### 2. **Check-SSO with Silent Check**
```typescript
keycloak.init({
  onLoad: 'check-sso',
  silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
  checkLoginIframe: true,
  pkceMethod: 'S256'
})
```

**Pros:**
- Automatic SSO if user is logged in elsewhere
- No forced login

**Cons:**
- Can cause redirect loops
- Requires additional HTML file
- Browser security policies may block

**When to use:**
- Internal applications
- When SSO across multiple apps is critical

### 3. **Login-Required (Force Authentication)**
```typescript
keycloak.init({
  onLoad: 'login-required',
  pkceMethod: 'S256'
})
```

**Pros:**
- Users are always authenticated
- Simple implementation

**Cons:**
- Forces login immediately
- Poor UX for public pages
- Can cause loops if misconfigured

**When to use:**
- Internal admin panels
- Apps with no public content

### 4. **Hybrid Approach (Best Practice)**
```typescript
class AuthService {
  private keycloak: Keycloak;
  
  async init() {
    // Initialize without automatic actions
    await this.keycloak.init({
      checkLoginIframe: false,
      pkceMethod: 'S256'
    });
    
    // Check if returning from login
    if (window.location.search.includes('code=')) {
      // Process the authentication code
      await this.handleCallback();
    }
    
    // Try silent authentication separately
    if (!this.keycloak.authenticated) {
      await this.trySilentAuth();
    }
  }
  
  async trySilentAuth() {
    try {
      // Attempt silent auth in hidden iframe
      await this.keycloak.login({
        prompt: 'none',
        redirectUri: window.location.origin + '/silent-callback'
      });
    } catch (error) {
      // Silent auth failed, user needs to login manually
      console.log('Silent auth not available');
    }
  }
}
```

**Pros:**
- Prevents redirect loops
- Supports SSO when possible
- Graceful fallback

**Cons:**
- More complex implementation
- Requires multiple callback handlers

## Implementation Patterns by Provider

### Google Identity Services (GIS)
```javascript
// Google's approach: separate prompt and callback
google.accounts.id.initialize({
  client_id: 'YOUR_CLIENT_ID',
  callback: handleCredentialResponse,
  auto_select: true,  // Try automatic sign-in
  cancel_on_tap_outside: false
});

// Show prompt only when needed
google.accounts.id.prompt((notification) => {
  if (notification.isNotDisplayed()) {
    // Silent auth failed, show login button
    showManualLoginButton();
  }
});
```

### Auth0
```javascript
// Auth0's approach: check session separately
const auth0 = new Auth0Client({
  domain: 'YOUR_DOMAIN',
  clientId: 'YOUR_CLIENT_ID',
  cacheLocation: 'localstorage'
});

// Check session without redirect
try {
  await auth0.checkSession();
  const user = await auth0.getUser();
} catch (error) {
  // Not authenticated, show login button
}
```

### Microsoft Authentication Library (MSAL)
```javascript
// MSAL's approach: silent token acquisition
const msalInstance = new PublicClientApplication(config);

// Try silent authentication first
try {
  const response = await msalInstance.ssoSilent({
    scopes: ["user.read"]
  });
} catch (error) {
  // Fall back to interactive login
  await msalInstance.loginPopup({
    scopes: ["user.read"]
  });
}
```

## Keycloak Best Practices for SPAs

### 1. Prevent Redirect Loops
```typescript
// Bad - can cause loops
keycloak.init({
  onLoad: 'check-sso',
  checkLoginIframe: true  // This often fails in modern browsers
});

// Good - manual control
keycloak.init({
  checkLoginIframe: false,
  pkceMethod: 'S256'
});
```

### 2. Handle Authentication State Separately
```typescript
interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: any;
}

// Separate authentication check from initialization
async function initAuth(): Promise<AuthState> {
  // 1. Initialize Keycloak without automatic actions
  await keycloak.init({ pkceMethod: 'S256' });
  
  // 2. Check URL for auth callback
  if (isAuthCallback()) {
    await processAuthCallback();
  }
  
  // 3. Return current state
  return {
    isAuthenticated: keycloak.authenticated || false,
    isLoading: false,
    user: keycloak.tokenParsed || null
  };
}
```

### 3. Use Feature Detection
```typescript
// Detect if browser supports required features
function canUseSilentAuth(): boolean {
  // Check for third-party cookie support
  const hasStorageAccess = 'hasStorageAccess' in document;
  
  // Check if in iframe
  const isIframe = window !== window.parent;
  
  // Check browser privacy settings
  const isPrivateMode = !window.indexedDB;
  
  return hasStorageAccess && !isIframe && !isPrivateMode;
}

// Use appropriate strategy based on capabilities
if (canUseSilentAuth()) {
  // Try silent auth
} else {
  // Show login button
}
```

### 4. Implement Graceful Degradation
```typescript
class RobustAuthService {
  async authenticate() {
    const strategies = [
      this.trySilentAuth,
      this.tryStoredToken,
      this.showLoginButton
    ];
    
    for (const strategy of strategies) {
      try {
        const result = await strategy.call(this);
        if (result.success) {
          return result;
        }
      } catch (error) {
        console.log(`Strategy failed: ${strategy.name}`, error);
        continue;
      }
    }
    
    // All strategies failed
    return { success: false, requiresLogin: true };
  }
}
```

## Debugging Redirect Loops

### 1. Check Browser DevTools
```javascript
// Add debugging to track redirects
window.addEventListener('beforeunload', () => {
  console.log('Page unloading', {
    url: window.location.href,
    authenticated: keycloak?.authenticated,
    token: keycloak?.token ? 'present' : 'missing'
  });
});
```

### 2. Use Network Tab
- Look for repeated calls to:
  - `/auth/realms/{realm}/protocol/openid-connect/auth`
  - Your application URL
- Check for missing parameters in redirect URLs

### 3. Common Causes and Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Infinite redirects | `onLoad: 'check-sso'` with iframe issues | Remove automatic SSO check |
| Token not captured | Incorrect redirect URI | Ensure exact URI match in Keycloak |
| Session lost | Third-party cookies blocked | Use first-party domain or disable iframe check |
| PKCE mismatch | Code verifier lost | Ensure proper state management |

## Recommended Approach for MATRIC

```typescript
// 1. Simple, reliable initialization
export class MatricAuthService {
  private keycloak: Keycloak;
  
  async init() {
    this.keycloak = new Keycloak({
      url: process.env.REACT_APP_KEYCLOAK_URL,
      realm: 'matric-dev',
      clientId: 'matric-web'
    });
    
    // Initialize without automatic actions
    const authenticated = await this.keycloak.init({
      checkLoginIframe: false,  // Prevent iframe issues
      pkceMethod: 'S256',        // Security for public clients
      enableLogging: true        // Debug in development
    });
    
    return authenticated;
  }
  
  // Explicit login method
  async login() {
    await this.keycloak.login({
      redirectUri: window.location.origin,
      scope: 'openid profile email'
    });
  }
  
  // Optional: Try silent auth separately
  async checkExistingSession() {
    if (this.canUseSilentAuth()) {
      try {
        await this.keycloak.login({
          prompt: 'none',
          redirectUri: window.location.origin + '/silent-check'
        });
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
  
  private canUseSilentAuth(): boolean {
    // Check if conditions are suitable for silent auth
    const url = new URL(window.location.href);
    return !url.searchParams.has('error') && 
           !url.searchParams.has('code') &&
           document.hasStorageAccess !== undefined;
  }
}
```

## Testing Checklist

- [ ] Test in normal browser mode
- [ ] Test in incognito/private mode
- [ ] Test with third-party cookies blocked
- [ ] Test with browser extensions (ad blockers)
- [ ] Test on mobile browsers
- [ ] Test with VPN/proxy
- [ ] Test cross-domain scenarios
- [ ] Test token expiration scenarios
- [ ] Test logout and re-login flow
- [ ] Test multiple tabs/windows

## Key Takeaways

1. **Don't rely on automatic SSO for SPAs** - Browser security makes it unreliable
2. **Provide explicit login controls** - Users understand and trust visible login buttons
3. **Handle authentication state separately** - Don't couple initialization with authentication
4. **Test across browsers and privacy modes** - Modern browsers have different security policies
5. **Implement fallback strategies** - Always have a manual login option
6. **Monitor and log authentication flows** - Help diagnose issues in production

This approach ensures a reliable authentication experience across all browsers and security settings, avoiding the common pitfalls of redirect loops in SPAs.