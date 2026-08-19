/**
 * Unified language utilities for CodeSync.
 * Provides canonical file extensions, human-readable display names,
 * and markdown syntax highlighting identifiers across all supported languages.
 */

const DISPLAY_LANGUAGES: Record<string, string> = {
  cpp: 'C++',
  'c++': 'C++',
  c: 'C',
  clang: 'C',
  csharp: 'C#',
  cs: 'C#',
  'c#': 'C#',
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
  ruby: 'Ruby',
  rb: 'Ruby',
  swift: 'Swift',
  kotlin: 'Kotlin',
  kt: 'Kotlin',
  scala: 'Scala',
  php: 'PHP',
  dart: 'Dart',
  racket: 'Racket',
  rkt: 'Racket',
  elixir: 'Elixir',
  ex: 'Elixir',
  erlang: 'Erlang',
  erl: 'Erlang',
  sql: 'SQL',
  mysql: 'MySQL',
  postgresql: 'PostgreSQL',
  oracle: 'Oracle',
  r: 'R',
  bash: 'Bash',
  sh: 'Bash',
};

/**
 * Returns the human-readable display name for a programming language.
 */
export function getLanguageDisplayName(language: string): string {
  if (!language) return 'Unknown';
  const clean = language.toLowerCase().trim();
  return DISPLAY_LANGUAGES[clean] || language;
}

/**
 * Resolves the appropriate file extension for a submission's programming language.
 */
export function getFileExtension(language: string): string {
  const lang = (language || '').toLowerCase().trim();
  if (lang.includes('c++') || lang === 'cpp') return 'cpp';
  if (lang === 'c' || lang.startsWith('c ') || lang === 'clang') return 'c';
  if (lang.includes('csharp') || lang === 'cs' || lang === 'c#') return 'cs';
  if (lang.includes('javascript') || lang === 'js') return 'js';
  if (lang.includes('typescript') || lang === 'ts') return 'ts';
  if (lang.includes('python') || lang === 'py') return 'py';
  if (lang.includes('java')) return 'java';
  if (lang.includes('kotlin') || lang === 'kt') return 'kt';
  if (lang.includes('swift')) return 'swift';
  if (lang.includes('go') || lang === 'golang') return 'go';
  if (lang.includes('rust') || lang === 'rs') return 'rs';
  if (lang.includes('ruby') || lang === 'rb') return 'rb';
  if (lang.includes('scala')) return 'scala';
  if (lang.includes('php')) return 'php';
  if (lang.includes('dart')) return 'dart';
  if (lang.includes('racket') || lang === 'rkt') return 'rkt';
  if (lang.includes('elixir') || lang === 'ex') return 'ex';
  if (lang.includes('erlang') || lang === 'erl') return 'erl';
  if (lang.includes('sql') || lang.includes('mysql') || lang.includes('postgresql') || lang.includes('oracle')) return 'sql';
  if (lang === 'r') return 'r';
  if (lang.includes('bash') || lang === 'sh') return 'sh';
  return 'txt';
}

/**
 * Resolves the markdown code fence identifier (e.g. ```typescript).
 */
export function getMarkdownLanguage(language: string): string {
  const lang = (language || '').toLowerCase().trim();
  if (lang.includes('c++') || lang === 'cpp') return 'cpp';
  if (lang === 'c' || lang === 'clang') return 'c';
  if (lang.includes('csharp') || lang === 'cs' || lang === 'c#') return 'csharp';
  if (lang.includes('javascript') || lang === 'js') return 'javascript';
  if (lang.includes('typescript') || lang === 'ts') return 'typescript';
  if (lang.includes('python') || lang === 'py' || lang === 'python3') return 'python';
  if (lang.includes('java')) return 'java';
  if (lang.includes('kotlin') || lang === 'kt') return 'kotlin';
  if (lang.includes('swift')) return 'swift';
  if (lang.includes('go') || lang === 'golang') return 'go';
  if (lang.includes('rust') || lang === 'rs') return 'rust';
  if (lang.includes('ruby') || lang === 'rb') return 'ruby';
  if (lang.includes('scala')) return 'scala';
  if (lang.includes('php')) return 'php';
  if (lang.includes('dart')) return 'dart';
  if (lang.includes('racket') || lang === 'rkt') return 'racket';
  if (lang.includes('elixir') || lang === 'ex') return 'elixir';
  if (lang.includes('erlang') || lang === 'erl') return 'erlang';
  if (lang.includes('sql') || lang.includes('mysql') || lang.includes('postgresql') || lang.includes('oracle')) return 'sql';
  if (lang === 'r') return 'r';
  if (lang.includes('bash') || lang === 'sh') return 'bash';
  return lang;
}
