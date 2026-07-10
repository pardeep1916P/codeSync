import { PlatformAdapter, Submission } from './types';

export class LeetCodeAdapter implements PlatformAdapter {
  platformName = 'LeetCode';
  domainPattern = /leetcode\.com/;

  async detectSubmission(): Promise<Submission | null> {
    // Template logic to detect and scrape accepted LeetCode submission
    // 1. Monitor DOM for "Success" or "Accepted" state in the submissions panel
    // 2. Fetch the submission details using LeetCode's GraphQL API or DOM querying
    // 3. Construct and return the Submission object
    
    try {
      const isAccepted = this.checkDomForSuccess();
      if (!isAccepted) return null;

      const problemInfo = this.scrapeProblemDetails();
      const codeInfo = this.scrapeCodeDetails();

      return {
        id: `leetcode_${Date.now()}`,
        problem: problemInfo,
        language: codeInfo.language,
        code: codeInfo.code,
        timestamp: Date.now(),
        status: 'ACCEPTED',
      };
    } catch (error) {
      console.error('Failed to parse LeetCode submission:', error);
      return null;
    }
  }

  private checkDomForSuccess(): boolean {
    // Check if LeetCode submission success UI exists
    const successElement = document.querySelector('[data-e2e-locator="submission-result"]') 
      || document.querySelector('.success__3Ai7');
    return !!successElement && (successElement.textContent?.includes('Accepted') || successElement.textContent?.includes('Success'));
  }

  private scrapeProblemDetails() {
    // Extracts title, slug, difficulty, etc. from page URL or DOM
    const titleElement = document.querySelector('[data-cy="question-title"]') 
      || document.querySelector('.text-title-large');
    const title = titleElement?.textContent?.trim() || 'Unknown Problem';
    const slug = window.location.pathname.split('/')[2] || '';
    
    // Find difficulty from DOM
    const diffElement = document.querySelector('.text-difficulty-easy, .text-difficulty-medium, .text-difficulty-hard');
    let difficulty: 'Easy' | 'Medium' | 'Hard' = 'Medium';
    if (diffElement?.classList.contains('text-difficulty-easy')) difficulty = 'Easy';
    if (diffElement?.classList.contains('text-difficulty-hard')) difficulty = 'Hard';

    return {
      id: slug,
      title,
      slug,
      difficulty,
      description: 'Problem description template',
      tags: [],
      url: window.location.href,
    };
  }

  private scrapeCodeDetails() {
    // In a full implementation, we extract the code submitted and its language
    return {
      code: '// Insert submitted code here',
      language: 'cpp',
    };
  }
}
