import { GitHubUser, GitHubRepo, GitCommitPayload } from './types';

export class GitHubClient {
  private token: string;
  private cachedUser: GitHubUser | null = null;

  constructor(token: string) {
    this.token = token;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async request<T>(path: string, options: RequestInit = {}, retries = 2): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(`https://api.github.com${path}`, {
          cache: 'no-store',
          ...options,
          headers: {
            Authorization: `Bearer ${this.token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            ...options.headers,
          },
        });

        // If rate limited or server temporarily unavailable, retry with backoff
        if ((response.status === 429 || response.status >= 500) && attempt < retries) {
          const retryAfter = response.headers.get('Retry-After');
          const delayMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : (attempt + 1) * 1000;
          await this.sleep(delayMs);
          continue;
        }

        if (!response.ok) {
          let bodyText = '';
          try {
            bodyText = await response.text();
          } catch (_) {
            // Ignore response reading error
          }
          throw new Error(`GitHub API request failed: ${response.status} ${response.statusText}. Response: ${bodyText}`);
        }

        return (await response.json()) as T;
      } catch (err) {
        lastError = err as Error;
        if (attempt < retries && !lastError.message?.includes('404') && !lastError.message?.includes('401')) {
          await this.sleep((attempt + 1) * 1000);
          continue;
        }
        throw lastError;
      }
    }

    throw lastError || new Error('GitHub API request failed after retries');
  }

  async getUser(): Promise<GitHubUser> {
    if (this.cachedUser) return this.cachedUser;
    const user = await this.request<GitHubUser>('/user');
    this.cachedUser = user;
    return user;
  }

  async getRepositories(): Promise<GitHubRepo[]> {
    const allRepos: GitHubRepo[] = [];
    let page = 1;
    const perPage = 100;
    const maxPages = 5; // Support up to 500 repositories

    while (page <= maxPages) {
      const repos = await this.request<GitHubRepo[]>(`/user/repos?per_page=${perPage}&page=${page}&sort=updated`);
      if (!Array.isArray(repos) || repos.length === 0) break;
      allRepos.push(...repos);
      if (repos.length < perPage) break;
      page++;
    }

    return allRepos;
  }

  async getFileContent(repoFullName: string, path: string, branch?: string): Promise<{ content: string; sha: string } | null> {
    try {
      const url = `/repos/${repoFullName}/contents/${path}${branch ? `?ref=${branch}` : ''}`;
      const response = await this.request<{ content: string; sha: string; encoding: string }>(url);
      
      // Decode base64 content
      const cleanBase64 = response.content.replace(/\s/g, '');
      const content = atob(cleanBase64);

      return { content, sha: response.sha };
    } catch (e: unknown) {
      const err = e as Error;
      if (err.message && (err.message.includes('404') || err.message.includes('Not Found'))) {
        return null;
      }
      throw e;
    }
  }

  /**
   * Performs a single commit with multiple files using Git Trees API.
   * This ensures atomic single commit uploads.
   */
  async createCommit(repoFullName: string, payload: GitCommitPayload): Promise<void> {
    let branch = payload.branch;
    if (!branch) {
      try {
        const repoInfo = await this.request<{ default_branch: string }>(`/repos/${repoFullName}`);
        branch = repoInfo.default_branch;
      } catch (e) {
        branch = 'main';
      }
    }

    let latestCommitSha: string = '';
    let baseTreeSha: string = '';

    // 1. Get reference to the last commit of the target branch
    try {
      const refResponse = await this.request<{ object: { sha: string } }>(
        `/repos/${repoFullName}/git/ref/heads/${branch}`
      );
      latestCommitSha = refResponse.object.sha;

      // 2. Retrieve the tree SHA of that latest commit
      const commitResponse = await this.request<{ tree: { sha: string } }>(
        `/repos/${repoFullName}/git/commits/${latestCommitSha}`
      );
      baseTreeSha = commitResponse.tree.sha;
    } catch (error: unknown) {
      const err = error as Error;
      if (err.message && (err.message.includes('Git Repository is empty') || err.message.includes('409'))) {
        // Initialize empty repository by creating a README.md file
        const initResponse = await this.request<{ commit: { sha: string; tree: { sha: string } } }>(
          `/repos/${repoFullName}/contents/README.md`,
          {
            method: 'PUT',
            body: JSON.stringify({
              message: 'Initial commit: initialize repository with README.md',
              content: 'IyBDb2RlU3luYyBTb2x1dGlvbnMK', // "# CodeSync Solutions\n" in Base64
              branch,
            }),
          }
        );
        latestCommitSha = initResponse.commit.sha;
        baseTreeSha = initResponse.commit.tree.sha;
      } else {
        throw error;
      }
    }

    // 3. Create tree items for files (inline content < 100 KB for fast single-payload tree creation)
    const treeItems = await Promise.all(
      payload.files.map(async (file) => {
        if (file.content.length < 100 * 1024) {
          return {
            path: file.path,
            mode: '100644', // normal file
            type: 'blob',
            content: file.content,
          };
        }
        const blobResponse = await this.request<{ sha: string }>(
          `/repos/${repoFullName}/git/blobs`,
          {
            method: 'POST',
            body: JSON.stringify({
              content: file.content,
              encoding: 'utf-8',
            }),
          }
        );
        return {
          path: file.path,
          mode: '100644', // normal file
          type: 'blob',
          sha: blobResponse.sha,
        };
      })
    );

    // 4. Create a new tree with the new file blobs resting on top of the base tree
    const treeParams = {
      base_tree: baseTreeSha,
      tree: treeItems,
    };
    const newTreeResponse = await this.request<{ sha: string }>(
      `/repos/${repoFullName}/git/trees`,
      {
        method: 'POST',
        body: JSON.stringify(treeParams),
      }
    );
    const newTreeSha = newTreeResponse.sha;

    // 5. Create the commit object referencing the new tree and base commit parent
    const commitParams: Record<string, unknown> = {
      message: payload.message,
      tree: newTreeSha,
      parents: [latestCommitSha],
    };

    if (payload.authorDate) {
      let name = 'CodeSync User';
      let email = 'codesync@users.noreply.github.com';
      try {
        const user = await this.getUser();
        name = user.name || user.login || name;
        email = user.email || `${user.login}@users.noreply.github.com`;
      } catch (e) {
        // Silent fallback
      }
      commitParams.author = {
        name,
        email,
        date: payload.authorDate,
      };
    }
    const newCommitResponse = await this.request<{ sha: string }>(
      `/repos/${repoFullName}/git/commits`,
      {
        method: 'POST',
        body: JSON.stringify(commitParams),
      }
    );
    const newCommitSha = newCommitResponse.sha;

    // 6. Update the branch reference to point to the new commit
    await this.request(
      `/repos/${repoFullName}/git/refs/heads/${branch}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          sha: newCommitSha,
          force: false,
        }),
      }
    );
  }
}
