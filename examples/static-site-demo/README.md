# MATRIC Static Site Authentication Demo

## ✅ The app is now running!

### Access the Demo
🌐 **Open your browser to: http://localhost:3000**

## What You'll See

### Before Login:
- Welcome screen with test account credentials
- Features list showing PKCE authentication
- Login and Register buttons

### After Login:
- Your user profile information
- Role-based access indicators
- Token details viewer
- Account management button
- API integration test button

## Test Accounts

| Username | Password | Role |
|----------|----------|------|
| admin@matric.local | admin123 | Admin |
| developer@matric.local | dev123 | Developer |
| viewer@matric.local | view123 | Viewer |

## Key Features Demonstrated

1. **PKCE Authentication** - No client secret needed, perfect for static sites
2. **Automatic Token Refresh** - Tokens refresh every 30 seconds
3. **Role-Based Access** - Shows different UI based on user roles
4. **API Integration** - Axios interceptors automatically add Bearer tokens
5. **Account Management** - Direct links to Keycloak account console

## How It Works

1. **Click "Login with Keycloak"** - Redirects to Keycloak login page
2. **Enter credentials** - Use one of the test accounts
3. **Get redirected back** - After login, you return to the app authenticated
4. **Token in memory** - Token stored in memory only (not localStorage)
5. **API calls secured** - All API calls automatically include the token

## Test the Authentication

1. **Login** - Click login and use test credentials
2. **Check roles** - See which roles are active for your user
3. **Test API** - Click "Test API Call with Token" to see token attachment
4. **Manage Account** - Click to go to Keycloak account management
5. **Logout** - Properly clears session

## Build for Production

```bash
# Build for production
npm run build

# Files will be in build/ directory
# Deploy to any static hosting (S3, Netlify, Vercel, etc.)
```

## Important Files

- `src/services/keycloak.ts` - Keycloak initialization and management
- `src/services/api.ts` - API service with automatic auth
- `src/App.tsx` - Main application component
- `.env` - Configuration (change for production)

## Security Notes

- Uses PKCE for public client security
- No client secret in code
- Tokens stored in memory only
- Automatic token refresh
- Proper logout flow

## Next Steps

After testing this demo:
1. Build the app: `npm run build`
2. Deploy `build/` folder to your CDN
3. Update `.env` with production URLs
4. Configure Keycloak client with production redirect URIs

## Stop the Demo

Press `Ctrl+C` in the terminal to stop the development server.