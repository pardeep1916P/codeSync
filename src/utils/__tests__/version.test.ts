import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getExtensionVersion } from '../version';

describe('getExtensionVersion', () => {
  const originalChrome = globalThis.chrome;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.chrome = originalChrome;
  });

  it('returns manifest version when available', () => {
    globalThis.chrome = {
      runtime: {
        getManifest: () => ({ version: '1.3.0' }),
      },
    } as unknown as typeof chrome;

    expect(getExtensionVersion()).toBe('1.3.0');
  });

  it('falls back to 1.3.0 when getManifest returns empty version', () => {
    globalThis.chrome = {
      runtime: {
        getManifest: () => ({}),
      },
    } as unknown as typeof chrome;

    expect(getExtensionVersion()).toBe('1.3.0');
  });

  it('falls back to 1.3.0 when getManifest throws', () => {
    globalThis.chrome = {
      runtime: {
        getManifest: () => {
          throw new Error('Manifest unavailable');
        },
      },
    } as unknown as typeof chrome;

    expect(getExtensionVersion()).toBe('1.3.0');
  });

  it('falls back to 1.3.0 when chrome is undefined', () => {
    // @ts-expect-error Mocking undefined chrome environment
    delete globalThis.chrome;

    expect(getExtensionVersion()).toBe('1.3.0');
  });
});
