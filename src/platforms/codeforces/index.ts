import { PlatformAdapter, PlatformId } from '../types';

export class CodeforcesAdapter implements PlatformAdapter {
  readonly id: PlatformId = 'codeforces';
  readonly name = 'Codeforces';
  readonly domainPatterns = [
    /codeforces\.com/i,
    /codeforces\.net/i,
  ];

  matchesUrl(url: string): boolean {
    if (!url) return false;
    return this.domainPatterns.some(pattern => pattern.test(url));
  }

  getFileExtension(language: string): string {
    const lang = (language || '').toLowerCase().trim();
    if (lang.includes('c++') || lang.includes('g++') || lang.includes('clang++') || lang.includes('cpp')) return 'cpp';
    if (lang.includes('c#') || lang.includes('csharp')) return 'cs';
    if (lang === 'c' || lang.startsWith('c ') || lang.includes('gcc')) return 'c';
    if (lang.includes('java')) return 'java';
    if (lang.includes('python') || lang.includes('py') || lang.includes('pypy')) return 'py';
    if (lang.includes('javascript') || lang.includes('node') || lang.includes('js')) return 'js';
    if (lang.includes('typescript') || lang.includes('ts')) return 'ts';
    if (lang.includes('rust') || lang.includes('rs')) return 'rs';
    if (lang.includes('go') || lang.includes('golang')) return 'go';
    if (lang.includes('kotlin') || lang.includes('kt')) return 'kt';
    if (lang.includes('haskell') || lang.includes('hs')) return 'hs';
    if (lang.includes('ruby') || lang.includes('rb')) return 'rb';
    if (lang.includes('php')) return 'php';
    return 'txt';
  }

  normalizeDifficulty(rating?: number | string): string {
    if (typeof rating === 'number') {
      if (rating < 1400) return 'Easy';
      if (rating <= 1800) return 'Medium';
      return 'Hard';
    }
    if (typeof rating === 'string') {
      const num = parseInt(rating, 10);
      if (!isNaN(num)) {
        if (num < 1400) return 'Easy';
        if (num <= 1800) return 'Medium';
        return 'Hard';
      }
      const lower = rating.toLowerCase();
      if (lower.includes('div. 3') || lower.includes('div. 4') || lower.includes('easy')) return 'Easy';
      if (lower.includes('div. 2') || lower.includes('medium')) return 'Medium';
      if (lower.includes('div. 1') || lower.includes('hard')) return 'Hard';
    }
    return 'Medium';
  }
}
