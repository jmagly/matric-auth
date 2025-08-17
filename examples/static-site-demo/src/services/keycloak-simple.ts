import Keycloak from 'keycloak-js';

class SimpleKeycloakService {
  private keycloak: Keycloak | null = null;
  private initialized = false;
  private initPromise: Promise<boolean> | null = null;

  async init(): Promise<boolean> {
    // Prevent multiple simultaneous initializations
    if (this.initPromise) {
      return this.initPromise;
    }
    
    if (this.initialized && this.keycloak) {
      return this.keycloak.authenticated || false;
    }
    
    // Store the promise to prevent double init
    this.initPromise = this.doInit();
    return this.initPromise;
  }
  
  private async doInit(): Promise<boolean> {

    console.log('Initializing Keycloak (Simple)...');
    
    this.keycloak = new Keycloak({
      url: 'http://localhost:8081',
      realm: 'matric-dev',
      clientId: 'matric-web',
    });

    try {
      // Very simple init - just parse the URL for auth response
      const authenticated = await this.keycloak.init({
        // Don't use any automatic behaviors
        checkLoginIframe: false,
        enableLogging: true,
        pkceMethod: 'S256',
        responseMode: 'query'
      });

      this.initialized = true;
      
      if (authenticated) {
        console.log('✅ User is authenticated!');
        console.log('User:', this.keycloak.tokenParsed);
        
        // Setup auto-refresh
        setInterval(() => {
          this.keycloak?.updateToken(30).catch(() => {
            console.log('Failed to refresh token');
          });
        }, 30000);
      } else {
        console.log('❌ User is NOT authenticated');
      }

      return authenticated;
    } catch (error) {
      console.error('Failed to initialize Keycloak:', error);
      this.initialized = true;
      return false;
    }
  }

  isAuthenticated(): boolean {
    return this.keycloak?.authenticated || false;
  }

  getUser(): any {
    return this.keycloak?.tokenParsed || null;
  }

  getToken(): string | undefined {
    return this.keycloak?.token;
  }

  hasRole(role: string): boolean {
    const roles = (this.keycloak?.tokenParsed as any)?.realm_access?.roles || [];
    return roles.includes(role);
  }

  login(): void {
    this.keycloak?.login({
      redirectUri: window.location.origin + '/'
    });
  }

  logout(): void {
    this.keycloak?.logout({
      redirectUri: window.location.origin + '/'
    });
  }

  accountManagement(): void {
    this.keycloak?.accountManagement();
  }
}

const simpleKeycloakService = new SimpleKeycloakService();
export default simpleKeycloakService;