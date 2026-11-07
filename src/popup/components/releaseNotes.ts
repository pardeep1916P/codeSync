export interface ReleaseHighlight {
  tag: string;
  title: string;
  description: string;
}

export const RELEASE_NOTES: Record<string, ReleaseHighlight[]> = {
  '1.3.0': [
    {
      tag: 'PLATFORMS',
      title: 'Multi-Platform Sync Expansion',
      description: 'Live submission detection for Codeforces and CodeChef with automated rating and difficulty normalization.',
    },
    {
      tag: 'METRICS',
      title: 'Unified Stats Aggregator',
      description: 'Integrated multi-platform statistics breakdown tracking solved problems across all supported competitive coding sites.',
    },
    {
      tag: 'PERMISSIONS',
      title: 'Expanded Platform Access',
      description: 'Added secure host permissions and content script bridges for HackerRank, GeeksforGeeks, and Codeforces.',
    },
  ],
  '1.2.2': [
    {
      tag: 'STABILITY',
      title: 'Storage Schema Migrations',
      description: 'Automated sequential migrations ensuring your settings and tokens stay safe across updates.',
    },
    {
      tag: 'EXPERIENCE',
      title: "What's New Release Notes",
      description: 'Instant visibility into new features and improvements after an extension upgrade.',
    },
    {
      tag: 'RELIABILITY',
      title: 'Dynamic Version Alignment',
      description: 'Synchronized manifest version detection across Chrome, Edge, and Brave browsers.',
    },
  ],
  '1.2.1': [
    {
      tag: 'SYNC',
      title: 'In-Repository Preference Sync',
      description: 'Cross-browser settings restoration via encoded codesync_state in stats.json.',
    },
    {
      tag: 'PLATFORM',
      title: 'CodeChef Support',
      description: 'Support for codechef.com with rating tiers and difficulty normalization.',
    },
  ],
};
