import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runStorageMigrations, CURRENT_SCHEMA_VERSION, DEFAULT_SETTINGS, storage } from '../index';
import * as chromeUtil from '../../utils/chrome';

describe('Storage Schema Migrations', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('runStorageMigrations', () => {
    it('migrates legacy v1 settings (without schemaVersion) to version 2', async () => {
      const legacySettings = {
        githubToken: 'ghp_legacy_token',
        githubUser: 'octocat',
        selectedRepo: 'octocat/code-solutions',
        folderLayout: 'flat',
        syncOnAccept: true,
      };

      const { migrated, hasChanges } = await runStorageMigrations(legacySettings);

      expect(hasChanges).toBe(true);
      expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(migrated.githubToken).toBe('ghp_legacy_token');
      expect(migrated.githubUser).toBe('octocat');
      expect(migrated.selectedRepo).toBe('octocat/code-solutions');
      expect(migrated.folderLayout).toBe('flat');
      expect(migrated.syncHistoricalOnView).toBe(false);
      expect(migrated.desktopNotifications).toBe(false);
      expect(migrated.lastSeenVersion).toBeNull();
      expect(migrated.commitQueue).toEqual([]);
    });

    it('corrects invalid folderLayout values to "difficulty" during migration', async () => {
      const invalidLayoutSettings = {
        schemaVersion: 1,
        folderLayout: 'invalid-custom-layout',
      };

      const { migrated, hasChanges } = await runStorageMigrations(invalidLayoutSettings);

      expect(hasChanges).toBe(true);
      expect(migrated.folderLayout).toBe('difficulty');
    });

    it('is idempotent when settings already have CURRENT_SCHEMA_VERSION', async () => {
      const currentSettings = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        githubToken: 'ghp_modern_token',
        githubUser: 'pardeep1916P',
        selectedRepo: 'pardeep1916P/leetcode-solutions',
        syncOnAccept: true,
        syncHistoricalOnView: true,
        desktopNotifications: true,
        folderLayout: 'difficulty' as const,
        theme: 'dracula',
        lastSeenVersion: '1.2.1',
        commitQueue: ['123', '456'],
      };

      const { migrated, hasChanges } = await runStorageMigrations(currentSettings);

      expect(hasChanges).toBe(false);
      expect(migrated).toEqual(currentSettings);
    });

    it('handles empty settings object gracefully returning DEFAULT_SETTINGS', async () => {
      const { migrated, hasChanges } = await runStorageMigrations({});

      expect(hasChanges).toBe(false);
      expect(migrated).toEqual(DEFAULT_SETTINGS);
    });
  });

  describe('storage.getSettings integration with migrations', () => {
    it('automatically persists migrated settings when legacy data is read', async () => {
      const legacyStorageData = {
        settings: {
          githubToken: null,
          githubUser: 'testUser',
          selectedRepo: 'testUser/repo',
          syncOnAccept: true,
          // Missing schemaVersion, syncHistoricalOnView, etc.
        },
      };

      vi.spyOn(chromeUtil, 'getLocalStorage').mockResolvedValue(legacyStorageData);
      const setStorageSpy = vi.spyOn(chromeUtil, 'setLocalStorage').mockResolvedValue(undefined);

      const settings = await storage.getSettings();

      expect(settings.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(settings.githubUser).toBe('testUser');
      expect(setStorageSpy).toHaveBeenCalledWith({
        settings: expect.objectContaining({
          schemaVersion: CURRENT_SCHEMA_VERSION,
          githubUser: 'testUser',
          syncHistoricalOnView: false,
        }),
      });
    });
  });
});
