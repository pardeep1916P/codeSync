import { LeetCodeAdapter } from './leetcode';
import { PlatformAdapter } from './types';

export * from './types';
export * from './leetcode';

const adapters: PlatformAdapter[] = [
  new LeetCodeAdapter(),
];

export function getAdapterForUrl(url: string): PlatformAdapter | null {
  return adapters.find(adapter => adapter.domainPattern.test(url)) || null;
}
