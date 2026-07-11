---
name: github-oauth-flow
description: GitHub OAuth 2.0 authorization flow, token management, and chrome.identity integration for CodeSync browser extension authentication.
---

# GitHub OAuth Flow — Authentication & Token Management

## Purpose & Scope

Use this skill when:
- Implementing GitHub OAuth login in the extension
- Managing token storage and refresh
- Setting up OAuth app credentials
- Handling OAuth redirects in MV3 service workers
- Implementing PAT (Personal Access Token) fallback

---

## Decision Tree

```
Authenticating with GitHub?
├─ OAuth (recommended for distribution)
│  ├─ chrome.identity.launchWebAuthFlow() → MV3 compatible
│  ├─ Handles redirect internally
│  ├─ Exchange code for token via backend proxy
│  └─ Store token in chrome.storage.local
├─ PAT (simpler for dev/personal use)
│  ├─ User generates at github.com/settings/tokens
│  ├─ Paste into extension settings
│  └─ Store in chrome.storage.local
└─ Token validation?
   ├─ GET /user with Authorization header
   ├─ 200 → Valid
   ├─ 401 → Expired/revoked → prompt re-auth
   └─ 403 → Insufficient scope
```

---

## Implementation Patterns

### Pattern 1: OAuth Flow with chrome.identity

```typescript
// src/github/auth.ts

const CLIENT_ID = process.env.VITE_GITHUB_CLIENT_ID!;

export async function startOAuth(): Promise<string> {
  const redirectUrl = chrome.identity.getRedirectURL('oauth');
  const state = crypto.randomUUID();
  
  const authUrl = new URL('https://github.com/login/oauth/authorize');
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', redirectUrl);
  authUrl.searchParams.set('scope', 'repo');
  authUrl.searchParams.set('state', state);
  
  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: authUrl.toString(), interactive: true },
      (responseUrl) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!responseUrl) {
          reject(new Error('No response URL from OAuth'));
          return;
        }
        
        const url = new URL(responseUrl);
        const code = url.searchParams.get('code');
        const returnedState = url.searchParams.get('state');
        
        if (returnedState !== state) {
          reject(new Error('OAuth state mismatch — possible CSRF'));
          return;
        }
        
        if (!code) {
          reject(new Error('No authorization code returned'));
          return;
        }
        
        resolve(code);
      }
    );
  });
}

// Exchange auth code for access token (requires backend proxy)
export async function exchangeCodeForToken(code: string): Promise<string> {
  const response = await fetch('https://your-backend.com/api/github/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  
  if (!response.ok) throw new Error('Token exchange failed');
  
  const { access_token } = await response.json();
  return access_token;
}

// Validate an existing token
export async function validateToken(token: string): Promise<{
  valid: boolean;
  user?: { login: string; avatar_url: string };
  scopes?: string[];
}> {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
      },
    });
    
    if (response.status === 401) return { valid: false };
    if (!response.ok) return { valid: false };
    
    const user = await response.json();
    const scopes = response.headers.get('X-OAuth-Scopes')?.split(', ') || [];
    
    return { valid: true, user, scopes };
  } catch {
    return { valid: false };
  }
}

// Full login flow
export async function login(): Promise<{ token: string; user: GitHubUser }> {
  const code = await startOAuth();
  const token = await exchangeCodeForToken(code);
  const validation = await validateToken(token);
  
  if (!validation.valid || !validation.user) {
    throw new Error('Token validation failed after OAuth');
  }
  
  // Persist token
  await storage.updateSettings({ githubToken: token });
  
  // Cache user data
  await storage.setOAuthCache({
    user: validation.user,
    cachedAt: Date.now(),
  });
  
  return { token, user: validation.user };
}
```

### Pattern 2: PAT Authentication (Development Fallback)

```typescript
export async function loginWithPAT(token: string): Promise<GitHubUser> {
  const validation = await validateToken(token);
  
  if (!validation.valid) {
    throw new Error('Invalid Personal Access Token');
  }
  
  if (!validation.scopes?.includes('repo')) {
    throw new Error('Token missing "repo" scope');
  }
  
  await storage.updateSettings({ githubToken: token });
  return validation.user!;
}
```

### Pattern 3: Repository Listing

```typescript
export async function fetchUserRepos(token: string): Promise<RepoInfo[]> {
  const repos: RepoInfo[] = [];
  let page = 1;
  
  while (true) {
    const response = await fetch(
      `https://api.github.com/user/repos?per_page=100&page=${page}&sort=updated`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
        },
      }
    );
    
    if (!response.ok) break;
    
    const batch = await response.json();
    if (batch.length === 0) break;
    
    repos.push(...batch.map((r: any) => ({
      fullName: r.full_name,
      name: r.name,
      owner: r.owner.login,
      private: r.private,
      defaultBranch: r.default_branch,
    })));
    
    page++;
    if (batch.length < 100) break; // Last page
  }
  
  return repos;
}
```

---

## Checklists

### OAuth Implementation Checklist

- [ ] Client ID stored in environment variable (not hardcoded)
- [ ] Client secret NEVER in extension code (use backend proxy)
- [ ] State parameter used for CSRF protection
- [ ] Token stored in chrome.storage.local only
- [ ] Token validated before use (GET /user)
- [ ] Scope check includes "repo"
- [ ] Re-auth flow for expired/revoked tokens
- [ ] Logout clears token from storage
- [ ] OAuth redirect URL uses chrome.identity.getRedirectURL()

---

## Anti-Patterns

### ✗ Client Secret in Extension Code

```typescript
// BAD — anyone can extract the secret from your extension
const CLIENT_SECRET = 'ghp_xxxxxxxxxxxxx';
await fetch('https://github.com/login/oauth/access_token', {
  body: JSON.stringify({ client_secret: CLIENT_SECRET })
});

// GOOD — exchange via backend proxy
await fetch('https://your-backend.com/api/github/token', {
  body: JSON.stringify({ code })
});
```

---

## References

- [GitHub OAuth Guide](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)
- [chrome.identity API](https://developer.chrome.com/docs/extensions/reference/api/identity)
- [GitHub Scopes](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps)
