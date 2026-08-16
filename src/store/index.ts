import { create } from 'zustand';
import { storage, UserSettings } from '../storage';
import { GitHubClient } from '../github/client';
import { GitHubRepo, GitHubUser } from '../github/types';
import { GitHubOAuth } from '../github/oauth';
import { getLocalStorage, setLocalStorage, removeLocalStorage, sendRuntimeMessage, isChromeStorageAvailable } from '../utils/chrome';

let isListenerRegistered = false;

async function fetchRepoSolvedCount(client: GitHubClient, repoFullName: string): Promise<number> {
  try {
    const statsFile = await client.getFileContent(repoFullName, 'stats.json');
    if (statsFile) {
      const stats = JSON.parse(statsFile.content);
      if (typeof stats.solved === 'number') {
        await setLocalStorage({ codesync_solved_count: stats.solved });
        return stats.solved;
      }
    }
  } catch {
    // stats.json may not exist yet
  }
  return 0;
}

interface AppState extends UserSettings {
  isLoading: boolean;
  isSyncing: boolean;
  user: GitHubUser | null;
  repositories: GitHubRepo[];
  error: string | null;
  solvedCount: number;
  updateInfo: { version: string } | null;
  isCheckingUpdate: boolean;

  // Actions
  initialize: () => Promise<void>;
  login: (token: string) => Promise<void>;
  loginOAuth: () => Promise<void>;
  logout: () => Promise<void>;
  selectRepo: (repoFullName: string) => Promise<void>;
  setSyncOnAccept: (value: boolean) => Promise<void>;
  removeItemFromQueue: (id: string) => Promise<void>;
  clearQueue: (id?: string) => Promise<void>;
  refreshGithubData: (silent?: boolean) => Promise<void>;
  checkForUpdates: () => Promise<{ status: string; version?: string }>;
  applyUpdate: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  githubToken: null,
  githubUser: null,
  selectedRepo: null,
  syncOnAccept: true,
  commitQueue: [],
  isLoading: true,
  isSyncing: false,
  user: null,
  repositories: [],
  error: null,
  solvedCount: 0,
  updateInfo: null,
  isCheckingUpdate: false,

  initialize: async () => {
    try {
      const settings = await storage.getSettings();
      const updateInfo = await storage.getUpdateInfo();

      // Phase 1: Load cached user/repos instantly
      const cached = await getLocalStorage(['cached_user', 'cached_repos', 'codesync_solved_count', 'codesync_is_syncing']);
      const cachedUser = (cached.cached_user as GitHubUser) || null;
      const cachedRepos = (cached.cached_repos as GitHubRepo[]) || [];
      const cachedSolvedCount = typeof cached.codesync_solved_count === 'number' ? cached.codesync_solved_count : 0;
      const cachedIsSyncing = typeof cached.codesync_is_syncing === 'boolean' ? cached.codesync_is_syncing : false;

      // Immediately show UI with cached data (no loading flash)
      set({
        ...settings,
        updateInfo,
        user: cachedUser,
        repositories: cachedRepos,
        solvedCount: cachedSolvedCount,
        isSyncing: cachedIsSyncing,
        isLoading: false,
        error: null,
      });

      // Register storage listener once to sync changes dynamically from background process
      if (!isListenerRegistered && isChromeStorageAvailable() && chrome.storage.onChanged) {
        isListenerRegistered = true;
        chrome.storage.onChanged.addListener((changes, areaName) => {
          if (areaName === 'local') {
            if (changes.settings) {
              const newSettings = changes.settings.newValue;
              if (newSettings) {
                set({
                  githubToken: newSettings.githubToken,
                  githubUser: newSettings.githubUser,
                  selectedRepo: newSettings.selectedRepo,
                  syncOnAccept: newSettings.syncOnAccept,
                  commitQueue: newSettings.commitQueue || [],
                });
              }
            }
            if (changes.codesync_is_syncing) {
              set({ isSyncing: !!changes.codesync_is_syncing.newValue });
            }
            if (changes.codesync_solved_count) {
              set({ solvedCount: changes.codesync_solved_count.newValue });
            }
            if (changes.updateInfo) {
              set({ updateInfo: changes.updateInfo.newValue || null });
            }
          }
        });
      }

      // Phase 2: Silently refresh from GitHub API in background
      if (settings.githubToken) {
        try {
          const client = new GitHubClient(settings.githubToken);
          const [user, repositories] = await Promise.all([
            client.getUser(),
            client.getRepositories(),
          ]);

          await setLocalStorage({ cached_user: user, cached_repos: repositories });
          set({ user, repositories });

          if (settings.selectedRepo) {
            const solved = await fetchRepoSolvedCount(client, settings.selectedRepo);
            if (solved > 0) set({ solvedCount: solved });
          }
        } catch {
          // If cache exists, keep using it. Only reset token if there's no cache.
          if (!cachedUser) {
            await storage.updateSettings({ githubToken: null, githubUser: null });
            set({ githubToken: null, githubUser: null, user: null, repositories: [], solvedCount: 0 });
          }
        }
      }
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
    }
  },

