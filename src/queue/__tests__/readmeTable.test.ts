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

  it('should initialize a README with tag headings and table sorted alphabetically', () => {
    const result = updateReadmeTable(null, mockProblem, mockSubmission);
    expect(result).toContain('# CodeSync Solutions');
    
    // Verify alphabetical sorting of sections
    const arrayIndex = result.indexOf('## Array');
    const hashTableIndex = result.indexOf('## Hash Table');
    expect(arrayIndex).toBeGreaterThan(-1);
    expect(hashTableIndex).toBeGreaterThan(-1);
    expect(arrayIndex).toBeLessThan(hashTableIndex);

    // Verify correct headers and language link
    expect(result).toContain('| # | Problem | Platform | Language |');
    expect(result).toContain('| 1 | [Two Sum](https://leetcode.com/problems/two-sum/) | LeetCode #1 | [C++](./two-sum/two-sum.cpp) |');
  });

  it('should append solutions under the correct topic heading', () => {
    const initialContent = `# CodeSync Solutions\n\n## Array\n\n| # | Problem | Platform | Language |\n| :--- | :--- | :--- | :--- |\n| 1 | [Two Sum](https://leetcode.com/problems/two-sum/) | LeetCode #1 | [C++](./two-sum/two-sum.cpp) |\n`;
    
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
    expect(result).toContain('| 2 | [Contains Duplicate](https://leetcode.com/problems/contains-duplicate/) | LeetCode #217 | [Java](./contains-duplicate/contains-duplicate.java) |');
  });

  it('should merge multi-language links alphabetically for the same problem', () => {
    const initialContent = `# CodeSync Solutions\n\n## Array\n\n| # | Problem | Platform | Language |\n| :--- | :--- | :--- | :--- |\n| 1 | [Two Sum](https://leetcode.com/problems/two-sum/) | LeetCode #1 | [C++](./two-sum/two-sum.cpp) |\n`;
    
    const javaSubmission: Submission = {
      id: 'sub_lc_java',
      problem: mockProblem,
      language: 'java',
      code: 'java code',
      timestamp: 0,
      status: 'ACCEPTED',
    };

    const result = updateReadmeTable(initialContent, mockProblem, javaSubmission);
    expect(result).toContain('| 1 | [Two Sum](https://leetcode.com/problems/two-sum/) | LeetCode #1 | [C++](./two-sum/two-sum.cpp), [Java](./two-sum/two-sum.java) |');
  });

  it('should sort multi-language links alphabetically even if added in reverse order', () => {
    const initialContent = `# CodeSync Solutions\n\n## Array\n\n| # | Problem | Platform | Language |\n| :--- | :--- | :--- | :--- |\n| 1 | [Two Sum](https://leetcode.com/problems/two-sum/) | LeetCode #1 | [Java](./two-sum/two-sum.java) |\n`;
    
    const cppSubmission: Submission = {
      id: 'sub_lc_cpp',
      problem: mockProblem,
      language: 'cpp',
      code: 'cpp code',
      timestamp: 0,
      status: 'ACCEPTED',
    };

    const result = updateReadmeTable(initialContent, mockProblem, cppSubmission);
    expect(result).toContain('| 1 | [Two Sum](https://leetcode.com/problems/two-sum/) | LeetCode #1 | [C++](./two-sum/two-sum.cpp), [Java](./two-sum/two-sum.java) |');
  });
});
