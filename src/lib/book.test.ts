import { describe, expect, it } from 'vitest';
import { buildBook } from './book';

const FILES = [
  'b.md',
  'README.md',
  'docs/10-x.md',
  'docs/2-y.md',
  'a.mmd',
  'src/x.ts',
  'node_modules/p/README.md',
  'docs/sub/z.md',
  'docs/index.md',
];

describe('buildBook', () => {
  it('orders the whole repo: readme first, then files, then folders, numeric-aware', () => {
    expect(buildBook(FILES, '').pages).toEqual([
      'README.md',
      'a.mmd',
      'b.md',
      'docs/index.md',
      'docs/2-y.md',
      'docs/10-x.md',
      'docs/sub/z.md',
    ]);
  });

  it('limits pages to the given root folder', () => {
    expect(buildBook(FILES, 'docs').pages).toEqual([
      'docs/index.md',
      'docs/2-y.md',
      'docs/10-x.md',
      'docs/sub/z.md',
    ]);
  });

  it('puts a lowercase readme first among files in the same folder', () => {
    expect(buildBook(['z.md', 'readme.md', 'a.md'], '').pages).toEqual(['readme.md', 'a.md', 'z.md']);
  });

  it('returns the root children as the tree, without the root folder itself', () => {
    const { tree } = buildBook(['docs/a.md', 'docs/sub/b.md'], 'docs');
    expect(tree).toEqual([
      { type: 'file', name: 'a.md', path: 'docs/a.md' },
      {
        type: 'dir',
        name: 'sub',
        path: 'docs/sub',
        children: [{ type: 'file', name: 'b.md', path: 'docs/sub/b.md' }],
      },
    ]);
  });

  it('does not create folders that contain no documents', () => {
    const { tree } = buildBook(['src/x.ts', 'docs/a.md'], '');
    expect(tree.map((n) => n.name)).toEqual(['docs']);
  });
});
