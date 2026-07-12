export interface UserSettings {
  githubToken: string | null;
  githubUser: string | null;
  selectedRepo: string | null;
  syncOnAccept: boolean;
  commitQueue: string[]; // Submission IDs pending sync
}

const DEFAULT_SETTINGS: UserSettings = {
  githubToken: null,
  githubUser: null,
  selectedRepo: null,
  syncOnAccept: true,
  commitQueue: [],
};

export const storage = {
  async getSettings(): Promise<UserSettings> {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      // Fallback for development/testing environment
      const local = localStorage.getItem('codesync_settings');
      return local ? { ...DEFAULT_SETTINGS, ...JSON.parse(local) } : DEFAULT_SETTINGS;
    }

    return new Promise((resolve) => {
      chrome.storage.local.get('settings', (result) => {
        resolve(result.settings ? { ...DEFAULT_SETTINGS, ...result.settings } : DEFAULT_SETTINGS);
      });
    });
  },

  async updateSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
    const current = await this.getSettings();
    const updated = { ...current, ...settings };

    if (typeof chrome === 'undefined' || !chrome.storage) {
      localStorage.setItem('codesync_settings', JSON.stringify(updated));
      return updated;
    }

    return new Promise((resolve) => {
      chrome.storage.local.set({ settings: updated }, () => {
        resolve(updated);
      });
    });
  },

  async clearSettings(): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      localStorage.removeItem('codesync_settings');
      return;
    }

    return new Promise((resolve) => {
      chrome.storage.local.remove('settings', () => {
        resolve();
      });
    });
  }
};
