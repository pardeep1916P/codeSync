export interface OAuthConfig {
  clientId: string;
  clientSecret: string; // Typically handled via a proxy server to keep it secret, but supported in client config for custom apps
  scopes: string[];
}

export class GitHubOAuth {
  private config: OAuthConfig;

  constructor(config: OAuthConfig) {
    this.config = config;
  }

  getAuthUrl(): string {
    const scopes = this.config.scopes.join(' ');
    const redirectUri = typeof chrome !== 'undefined' && chrome.identity
      ? chrome.identity.getRedirectURL()
      : window.location.origin;

    return `https://github.com/login/oauth/authorize?client_id=${this.config.clientId}&scope=${encodeURIComponent(
      scopes
    )}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  }
  

  async authenticate(): Promise<string | null> {
    if (typeof chrome === 'undefined' || !chrome.identity) {
      console.warn('chrome.identity is not available. Simulating OAuth redirect.');
      window.open(this.getAuthUrl(), '_blank');
      return null;
    }

    return new Promise((resolve) => {
      chrome.identity.launchWebAuthFlow(
        {
          url: this.getAuthUrl(),
          interactive: true,
        },
        async (redirectUrl) => {
          if (!redirectUrl) {
            console.error('OAuth flow canceled or failed:', chrome.runtime.lastError);
            resolve(null);
            return;
          }

          const url = new URL(redirectUrl);
          const code = url.searchParams.get('code');
          
          if (!code) {
            resolve(null);
            return;
          }

          // In production, send this code to an OAuth proxy to exchange it for an access token
          // For template placeholder, we write the client exchange call:
          const token = await this.exchangeCodeForToken(code);
          resolve(token);
        }
      );
    });
  }

  private async exchangeCodeForToken(code: string): Promise<string> {
    // Note: Direct client-side code exchange is blocked by CORS by GitHub, so a secure backend proxy
    // is normally used. This is a template configuration.
    try {
      const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          code,
        }),
      });

      const data = await response.json();
      return data.access_token || '';
    } catch (error) {
      console.error('Error exchanging code for token:', error);
      throw error;
    }
  }
}
