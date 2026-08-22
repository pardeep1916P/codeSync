import { PlatformAdapter, PlatformId } from '../types';

export class LeetCodeAdapter implements PlatformAdapter {
  readonly id: PlatformId = 'leetcode';
  readonly name = 'LeetCode';
  readonly domainPatterns = [
    /leetcode\.com/i,
    /leetcode\.cn/i,
  ];

  matchesUrl(url: string): boolean {
    return this.domainPatterns.some(pattern => pattern.test(url));
  }

  getFileExtension(language: string): string {
    const lang = (language || '').toLowerCase().trim();
    const map: Record<string, string> = {
      'cpp': 'cpp',
      'c++': 'cpp',
      'c': 'c',
      'csharp': 'cs',
      'c#': 'cs',
      'java': 'java',
      'python': 'py',
      'python3': 'py',
      'py': 'py',
      'javascript': 'js',
      'js': 'js',
      'typescript': 'ts',
      'ts': 'ts',
      'golang': 'go',
      'go': 'go',
      'rust': 'rs',
      'ruby': 'rb',
      'swift': 'swift',
      'kotlin': 'kt',
      'scala': 'scala',
      'php': 'php',
      'sql': 'sql',
      'mysql': 'sql',
      'mssql': 'sql',
      'oracle': 'sql',
      'r': 'r',
      'dart': 'dart',
    };
    return map[lang] || 'txt';
  }
}
