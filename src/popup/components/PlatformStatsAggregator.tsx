import React from 'react';
import { Theme } from '../../styles/themes';
import {
  LeetCodeIcon,
  CodeforcesIcon,
  CodeChefIcon,
  HackerRankIcon,
  GeeksforGeeksIcon,
  AllPlatformsIcon,
} from '../../components/PlatformIcons';

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
  icon: React.FC<{ className?: string }>;
}

const PLATFORMS: PlatformConfig[] = [
  {
    key: 'leetcode',
    name: 'LeetCode',
    shortCode: 'LC',
    color: '#FFA116',
    bg: 'rgba(255, 161, 22, 0.1)',
    border: 'rgba(255, 161, 22, 0.25)',
    icon: LeetCodeIcon,
  },
  {
    key: 'codeforces',
    name: 'Codeforces',
    shortCode: 'CF',
    color: '#318CE7',
    bg: 'rgba(49, 140, 231, 0.1)',
    border: 'rgba(49, 140, 231, 0.25)',
    icon: CodeforcesIcon,
  },
  {
    key: 'codechef',
    name: 'CodeChef',
    shortCode: 'CC',
    color: '#D97706',
    bg: 'rgba(217, 119, 6, 0.1)',
    border: 'rgba(217, 119, 6, 0.25)',
    icon: CodeChefIcon,
  },
  {
    key: 'hackerrank',
    name: 'HackerRank',
    shortCode: 'HR',
    color: '#10B981',
    bg: 'rgba(16, 185, 129, 0.1)',
    border: 'rgba(16, 185, 129, 0.25)',
    icon: HackerRankIcon,
  },
  {
    key: 'geeksforgeeks',
    name: 'GeeksforGeeks',
    shortCode: 'GFG',
    color: '#22C55E',
    bg: 'rgba(34, 197, 94, 0.1)',
    border: 'rgba(34, 197, 94, 0.25)',
    icon: GeeksforGeeksIcon,
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
        className="border rounded-2xl p-5 text-xs font-bold italic leading-relaxed" 
        style={{ 
          backgroundColor: activeTheme.cardBg, 
          borderColor: activeTheme.border, 
          color: activeTheme.text,
          opacity: 0.7 
        }}
      >
        Select a target repository above to view multi-platform activity breakdown.
      </div>
    );
  }

  const effectiveStats: Record<string, number> = (platformStats && Object.keys(platformStats).length > 0)
    ? platformStats
    : (totalSolved > 0 ? { leetcode: totalSolved } : {});

  return (
    <div
      className="border rounded-2xl p-5 flex flex-col gap-4 transition-all duration-200"
      style={{
        backgroundColor: activeTheme.cardBg,
        borderColor: activeTheme.border,
      }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div>
          <p className="text-xs leading-relaxed opacity-60">
            Real-time solution counts synchronized to <span className="font-bold font-mono" style={{ color: activeTheme.textHighlight }}>{selectedRepo}</span>.
          </p>
        </div>
        <div 
          className="self-start sm:self-auto px-3 py-1 rounded-xl border flex items-center gap-2 font-mono shrink-0"
          style={{ 
            backgroundColor: activeTheme.inputBg, 
            borderColor: activeTheme.border 
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: activeTheme.accent }}></span>
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: activeTheme.accent }}>
            Total Solved: {totalSolved}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {PLATFORMS.map((platform) => {
          const count = effectiveStats[platform.key] || 0;
          const hasCount = count > 0;
          const PlatformIconComponent = platform.icon;

          return (
            <div
              key={platform.key}
              title={`${platform.name}: ${count} solved`}
              className="flex items-center justify-between p-3.5 rounded-xl border transition-all duration-150"
              style={{
                backgroundColor: hasCount ? platform.bg : activeTheme.inputBg,
                borderColor: hasCount ? platform.border : activeTheme.border,
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 p-2"
                  style={{
                    backgroundColor: hasCount ? platform.bg : 'rgba(255,255,255,0.04)',
                    color: hasCount ? platform.color : activeTheme.text,
                    border: `1px solid ${hasCount ? platform.border : activeTheme.border}`,
                  }}
                >
                  <PlatformIconComponent className="w-5 h-5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span
                    className="text-xs font-bold truncate"
                    style={{
                      color: hasCount ? activeTheme.textHighlight : activeTheme.text,
                      opacity: hasCount ? 1 : 0.6,
                    }}
                  >
                    {platform.name}
                  </span>
                  <span className="text-[10px] font-mono opacity-40 uppercase tracking-wider">
                    {hasCount ? 'Active' : 'No Submissions'}
                  </span>
                </div>
              </div>
              <div className="flex items-baseline gap-1 pl-2 shrink-0">
                <span
                  className="text-sm font-black font-mono"
                  style={{
                    color: hasCount ? activeTheme.textHighlight : activeTheme.text,
                    opacity: hasCount ? 1 : 0.4,
                  }}
                >
                  {count}
                </span>
                <span className="text-[9px] font-mono opacity-40 uppercase">solved</span>
              </div>
            </div>
          );
        })}

        {/* Aggregate Summary Card (6th Card for perfect 2-column symmetry) */}
        <div
          className="flex items-center justify-between p-3.5 rounded-xl border transition-all duration-150"
          style={{
            backgroundColor: totalSolved > 0 ? 'rgba(16, 185, 129, 0.08)' : activeTheme.inputBg,
            borderColor: totalSolved > 0 ? 'rgba(16, 185, 129, 0.25)' : activeTheme.border,
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 p-2"
              style={{
                backgroundColor: totalSolved > 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.04)',
                color: activeTheme.accent,
                border: `1px solid ${totalSolved > 0 ? 'rgba(16, 185, 129, 0.3)' : activeTheme.border}`,
              }}
            >
              <AllPlatformsIcon className="w-5 h-5" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold truncate" style={{ color: activeTheme.textHighlight }}>
                Total Solutions
              </span>
              <span className="text-[10px] font-mono opacity-40 uppercase tracking-wider">
                5 Platforms
              </span>
            </div>
          </div>
          <div className="flex items-baseline gap-1 pl-2 shrink-0">
            <span className="text-sm font-black font-mono" style={{ color: activeTheme.accent }}>
              {totalSolved}
            </span>
            <span className="text-[9px] font-mono opacity-40 uppercase">total</span>
          </div>
        </div>
      </div>
    </div>
  );
};
