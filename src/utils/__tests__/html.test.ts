import { describe, it, expect } from 'vitest';
import { htmlToMarkdown } from '../html';

describe('htmlToMarkdown', () => {
  it('converts basic tags to markdown equivalents', () => {
    const html = '<p><strong>Bold</strong> and <em>Italic</em> and <code>code</code></p>';
    const md = htmlToMarkdown(html);
    expect(md).toContain('**Bold**');
    expect(md).toContain('_Italic_');
    expect(md).toContain('`code`');
  });

  it('handles preformatted code blocks cleanly', () => {
    const html = '<pre><span>function solve() { return true; }</span></pre>';
    const md = htmlToMarkdown(html);
    expect(md).toContain('```\nfunction solve() { return true; }\n```');
  });

  it('handles headers and lists', () => {
    const html = '<h3>Example 1</h3><ul><li>Item 1</li><li>Item 2</li></ul>';
    const md = htmlToMarkdown(html);
    expect(md).toContain('### Example 1');
    expect(md).toContain('- Item 1');
    expect(md).toContain('- Item 2');
  });

  it('handles math superscripts and subscripts', () => {
    const html = '<p>10<sup>5</sup> and a<sub>i</sub></p>';
    const md = htmlToMarkdown(html);
    expect(md).toContain('10^5');
    expect(md).toContain('a_i');
  });

  it('handles image tags with relative and absolute urls', () => {
    const html = '<img src="/assets/img.png" alt="Example Diagram" />';
    const md = htmlToMarkdown(html);
    expect(md).toBe('![Example Diagram](https://leetcode.com/assets/img.png)');
  });

  it('handles empty or blank string gracefully', () => {
    expect(htmlToMarkdown('')).toBe('');
  });
});
