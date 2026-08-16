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

  getAuthUrl(browserRedirectUri: string): string {
    const scopes = this.config.scopes.join(' ');
    const proxyCallback = `${this.config.proxyUrl || 'https://codesync-oauth.chaitanyacharan07.workers.dev'}/callback`;

    return `https://github.com/login/oauth/authorize?client_id=${this.config.clientId}&scope=${encodeURIComponent(
      scopes
    )}&redirect_uri=${encodeURIComponent(proxyCallback)}&state=${encodeURIComponent(browserRedirectUri)}&prompt=select_account`;
  }

  async authenticate(): Promise<string | null> {
    const browserRedirectUri = typeof chrome !== 'undefined' && chrome.identity
      ? chrome.identity.getRedirectURL()
      : window.location.origin;

    if (typeof chrome === 'undefined' || !chrome.identity) {
      window.open(this.getAuthUrl(browserRedirectUri), '_blank');
      return null;
    }

    return new Promise((resolve) => {
      chrome.identity.launchWebAuthFlow(
        {
          url: this.getAuthUrl(browserRedirectUri),
          interactive: true,
        },
        async (redirectUrl) => {
          if (!redirectUrl) {
            resolve(null);
            return;
          }

          try {
            const url = new URL(redirectUrl);
            // 1. Direct access_token returned from our worker redirect
            const token = url.searchParams.get('access_token');
            if (token) {
              resolve(token);
              return;
            }

            // 2. Fallback: code returned from legacy direct redirect
            const code = url.searchParams.get('code');
            if (code) {
              const exchanged = await this.exchangeCodeForToken(code);
              resolve(exchanged);
              return;
            }
          } catch {
            // Ignore parse errors
          }

          resolve(null);
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
