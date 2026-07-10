import { create } from 'zustand';
import { storage, UserSettings } from '../storage';
import { GitHubClient } from '../github/client';
import { GitHubRepo, GitHubUser } from '../github/types';
import { GitHubOAuth } from '../github/oauth';

interface AppState extends UserSettings {
  isLoading: boolean;
  user: GitHubUser | null;
  repositories: GitHubRepo[];
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  login: (token: string) => Promise<void>;
  loginOAuth: () => Promise<void>;
  logout: () => Promise<void>;
  selectRepo: (repoFullName: string) => Promise<void>;
  setSyncOnAccept: (value: boolean) => Promise<void>;
  removeItemFromQueue: (id: string) => Promise<void>;
  clearQueue: (id?: string) => Promise<void>;
}

export const useStore = create<AppState>((set) => ({
  githubToken: null,
  githubUser: null,
  selectedRepo: null,
  syncOnAccept: true,
  commitQueue: [],
  isLoading: true,
  user: null,
  repositories: [],
  error: null,

  initialize: async () => {
    try {
      const settings = await storage.getSettings();

      // Phase 1: Load cached user/repos from storage instantly (no spinner)
      let cachedUser: GitHubUser | null = null;
      let cachedRepos: GitHubRepo[] = [];

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const cached = await new Promise<Record<string, unknown>>((resolve) => {
          chrome.storage.local.get(['cached_user', 'cached_repos'], (res) => resolve(res));
        });
        if (cached.cached_user) cachedUser = cached.cached_user as GitHubUser;
        if (cached.cached_repos) cachedRepos = cached.cached_repos as GitHubRepo[];
      }

      // Immediately show UI with cached data (no loading flash)
      set({
        ...settings,
        user: cachedUser,
        repositories: cachedRepos,
        isLoading: false,
        error: null,
      });

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
        } catch (e) {
          console.error('Failed to refresh GitHub data:', e);
          // If cache exists, keep using it. Only reset token if there's no cache.
          if (!cachedUser) {
            await storage.updateSettings({ githubToken: null, githubUser: null });
            set({ githubToken: null, githubUser: null, user: null, repositories: [] });
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

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ cached_user: user, cached_repos: repositories });
      }

      set({
        githubToken: token,
        githubUser: user.login,
        user,
        repositories,
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

        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ cached_user: user, cached_repos: repositories });
        }

        set({
          githubToken: token,
          githubUser: user.login,
          user,
          repositories,
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
      chrome.storage.local.remove(['cached_user', 'cached_repos']);
    }
    set({
      githubToken: null,
      githubUser: null,
      selectedRepo: null,
      syncOnAccept: true,
      commitQueue: [],
      user: null,
      repositories: [],
      isLoading: false,
    });
  },

  selectRepo: async (repoFullName: string) => {
    await storage.updateSettings({ selectedRepo: repoFullName });
    set({ selectedRepo: repoFullName });
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
    } else if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
    
    set({ commitQueue: updatedQueue });
  },

  clearQueue: async () => {
    const settings = await storage.getSettings();
    const keysToRemove = settings.commitQueue.map(id => `sub_${id}`);
    
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.remove(keysToRemove);
    } else if (typeof localStorage !== 'undefined') {
      keysToRemove.forEach(k => localStorage.removeItem(k));
    }
    
    await storage.updateSettings({ commitQueue: [] });
    set({ commitQueue: [] });
  },
}));
