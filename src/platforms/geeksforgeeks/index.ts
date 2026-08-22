import { PlatformAdapter, PlatformId } from '../types';

export class GeeksforGeeksAdapter implements PlatformAdapter {
  readonly id: PlatformId = 'geeksforgeeks';
  readonly name = 'GeeksforGeeks';
  readonly domainPatterns = [
    /geeksforgeeks\.org/i,
  ];

  matchesUrl(url: string): boolean {
    return this.domainPatterns.some(pattern => pattern.test(url));
  }

  getFileExtension(language: string): string {
    const lang = (language || '').toLowerCase().trim();
    if (lang.includes('cpp') || lang.includes('c++')) return 'cpp';
    if (lang.includes('csharp') || lang.includes('c#')) return 'cs';
    if (lang.includes('c')) return 'c';
    if (lang.includes('java')) return 'java';
    if (lang.includes('python')) return 'py';
    if (lang.includes('javascript') || lang.includes('js')) return 'js';
    return 'txt';
  }
}
