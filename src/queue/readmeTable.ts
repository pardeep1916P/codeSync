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
    : (globalThis as unknown as { crypto?: { subtle?: SubtleCrypto } }).crypto?.subtle;

  if (!subtleCrypto) {
    throw new Error('Web Crypto API (crypto.subtle) is not available in this environment.');
  }

  const hashBuffer = await subtleCrypto.digest('SHA-1', gitBlobBytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b: number) => b.toString(16).padStart(2, '0')).join('');
}

const DISPLAY_LANGUAGES: Record<string, string> = {
  cpp: 'C++',
  'c++': 'C++',
  java: 'Java',
  python: 'Python',
  python3: 'Python',
  py: 'Python',
  javascript: 'JavaScript',
  js: 'JavaScript',
  typescript: 'TypeScript',
  ts: 'TypeScript',
  golang: 'Go',
  go: 'Go',
  rust: 'Rust',
  rs: 'Rust',
  c: 'C',
  csharp: 'C#',
  'c#': 'C#',
  ruby: 'Ruby',
  rb: 'Ruby',
  swift: 'Swift',
  kotlin: 'Kotlin',
  kt: 'Kotlin',
  scala: 'Scala',
  php: 'PHP',
  sql: 'SQL',
  mysql: 'MySQL'
};

function getLanguageDisplayName(lang: string): string {
  const clean = lang.toLowerCase().trim();
  return DISPLAY_LANGUAGES[clean] || lang;
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
  const langDisplayName = getLanguageDisplayName(submission.language);

  let content = existingContent || `# LeetCode Solutions\n`;
  if (!content.endsWith('\n')) {
    content += '\n';
  }

  const tags = problem.tags && problem.tags.length > 0 ? problem.tags : ['General'];

  // Parse existing content into prefix and sections
  const lines = content.split('\n');
  const prefixLines: string[] = [];
  interface Section {
    heading: string;
    title: string;
    lines: string[];
  }
  const sections: Section[] = [];
  let currentSection: Section | null = null;

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = {
        heading: line,
        title: line.replace('## ', '').trim(),
        lines: []
      };
    } else if (currentSection) {
      currentSection.lines.push(line);
    } else {
      prefixLines.push(line);
    }
  }
  if (currentSection) {
    sections.push(currentSection);
  }

  // Helper to parse language links from a cell/column
  function parseLanguageLinks(cellContent: string): { name: string; href: string }[] {
    const links: { name: string; href: string }[] = [];
    const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let m;
    while ((m = regex.exec(cellContent)) !== null) {
      links.push({ name: m[1], href: m[2] });
    }
    return links;
  }

  // Helper to format language links
  function formatLanguageLinks(links: { name: string; href: string }[]): string {
    return links
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(link => `[${link.name}](${link.href})`)
      .join(', ');
  }

  for (const tag of tags) {
    const sectionHeader = `## ${tag}`;
    const header = `| # | Problem | Platform | Language |`;
    const separator = `| :--- | :--- | :--- | :--- |`;
    const targetPattern = `[${problem.title}]`;

    let section = sections.find(s => s.title.toLowerCase() === tag.toLowerCase());

    if (!section) {
      // Create new section
      const sectionLines = [
        '',
        header,
        separator,
        `| 1 | [${problem.title}](${problemUrl}) | ${platform} #${problem.id} | [${langDisplayName}](${solutionPath}) |`,
        ''
      ];
      section = {
        heading: sectionHeader,
        title: tag,
        lines: sectionLines
      };
      sections.push(section);
      continue;
    }

    // Section exists. Search for the table and update or append.
    let tableStartIndex = -1;
    for (let i = 0; i < section.lines.length; i++) {
      const line = section.lines[i].trim();
      if (line.includes('| # | Problem |')) {
        tableStartIndex = i;
        break;
      }
    }

    if (tableStartIndex === -1) {
      // Table doesn't exist in section. Insert one.
      const newTable = [
        header,
        separator,
        `| 1 | [${problem.title}](${problemUrl}) | ${platform} #${problem.id} | [${langDisplayName}](${solutionPath}) |`,
        ''
      ];
      section.lines.push(...newTable);
      continue;
    }

    // Find table end
    let lastRowIndex = tableStartIndex + 1;
    while (lastRowIndex + 1 < section.lines.length && section.lines[lastRowIndex + 1].trim().startsWith('|')) {
      lastRowIndex++;
    }

    // Check if the problem already exists in this table
    let problemRowIndex = -1;
    let maxIndex = 0;

    for (let i = tableStartIndex + 2; i <= lastRowIndex; i++) {
      const line = section.lines[i];
      if (line.includes(targetPattern)) {
        problemRowIndex = i;
      }
      const match = line.match(/^\|\s*(\d+)\s*\|/);
      if (match) {
        const idx = parseInt(match[1], 10);
        if (idx > maxIndex) {
          maxIndex = idx;
        }
      }
    }

    if (problemRowIndex !== -1) {
      // Row exists! Parse and update the Language column.
      const line = section.lines[problemRowIndex];
      const parts = line.split('|');
      if (parts.length >= 5) {
        const existingLinks = parseLanguageLinks(parts[4]);
        const exists = existingLinks.some(l => l.name.toLowerCase() === langDisplayName.toLowerCase());
        if (!exists) {
          existingLinks.push({ name: langDisplayName, href: solutionPath });
        } else {
          const idx = existingLinks.findIndex(l => l.name.toLowerCase() === langDisplayName.toLowerCase());
          existingLinks[idx].href = solutionPath;
        }
        parts[4] = ` ${formatLanguageLinks(existingLinks)} `;
        section.lines[problemRowIndex] = parts.join('|');
      }
    } else {
      // Row doesn't exist, append new row to table
      const nextIndex = maxIndex + 1;
      const newRow = `| ${nextIndex} | [${problem.title}](${problemUrl}) | ${platform} #${problem.id} | [${langDisplayName}](${solutionPath}) |`;
      section.lines.splice(lastRowIndex + 1, 0, newRow);
    }
  }

  // Sort sections alphabetically by title
  sections.sort((a, b) => a.title.localeCompare(b.title));

  // Rebuild the final content
  const cleanPrefixLines = prefixLines.filter(line => !line.includes('Synced automatically using') && line.trim() !== '---');

  let finalContent = cleanPrefixLines.join('\n').trimEnd();
  if (finalContent) {
    finalContent += '\n\n';
  }

  for (const s of sections) {
    const cleanLines = s.lines.filter(line => !line.includes('Synced automatically using') && line.trim() !== '---');
    finalContent += s.heading + '\n';
    finalContent += cleanLines.join('\n').trimEnd() + '\n\n';
  }

  finalContent = finalContent.trimEnd() + '\n\n---\n*Synced automatically using [CodeSync](https://github.com/pardeep1916P/codeSync).*\n';
  return finalContent;
}
