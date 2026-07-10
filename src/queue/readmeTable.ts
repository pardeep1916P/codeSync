import { Problem, Submission } from '../parser/types';

export function getFileExtension(language: string): string {
  const lang = language.toLowerCase().trim();
  if (lang.includes('c++') || lang === 'cpp') return 'cpp';
  if (lang.includes('javascript') || lang === 'js') return 'js';
  if (lang.includes('typescript') || lang === 'ts') return 'ts';
  if (lang.includes('python') || lang === 'py') return 'py';
  if (lang.includes('java')) return 'java';
  if (lang.includes('go') || lang === 'golang') return 'go';
  if (lang.includes('rust') || lang === 'rs') return 'rs';
  if (lang.includes('csharp') || lang === 'cs' || lang === 'c#') return 'cs';
  return 'txt';
}

export function getPlatformName(url: string): string {
  const lowercaseUrl = url.toLowerCase();
  if (lowercaseUrl.includes('leetcode.com')) return 'LeetCode';
  if (lowercaseUrl.includes('hackerrank.com')) return 'HackerRank';
  return 'LeetCode'; // default fallback
}

export function updateReadmeTable(
  existingContent: string | null,
  problem: Problem,
  submission: Submission
): string {
  const platform = getPlatformName(problem.url);
  const fileExt = getFileExtension(submission.language);
  const solutionPath = `./${problem.slug}/${problem.slug}.${fileExt}`;
  const problemUrl = problem.url || `https://leetcode.com/problems/${problem.slug}/`;

  const header = `| # | Problem | Difficulty | Solution | Submission |`;
  const separator = `| :--- | :--- | :--- | :--- | :--- |`;

  // Base template if README is completely empty
  if (!existingContent) {
    let base = `# CodeSync Solutions\n\nMy coding solutions synced automatically using CodeSync.\n\n`;
    base += `## ${platform}\n\n`;
    base += `${header}\n${separator}\n`;
    base += `| 1 | [${problem.title}](${problemUrl}) | ${problem.difficulty} | [Solution](${solutionPath}) | [Submission](${problemUrl}) |\n`;
    return base;
  }

  const lines = existingContent.split('\n');
  const sectionHeader = `## ${platform}`;
  
  // Find the platform heading index
  const headingIndex = lines.findIndex(line => line.trim().toLowerCase() === sectionHeader.toLowerCase());

  if (headingIndex === -1) {
    // Platform section does not exist. Append it at the end.
    let appendStr = `\n\n${sectionHeader}\n\n`;
    appendStr += `${header}\n${separator}\n`;
    appendStr += `| 1 | [${problem.title}](${problemUrl}) | ${problem.difficulty} | [Solution](${solutionPath}) | [Submission](${problemUrl}) |\n`;
    return existingContent.trimEnd() + appendStr;
  }

  // Find the table within this platform section (before the next section header)
  let tableStartIndex = -1;
  let nextSectionIndex = lines.length;

  for (let i = headingIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('#')) {
      nextSectionIndex = i;
      break;
    }
    if (line.includes('| # | Problem |') && tableStartIndex === -1) {
      tableStartIndex = i;
    }
  }

  if (tableStartIndex === -1 || tableStartIndex >= nextSectionIndex) {
    // Heading exists but table doesn't. Insert it right after the heading.
    const newTableLines = [
      '',
      header,
      separator,
      `| 1 | [${problem.title}](${problemUrl}) | ${problem.difficulty} | [Solution](${solutionPath}) | [Submission](${problemUrl}) |`,
      ''
    ];
    lines.splice(headingIndex + 1, 0, ...newTableLines);
    return lines.join('\n');
  }

  // Find the end of the table
  let lastRowIndex = tableStartIndex + 1;
  while (lastRowIndex + 1 < nextSectionIndex && lines[lastRowIndex + 1].trim().startsWith('|')) {
    lastRowIndex++;
  }

  // Parse table rows to check for duplicates and find the last index number
  let maxIndex = 0;
  let alreadyExists = false;
  const targetPattern = `[${problem.title}]`;

  for (let i = tableStartIndex + 2; i <= lastRowIndex; i++) {
    const line = lines[i];
    if (line.includes(targetPattern)) {
      alreadyExists = true;
      break;
    }
    const match = line.match(/^\|\s*(\d+)\s*\|/);
    if (match) {
      const idx = parseInt(match[1], 10);
      if (idx > maxIndex) {
        maxIndex = idx;
      }
    }
  }

  if (alreadyExists) {
    return existingContent; // Problem is already in the table
  }

  const nextIndex = maxIndex + 1;
  const newRow = `| ${nextIndex} | [${problem.title}](${problemUrl}) | ${problem.difficulty} | [Solution](${solutionPath}) | [Submission](${problemUrl}) |`;
  
  lines.splice(lastRowIndex + 1, 0, newRow);
  return lines.join('\n');
}
