import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useStore } from '../index';

describe('Multi-Platform Stats Store Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useStore.setState({
      githubToken: null,
      githubUser: null,
      selectedRepo: null,
      solvedCount: 0,
      platformStats: {},
    });
  });

  it('initializes with empty platformStats by default', () => {
    const state = useStore.getState();
    expect(state.platformStats).toEqual({});
    expect(state.solvedCount).toBe(0);
  });

  it('updates platformStats when multiple platforms are provided', () => {
    useStore.setState({
      solvedCount: 15,
      platformStats: {
        leetcode: 10,
        codeforces: 3,
        codechef: 2,
      },
    });

    const state = useStore.getState();
    expect(state.solvedCount).toBe(15);
    expect(state.platformStats.leetcode).toBe(10);
    expect(state.platformStats.codeforces).toBe(3);
    expect(state.platformStats.codechef).toBe(2);
  });

  it('resets platformStats alongside solvedCount and user state', () => {
    useStore.setState({
      githubToken: 'ghp_test123',
      githubUser: 'testUser',
      selectedRepo: 'testUser/leetcode',
      solvedCount: 20,
      platformStats: {
        leetcode: 15,
        codeforces: 5,
      },
    });

    useStore.setState({
      githubToken: null,
      githubUser: null,
      selectedRepo: null,
      solvedCount: 0,
      platformStats: {},
    });

    const state = useStore.getState();
    expect(state.githubToken).toBeNull();
    expect(state.solvedCount).toBe(0);
    expect(state.platformStats).toEqual({});
  });
});
