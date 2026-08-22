import { getLocalStorage, setLocalStorage, removeLocalStorage } from '../utils/chrome';
import { encryptToken, decryptToken } from '../utils/crypto';

export type FolderLayout = 'flat' | 'platform' | 'difficulty';

export interface UserSettings {
  githubToken: string | null;
  githubUser: string | null;
  selectedRepo: string | null;
  syncOnAccept: boolean;
  syncHistoricalOnView: boolean;
  desktopNotifications: boolean;
  folderLayout: FolderLayout;
  commitQueue: string[]; // Submission IDs pending sync
}

const DEFAULT_SETTINGS: UserSettings = {
  githubToken: null,
  githubUser: null,
  selectedRepo: null,
  syncOnAccept: true,
  syncHistoricalOnView: false,
  desktopNotifications: false,
  folderLayout: 'flat',
  commitQueue: [],
};

export const storage = {
  async getSettings(): Promise<UserSettings> {
    const data = await getLocalStorage('settings');
    const rawSettings = data.settings as UserSettings | undefined;
    if (!rawSettings) {
      console.log('[CodeSync:Storage] No settings found in storage, returning DEFAULT_SETTINGS');
      return DEFAULT_SETTINGS;
    }

    const merged = { ...DEFAULT_SETTINGS, ...rawSettings };
    if (merged.githubToken) {
      merged.githubToken = await decryptToken(merged.githubToken);
    }
    console.log('[CodeSync:Storage] getSettings returning settings with commitQueue length:', merged.commitQueue?.length, 'user:', merged.githubUser);
    return merged;
  },

  async updateSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
    console.log('[CodeSync:Storage] updateSettings called with keys:', Object.keys(settings), 'commitQueue:', settings.commitQueue);
    const current = await this.getSettings();
    const updated = { ...current, ...settings };

    const toStore = { ...updated };
    if (toStore.githubToken) {
      toStore.githubToken = await encryptToken(toStore.githubToken);
    }

    await setLocalStorage({ settings: toStore });
    console.log('[CodeSync:Storage] updateSettings saved to storage successfully. Queue length:', updated.commitQueue?.length);
    return updated;
  },

  async clearSettings(): Promise<void> {
    await removeLocalStorage('settings');
  },

  async getUpdateInfo(): Promise<{ version: string } | null> {
    const data = await getLocalStorage('updateInfo');
    return (data.updateInfo as { version: string } | null) || null;
  },

  async setUpdateInfo(info: { version: string } | null): Promise<void> {
    if (info) {
      await setLocalStorage({ updateInfo: info });
    } else {
      await removeLocalStorage('updateInfo');
    }
  }
};

