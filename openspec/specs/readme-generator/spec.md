# README Generator Capability Specification

## Overview
CodeSync dynamically generates and maintains Markdown documentation for both the repository root and individual problem directories.

## Requirements

### Requirement: DSA Topic Category Tables
- The repository root `README.md` MUST group solved problems under H2 topic headings (`## <Topic Name>`).
- Every problem MUST be listed under ALL topic tags returned by LeetCode (e.g. `Array`, `Hash Table`, `Dynamic Programming`, `Tree`, `Graph`, etc.).
- Topic headings MUST be sorted alphabetically.

### Requirement: Dynamic Repository Heading
- The main H1 title heading of the root `README.md` MUST match the target repository name (e.g. `# DSA` for `pardeep1916P/DSA`).
- If an existing `README.md` uses `# LeetCode Solutions`, CodeSync MUST update the heading to match the target repository name.

### Requirement: Multi-Language Merging
- For the same problem solved in multiple languages (e.g. `C++`, `Java`, `Python`), the table cell for `Language` MUST merge and display sorted links to all language solution files.

### Requirement: Individual Problem README
- Each problem directory MUST contain a dedicated `README.md` with:
  1. Problem title link and difficulty badge (`Easy`, `Medium`, `Hard`).
  2. Problem description formatted in clean Markdown.
  3. Syntax-highlighted code blocks for each solved language.
