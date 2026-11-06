import { describe, it, expect } from 'vitest';
import React from 'react';
import { PlatformStatsAggregator } from '../PlatformStatsAggregator';
import { THEMES } from '../../../styles/themes';

describe('PlatformStatsAggregator Component', () => {
  const activeTheme = THEMES.amoled;

  it('renders null when no repository is selected', () => {
    const result = PlatformStatsAggregator({
      platformStats: {},
      totalSolved: 0,
      activeTheme,
      selectedRepo: null,
    });
    expect(result).toBeNull();
  });

  it('renders stats element tree when repository is selected', () => {
    const result = PlatformStatsAggregator({
      platformStats: {
        leetcode: 42,
        codeforces: 12,
        codechef: 5,
      },
      totalSolved: 59,
      activeTheme,
      selectedRepo: 'pardeep1916P/competitive-programming',
    });

    expect(result).not.toBeNull();
    expect(React.isValidElement(result)).toBe(true);

    // Verify root styling and structure
    const element = result as React.ReactElement<{ style: React.CSSProperties; children: React.ReactNode[] }>;
    expect(element.props.style.backgroundColor).toBe(activeTheme.cardBg);
    expect(element.props.style.borderColor).toBe(activeTheme.border);
  });

  it('handles empty platform stats gracefully', () => {
    const result = PlatformStatsAggregator({
      platformStats: {},
      totalSolved: 0,
      activeTheme,
      selectedRepo: 'pardeep1916P/leetcode',
    });

    expect(result).not.toBeNull();
    expect(React.isValidElement(result)).toBe(true);
  });
});
