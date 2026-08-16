/**
 * Lightweight token encryption using the Web Crypto API (AES-GCM).
 * Protects GitHub personal access tokens from plaintext exposure in local storage.
 */

const SALT = new Uint8Array([75, 111, 100, 101, 83, 121, 110, 99, 83, 101, 99, 114, 101, 116, 49, 50]);
const KEY_PHRASE = 'codesync_token_encryption_key_v1';

async function deriveKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(KEY_PHRASE),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: SALT,
      iterations: 10000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a plaintext string into a base64-encoded encrypted payload.
 */
export async function encryptToken(token: string): Promise<string> {
  if (!token) return '';
  try {
    const key = await deriveKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const encodedData = enc.encode(token);

    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      encodedData
    );

    const encryptedArray = new Uint8Array(encryptedBuffer);
    const combined = new Uint8Array(iv.length + encryptedArray.length);
    combined.set(iv);
    combined.set(encryptedArray, iv.length);

    return btoa(String.fromCharCode(...combined));
  } catch {
    // If crypto fails, return raw token as fallback
    return token;
  }
}

/**
 * Decrypts a base64-encoded encrypted payload back to the plaintext string.
 */
export async function decryptToken(encryptedBase64: string): Promise<string> {
  if (!encryptedBase64) return '';
  // Check if it's already a raw github token (e.g. ghp_... or github_pat_...)
  if (encryptedBase64.startsWith('ghp_') || encryptedBase64.startsWith('github_pat_') || encryptedBase64.startsWith('gho_')) {
    return encryptedBase64;
  }

  try {
    const key = await deriveKey();
    const combinedStr = atob(encryptedBase64);
    const combined = new Uint8Array(combinedStr.length);
    for (let i = 0; i < combinedStr.length; i++) {
      combined[i] = combinedStr.charCodeAt(i);
    }

    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      data
    );

    const dec = new TextDecoder();
    return dec.decode(decryptedBuffer);
  } catch {
    // Return original string if decryption fails (e.g. unencrypted legacy token)
    return encryptedBase64;
  }
}
