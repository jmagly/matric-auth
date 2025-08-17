# Keycloak Integration: Deployment Patterns

## Overview

This document compares two React + Keycloak integration patterns:
1. **Server-Hosted SPA** - React app served from a Node.js/Express server
2. **Static Site Deployment** - React app deployed to CDN/S3/Netlify/Vercel

## Pattern Comparison

| Aspect | Server-Hosted (`react-integration.tsx`) | Static Site (`react-static-site.tsx`) |
|--------|------------------------------------------|----------------------------------------|
| **Hosting** | Node.js server required | CDN/S3/Netlify/Vercel |
| **Client Type** | Can use confidential client | Must use public client |
| **Client Secret** | Can be stored server-side | Not available (PKCE instead) |
| **Token Storage** | Can use server sessions | Browser memory only |
| **Initial Load** | Server can pre-authenticate | Client-side auth check |
| **CORS** | Controlled by your server | Must configure in Keycloak |
| **Cost** | Higher (server costs) | Lower (static hosting) |
| **Scalability** | Requires scaling servers | Infinitely scalable via CDN |
| **Security** | More secure (secrets server-side) | Relies on PKCE + browser security |

## Static Site Pattern (Recommended for MATRIC)

### Architecture
```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Browser   │────▶│  CDN/Static  │     │  Keycloak   │
│  (React)    │     │   Hosting    │     │   (Auth)    │
└─────────────┘     └──────────────┘     └─────────────┘
       │                                         ▲
       │                                         │
       └─────────────────────────────────────────┘
                    Direct Auth Flow
       
       │                                   ┌─────────────┐
       └──────────────────────────────────▶│  Backend    │
                  API Calls with JWT        │   APIs      │
                                           └─────────────┘
```

### Key Features for Static Deployment

1. **PKCE (Proof Key for Code Exchange)**
   ```typescript
   keycloak.init({
     pkceMethod: 'S256', // Critical for public clients
   });
   ```

2. **Public Client Configuration**
   - No client secret needed
   - More secure with PKCE
   - Works entirely in browser

3. **Token Management**
   - Tokens stored in memory (not localStorage)
   - Auto-refresh before expiry
   - Event-based token updates

4. **API Integration**
   - Axios interceptors for automatic auth
   - Token refresh on 401 responses
   - Centralized API service

### Deployment Process

#### 1. Build for Production
```bash
# Set production environment
export REACT_APP_KEYCLOAK_URL=https://auth.your-domain.com
export REACT_APP_API_URL=https://api.your-domain.com/api

# Build the app
npm run build
```

#### 2. Deploy to Static Hosting

**AWS S3 + CloudFront:**
```bash
# Upload to S3
aws s3 sync build/ s3://your-bucket-name --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

**Netlify:**
```bash
# Deploy with Netlify CLI
netlify deploy --prod --dir=build

# Or use continuous deployment from Git
```

**Vercel:**
```bash
# Deploy with Vercel CLI
vercel --prod

# Or connect to GitHub for auto-deploy
```

**GitHub Pages:**
```bash
# Add homepage to package.json
"homepage": "https://username.github.io/repo-name"

# Deploy
npm run build
npm run deploy  # using gh-pages package
```

### Keycloak Configuration for Static Sites

1. **Client Settings:**
   ```json
   {
     "clientId": "matric-web",
     "publicClient": true,
     "standardFlowEnabled": true,
     "directAccessGrantsEnabled": false,
     "implicitFlowEnabled": false,
     "pkceRequired": true
   }
   ```

2. **Valid Redirect URIs:**
   ```
   http://localhost:3000/*
   https://your-app.netlify.app/*
   https://your-app.vercel.app/*
   https://your-domain.com/*
   ```

3. **Web Origins (CORS):**
   ```
   http://localhost:3000
   https://your-app.netlify.app
   https://your-app.vercel.app
   https://your-domain.com
   ```

### Security Considerations

1. **Content Security Policy (CSP)**
   ```html
   <meta http-equiv="Content-Security-Policy" 
         content="default-src 'self'; 
                  connect-src 'self' https://auth.your-domain.com https://api.your-domain.com;">
   ```

2. **Environment Variables**
   - Never commit production URLs
   - Use build-time injection
   - Consider runtime configuration loading

3. **Token Storage**
   - ❌ Don't use localStorage (XSS vulnerable)
   - ✅ Use memory storage (service pattern)
   - ✅ Use secure, httpOnly cookies (if backend supports)

### Backend API Protection

Your backend APIs should validate tokens regardless of deployment pattern:

```typescript
// Express middleware example
app.use(async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    // Validate token with Keycloak public key
    const decoded = await validateToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});
```

## When to Use Each Pattern

### Use Static Site Pattern When:
- ✅ You want CDN performance benefits
- ✅ You need infinite scalability
- ✅ You want lower hosting costs
- ✅ Your app is truly a SPA
- ✅ You don't need SEO for protected content
- ✅ You can handle auth entirely client-side

### Use Server-Hosted Pattern When:
- ✅ You need server-side rendering (SSR)
- ✅ You want to hide auth complexity from client
- ✅ You need better SEO
- ✅ You have complex session management needs
- ✅ You want to use confidential clients
- ✅ You need server-side token management

## Migration Path

To migrate from server-hosted to static:

1. **Update Keycloak Client:**
   - Change from confidential to public
   - Enable PKCE
   - Add all deployment URLs to redirect URIs

2. **Refactor Auth Code:**
   - Remove server-side auth logic
   - Implement client-side Keycloak service
   - Update API calls to include tokens

3. **Configure Build Pipeline:**
   - Set up environment-specific builds
   - Configure CDN/static hosting
   - Set up CI/CD for deployments

4. **Update CORS:**
   - Configure Keycloak web origins
   - Update backend CORS settings
   - Test cross-origin requests

## Testing Checklist

- [ ] Login flow works from static site
- [ ] Logout properly clears session
- [ ] Token refresh works automatically
- [ ] API calls include valid tokens
- [ ] 401 responses trigger re-authentication
- [ ] CORS headers are properly configured
- [ ] PKCE is enabled and working
- [ ] Role-based access control works
- [ ] Account management links work
- [ ] Password reset flow works

## Monitoring & Debugging

### Browser DevTools
```javascript
// Check Keycloak state
console.log(keycloakService.getKeycloak());

// Monitor token refresh
window.addEventListener('keycloak-token-refreshed', (e) => {
  console.log('Token refreshed:', e.detail);
});
```

### Network Monitoring
- Monitor token endpoint calls
- Check for CORS errors
- Verify redirect flows
- Monitor API authentication headers

### Common Issues

1. **CORS Errors**
   - Solution: Add origin to Keycloak Web Origins

2. **Redirect Loop**
   - Solution: Check Valid Redirect URIs include exact URL

3. **Token Expired**
   - Solution: Implement proper token refresh logic

4. **Session Lost on Refresh**
   - Solution: Use check-sso in Keycloak init

## Conclusion

For MATRIC's architecture (static frontends + API backends), the **Static Site Pattern** is recommended because:

1. **Cost Effective** - No server costs for frontend
2. **Scalable** - CDN provides global distribution
3. **Simple** - No server maintenance
4. **Fast** - Edge caching for static assets
5. **Secure** - PKCE provides security for public clients

The implementation in `react-static-site.tsx` provides a production-ready pattern that can be deployed to any static hosting service while maintaining secure authentication through Keycloak.