  login: async (token: string) => {
    set({ isLoading: true, error: null });
    try {
      const client = new GitHubClient(token);
      const [user, repositories] = await Promise.all([
        client.getUser(),
        client.getRepositories(),
      ]);

      await storage.updateSettings({
        githubToken: token,
        githubUser: user.login,
      });

      let solvedCount = 0;
      const settings = await storage.getSettings();
      if (settings.selectedRepo) {
        solvedCount = await fetchRepoSolvedCount(client, settings.selectedRepo);
      }

      await setLocalStorage({ cached_user: user, cached_repos: repositories, codesync_solved_count: solvedCount });

      set({
        githubToken: token,
        githubUser: user.login,
        user,
        repositories,
        solvedCount,
        isLoading: false,
      });
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
    }
  },

  loginOAuth: async () => {
    set({ isLoading: true, error: null });
    try {
      const oauth = new GitHubOAuth({
        clientId: import.meta.env.VITE_GITHUB_CLIENT_ID || '',
        proxyUrl: import.meta.env.VITE_OAUTH_PROXY_URL || 'https://codesync-oauth.chaitanyacharan07.workers.dev',
        scopes: ['repo'],
      });
      const token = await oauth.authenticate();
      if (token) {
        await get().login(token);
      } else {
        set({ isLoading: false, error: 'OAuth authentication failed or returned empty token' });
      }
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
    }
  },

  logout: async () => {
    await storage.clearSettings();
    await removeLocalStorage(['cached_user', 'cached_repos', 'codesync_solved_count']);
    await setLocalStorage({ codesync_is_syncing: false });

    set({
      githubToken: null,
      githubUser: null,
      selectedRepo: null,
      syncOnAccept: true,
      commitQueue: [],
      user: null,
      repositories: [],
      solvedCount: 0,
      isLoading: false,
      isSyncing: false,
    });
  },

  selectRepo: async (repoFullName: string) => {
    await storage.updateSettings({ selectedRepo: repoFullName });
    set({ selectedRepo: repoFullName, isLoading: true });

    let solvedCount = 0;
    const token = get().githubToken;
    if (token) {
      const client = new GitHubClient(token);
      solvedCount = await fetchRepoSolvedCount(client, repoFullName);
    }

    set({ solvedCount, isLoading: false });
  },

  setSyncOnAccept: async (value: boolean) => {
    await storage.updateSettings({ syncOnAccept: value });
    set({ syncOnAccept: value });
  },

  removeItemFromQueue: async (id: string) => {
    const settings = await storage.getSettings();
    const updatedQueue = settings.commitQueue.filter(item => item !== id);
    await storage.updateSettings({ commitQueue: updatedQueue });

    const key = `sub_${id}`;
    await removeLocalStorage(key);
    if (updatedQueue.length === 0) {
      await setLocalStorage({ codesync_is_syncing: false });
    }

    set({
      commitQueue: updatedQueue,
      isSyncing: updatedQueue.length === 0 ? false : get().isSyncing,
    });
  },

  clearQueue: async () => {
    const settings = await storage.getSettings();
    const keysToRemove = settings.commitQueue.map(id => `sub_${id}`);

    await removeLocalStorage(keysToRemove);
    await setLocalStorage({ codesync_is_syncing: false });

    await storage.updateSettings({ commitQueue: [] });
    set({ commitQueue: [], isSyncing: false });
  },

  refreshGithubData: async (silent = false) => {
    if (!silent) set({ isLoading: true });
    set({ error: null });
    try {
      const token = get().githubToken;
      if (!token) return;

      const client = new GitHubClient(token);
      const [user, repositories] = await Promise.all([
        client.getUser(),
        client.getRepositories(),
      ]);

      await setLocalStorage({
        cached_user: user,
        cached_repos: repositories,
        last_github_refresh: Date.now(),
      });

      await storage.updateSettings({
        githubUser: user.login,
      });

      let solved = get().solvedCount;
      const settings = await storage.getSettings();
      if (settings.selectedRepo) {
        solved = await fetchRepoSolvedCount(client, settings.selectedRepo);
      }

      set({ user, repositories, githubUser: user.login, solvedCount: solved });
    } catch (e) {
      set({ error: (e as Error).message });
      throw e;
    } finally {
      if (!silent) set({ isLoading: false });
    }
  },

  checkForUpdates: async () => {
    set({ isCheckingUpdate: true });
    try {
      const response = await sendRuntimeMessage<{ status: string; version?: string }>({ action: 'CHECK_FOR_UPDATES' });
      set({ isCheckingUpdate: false });
      if (response?.status === 'update_available' && response?.version) {
        set({ updateInfo: { version: response.version } });
      }
      return response || { status: 'no_update' };
    } catch {
      set({ isCheckingUpdate: false });
      return { status: 'no_update' };
    }
  },

  applyUpdate: () => {
    sendRuntimeMessage({ action: 'APPLY_UPDATE' }).catch(() => {
      window.location.reload();
    });
  },
}));

