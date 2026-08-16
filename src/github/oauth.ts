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

    // In Chrome extension context, delegate to background service worker for persistent lifecycle
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            action: 'START_OAUTH_FLOW',
            payload: {
              clientId: this.config.clientId,
              proxyUrl: this.config.proxyUrl,
            },
          },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }

            if (response && response.error) {
              reject(new Error(response.error));
              return;
            }

            if (response && response.token) {
              resolve(response.token);
              return;
            }

            reject(new Error('OAuth failed or returned empty response.'));
          }
        );
      });
    }

    // Fallback for non-extension web contexts
    window.open(this.getAuthUrl(browserRedirectUri), '_blank');
    return null;
  }

}

