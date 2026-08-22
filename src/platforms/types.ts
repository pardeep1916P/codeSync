export type PlatformId = 'leetcode' | 'codeforces' | 'hackerrank' | 'geeksforgeeks' | 'neetcode';

export type Difficulty = 'Easy' | 'Medium' | 'Hard' | string;

export interface Problem {
  id: string;
  title: string;
  slug: string;
  difficulty: Difficulty;
  description: string;
  tags: string[];
  url: string;
  platform?: PlatformId;
}

export interface Submission {
  id: string;
  problem: Problem;
  language: string;
  code: string;
  timestamp: number;
  status: 'ACCEPTED' | 'FAILED' | 'PENDING';
  platform?: PlatformId;
}

export interface PlatformAdapter {
  readonly id: PlatformId;
  readonly name: string;
  readonly domainPatterns: RegExp[];
  
  matchesUrl(url: string): boolean;
  getFileExtension(language: string): string;
}
