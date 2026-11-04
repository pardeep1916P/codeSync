import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useStore } from '../index';
import { storage } from '../../storage';
import { RELEASE_NOTES } from '../../popup/components/releaseNotes';
import * as versionUtil from '../../utils/version';

describe("Post-Upgrade What's New State & Release Notes", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('RELEASE_NOTES data integrity', () => {
    it('contains comprehensive highlights for version 1.2.2', () => {
      const notes = RELEASE_NOTES['1.2.2'];
      expect(notes).toBeDefined();
      expect(notes.length).toBeGreaterThanOrEqual(3);

      notes.forEach((item) => {
        expect(item.tag).toBeTruthy();
        expect(item.title).toBeTruthy();
        expect(item.description).toBeTruthy();
      });
    });

    it('contains historic release highlights for version 1.2.1', () => {
      const notes = RELEASE_NOTES['1.2.1'];
      expect(notes).toBeDefined();
      expect(notes.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('useStore What\'s New lifecycle', () => {
    it('sets showWhatsNew to true when lastSeenVersion differs from currentVersion', async () => {
      vi.spyOn(versionUtil, 'getExtensionVersion').mockReturnValue('1.2.2');
      vi.spyOn(storage, 'getSettings').mockResolvedValue({
        schemaVersion: 2,
        githubToken: null,
        githubUser: 'testUser',
        selectedRepo: 'testUser/repo',
        syncOnAccept: true,
        syncHistoricalOnView: false,
        desktopNotifications: false,
        folderLayout: 'difficulty',
        lastSeenVersion: '1.2.1', // Older version
        commitQueue: [],
      });
      vi.spyOn(storage, 'getUpdateInfo').mockResolvedValue(null);

      await useStore.getState().initialize();

      expect(useStore.getState().showWhatsNew).toBe(true);
    });

    it('sets showWhatsNew to false when lastSeenVersion matches currentVersion', async () => {
      vi.spyOn(versionUtil, 'getExtensionVersion').mockReturnValue('1.2.2');
      vi.spyOn(storage, 'getSettings').mockResolvedValue({
        schemaVersion: 2,
        githubToken: null,
        githubUser: 'testUser',
        selectedRepo: 'testUser/repo',
        syncOnAccept: true,
        syncHistoricalOnView: false,
        desktopNotifications: false,
        folderLayout: 'difficulty',
        lastSeenVersion: '1.2.2', // Same version
        commitQueue: [],
      });
      vi.spyOn(storage, 'getUpdateInfo').mockResolvedValue(null);

      await useStore.getState().initialize();

      expect(useStore.getState().showWhatsNew).toBe(false);
    });

    it('dismisses modal and persists currentVersion on dismissWhatsNew()', async () => {
      vi.spyOn(versionUtil, 'getExtensionVersion').mockReturnValue('1.2.2');
      const updateSettingsSpy = vi.spyOn(storage, 'updateSettings').mockResolvedValue({
        schemaVersion: 2,
        githubToken: null,
        githubUser: null,
        selectedRepo: null,
        syncOnAccept: true,
        syncHistoricalOnView: false,
        desktopNotifications: false,
        folderLayout: 'difficulty',
        lastSeenVersion: '1.2.2',
        commitQueue: [],
      });

      // Set initial open state
      useStore.setState({ showWhatsNew: true, lastSeenVersion: '1.2.1' });

      await useStore.getState().dismissWhatsNew();

      expect(updateSettingsSpy).toHaveBeenCalledWith({ lastSeenVersion: '1.2.2' });
      expect(useStore.getState().showWhatsNew).toBe(false);
      expect(useStore.getState().lastSeenVersion).toBe('1.2.2');
    });
  });
});
