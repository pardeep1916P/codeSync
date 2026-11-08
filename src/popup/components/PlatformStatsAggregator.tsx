import React from 'react';
import { Theme } from '../../styles/themes';

interface PlatformStatsAggregatorProps {
  platformStats: Record<string, number>;
  totalSolved: number;
  activeTheme: Theme;
  selectedRepo: string | null;
}

interface PlatformConfig {
  key: string;
  name: string;
  shortCode: string;
  color: string;
  bg: string;
  border: string;
}

const PLATFORMS: PlatformConfig[] = [
  {
    key: 'leetcode',
    name: 'LeetCode',
    shortCode: 'LC',
    color: '#FFA116',
    bg: 'rgba(255, 161, 22, 0.1)',
    border: 'rgba(255, 161, 22, 0.25)',
  },
  {
    key: 'codeforces',
    name: 'Codeforces',
    shortCode: 'CF',
    color: '#318CE7',
    bg: 'rgba(49, 140, 231, 0.1)',
    border: 'rgba(49, 140, 231, 0.25)',
  },
  {
    key: 'codechef',
    name: 'CodeChef',
    shortCode: 'CC',
    color: '#D97706',
    bg: 'rgba(217, 119, 6, 0.1)',
    border: 'rgba(217, 119, 6, 0.25)',
  },
  {
    key: 'hackerrank',
    name: 'HackerRank',
    shortCode: 'HR',
    color: '#10B981',
    bg: 'rgba(16, 185, 129, 0.1)',
    border: 'rgba(16, 185, 129, 0.25)',
  },
  {
    key: 'geeksforgeeks',
    name: 'GeeksforGeeks',
    shortCode: 'GFG',
    color: '#22C55E',
    bg: 'rgba(34, 197, 94, 0.1)',
    border: 'rgba(34, 197, 94, 0.25)',
  },
];

export const PlatformStatsAggregator: React.FC<PlatformStatsAggregatorProps> = ({
  platformStats,
  totalSolved,
  activeTheme,
  selectedRepo,
}) => {
  if (!selectedRepo) {
    return (
      <div 
        className="text-xs font-bold italic p-4 rounded-xl border" 
        style={{ 
          backgroundColor: activeTheme.cardBg, 
          borderColor: activeTheme.border, 
          color: activeTheme.text,
          opacity: 0.7 
        }}
      >
        Select a target repository to view multi-platform activity.
      </div>
    );
  }

  return (
    <div
      className="border rounded-2xl p-5 flex flex-col gap-4 transition-all duration-200"
      style={{
        backgroundColor: activeTheme.cardBg,
        borderColor: activeTheme.border,
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: activeTheme.accent }}
          />
          <span className="text-xs font-bold tracking-wider uppercase opacity-70">
            PLATFORM_ACTIVITY_METRICS
          </span>
        </div>
        <span
          className="text-xs font-extrabold tracking-wide uppercase px-2.5 py-1 rounded-lg border font-mono"
          style={{ 
            color: activeTheme.accent,
            borderColor: activeTheme.border,
            backgroundColor: activeTheme.inputBg,
          }}
        >
          TOTAL SOLVED: {totalSolved}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {PLATFORMS.map((platform) => {
          const count = platformStats[platform.key] || 0;
          const hasCount = count > 0;

          return (
            <div
              key={platform.key}
              title={`${platform.name}: ${count} solved`}
              className="flex items-center justify-between px-3.5 py-3 rounded-xl border transition-all duration-150"
              style={{
                backgroundColor: hasCount ? platform.bg : 'rgba(255,255,255,0.02)',
                borderColor: hasCount ? platform.border : activeTheme.border,
              }}
            >
              <div className="flex flex-col gap-0.5">
                <span
                  className="text-xs font-bold tracking-wide"
                  style={{
                    color: hasCount ? platform.color : activeTheme.text,
                    opacity: hasCount ? 1 : 0.5,
                  }}
                >
                  {platform.name}
                </span>
                <span className="text-[9px] font-mono opacity-50 uppercase tracking-wider">
                  {platform.shortCode}
                </span>
              </div>
              <span
                className="text-sm font-mono font-black"
                style={{
                  color: hasCount ? activeTheme.textHighlight : activeTheme.text,
                  opacity: hasCount ? 1 : 0.4,
                }}
              >
                {count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
