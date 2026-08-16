import { describe, it, expect } from 'vitest';
import { CommitQueue } from '../index';

describe('getFileExtension', () => {
  const queue = new CommitQueue();

  it('maps all supported languages to proper file extensions', () => {
    expect(queue.getFileExtension('C++')).toBe('cpp');
    expect(queue.getFileExtension('cpp')).toBe('cpp');
    expect(queue.getFileExtension('C')).toBe('c');
    expect(queue.getFileExtension('C#')).toBe('cs');
    expect(queue.getFileExtension('csharp')).toBe('cs');
    expect(queue.getFileExtension('Java')).toBe('java');
    expect(queue.getFileExtension('Python3')).toBe('py');
    expect(queue.getFileExtension('python')).toBe('py');
    expect(queue.getFileExtension('JavaScript')).toBe('js');
    expect(queue.getFileExtension('TypeScript')).toBe('ts');
    expect(queue.getFileExtension('Go')).toBe('go');
    expect(queue.getFileExtension('golang')).toBe('go');
    expect(queue.getFileExtension('Rust')).toBe('rs');
    expect(queue.getFileExtension('Kotlin')).toBe('kt');
    expect(queue.getFileExtension('Swift')).toBe('swift');
    expect(queue.getFileExtension('Ruby')).toBe('rb');
    expect(queue.getFileExtension('Scala')).toBe('scala');
    expect(queue.getFileExtension('PHP')).toBe('php');
    expect(queue.getFileExtension('Dart')).toBe('dart');
    expect(queue.getFileExtension('Racket')).toBe('rkt');
    expect(queue.getFileExtension('Elixir')).toBe('ex');
    expect(queue.getFileExtension('Erlang')).toBe('erl');
    expect(queue.getFileExtension('MySQL')).toBe('sql');
    expect(queue.getFileExtension('PostgreSQL')).toBe('sql');
    expect(queue.getFileExtension('R')).toBe('r');
    expect(queue.getFileExtension('Bash')).toBe('sh');
    expect(queue.getFileExtension('UnknownLang')).toBe('txt');
  });
});
