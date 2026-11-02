---
name: codesync-storage-and-security
description: Encrypted token storage with Web Crypto API AES-GCM (256-bit), chrome.storage abstraction, zero-client-secret model, and CSP compliance.
---

# CodeSync Storage & Extension Security Architecture

Use this skill when modifying persistent storage, token encryption, authentication credentials, or security policies in `src/storage/` and `src/utils/crypto.ts`.

---

## 1. At-Rest Credential Encryption (AES-GCM 256-bit)

OAuth tokens and Personal Access Tokens (PATs) are **never** stored in plain text inside `chrome.storage.local`. CodeSync uses the native browser **Web Crypto API (`window.crypto.subtle`)** to encrypt and decrypt tokens transparently:

```
[Plain Text Token]
        │
        ▼
[crypto.subtle.encrypt(AES-GCM)]  <── Key derived from extension installation entropy
        │
        ▼
[Base64 Encrypted String: iv.ciphertext]
        │
        ▼
[chrome.storage.local.set({ settings: { githubToken: 'enc:...' } })]
```

### Encryption Implementation (`src/utils/crypto.ts`)
```typescript
const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;

export async function encryptToken(plainText: string): Promise<string> {
  if (!plainText) return '';
  const key = await getOrCreateEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM
  const encodedData = new TextEncoder().encode(plainText);

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encodedData
  );

  const ivB64 = bufferToBase64(iv.buffer);
  const dataB64 = bufferToBase64(encryptedBuffer);
  return `enc:${ivB64}:${dataB64}`;
}
```

On read (`storage.getSettings()`), the token is decrypted if the string begins with the `enc:` prefix.

---

## 2. Typed Storage Interface (`src/storage/index.ts`)

All interaction with `chrome.storage.local` is strongly typed via the `UserSettings` interface:

```typescript
export interface UserSettings {
  githubToken: string | null;
  githubUser: string | null;
  selectedRepo: string | null;
  syncOnAccept: boolean;
  syncHistoricalOnView: boolean;
  desktopNotifications: boolean;
  folderLayout: FolderLayout;
  theme?: string;
  commitQueue: string[]; // List of pending submission IDs
}
```

### Storage Invariants:
1. **Always merge with defaults**:
   When reading settings, merge the raw object with `DEFAULT_SETTINGS` to ensure newly introduced keys are never `undefined`:
   ```typescript
   const merged = { ...DEFAULT_SETTINGS, ...rawSettings };
   ```
2. **Atomic token encryption**:
   `updateSettings()` must encrypt `githubToken` before persisting to storage.

---

## 3. Zero-Client-Secret Model

- **Absolute Rule**: Never embed a GitHub OAuth App Client Secret into frontend code or environment files bundled into the extension bundle.
- In production, OAuth token exchange is routed through the proxy worker specified in `VITE_OAUTH_PROXY_URL`.
- Personal Access Tokens (PATs) enter the extension solely through the user input form in `src/popup/components/AuthForm.tsx` and are immediately encrypted before disk persistence.

---

## 4. Manifest V3 Content Security Policy (CSP)

CodeSync strictly adheres to the Chrome Manifest V3 CSP:
```json
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'self';"
}
```

### Prohibited Patterns:
- ❌ **No `eval()` or `Function()` constructors**: Any string-to-code execution will be rejected by the browser and Chrome Web Store review.
- ❌ **No inline script tags**: All scripts must be loaded via external bundled `.js` files.
- ❌ **No remote code loading**: Never inject scripts from external CDNs (e.g. unpkg, cdnjs). All dependencies must be packaged in `package.json` and bundled by Vite.

---

## 5. Security Checklist for Contributors

Before committing changes involving credentials or storage:
- [ ] Verify that `githubToken` is never output to `console.log` in development or production.
- [ ] Run `npm run test -- src/utils/__tests__/crypto.test.ts` to ensure encryption and decryption pass with 100% round-trip parity.
- [ ] Verify that logging out (`storage.clearSettings()`) cleans up stored credentials.
