import { describe, it, expect } from 'vitest';
import { ReadmeGenerator } from '../index';
import { Problem, Submission } from '../../parser/types';

describe('ReadmeGenerator', () => {
  it('should generate a beautiful markdown string matching problem details', () => {
    const mockProblem: Problem = {
      id: 'two-sum',
      title: 'Two Sum',
      slug: 'two-sum',
      difficulty: 'Easy',
      description: 'Given an array of integers, return indices of the two numbers such that they add up to a specific target.',
      tags: ['Array', 'Hash Table'],
      url: 'https://leetcode.com/problems/two-sum/',
    };

    const mockSubmission: Submission = {
      id: 'sub_123456',
      problem: mockProblem,
      language: 'cpp',
      code: 'class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {}\n};',
      timestamp: 1783680000000, // May 2026
      status: 'ACCEPTED',
    };

    const result = ReadmeGenerator.generate(mockProblem, mockSubmission);

    // Verify metadata presence
    expect(result).toContain('# [Two Sum](https://leetcode.com/problems/two-sum/)');
    expect(result).toContain('**Difficulty:** <span style="color: #22c55e; font-weight: bold;">Easy</span>');
    expect(result).toContain('**Language:** `cpp`');
    expect(result).toContain('**Tags:** `Array`, `Hash Table`');
    
    // Verify description presence
    expect(result).toContain(mockProblem.description);
    
    // Verify solution block
    expect(result).toContain('```cpp');
    expect(result).toContain(mockSubmission.code);
  });
});
