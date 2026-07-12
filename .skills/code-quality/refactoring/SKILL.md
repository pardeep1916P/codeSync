---
name: refactoring
description: Refactoring guidelines, code simplification rules, dead code elimination, and modular design patterns in CodeSync.
---

# Refactoring — Guidelines & Modular Simplification

## Purpose & Scope
This skill details safe programming practices for refactoring CodeSync. It guides developers on simplifying functions, decoupling modules, and ensuring regressions are not introduced.

## Decision Tree
```
Need to refactor?
├─ Are there automated tests coverage?
│  ├─ No → Write unit/integration tests first!
│  └─ Yes → Proceed with refactoring
├─ Break down large functions?
│  ├─ Extract single-concern utilities
│  └─ Separate asynchronous and synchronous paths
└─ Verification?
   └─ Run Vitest and ESLint immediately after each small modification step
```

## Implementation Patterns
### Simplifying Large Functions
Decouple logic into discrete units:
```typescript
// BEFORE: Monolithic function doing details retrieval + formatting + writing
async function handleAccepted(id: string) {
  const details = await fetchDetails(id);
  const formatted = `# ${details.title}\n${details.code}`;
  await write(formatted);
}

// AFTER: Separated duties
async function handleAccepted(id: string) {
  const details = await fetchDetails(id);
  const formatted = formatProblemDetails(details);
  await saveSolution(formatted);
}
```

## Checklists
- [ ] Ensure Vitest tests pass before starting modifications.
- [ ] No behavioral or structural regressions are introduced.
- [ ] Simplify control flows by avoiding nested loops.

## References
- [Refactoring Guide Catalog](https://refactoring.com/)
- [Modular Programming Rules](https://en.wikipedia.org/wiki/Modular_programming)
