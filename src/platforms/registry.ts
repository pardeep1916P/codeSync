import { PlatformAdapter } from './types';
import { LeetCodeAdapter } from './leetcode';
import { CodeforcesAdapter } from './codeforces';
import { HackerRankAdapter } from './hackerrank';
import { GeeksforGeeksAdapter } from './geeksforgeeks';

const platformAdapters: PlatformAdapter[] = [
  new LeetCodeAdapter(),
  new CodeforcesAdapter(),
  new HackerRankAdapter(),
  new GeeksforGeeksAdapter(),
];

export function getPlatformForUrl(url: string): PlatformAdapter | null {
  if (!url) return null;
  return platformAdapters.find(adapter => adapter.matchesUrl(url)) || null;
}

export function getAllPlatforms(): PlatformAdapter[] {
  return [...platformAdapters];
}
