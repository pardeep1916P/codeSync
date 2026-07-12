import { describe, it, expect } from 'vitest';
import { LeetCodeAdapter } from '../leetcode';

describe('LeetCodeAdapter htmlToMarkdown', () => {
  const adapter = new LeetCodeAdapter();

  it('should handle basic formatting and paragraphs', () => {
    const html = '<p>Hello <strong>World</strong>!</p><p>This is <em>italic</em> and <b>bold</b>.</p>';
    const md = adapter.htmlToMarkdown(html);
    expect(md).toBe('Hello **World**!\n\nThis is _italic_ and **bold**.');
  });

  it('should parse math superscripts and subscripts', () => {
    const html = '<p>Constraints: 10<sup>9</sup> + <sub>i</sub></p>';
    const md = adapter.htmlToMarkdown(html);
    expect(md).toBe('Constraints: 10^9 + _i');
  });

  it('should format code blocks and strip nested html tags from them', () => {
    const html = '<pre><strong>Input:</strong> x = 5\n<strong>Output:</strong> 10</pre>';
    const md = adapter.htmlToMarkdown(html);
    expect(md).toBe('```\nInput: x = 5\nOutput: 10\n```');
  });

  it('should parse inline code and lists correctly', () => {
    const html = '<p>Use <code>func()</code>.</p><ul><li>First</li><li>Second</li></ul>';
    const md = adapter.htmlToMarkdown(html);
    expect(md).toBe('Use `func()`.\n\n- First\n- Second');
  });

  it('should convert relative image URLs to absolute ones', () => {
    const html = '<img src="/uploads/2021/01/18/path.jpg" alt="Tree Diagram" />';
    const md = adapter.htmlToMarkdown(html);
    expect(md).toBe('![Tree Diagram](https://leetcode.com/uploads/2021/01/18/path.jpg)');
  });

  it('should leave absolute image URLs untouched', () => {
    const html = '<img src="https://assets.leetcode.com/uploads/diagram.png" alt="Graph" />';
    const md = adapter.htmlToMarkdown(html);
    expect(md).toBe('![Graph](https://assets.leetcode.com/uploads/diagram.png)');
  });
});
