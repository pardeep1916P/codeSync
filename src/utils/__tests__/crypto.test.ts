import { describe, it, expect } from 'vitest';
import { encryptToken, decryptToken } from '../crypto';

describe('token crypto', () => {
  it('encrypts and decrypts a token correctly', async () => {
    const rawToken = 'ghp_SamplePersonalAccessToken123456789';
    const encrypted = await encryptToken(rawToken);

    expect(encrypted).not.toBe(rawToken);
    expect(typeof encrypted).toBe('string');

    const decrypted = await decryptToken(encrypted);
    expect(decrypted).toBe(rawToken);
  });

  it('handles empty string gracefully', async () => {
    expect(await encryptToken('')).toBe('');
    expect(await decryptToken('')).toBe('');
  });

  it('returns raw legacy token if not encrypted', async () => {
    const legacyToken = 'ghp_AlreadyUnencryptedToken';
    const result = await decryptToken(legacyToken);
    expect(result).toBe(legacyToken);
  });
});
