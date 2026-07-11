---
name: commit-standards
description: Git commit message conventions, atomic commit strategies, and changelog generation for CodeSync extension development.
---

# Commit Standards — Message Conventions & Atomic Commits

## Purpose & Scope

Use this skill when writing commit messages for CodeSync development or generating commit messages for synced LeetCode solutions.

---

## Commit Message Format

### Development Commits (Conventional Commits)

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

| Type | Use Case | Example |
|------|----------|---------|
| `feat` | New feature | `feat(sync): add instant sync toggle` |
| `fix` | Bug fix | `fix(queue): resolve duplicate submission race condition` |
| `docs` | Documentation | `docs: update README with Phase 1 features` |
| `style` | Formatting only | `style(popup): fix toggle alignment` |
| `refactor` | Code change (no feature/fix) | `refactor(storage): extract defaults merge helper` |
| `test` | Adding/fixing tests | `test(queue): add deduplication unit tests` |
| `chore` | Build, CI, tooling | `chore: update .gitignore` |
| `perf` | Performance | `perf(popup): implement two-phase cached loading` |

### Scopes for CodeSync

| Scope | Directory | Description |
|-------|-----------|-------------|
| `sync` | src/queue/ | Queue processing and GitHub sync |
| `content` | src/content/ | Content script and network interception |
| `popup` | src/popup/ | Popup dashboard UI |
| `options` | src/options/ | Options/settings page |
| `storage` | src/storage/ | Chrome storage layer |
| `store` | src/store/ | Zustand state management |
| `github` | src/github/ | GitHub API client |
| `theme` | src/styles/ | Theme system |
| `build` | vite.config.ts | Build configuration |

### Synced Solution Commits

```
feat(solve): {Problem Title}

Difficulty: {Easy|Medium|Hard}
Language: {Language}
Platform: LeetCode
```

---

## Implementation Patterns

### Pattern: Commit Message Generator

```typescript
function generateCommitMessage(submission: SubmissionData, prefix?: string): string {
  const { problem, language } = submission;
  const p = prefix || 'feat(solve):';
  
  const subject = `${p} ${problem.title}`;
  const body = [
    '',
    `Difficulty: ${problem.difficulty}`,
    `Language: ${language}`,
    `Platform: LeetCode`,
    `Solved: ${new Date(submission.timestamp).toISOString().split('T')[0]}`,
  ].join('\n');
  
  return subject + '\n' + body;
}
```

---

## Checklists

### Commit Message Checklist

- [ ] Subject line ≤72 characters
- [ ] Type is from the allowed list
- [ ] Scope matches the affected module
- [ ] Subject uses imperative mood ("add" not "added")
- [ ] No period at end of subject line
- [ ] Body explains WHY, not just WHAT
- [ ] Breaking changes noted with `BREAKING CHANGE:` footer
- [ ] Each commit is atomic (one logical change)

---

## References

- [Conventional Commits](https://www.conventionalcommits.org/)
- [How to Write a Git Commit Message](https://cbea.ms/git-commit/)
