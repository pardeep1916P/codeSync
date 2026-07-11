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

/**
 * Computes the Git SHA-1 of a string content.
 * Follows the standard Git blob format: sha1("blob <size>\0<content>")
 */
export async function computeGitSha(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const contentBytes = encoder.encode(content);
  const headerBytes = encoder.encode(`blob ${contentBytes.length}\0`);
  
  const gitBlobBytes = new Uint8Array(headerBytes.length + contentBytes.length);
  gitBlobBytes.set(headerBytes, 0);
  gitBlobBytes.set(contentBytes, headerBytes.length);

  const subtleCrypto = typeof crypto !== 'undefined' && crypto.subtle 
    ? crypto.subtle 
    : (globalThis as any).crypto?.subtle;

  if (!subtleCrypto) {
    throw new Error('Web Crypto API (crypto.subtle) is not available in this environment.');
  }

  const hashBuffer = await subtleCrypto.digest('SHA-1', gitBlobBytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b: any) => b.toString(16).padStart(2, '0')).join('');
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

  let content = existingContent || `# CodeSync Solutions\n\nMy coding solutions synced automatically using CodeSync.\n`;
  if (!content.endsWith('\n')) {
    content += '\n';
  }

  const tags = problem.tags && problem.tags.length > 0 ? problem.tags : ['General'];

  for (const tag of tags) {
    const sectionHeader = `## ${tag}`;
    const header = `| # | Problem | Platform | Solution |`;
    const separator = `| :--- | :--- | :--- | :--- |`;
    const targetPattern = `[${problem.title}]`;

    const lines = content.split('\n');
    const headingIndex = lines.findIndex(line => line.trim().toLowerCase() === sectionHeader.toLowerCase());

    if (headingIndex === -1) {
      // Create section at the end
      let appendStr = `\n${sectionHeader}\n\n`;
      appendStr += `${header}\n${separator}\n`;
      appendStr += `| 1 | [${problem.title}](${problemUrl}) | ${platform} #${problem.id} | [Solution](${solutionPath}) |\n`;
      content = lines.join('\n').trimEnd() + appendStr;
      continue;
    }

    // Section exists, find table start and next section start
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
      // Table doesn't exist under heading. Insert it.
      const newTableLines = [
        '',
        header,
        separator,
        `| 1 | [${problem.title}](${problemUrl}) | ${platform} #${problem.id} | [Solution](${solutionPath}) |`,
        ''
      ];
      lines.splice(headingIndex + 1, 0, ...newTableLines);
      content = lines.join('\n');
      continue;
    }

    // Table exists, find last row
    let lastRowIndex = tableStartIndex + 1;
    while (lastRowIndex + 1 < nextSectionIndex && lines[lastRowIndex + 1].trim().startsWith('|')) {
      lastRowIndex++;
    }

    // Check for duplicates in this specific table
    let alreadyExists = false;
    let maxIndex = 0;

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
      continue; // Skip this category
    }

    const nextIndex = maxIndex + 1;
    const newRow = `| ${nextIndex} | [${problem.title}](${problemUrl}) | ${platform} #${problem.id} | [Solution](${solutionPath}) |`;
    
    lines.splice(lastRowIndex + 1, 0, newRow);
    content = lines.join('\n');
  }

  return content;
}
