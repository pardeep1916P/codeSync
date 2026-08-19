import { getLocalStorage, setLocalStorage, removeLocalStorage } from '../utils/chrome';
import { encryptToken, decryptToken } from '../utils/crypto';

export interface UserSettings {
  githubToken: string | null;
  githubUser: string | null;
  selectedRepo: string | null;
  syncOnAccept: boolean;
  syncHistoricalOnView: boolean;
  commitQueue: string[]; // Submission IDs pending sync
}

const DEFAULT_SETTINGS: UserSettings = {
  githubToken: null,
  githubUser: null,
  selectedRepo: null,
  syncOnAccept: true,
  syncHistoricalOnView: false,
  commitQueue: [],
};

export const storage = {
  async getSettings(): Promise<UserSettings> {
    const data = await getLocalStorage('settings');
    const rawSettings = data.settings as UserSettings | undefined;
    if (!rawSettings) return DEFAULT_SETTINGS;

    const merged = { ...DEFAULT_SETTINGS, ...rawSettings };
    if (merged.githubToken) {
      merged.githubToken = await decryptToken(merged.githubToken);
    }
    return merged;
  },

  async updateSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
    const current = await this.getSettings();
    const updated = { ...current, ...settings };

    const toStore = { ...updated };
    if (toStore.githubToken) {
      toStore.githubToken = await encryptToken(toStore.githubToken);
    }

    await setLocalStorage({ settings: toStore });
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

