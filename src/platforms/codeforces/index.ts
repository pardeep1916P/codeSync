import { PlatformAdapter, PlatformId } from '../types';

export class CodeforcesAdapter implements PlatformAdapter {
  readonly id: PlatformId = 'codeforces';
  readonly name = 'Codeforces';
  readonly domainPatterns = [
    /codeforces\.com/i,
    /codeforces\.net/i,
  ];

  matchesUrl(url: string): boolean {
    return this.domainPatterns.some(pattern => pattern.test(url));
  }

  getFileExtension(language: string): string {
    const lang = (language || '').toLowerCase().trim();
    if (lang.includes('c++') || lang.includes('g++') || lang.includes('clang++')) return 'cpp';
    if (lang.includes('c#')) return 'cs';
    if (lang.includes('c')) return 'c';
    if (lang.includes('java')) return 'java';
    if (lang.includes('python') || lang.includes('pypy')) return 'py';
    if (lang.includes('javascript') || lang.includes('node')) return 'js';
    if (lang.includes('typescript')) return 'ts';
    if (lang.includes('rust')) return 'rs';
    if (lang.includes('go')) return 'go';
    if (lang.includes('kotlin')) return 'kt';
    return 'txt';
  }
}
