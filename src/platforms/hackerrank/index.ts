import { PlatformAdapter, PlatformId } from '../types';

export class HackerRankAdapter implements PlatformAdapter {
  readonly id: PlatformId = 'hackerrank';
  readonly name = 'HackerRank';
  readonly domainPatterns = [
    /hackerrank\.com/i,
  ];

  matchesUrl(url: string): boolean {
    return this.domainPatterns.some(pattern => pattern.test(url));
  }

  getFileExtension(language: string): string {
    const lang = (language || '').toLowerCase().trim();
    const map: Record<string, string> = {
      'cpp': 'cpp',
      'cpp14': 'cpp',
      'cpp20': 'cpp',
      'c': 'c',
      'csharp': 'cs',
      'java': 'java',
      'java8': 'java',
      'java15': 'java',
      'python': 'py',
      'python3': 'py',
      'pypy': 'py',
      'javascript': 'js',
      'typescript': 'ts',
      'golang': 'go',
      'go': 'go',
      'ruby': 'rb',
      'swift': 'swift',
      'kotlin': 'kt',
      'rust': 'rs',
    };
    return map[lang] || 'txt';
  }
}
