import { describe, it, expect } from 'vitest';
import { LRUCache } from '../lru';

describe('LRUCache', () => {
  it('stores and retrieves values correctly', () => {
    const cache = new LRUCache<string, number>(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);

    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
    expect(cache.size).toBe(3);
  });

  it('evicts the least recently used item when capacity is reached', () => {
    const cache = new LRUCache<string, number>(2);
    cache.set('a', 1);
    cache.set('b', 2);

    // Access 'a' so 'b' becomes the oldest
    cache.get('a');

    // Add 'c', should evict 'b'
    cache.set('c', 3);

    expect(cache.has('a')).toBe(true);
    expect(cache.has('c')).toBe(true);
    expect(cache.has('b')).toBe(false);
    expect(cache.get('b')).toBeUndefined();
  });

  it('updates existing keys without exceeding capacity', () => {
    const cache = new LRUCache<string, number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('a', 10);

    expect(cache.size).toBe(2);
    expect(cache.get('a')).toBe(10);
  });
});
