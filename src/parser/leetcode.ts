import { PlatformAdapter, Submission, Problem, Difficulty } from './types';

export class LeetCodeAdapter implements PlatformAdapter {
  platformName = 'LeetCode';
  domainPattern = /leetcode\.com/;

  async detectSubmission(): Promise<Submission | null> {
    try {
      const isAccepted = this.checkDomForSuccess();
      if (!isAccepted) return null;

      const slug = this.getQuestionSlug();
      if (!slug) return null;

      // 1. Get recent submissions for the current problem slug
      const submissionsList = await this.fetchRecentSubmissions(slug);
      const latestAccepted = submissionsList.find(sub => sub.statusDisplay === 'Accepted');
      
      if (!latestAccepted) return null;

      // 2. Check if this is a new submission we haven't processed yet
      const lastProcessedId = await this.getLastProcessedId();
      if (lastProcessedId === latestAccepted.id) {
        return null; // Already processed
      }

      // 3. Fetch full submission details including code, description, difficulty
      const details = await this.fetchSubmissionDetails(latestAccepted.id);
      if (!details) return null;

      // 4. Update last processed id
      await this.setLastProcessedId(latestAccepted.id);

      const difficultyMap: Record<string, Difficulty> = {
        'Easy': 'Easy',
        'Medium': 'Medium',
        'Hard': 'Hard'
      };

      const problem: Problem = {
        id: details.question.questionId,
        title: details.question.title,
        slug: details.question.titleSlug,
        difficulty: difficultyMap[details.question.difficulty] || 'Medium',
        description: this.htmlToMarkdown(details.question.content),
        tags: [], // Tags can be fetched dynamically or parsed
        url: `https://leetcode.com/problems/${details.question.titleSlug}/`,
      };

      return {
        id: latestAccepted.id,
        problem,
        language: details.lang.name,
        code: details.code,
        timestamp: details.timestamp * 1000, // Convert to ms
        status: 'ACCEPTED',
      };
    } catch (error) {
      console.error('Failed to parse LeetCode submission:', error);
      return null;
    }
  }

  private checkDomForSuccess(): boolean {
    // Check various common success indicators in LeetCode v1 and v2 layout
    const successLocators = [
      '[data-e2e-locator="submission-result"]',
      '.success__3Ai7',
      '.text-green-s',
      '.text-sd-success-500',
      'div[class*="success"]',
    ];

    for (const selector of successLocators) {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent || '';
        if (text.includes('Accepted') || text.includes('Success')) {
          return true;
        }
      }
    }

    return false;
  }

  private getQuestionSlug(): string {
    const pathParts = window.location.pathname.split('/');
    const problemsIndex = pathParts.indexOf('problems');
    if (problemsIndex !== -1 && pathParts[problemsIndex + 1]) {
      return pathParts[problemsIndex + 1];
    }
    return '';
  }

  private async getLastProcessedId(): Promise<string | null> {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const result = await chrome.storage.local.get('leetcode_last_processed');
      return result.leetcode_last_processed || null;
    }
    return localStorage.getItem('leetcode_last_processed');
  }

  private async setLastProcessedId(id: string): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await chrome.storage.local.set({ leetcode_last_processed: id });
    } else {
      localStorage.setItem('leetcode_last_processed', id);
    }
  }

  private async queryGraphQL<T>(query: string, variables: Record<string, any>): Promise<T> {
    const response = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    });

    if (!response.ok) {
      throw new Error(`GraphQL request failed: ${response.statusText}`);
    }

    const json = await response.json();
    if (json.errors) {
      throw new Error(`GraphQL returned errors: ${JSON.stringify(json.errors)}`);
    }

    return json.data as T;
  }

  private async fetchRecentSubmissions(questionSlug: string): Promise<{ id: string; statusDisplay: string }[]> {
    const query = `
      query submissionList($offset: Int!, $limit: Int!, $questionSlug: String!) {
        questionSubmissionList(
          offset: $offset
          limit: $limit
          questionSlug: $questionSlug
        ) {
          submissions {
            id
            statusDisplay
          }
        }
      }
    `;

    interface ResponseType {
      questionSubmissionList: {
        submissions: { id: string; statusDisplay: string }[];
      };
    }

    const data = await this.queryGraphQL<ResponseType>(query, {
      offset: 0,
      limit: 10,
      questionSlug,
    });

    return data.questionSubmissionList.submissions;
  }

  private async fetchSubmissionDetails(submissionId: string) {
    const query = `
      query submissionDetails($submissionId: Int!) {
        submissionDetails(submissionId: $submissionId) {
          code
          timestamp
          lang {
            name
          }
          question {
            questionId
            title
            titleSlug
            difficulty
            content
          }
        }
      }
    `;

    interface ResponseType {
      submissionDetails: {
        code: string;
        timestamp: number;
        lang: { name: string };
        question: {
          questionId: string;
          title: string;
          titleSlug: string;
          difficulty: string;
          content: string;
        };
      };
    }

    const data = await this.queryGraphQL<ResponseType>(query, {
      submissionId: parseInt(submissionId, 10),
    });

    return data.submissionDetails;
  }

  private htmlToMarkdown(html: string): string {
    if (!html) return '';
    return html
      .replace(/<p>/g, '')
      .replace(/<\/p>/g, '\n\n')
      .replace(/<code>/g, '`')
      .replace(/<\/code>/g, '`')
      .replace(/<pre>/g, '\n```\n')
      .replace(/<\/pre>/g, '\n```\n')
      .replace(/<strong>/g, '**')
      .replace(/<\/strong>/g, '**')
      .replace(/<em>/g, '_')
      .replace(/<\/em>/g, '_')
      .replace(/<ul>/g, '\n')
      .replace(/<\/ul>/g, '\n')
      .replace(/<li>/g, '- ')
      .replace(/<\/li>/g, '\n')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/<[^>]*>/g, '') // remove remaining HTML tags
      .trim();
  }
}

