export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export interface Problem {
  id: string;
  title: string;
  slug: string;
  difficulty: Difficulty;
  description: string; // Markdown or HTML description
  tags: string[];
  url: string;
}

export interface Submission {
  id: string;
  problem: Problem;
  language: string;
  code: string;
  timestamp: number;
  status: 'ACCEPTED' | 'FAILED' | 'PENDING';
}

export interface PlatformAdapter {
  platformName: string;
  domainPattern: RegExp;
  
  // Scrapes/detects if the current submission is accepted
  detectSubmission(): Promise<Submission | null>;
}
