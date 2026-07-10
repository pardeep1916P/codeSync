import { describe, it, expect } from 'vitest';
import { updateReadmeTable } from '../readmeTable';
import { Problem, Submission } from '../../parser/types';

describe('updateReadmeTable with platform categorization', () => {
  const mockLeetCodeProblem: Problem = {
    id: '1',
    title: 'Two Sum',
    slug: 'two-sum',
    difficulty: 'Easy',
    description: 'Description',
    tags: [],
    url: 'https://leetcode.com/problems/two-sum/',
  };

  const mockLeetCodeSubmission: Submission = {
    id: 'sub_lc',
    problem: mockLeetCodeProblem,
    language: 'cpp',
    code: 'code',
    timestamp: 0,
    status: 'ACCEPTED',
  };

  const mockHackerRankProblem: Problem = {
    id: 'hr_1',
    title: 'Solve Me First',
    slug: 'solve-me-first',
    difficulty: 'Easy',
    description: 'Description',
    tags: [],
    url: 'https://www.hackerrank.com/challenges/solve-me-first/problem',
  };

  const mockHackerRankSubmission: Submission = {
    id: 'sub_hr',
    problem: mockHackerRankProblem,
    language: 'python',
    code: 'code',
    timestamp: 0,
    status: 'ACCEPTED',
  };

  it('should initialize a README with platform heading and table', () => {
    const result = updateReadmeTable(null, mockLeetCodeProblem, mockLeetCodeSubmission);
    expect(result).toContain('# CodeSync Solutions');
    expect(result).toContain('## LeetCode');
    expect(result).toContain('| # | Problem | Difficulty | Solution | Submission |');
    expect(result).toContain('| 1 | [Two Sum](https://leetcode.com/problems/two-sum/) | Easy | [Solution](./two-sum/two-sum.cpp) | [Submission](https://leetcode.com/problems/two-sum/) |');
  });

  it('should append solutions under the correct platform heading', () => {
    const initialContent = `# CodeSync Solutions\n\n## LeetCode\n\n| # | Problem | Difficulty | Solution | Submission |\n| :--- | :--- | :--- | :--- | :--- |\n| 1 | [Two Sum](https://leetcode.com/problems/two-sum/) | Easy | [Solution](./two-sum/two-sum.cpp) | [Submission](https://leetcode.com/problems/two-sum/) |\n`;
    
    const secondLCProblem: Problem = {
      id: '217',
      title: 'Contains Duplicate',
      slug: 'contains-duplicate',
      difficulty: 'Easy',
      description: 'Desc',
      tags: [],
      url: 'https://leetcode.com/problems/contains-duplicate/',
    };
    
    const secondLCSubmission: Submission = {
      id: 'sub_lc_2',
      problem: secondLCProblem,
      language: 'java',
      code: 'code',
      timestamp: 0,
      status: 'ACCEPTED',
    };

    const result = updateReadmeTable(initialContent, secondLCProblem, secondLCSubmission);
    expect(result).toContain('## LeetCode');
    expect(result).toContain('| 1 | [Two Sum]');
    expect(result).toContain('| 2 | [Contains Duplicate](https://leetcode.com/problems/contains-duplicate/) | Easy | [Solution](./contains-duplicate/contains-duplicate.java) | [Submission](https://leetcode.com/problems/contains-duplicate/) |');
  });

  it('should append a new platform heading and table if it does not exist', () => {
    const initialContent = `# CodeSync Solutions\n\n## LeetCode\n\n| # | Problem | Difficulty | Solution | Submission |\n| :--- | :--- | :--- | :--- | :--- |\n| 1 | [Two Sum](https://leetcode.com/problems/two-sum/) | Easy | [Solution](./two-sum/two-sum.cpp) | [Submission](https://leetcode.com/problems/two-sum/) |\n`;
    
    const result = updateReadmeTable(initialContent, mockHackerRankProblem, mockHackerRankSubmission);
    expect(result).toContain('## LeetCode');
    expect(result).toContain('## HackerRank');
    expect(result).toContain('| 1 | [Solve Me First](https://www.hackerrank.com/challenges/solve-me-first/problem) | Easy | [Solution](./solve-me-first/solve-me-first.py) | [Submission](https://www.hackerrank.com/challenges/solve-me-first/problem) |');
  });

  it('should not add duplicate problems in the same section', () => {
    const initialContent = `# CodeSync Solutions\n\n## LeetCode\n\n| # | Problem | Difficulty | Solution | Submission |\n| :--- | :--- | :--- | :--- | :--- |\n| 1 | [Two Sum](https://leetcode.com/problems/two-sum/) | Easy | [Solution](./two-sum/two-sum.cpp) | [Submission](https://leetcode.com/problems/two-sum/) |\n`;
    
    const result = updateReadmeTable(initialContent, mockLeetCodeProblem, mockLeetCodeSubmission);
    expect(result).toBe(initialContent);
  });
});
