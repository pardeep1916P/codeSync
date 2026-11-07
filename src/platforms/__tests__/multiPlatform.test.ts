import { describe, it, expect } from 'vitest';
import { CodeforcesAdapter } from '../codeforces';
import { CodeChefAdapter } from '../codechef';
import { getPlatformForUrl, getAllPlatforms } from '../registry';

describe('Multi-Platform Integration & Normalization', () => {
  const codeforces = new CodeforcesAdapter();
  const codechef = new CodeChefAdapter();

  describe('CodeforcesAdapter', () => {
    it('matches Codeforces domains correctly', () => {
      expect(codeforces.matchesUrl('https://codeforces.com/contest/1234/problem/A')).toBe(true);
      expect(codeforces.matchesUrl('https://codeforces.net/problemset/problem/1234/B')).toBe(true);
      expect(codeforces.matchesUrl('https://leetcode.com/problems/two-sum')).toBe(false);
    });

    it('normalizes ratings and division strings to standardized difficulties', () => {
      expect(codeforces.normalizeDifficulty(800)).toBe('Easy');
      expect(codeforces.normalizeDifficulty(1350)).toBe('Easy');
      expect(codeforces.normalizeDifficulty(1400)).toBe('Medium');
      expect(codeforces.normalizeDifficulty(1750)).toBe('Medium');
      expect(codeforces.normalizeDifficulty(1900)).toBe('Hard');
      expect(codeforces.normalizeDifficulty(2400)).toBe('Hard');

      // String division tests
      expect(codeforces.normalizeDifficulty('Div. 3')).toBe('Easy');
      expect(codeforces.normalizeDifficulty('Div. 4')).toBe('Easy');
      expect(codeforces.normalizeDifficulty('Div. 2')).toBe('Medium');
      expect(codeforces.normalizeDifficulty('Div. 1')).toBe('Hard');
    });

    it('maps programming language names to proper file extensions', () => {
      expect(codeforces.getFileExtension('GNU C++20 (64)')).toBe('cpp');
      expect(codeforces.getFileExtension('Python 3.8.10')).toBe('py');
      expect(codeforces.getFileExtension('PyPy 3')).toBe('py');
      expect(codeforces.getFileExtension('Java 17 64bit')).toBe('java');
      expect(codeforces.getFileExtension('Rust 2021')).toBe('rs');
      expect(codeforces.getFileExtension('Go 1.19')).toBe('go');
      expect(codeforces.getFileExtension('Kotlin 1.7')).toBe('kt');
    });
  });

  describe('CodeChefAdapter', () => {
    it('matches CodeChef URLs correctly', () => {
      expect(codechef.matchesUrl('https://www.codechef.com/problems/FLOW001')).toBe(true);
      expect(codechef.matchesUrl('https://codechef.com/submit/FLOW001')).toBe(true);
      expect(codeforces.matchesUrl('https://codeforces.com')).toBe(true);
    });

    it('normalizes CodeChef difficulty levels accurately', () => {
      expect(codechef.normalizeDifficulty('Beginner')).toBe('Easy');
      expect(codechef.normalizeDifficulty('School')).toBe('Easy');
      expect(codechef.normalizeDifficulty('Easy')).toBe('Easy');
      expect(codechef.normalizeDifficulty('Medium')).toBe('Medium');
      expect(codechef.normalizeDifficulty('Hard')).toBe('Hard');
      expect(codechef.normalizeDifficulty('Challenge')).toBe('Hard');
    });

    it('maps CodeChef languages to proper extensions', () => {
      expect(codechef.getFileExtension('C++17')).toBe('cpp');
      expect(codechef.getFileExtension('PYTH 3')).toBe('py');
      expect(codechef.getFileExtension('JAVA')).toBe('java');
      expect(codechef.getFileExtension('C')).toBe('c');
      expect(codechef.getFileExtension('JS')).toBe('js');
    });
  });

  describe('Platform Registry Detection', () => {
    it('finds appropriate adapters by platform URL', () => {
      const all = getAllPlatforms();
      expect(all.length).toBeGreaterThanOrEqual(5);

      const detectedCf = getPlatformForUrl('https://codeforces.com/contest/1800/problem/A');
      expect(detectedCf?.id).toBe('codeforces');

      const detectedCc = getPlatformForUrl('https://www.codechef.com/problems/START01');
      expect(detectedCc?.id).toBe('codechef');

      const detectedLc = getPlatformForUrl('https://leetcode.com/problems/two-sum');
      expect(detectedLc?.id).toBe('leetcode');
    });
  });
});
