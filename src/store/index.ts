import { create } from 'zustand';
import { storage, UserSettings } from '../storage';
import { GitHubClient } from '../github/client';
import { GitHubRepo, GitHubUser } from '../github/types';
import { GitHubOAuth } from '../github/oauth';

let isListenerRegistered = false;

interface AppState extends UserSettings {
  isLoading: boolean;
  isSyncing: boolean;
  user: GitHubUser | null;
  repositories: GitHubRepo[];
  error: string | null;
  solvedCount: number;

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

  initialize: async () => {
    try {
      const settings = await storage.getSettings();

      // Phase 1: Load cached user/repos from storage instantly (no spinner)
      let cachedUser: GitHubUser | null = null;
      let cachedRepos: GitHubRepo[] = [];
      let cachedSolvedCount = 0;
      let cachedIsSyncing = false;

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const cached = await new Promise<Record<string, unknown>>((resolve) => {
          chrome.storage.local.get(['cached_user', 'cached_repos', 'codesync_solved_count', 'codesync_is_syncing'], (res) => resolve(res));
        });
        if (cached.cached_user) cachedUser = cached.cached_user as GitHubUser;
        if (cached.cached_repos) cachedRepos = cached.cached_repos as GitHubRepo[];
        if (typeof cached.codesync_solved_count === 'number') cachedSolvedCount = cached.codesync_solved_count;
        if (typeof cached.codesync_is_syncing === 'boolean') cachedIsSyncing = cached.codesync_is_syncing;
      }

      // Immediately show UI with cached data (no loading flash)
      set({
        ...settings,
        user: cachedUser,
        repositories: cachedRepos,
        solvedCount: cachedSolvedCount,
        isSyncing: cachedIsSyncing,
        isLoading: false,
        error: null,
      });

      // Register storage listener once to sync changes dynamically from background process
      if (!isListenerRegistered && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
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

          // Cache for next time
          if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ cached_user: user, cached_repos: repositories });
          }

          set({ user, repositories });

          // Silently fetch stats.json from the selected repository to update solved count
          if (settings.selectedRepo) {
            try {
              const statsFile = await client.getFileContent(settings.selectedRepo, 'stats.json');
              if (statsFile) {
                const stats = JSON.parse(statsFile.content);
                if (typeof stats.solved === 'number') {
                  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                    chrome.storage.local.set({ codesync_solved_count: stats.solved });
                  }
                  set({ solvedCount: stats.solved });
                }
              }
            } catch (e) {
              // stats.json may not exist yet
            }
          }
        } catch (e) {
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
      const user = await client.getUser();
      const repositories = await client.getRepositories();

      await storage.updateSettings({
        githubToken: token,
        githubUser: user.login,
      });

      let solvedCount = 0;
      const settings = await storage.getSettings();
      if (settings.selectedRepo) {
        try {
          const statsFile = await client.getFileContent(settings.selectedRepo, 'stats.json');
          if (statsFile) {
            const stats = JSON.parse(statsFile.content);
            if (typeof stats.solved === 'number') {
              solvedCount = stats.solved;
            }
          }
        } catch (e) {
          // ignore
        }
      }

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ cached_user: user, cached_repos: repositories, codesync_solved_count: solvedCount });
      }

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
        clientSecret: import.meta.env.VITE_GITHUB_CLIENT_SECRET || '',
        scopes: ['repo'],
      });
      const token = await oauth.authenticate();
      if (token) {
        // Reuse client login logic
        const client = new GitHubClient(token);
        const user = await client.getUser();
        const repositories = await client.getRepositories();

        await storage.updateSettings({
          githubToken: token,
          githubUser: user.login,
        });

        let solvedCount = 0;
        const settings = await storage.getSettings();
        if (settings.selectedRepo) {
          try {
            const statsFile = await client.getFileContent(settings.selectedRepo, 'stats.json');
            if (statsFile) {
              const stats = JSON.parse(statsFile.content);
              if (typeof stats.solved === 'number') {
                solvedCount = stats.solved;
              }
            }
          } catch (e) {
            // ignore
          }
        }

        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ cached_user: user, cached_repos: repositories, codesync_solved_count: solvedCount });
        }

        set({
          githubToken: token,
          githubUser: user.login,
          user,
          repositories,
          solvedCount,
          isLoading: false,
        });
      } else {
        set({ isLoading: false, error: 'OAuth authentication failed or returned empty token' });
      }
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
    }
  },

  logout: async () => {
    await storage.clearSettings();
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.remove(['cached_user', 'cached_repos', 'codesync_solved_count']);
      await chrome.storage.local.set({ codesync_is_syncing: false });
    }
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
      try {
        const client = new GitHubClient(token);
        const statsFile = await client.getFileContent(repoFullName, 'stats.json');
        if (statsFile) {
          const stats = JSON.parse(statsFile.content);
          if (typeof stats.solved === 'number') {
            solvedCount = stats.solved;
          }
        }
      } catch (e) {
        // ignore
      }
    }
    
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ codesync_solved_count: solvedCount });
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
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.remove([key]);
      if (updatedQueue.length === 0) {
        await chrome.storage.local.set({ codesync_is_syncing: false });
      }
    } else if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
    
    set({ 
      commitQueue: updatedQueue,
      isSyncing: updatedQueue.length === 0 ? false : get().isSyncing
    });
  },

  clearQueue: async () => {
    const settings = await storage.getSettings();
    const keysToRemove = settings.commitQueue.map(id => `sub_${id}`);
    
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.remove(keysToRemove);
      await chrome.storage.local.set({ codesync_is_syncing: false });
    } else if (typeof localStorage !== 'undefined') {
      keysToRemove.forEach(k => localStorage.removeItem(k));
    }
    
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

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ 
          cached_user: user, 
          cached_repos: repositories,
          last_github_refresh: Date.now()
        });
      }

      set({ user, repositories });

      const settings = await storage.getSettings();
      if (settings.selectedRepo) {
        try {
          const statsFile = await client.getFileContent(settings.selectedRepo, 'stats.json');
          if (statsFile) {
            const stats = JSON.parse(statsFile.content);
            if (typeof stats.solved === 'number') {
              if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                await chrome.storage.local.set({ codesync_solved_count: stats.solved });
              }
              set({ solvedCount: stats.solved });
            }
          }
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {
      set({ error: (e as Error).message });
      throw e;
    } finally {
      if (!silent) set({ isLoading: false });
    }
  },
}));
