/**
 * Converts LeetCode problem HTML description to clean GitHub Markdown.
 */
export function htmlToMarkdown(html: string): string {
  if (!html) return '';

  let text = html;

  // Math notation: sup and sub
  text = text.replace(/<sup>([^<]+)<\/sup>/g, '^$1');
  text = text.replace(/<sub>([^<]+)<\/sub>/g, '_$1');

  // Code blocks (Run early so we don't convert tags inside pre blocks to markdown formatting)
  text = text.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/g, (_, code) => {
    // Strip inner HTML tags from preformatted text so it looks clean inside the code block
    const cleanCode = code.replace(/<[^>]*>/g, '');
    return `\n\`\`\`\n${cleanCode}\n\`\`\`\n`;
  });

  // Headers
  text = text.replace(/<h[1-6]>(.*?)<\/h[1-6]>/g, '### $1\n');

  // Bold/Italics
  text = text.replace(/<strong[^>]*>(.*?)<\/strong>/g, '**$1**');
  text = text.replace(/<em[^>]*>(.*?)<\/em>/g, '_$1_');
  text = text.replace(/<b[^>]*>(.*?)<\/b>/g, '**$1**');
  text = text.replace(/<i[^>]*>(.*?)<\/i>/g, '_$1_');

  // Inline code
  text = text.replace(/<code[^>]*>(.*?)<\/code>/g, '`$1`');

  // Paragraphs and breaks
  text = text.replace(/<p[^>]*>/g, '');
  text = text.replace(/<\/p>/g, '\n\n');
  text = text.replace(/<br\s*\/?>/g, '\n');

  // Lists
  text = text.replace(/<ul[^>]*>/g, '\n');
  text = text.replace(/<\/ul>/g, '\n');
  text = text.replace(/<ol[^>]*>/g, '\n');
  text = text.replace(/<\/ol>/g, '\n');
  text = text.replace(/<li[^>]*>(.*?)<\/li>/g, '- $1\n');

  // Images
  text = text.replace(/<img[^>]*src=["']([^"']+)["'][^>]*>/g, (match, src) => {
    const absoluteSrc = src.startsWith('/') ? `https://leetcode.com${src}` : src;
    const altMatch = match.match(/alt=["']([^"']+)["']/);
    const alt = altMatch ? altMatch[1] : 'image';
    return `![${alt}](${absoluteSrc})`;
  });

  // Clean up remaining tags, entities, and whitespace
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/<[^>]*>/g, '') // strip any other remaining tags
    .replace(/\n{3,}/g, '\n\n') // collapse multiple newlines
    .trim();

  return text;
}
