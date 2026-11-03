import { getLocalStorage, setLocalStorage, removeLocalStorage } from '../utils/chrome';
import { encryptToken, decryptToken } from '../utils/crypto';

export type FolderLayout = 'flat' | 'platform' | 'difficulty';

export interface UserSettings {
  schemaVersion?: number;
  githubToken: string | null;
  githubUser: string | null;
  selectedRepo: string | null;
  syncOnAccept: boolean;
  syncHistoricalOnView: boolean;
  desktopNotifications: boolean;
  folderLayout: FolderLayout;
  theme?: string;
  lastSeenVersion?: string | null;
  commitQueue: string[]; // Submission IDs pending sync
}

export const CURRENT_SCHEMA_VERSION = 2;

export const DEFAULT_SETTINGS: UserSettings = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  githubToken: null,
  githubUser: null,
  selectedRepo: null,
  syncOnAccept: true,
  syncHistoricalOnView: false,
  desktopNotifications: false,
  folderLayout: 'difficulty',
  theme: 'amoled',
  lastSeenVersion: null,
  commitQueue: [],
};

type MigrationFunction = (raw: Record<string, unknown>) => Record<string, unknown>;

/**
 * Migration registry mapping target schema versions to transformation functions.
 * Every migration must be idempotent, non-destructive to user credentials, and safe.
 */
const MIGRATIONS: Record<number, MigrationFunction> = {
  2: (raw: Record<string, unknown>) => {
    const updated = { ...raw };

    // Migrate folder layout if invalid or missing
    const validLayouts: FolderLayout[] = ['flat', 'platform', 'difficulty'];
    if (!validLayouts.includes(updated.folderLayout as FolderLayout)) {
      updated.folderLayout = 'difficulty';
    }

    // Ensure boolean settings exist
    if (typeof updated.syncOnAccept !== 'boolean') {
      updated.syncOnAccept = true;
    }
    if (typeof updated.syncHistoricalOnView !== 'boolean') {
      updated.syncHistoricalOnView = false;
    }
    if (typeof updated.desktopNotifications !== 'boolean') {
      updated.desktopNotifications = false;
    }

    // Ensure commit queue is a valid array
    if (!Array.isArray(updated.commitQueue)) {
      updated.commitQueue = [];
    }

    // Initialize lastSeenVersion if not set
    if (typeof updated.lastSeenVersion !== 'string' && updated.lastSeenVersion !== null) {
      updated.lastSeenVersion = null;
    }

    updated.schemaVersion = 2;
    return updated;
  },
};

/**
 * Executes storage schema migrations sequentially up to CURRENT_SCHEMA_VERSION.
 * Preserves user data and fails gracefully if an unexpected error occurs.
 */
export async function runStorageMigrations(
  rawSettings: Record<string, unknown>
): Promise<{ migrated: UserSettings; hasChanges: boolean }> {
  if (!rawSettings || Object.keys(rawSettings).length === 0) {
    return { migrated: { ...DEFAULT_SETTINGS }, hasChanges: false };
  }

  const initialVersion = typeof rawSettings.schemaVersion === 'number' ? rawSettings.schemaVersion : 1;
  let currentSettings: Record<string, unknown> = { ...rawSettings };
  let hasChanges = false;

  for (let targetVersion = initialVersion + 1; targetVersion <= CURRENT_SCHEMA_VERSION; targetVersion++) {
    const migrate = MIGRATIONS[targetVersion];
    if (migrate) {
      try {
        currentSettings = migrate(currentSettings);
        hasChanges = true;
        console.log(`[CodeSync:Storage] Successfully migrated schema to version ${targetVersion}`);
      } catch (err) {
        console.warn(`[CodeSync:Storage] Migration to version ${targetVersion} encountered an error:`, err);
        // In case of migration failure, ensure schemaVersion is updated to avoid infinite retry loops
        currentSettings.schemaVersion = targetVersion;
        hasChanges = true;
      }
    }
  }

  const merged: UserSettings = {
    ...DEFAULT_SETTINGS,
    ...currentSettings,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };

  return { migrated: merged, hasChanges };
}

export const storage = {
  async getSettings(): Promise<UserSettings> {
    const data = await getLocalStorage('settings');
    const rawSettings = data.settings as Record<string, unknown> | undefined;
    if (!rawSettings) {
      console.log('[CodeSync:Storage] No settings found in storage, returning DEFAULT_SETTINGS');
      return { ...DEFAULT_SETTINGS };
    }

    // Run schema migrations sequentially
    const { migrated, hasChanges } = await runStorageMigrations(rawSettings);

    // If schema changed during migration, persist the updated settings immediately
    if (hasChanges) {
      await setLocalStorage({ settings: migrated });
    }

    if (migrated.githubToken) {
      migrated.githubToken = await decryptToken(migrated.githubToken);
    }

    console.log('[CodeSync:Storage] getSettings returning settings with commitQueue length:', migrated.commitQueue?.length, 'user:', migrated.githubUser);
    return migrated;
  },

  async updateSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
    console.log('[CodeSync:Storage] updateSettings called with keys:', Object.keys(settings), 'commitQueue:', settings.commitQueue);
    const current = await this.getSettings();
    const updated: UserSettings = { 
      ...current, 
      ...settings, 
      schemaVersion: CURRENT_SCHEMA_VERSION 
    };

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
