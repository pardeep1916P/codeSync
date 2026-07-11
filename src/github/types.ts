export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  name?: string | null;
  email?: string | null;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
}

export interface GitCommitPayload {
  message: string;
  files: {
    path: string;
    content: string;
  }[];
  branch?: string;
  authorDate?: string;
}
