import { describe, it, expect } from 'vitest';
import { updateReadmeTable, computeGitSha } from '../readmeTable';
import { Problem, Submission } from '../../parser/types';

describe('updateReadmeTable with topic categorization and Git SHA calculation', () => {
  const mockProblem: Problem = {
    id: '1',
    title: 'Two Sum',
    slug: 'two-sum',
    difficulty: 'Easy',
    description: 'Description',
    tags: ['Array', 'Hash Table'],
    url: 'https://leetcode.com/problems/two-sum/',
  };

  const mockSubmission: Submission = {
    id: 'sub_lc',
    problem: mockProblem,
    language: 'cpp',
    code: 'code',
    timestamp: 0,
    status: 'ACCEPTED',
  };

  it('should compute correct Git SHA-1', async () => {
    const content = 'hello world';
    const sha = await computeGitSha(content);
    // Git blob SHA-1 of "hello world" is 95d09f2b10159347eece71399a7e2e907ea3df4f
    expect(sha).toBe('95d09f2b10159347eece71399a7e2e907ea3df4f');
  });

  it('should initialize a README with tag headings and table', () => {
    const result = updateReadmeTable(null, mockProblem, mockSubmission);
    expect(result).toContain('# CodeSync Solutions');
    expect(result).toContain('## Array');
    expect(result).toContain('## Hash Table');
    expect(result).toContain('| # | Problem | Difficulty | Platform | Solution |');
    expect(result).toContain('| 1 | [Two Sum](https://leetcode.com/problems/two-sum/) | Easy | LeetCode #1 | [Solution](./two-sum/two-sum.cpp) |');
  });

  it('should append solutions under the correct topic heading', () => {
    const initialContent = `# CodeSync Solutions\n\n## Array\n\n| # | Problem | Difficulty | Platform | Solution |\n| :--- | :--- | :--- | :--- | :--- |\n| 1 | [Two Sum](https://leetcode.com/problems/two-sum/) | Easy | LeetCode #1 | [Solution](./two-sum/two-sum.cpp) |\n`;
    
    const secondProblem: Problem = {
      id: '217',
      title: 'Contains Duplicate',
      slug: 'contains-duplicate',
      difficulty: 'Easy',
      description: 'Desc',
      tags: ['Array'],
      url: 'https://leetcode.com/problems/contains-duplicate/',
    };
    
    const secondSubmission: Submission = {
      id: 'sub_lc_2',
      problem: secondProblem,
      language: 'java',
      code: 'code',
      timestamp: 0,
      status: 'ACCEPTED',
    };

    const result = updateReadmeTable(initialContent, secondProblem, secondSubmission);
    expect(result).toContain('## Array');
    expect(result).toContain('| 1 | [Two Sum]');
    expect(result).toContain('| 2 | [Contains Duplicate](https://leetcode.com/problems/contains-duplicate/) | Easy | LeetCode #217 | [Solution](./contains-duplicate/contains-duplicate.java) |');
  });

  it('should support multi-topic grouping for the same problem under all its tags', () => {
    const problem: Problem = {
      id: '226',
      title: 'Invert Binary Tree',
      slug: 'invert-binary-tree',
      difficulty: 'Easy',
      description: 'Desc',
      tags: ['Tree', 'Binary Tree'],
      url: 'https://leetcode.com/problems/invert-binary-tree/',
    };
    
    const submission: Submission = {
      id: 'sub_lc_3',
      problem,
      language: 'java',
      code: 'code',
      timestamp: 0,
      status: 'ACCEPTED',
    };

    const result = updateReadmeTable(null, problem, submission);
    expect(result).toContain('## Tree');
    expect(result).toContain('## Binary Tree');
    expect(result).toContain('| 1 | [Invert Binary Tree](https://leetcode.com/problems/invert-binary-tree/) | Easy | LeetCode #226 | [Solution](./invert-binary-tree/invert-binary-tree.java) |');
  });

  it('should not add duplicate problems in the same section', () => {
    const initialContent = `# CodeSync Solutions\n\n## Array\n\n| # | Problem | Difficulty | Platform | Solution |\n| :--- | :--- | :--- | :--- | :--- |\n| 1 | [Two Sum](https://leetcode.com/problems/two-sum/) | Easy | LeetCode #1 | [Solution](./two-sum/two-sum.cpp) |\n`;
    
    const result = updateReadmeTable(initialContent, mockProblem, mockSubmission);
    // Since mockProblem has 'Array' and 'Hash Table', and 'Array' already has 'Two Sum',
    // it will skip 'Array' but still append 'Hash Table' because it doesn't exist yet!
    expect(result).toContain('## Hash Table');
    expect(result).toContain('| 1 | [Two Sum]');
  });
});
