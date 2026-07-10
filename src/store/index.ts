import { create } from 'zustand';
import { storage, UserSettings } from '../storage';
import { GitHubClient } from '../github/client';
import { GitHubRepo, GitHubUser } from '../github/types';

interface AppState extends UserSettings {
  isLoading: boolean;
  user: GitHubUser | null;
  repositories: GitHubRepo[];
  error: string | null;
  
  // Actions
  initialize: () => Promise<void>;
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  selectRepo: (repoFullName: string) => Promise<void>;
  setSyncOnAccept: (value: boolean) => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
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
    set({ isLoading: true, error: null });
    try {
      const settings = await storage.getSettings();
      let user: GitHubUser | null = null;
      let repositories: GitHubRepo[] = [];

      if (settings.githubToken) {
        try {
          const client = new GitHubClient(settings.githubToken);
          user = await client.getUser();
          repositories = await client.getRepositories();
        } catch (e) {
          console.error('Failed to validate saved GitHub token:', e);
          // Token might be expired or invalid, reset it
          await storage.updateSettings({ githubToken: null, githubUser: null });
          settings.githubToken = null;
          settings.githubUser = null;
        }
      }

      set({
        ...settings,
        user,
        repositories,
        isLoading: false,
      });
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

  logout: async () => {
    set({ isLoading: true });
    await storage.clearSettings();
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
}));
