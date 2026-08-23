import { PlatformAdapter, PlatformId } from '../types';

export class CodeChefAdapter implements PlatformAdapter {
  readonly id: PlatformId = 'codechef';
  readonly name = 'CodeChef';
  readonly domainPatterns = [
    /codechef\.com/i,
  ];

  matchesUrl(url: string): boolean {
    return this.domainPatterns.some(pattern => pattern.test(url));
  }

  getFileExtension(language: string): string {
    const lang = (language || '').toLowerCase().trim();
    if (lang.includes('c++') || lang.includes('g++') || lang.includes('clang++') || lang.includes('cpp')) return 'cpp';
    if (lang.includes('c#') || lang.includes('csharp')) return 'cs';
    if (lang === 'c' || lang.startsWith('c ') || lang.includes('gcc')) return 'c';
    if (lang.includes('java')) return 'java';
    if (lang.includes('python') || lang.includes('py3') || lang.includes('pypy')) return 'py';
    if (lang.includes('javascript') || lang.includes('node') || lang.includes('js')) return 'js';
    if (lang.includes('typescript') || lang.includes('ts')) return 'ts';
    if (lang.includes('rust')) return 'rs';
    if (lang.includes('go') || lang.includes('golang')) return 'go';
    if (lang.includes('kotlin') || lang.includes('kt')) return 'kt';
    if (lang.includes('swift')) return 'swift';
    if (lang.includes('ruby') || lang.includes('rb')) return 'rb';
    if (lang.includes('php')) return 'php';
    return 'txt';
  }

  normalizeDifficulty(difficultyOrRating?: number | string): string {
    if (typeof difficultyOrRating === 'number') {
      if (difficultyOrRating < 1400) return 'Easy';
      if (difficultyOrRating <= 1800) return 'Medium';
      return 'Hard';
    }
    if (typeof difficultyOrRating === 'string') {
      const lower = difficultyOrRating.toLowerCase().trim();
      if (lower.includes('school') || lower.includes('beginner')) return 'Easy';
      if (lower.includes('easy')) return 'Easy';
      if (lower.includes('medium')) return 'Medium';
      if (lower.includes('hard') || lower.includes('challenge')) return 'Hard';
      const num = parseInt(difficultyOrRating, 10);
      if (!isNaN(num)) {
        if (num < 1400) return 'Easy';
        if (num <= 1800) return 'Medium';
        return 'Hard';
      }
    }
    return 'Medium';
  }
}
