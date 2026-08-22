import { describe, it, expect } from 'vitest';
import { getPlatformForUrl, getAllPlatforms } from '../registry';
import { LeetCodeAdapter } from '../leetcode';
import { CodeforcesAdapter } from '../codeforces';
import { HackerRankAdapter } from '../hackerrank';
import { GeeksforGeeksAdapter } from '../geeksforgeeks';

describe('Platform Registry & Adapters', () => {
  it('identifies LeetCode URLs correctly', () => {
    const adapter = getPlatformForUrl('https://leetcode.com/problems/two-sum/');
    expect(adapter).toBeInstanceOf(LeetCodeAdapter);
    expect(adapter?.id).toBe('leetcode');
    expect(adapter?.getFileExtension('python3')).toBe('py');
    expect(adapter?.getFileExtension('cpp')).toBe('cpp');
  });

  it('identifies Codeforces URLs correctly', () => {
    const adapter = getPlatformForUrl('https://codeforces.com/contest/158/problem/A');
    expect(adapter).toBeInstanceOf(CodeforcesAdapter);
    expect(adapter?.id).toBe('codeforces');
    expect(adapter?.getFileExtension('GNU C++20')).toBe('cpp');
  });

  it('identifies HackerRank URLs correctly', () => {
    const adapter = getPlatformForUrl('https://www.hackerrank.com/challenges/solve-me-first/problem');
    expect(adapter).toBeInstanceOf(HackerRankAdapter);
    expect(adapter?.id).toBe('hackerrank');
    expect(adapter?.getFileExtension('java15')).toBe('java');
  });

  it('identifies GeeksforGeeks URLs correctly', () => {
    const adapter = getPlatformForUrl('https://www.geeksforgeeks.org/problems/subarray-with-given-sum/1');
    expect(adapter).toBeInstanceOf(GeeksforGeeksAdapter);
    expect(adapter?.id).toBe('geeksforgeeks');
  });

  it('returns null for unknown domain', () => {
    const adapter = getPlatformForUrl('https://example.com/problems/test');
    expect(adapter).toBeNull();
  });

  it('lists all registered platforms', () => {
    const platforms = getAllPlatforms();
    expect(platforms.length).toBeGreaterThanOrEqual(4);
    const ids = platforms.map(p => p.id);
    expect(ids).toContain('leetcode');
    expect(ids).toContain('codeforces');
    expect(ids).toContain('hackerrank');
    expect(ids).toContain('geeksforgeeks');
  });
});
