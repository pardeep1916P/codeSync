export interface OAuthConfig {
  clientId: string;
  proxyUrl?: string;
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
    )}&redirect_uri=${encodeURIComponent(redirectUri)}&prompt=select_account`;
  }
  

  async authenticate(): Promise<string | null> {
    if (typeof chrome === 'undefined' || !chrome.identity) {
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
            resolve(null);
            return;
          }

          const url = new URL(redirectUrl);
          const code = url.searchParams.get('code');
          
          if (!code) {
            resolve(null);
            return;
          }

          const token = await this.exchangeCodeForToken(code);
          resolve(token);
        }
      );
    });
  }

  private async exchangeCodeForToken(code: string): Promise<string> {
    const proxyUrl = this.config.proxyUrl || 'https://codesync-oauth.chaitanyacharan07.workers.dev';
    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
      }),
    });

    if (!response.ok) {
      throw new Error(`OAuth proxy exchange failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.access_token || '';
  }
}
