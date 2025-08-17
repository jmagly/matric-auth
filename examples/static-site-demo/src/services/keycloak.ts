import Keycloak from 'keycloak-js';

class KeycloakService {
  private keycloak: Keycloak | null = null;
  private initialized = false;

  async init(): Promise<Keycloak> {
    if (this.initialized && this.keycloak) {
      return this.keycloak;
    }

    console.log('Initializing Keycloak...');
    
    this.keycloak = new Keycloak({
      url: process.env.REACT_APP_KEYCLOAK_URL || 'http://localhost:8081',
      realm: process.env.REACT_APP_KEYCLOAK_REALM || 'matric-dev',
      clientId: process.env.REACT_APP_KEYCLOAK_CLIENT || 'matric-web',
    });

    try {
      // Check if we're returning from a login
      const urlParams = new URLSearchParams(window.location.search);
      const hasAuthCode = urlParams.has('code');
      
      console.log('Keycloak init - has auth code:', hasAuthCode);
      
      // Initialize with appropriate settings
      const authenticated = await this.keycloak.init({
        onLoad: hasAuthCode ? 'check-sso' : undefined,  // Only check SSO if we have a code
        checkLoginIframe: false,
        pkceMethod: 'S256',
        enableLogging: process.env.NODE_ENV === 'development', // Only in dev
        flow: 'standard',
        responseMode: 'query',  // Use query params for auth code
      });

      if (authenticated) {
        console.log('User is authenticated');
        // NEVER log tokens or sensitive data
        // console.log('Token:', this.keycloak.token); // SECURITY RISK - REMOVED
        // console.log('User info:', this.keycloak.tokenParsed); // SECURITY RISK - REMOVED
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
    if (!this.keycloak) return;

    // Refresh token when it expires
    setInterval(async () => {
      try {
        if (this.keycloak?.authenticated) {
          const refreshed = await this.keycloak.updateToken(30);
          if (refreshed) {
            console.log('Token refreshed');
            this.onTokenRefresh();
          }
        }
      } catch (error) {
        console.error('Failed to refresh token:', error);
        this.logout();
      }
    }, 30000);
  }

  private onTokenRefresh() {
    // NEVER dispatch tokens in DOM events - security risk
    window.dispatchEvent(new CustomEvent('keycloak-token-refreshed', {
      detail: { refreshed: true } // Only send status, not the token
    }));
  }

  getKeycloak(): Keycloak | null {
    return this.keycloak;
  }

  isAuthenticated(): boolean {
    return this.keycloak?.authenticated || false;
  }

  getToken(): string | undefined {
    return this.keycloak?.token;
  }

  getUserInfo(): any {
    return this.keycloak?.tokenParsed;
  }

  hasRole(role: string): boolean {
    const tokenParsed = this.keycloak?.tokenParsed as any;
    return tokenParsed?.realm_access?.roles?.includes(role) || false;
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

const keycloakService = new KeycloakService();
export default keycloakService;