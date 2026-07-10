import { GitHubUser, GitHubRepo, GitCommitPayload } from './types';

export class GitHubClient {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`https://api.github.com${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API request failed: ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  async getUser(): Promise<GitHubUser> {
    return this.request<GitHubUser>('/user');
  }

  async getRepositories(): Promise<GitHubRepo[]> {
    return this.request<GitHubRepo[]>('/user/repos?per_page=100&sort=updated');
  }

  /**
   * Performs a single commit with multiple files using Git Trees API.
   * This ensures atomic single commit uploads.
   */
  async createCommit(repoFullName: string, payload: GitCommitPayload): Promise<void> {
    const branch = payload.branch || 'main';

    // 1. Get reference to the last commit of the target branch
    const refResponse = await this.request<{ object: { sha: string } }>(
      `/repos/${repoFullName}/git/ref/heads/${branch}`
    );
    const latestCommitSha = refResponse.object.sha;

    // 2. Retrieve the tree SHA of that latest commit
    const commitResponse = await this.request<{ tree: { sha: string } }>(
      `/repos/${repoFullName}/git/commits/${latestCommitSha}`
    );
    const baseTreeSha = commitResponse.tree.sha;

    // 3. Create the blobs for the files to commit
    const treeItems = await Promise.all(
      payload.files.map(async (file) => {
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
    const newTreeResponse = await this.request<{ sha: string }>(
      `/repos/${repoFullName}/git/trees`,
      {
        method: 'POST',
        body: JSON.stringify({
          base_tree: baseTreeSha,
          tree: treeItems,
        }),
      }
    );
    const newTreeSha = newTreeResponse.sha;

    // 5. Create the commit object referencing the new tree and base commit parent
    const newCommitResponse = await this.request<{ sha: string }>(
      `/repos/${repoFullName}/git/commits`,
      {
        method: 'POST',
        body: JSON.stringify({
          message: payload.message,
          tree: newTreeSha,
          parents: [latestCommitSha],
        }),
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
