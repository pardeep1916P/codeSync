import { describe, it, expect } from 'vitest';
import { parseRepoCodesyncState } from '../index';

describe('parseRepoCodesyncState (Repository-level preference sync)', () => {
  it('decodes full codesync_state with all 5 settings including theme correctly', () => {
    const payload = {
      layout: 'difficulty',
      syncOnAccept: false,
      syncHistoricalOnView: true,
      desktopNotifications: true,
      theme: 'dracula',
    };
    const encoded = `cs:${btoa(JSON.stringify(payload))}`;
    const stats = {
      solved: 10,
      codesync_state: encoded,
    };

    const result = parseRepoCodesyncState(stats);
    expect(result).toEqual({
      folderLayout: 'difficulty',
      syncOnAccept: false,
      syncHistoricalOnView: true,
      desktopNotifications: true,
      theme: 'dracula',
    });
  });

  it('handles partial settings in codesync_state', () => {
    const payload = {
      layout: 'platform',
    };
    const encoded = `cs:${btoa(JSON.stringify(payload))}`;
    const stats = {
      solved: 5,
      codesync_state: encoded,
    };

    const result = parseRepoCodesyncState(stats);
    expect(result).toEqual({
      folderLayout: 'platform',
    });
  });

  it('supports legacy fallback for raw config.layout', () => {
    const stats = {
      solved: 20,
      config: {
        layout: 'flat',
      },
    };

    const result = parseRepoCodesyncState(stats);
    expect(result).toEqual({
      folderLayout: 'flat',
    });
  });

  it('returns null when stats or codesync_state is missing or corrupted', () => {
    expect(parseRepoCodesyncState(null)).toBeNull();
    expect(parseRepoCodesyncState({})).toBeNull();
    expect(parseRepoCodesyncState({ codesync_state: 'invalid_format' })).toBeNull();
    expect(parseRepoCodesyncState({ codesync_state: 'cs:not_valid_base64_json!@#' })).toBeNull();
  });
});
