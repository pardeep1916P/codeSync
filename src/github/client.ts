import { GitHubUser, GitHubRepo, GitCommitPayload } from './types';

export class GitHubAuthError extends Error {
  status: number;
  constructor(message = 'Session expired or bad credentials') {
    super(message);
    this.name = 'GitHubAuthError';
    this.status = 401;
  }
}

export function isAuthError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof GitHubAuthError) return true;
  const msg = (err as Error).message || '';
  return msg.includes('401') || msg.includes('Bad credentials') || msg.includes('bad credentials');
}

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

        if (response.status === 401) {
          throw new GitHubAuthError('Session expired or bad credentials');
        }

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
        if (isAuthError(lastError)) {
          throw lastError;
        }
        if (attempt < retries && !lastError.message?.includes('404')) {
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

  async graphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    if (response.status === 401) {
      throw new GitHubAuthError('Session expired or bad credentials');
    }

    if (!response.ok) {
      throw new Error(`GitHub GraphQL request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    if (result.errors && result.errors.length > 0) {
      throw new Error(result.errors[0]?.message || 'GraphQL Error');
    }
    return result.data as T;
  }

  async fetchSyncContext(repoFullName: string, preferredBranch?: string): Promise<{
    branch: string;
    latestCommitSha: string;
    baseTreeSha: string;
    rootReadmeContent: string | null;
    statsContent: string | null;
  }> {
    const [owner, name] = repoFullName.split('/');
    const branch = preferredBranch || this.defaultBranchMap.get(repoFullName) || 'main';

    try {
      const query = `
        query($owner: String!, $name: String!, $branchRef: String!, $readmeExpr: String!, $statsExpr: String!) {
          repository(owner: $owner, name: $name) {
            defaultBranchRef {
              name
              target {
                ... on Commit {
                  oid
                  tree {
                    oid
                  }
                }
              }
            }
            ref(qualifiedName: $branchRef) {
              target {
                ... on Commit {
                  oid
                  tree {
                    oid
                  }
                }
              }
            }
            readme: object(expression: $readmeExpr) {
              ... on Blob { text }
            }
            stats: object(expression: $statsExpr) {
              ... on Blob { text }
            }
          }
        }
      `;

      const data = await this.graphql<{
        repository: {
          defaultBranchRef?: {
            name: string;
            target?: { oid: string; tree?: { oid: string } };
          } | null;
          ref?: {
            target?: { oid: string; tree?: { oid: string } };
          } | null;
          readme?: { text?: string } | null;
          stats?: { text?: string } | null;
        } | null;
      }>(query, {
        owner,
        name,
        branchRef: `refs/heads/${branch}`,
        readmeExpr: `${branch}:README.md`,
        statsExpr: `${branch}:stats.json`,
      });

      if (data?.repository) {
        const repo = data.repository;
        const targetRef = repo.ref || repo.defaultBranchRef;
        const resolvedBranch = (repo.ref ? branch : repo.defaultBranchRef?.name) || branch;
        this.defaultBranchMap.set(repoFullName, resolvedBranch);

        if (targetRef?.target?.oid && targetRef.target.tree?.oid) {
          return {
            branch: resolvedBranch,
            latestCommitSha: targetRef.target.oid,
            baseTreeSha: targetRef.target.tree.oid,
            rootReadmeContent: repo.readme?.text || null,
            statsContent: repo.stats?.text || null,
          };
        }
      }
    } catch {
      // Fallback to REST on empty repo or GraphQL failure
    }

    // REST Fallback:
    let resolvedBranch = branch;
    if (!preferredBranch && !this.defaultBranchMap.has(repoFullName)) {
      try {
        const repoInfo = await this.request<{ default_branch: string }>(`/repos/${repoFullName}`);
        resolvedBranch = repoInfo.default_branch || 'main';
        this.defaultBranchMap.set(repoFullName, resolvedBranch);
      } catch {
        resolvedBranch = 'main';
      }
    }

    const [readmeResult, statsResult] = await Promise.allSettled([
      this.getFileContent(repoFullName, 'README.md', resolvedBranch),
      this.getFileContent(repoFullName, 'stats.json', resolvedBranch),
    ]);

    let latestCommitSha = '';
    let baseTreeSha = '';

    try {
      const refResponse = await this.request<{ object: { sha: string } }>(
        `/repos/${repoFullName}/git/ref/heads/${resolvedBranch}`
      );
      latestCommitSha = refResponse.object.sha;

      const commitResponse = await this.request<{ tree: { sha: string } }>(
        `/repos/${repoFullName}/git/commits/${latestCommitSha}`
      );
      baseTreeSha = commitResponse.tree.sha;
    } catch {
      // Empty repo will be initialized in createCommit
    }

    return {
      branch: resolvedBranch,
      latestCommitSha,
      baseTreeSha,
      rootReadmeContent: readmeResult.status === 'fulfilled' && readmeResult.value ? readmeResult.value.content : null,
      statsContent: statsResult.status === 'fulfilled' && statsResult.value ? statsResult.value.content : null,
    };
  }

  private defaultBranchMap: Map<string, string> = new Map();

  /**
   * Performs a single commit with multiple files using Git Trees API.
   * This ensures atomic single commit uploads and supports chaining for fast multi-file batching.
   */
  async createCommit(repoFullName: string, payload: GitCommitPayload): Promise<{ commitSha: string; treeSha: string; branch: string }> {
    let branch = payload.branch;
    if (!branch) {
      if (this.defaultBranchMap.has(repoFullName)) {
        branch = this.defaultBranchMap.get(repoFullName)!;
      } else {
        try {
          const repoInfo = await this.request<{ default_branch: string }>(`/repos/${repoFullName}`);
          branch = repoInfo.default_branch || 'main';
          this.defaultBranchMap.set(repoFullName, branch);
        } catch {
          branch = 'main';
        }
      }
    }

    let latestCommitSha: string = payload.baseCommitSha || '';
    let baseTreeSha: string = payload.baseTreeSha || '';

    // If base SHAs were not passed from a chained batch, fetch them from GitHub
    if (!latestCommitSha || !baseTreeSha) {
      try {
        const refResponse = await this.request<{ object: { sha: string } }>(
          `/repos/${repoFullName}/git/ref/heads/${branch}`
        );
        latestCommitSha = refResponse.object.sha;

        const commitResponse = await this.request<{ tree: { sha: string } }>(
          `/repos/${repoFullName}/git/commits/${latestCommitSha}`
        );
        baseTreeSha = commitResponse.tree.sha;
      } catch (error: unknown) {
        const err = error as Error;
        if (err.message && (err.message.includes('Git Repository is empty') || err.message.includes('409') || err.message.includes('404'))) {
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
    }

    // Create tree items for files (inline content < 100 KB for fast single-payload tree creation)
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

    // Create a new tree with the new file blobs resting on top of the base tree
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

    // Create the commit object referencing the new tree and base commit parent
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
      } catch {
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

    // Update the branch reference to point to the new commit
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

    return { commitSha: newCommitSha, treeSha: newTreeSha, branch };
  }
}
