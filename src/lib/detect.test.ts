import { describe, expect, it } from 'vitest';
import { classifyInput, refCandidates } from './detect';

describe('classifyInput', () => {
  it('treats blank input as empty', () => {
    expect(classifyInput('')).toEqual({ kind: 'empty' });
    expect(classifyInput('   \n ')).toEqual({ kind: 'empty' });
  });

  it('treats multi-line or multi-word text as pasted markdown', () => {
    expect(classifyInput('# Hello\n\ntext')).toEqual({ kind: 'paste', content: '# Hello\n\ntext' });
    expect(classifyInput('see https://example.com')).toEqual({
      kind: 'paste',
      content: 'see https://example.com',
    });
  });

  it('keeps the untrimmed original as paste content', () => {
    expect(classifyInput('  # Hi\n')).toEqual({ kind: 'paste', content: '  # Hi\n' });
  });

  it('treats non-URL single tokens as paste', () => {
    expect(classifyInput('example.com')).toEqual({ kind: 'paste', content: 'example.com' });
    expect(classifyInput('ftp://example.com/a.md')).toEqual({
      kind: 'paste',
      content: 'ftp://example.com/a.md',
    });
  });

  it.each(['https://github.com/o/r', 'https://github.com/o/r.git', 'https://github.com/o/r/issues/1'])(
    'classifies %s as a repo',
    (input) => {
      expect(classifyInput(input)).toEqual({
        kind: 'github',
        target: { owner: 'o', repo: 'r', type: 'repo', rest: [] },
      });
    },
  );

  it('parses tree URLs with the ref and path segments', () => {
    expect(classifyInput('https://github.com/o/r/tree/main/docs/guide')).toEqual({
      kind: 'github',
      target: { owner: 'o', repo: 'r', type: 'tree', rest: ['main', 'docs', 'guide'] },
    });
  });

  it('parses blob URLs with the ref and path segments', () => {
    expect(classifyInput('https://github.com/o/r/blob/feat/x/README.md')).toEqual({
      kind: 'github',
      target: { owner: 'o', repo: 'r', type: 'blob', rest: ['feat', 'x', 'README.md'] },
    });
  });

  it('rejects a GitHub URL without a repo', () => {
    expect(classifyInput('https://github.com/o')).toEqual({
      kind: 'invalid',
      reason: '請提供 GitHub repo 網址，例如 https://github.com/owner/repo',
    });
  });

  it('classifies other http(s) hosts as direct URLs', () => {
    expect(classifyInput('https://raw.githubusercontent.com/o/r/main/a.md')).toEqual({
      kind: 'url',
      url: 'https://raw.githubusercontent.com/o/r/main/a.md',
    });
    expect(classifyInput('https://example.com/a.md')).toEqual({
      kind: 'url',
      url: 'https://example.com/a.md',
    });
  });
});

describe('refCandidates', () => {
  it('lists every ref/path split for blob URLs, shortest ref first', () => {
    expect(refCandidates('blob', ['feat', 'x', 'README.md'])).toEqual([
      { ref: 'feat', path: 'x/README.md' },
      { ref: 'feat/x', path: 'README.md' },
    ]);
  });

  it('allows an empty path for tree URLs', () => {
    expect(refCandidates('tree', ['main'])).toEqual([{ ref: 'main', path: '' }]);
  });

  it('never yields an empty blob path', () => {
    expect(refCandidates('blob', ['main'])).toEqual([]);
  });
});
