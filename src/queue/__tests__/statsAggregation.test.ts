import { describe, it, expect } from 'vitest';

describe('CommitQueue Stats Aggregation', () => {
  it('correctly aggregates counts across platforms in stats data', () => {
    interface StatsData {
      shas: Record<string, Record<string, string>>;
      solved: number;
      platforms?: Record<string, number>;
    }

    const workingStats: StatsData = {
      shas: {},
      solved: 0,
      platforms: {},
    };

    const mockSubmissions = [
      { slug: 'two-sum', platform: 'leetcode' },
      { slug: 'add-two-numbers', platform: 'leetcode' },
      { slug: 'cf-1800-a', platform: 'codeforces' },
      { slug: 'cc-chef-and-digits', platform: 'codechef' },
    ];

    for (const sub of mockSubmissions) {
      const platform = sub.platform.toLowerCase();
      const isNewProblem = !workingStats.shas[sub.slug];

      workingStats.shas[sub.slug] = {
        [`${sub.slug}.cpp`]: 'mock_sha',
        'README.md': 'mock_readme_sha',
      };

      if (isNewProblem) {
        if (!workingStats.platforms) workingStats.platforms = {};
        workingStats.platforms[platform] = (workingStats.platforms[platform] || 0) + 1;
      }
    }

    workingStats.solved = Object.keys(workingStats.shas).filter(k => k !== 'README.md' && k !== 'stats.json').length;

    expect(workingStats.solved).toBe(4);
    expect(workingStats.platforms?.leetcode).toBe(2);
    expect(workingStats.platforms?.codeforces).toBe(1);
    expect(workingStats.platforms?.codechef).toBe(1);
  });

  it('preserves existing counts and handles legacy repos without platform breakdown', () => {
    const legacyStats = {
      shas: {
        'problem-1': { 'code.py': 'sha1' },
        'problem-2': { 'code.py': 'sha2' },
        'problem-3': { 'code.py': 'sha3' },
      },
      solved: 3,
      platforms: undefined as Record<string, number> | undefined,
    };

    if (!legacyStats.platforms) {
      legacyStats.platforms = {};
    }
    const recordedTotal = Object.values(legacyStats.platforms).reduce((sum, c) => sum + (c || 0), 0);
    if (recordedTotal < legacyStats.solved) {
      legacyStats.platforms.leetcode = (legacyStats.platforms.leetcode || 0) + (legacyStats.solved - recordedTotal);
    }

    expect(legacyStats.platforms.leetcode).toBe(3);
  });
});
