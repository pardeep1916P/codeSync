---
name: problem-parser
description: LeetCode problem metadata extraction, difficulty classification, topic tagging, and slug normalization for CodeSync.
---

# Problem Parser — Metadata Extraction & Classification

## Purpose & Scope

Use this skill when extracting problem metadata from LeetCode submissions, normalizing problem slugs, or classifying problems by difficulty/topic.

---

## Implementation Patterns

### Pattern 1: Problem Metadata Extraction

```typescript
interface ProblemMetadata {
  title: string;
  titleSlug: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  questionId: string;
  topicTags: Array<{ name: string; slug: string }>;
  categoryTitle: string;
}

function extractProblemMetadata(submissionDetails: any): ProblemMetadata {
  const q = submissionDetails.question;
  return {
    title: q.title || 'Unknown Problem',
    titleSlug: q.titleSlug || slugify(q.title || 'unknown'),
    difficulty: normalizeDifficulty(q.difficulty),
    questionId: String(q.questionId || ''),
    topicTags: (q.topicTags || []).map((t: any) => ({ name: t.name, slug: t.slug })),
    categoryTitle: q.categoryTitle || 'algorithms',
  };
}

function normalizeDifficulty(raw: string): 'Easy' | 'Medium' | 'Hard' {
  const d = raw?.toLowerCase().trim();
  if (d === 'easy') return 'Easy';
  if (d === 'medium') return 'Medium';
  if (d === 'hard') return 'Hard';
  return 'Medium'; // Default
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}
```

### Pattern 2: Language Detection & Extension Mapping

```typescript
const LANGUAGE_MAP: Record<string, { extension: string; display: string }> = {
  'c++': { extension: 'cpp', display: 'C++' },
  'java': { extension: 'java', display: 'Java' },
  'python': { extension: 'py', display: 'Python' },
  'python3': { extension: 'py', display: 'Python3' },
  'javascript': { extension: 'js', display: 'JavaScript' },
  'typescript': { extension: 'ts', display: 'TypeScript' },
  'go': { extension: 'go', display: 'Go' },
  'rust': { extension: 'rs', display: 'Rust' },
  'c#': { extension: 'cs', display: 'C#' },
  'c': { extension: 'c', display: 'C' },
  'ruby': { extension: 'rb', display: 'Ruby' },
  'swift': { extension: 'swift', display: 'Swift' },
  'kotlin': { extension: 'kt', display: 'Kotlin' },
  'scala': { extension: 'scala', display: 'Scala' },
  'php': { extension: 'php', display: 'PHP' },
  'dart': { extension: 'dart', display: 'Dart' },
};

function getLanguageInfo(rawLang: string): { extension: string; display: string } {
  const key = rawLang.toLowerCase().trim();
  return LANGUAGE_MAP[key] || { extension: 'txt', display: rawLang };
}
```

---

## References

- [LeetCode Problem Categories](https://leetcode.com/problemset/)
