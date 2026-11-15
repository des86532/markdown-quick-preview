export type BookNode =
  | { type: 'file'; name: string; path: string }
  | { type: 'dir'; name: string; path: string; children: BookNode[] };

export const DOC_RE = /\.(md|markdown|mdx|mmd|mermaid)$/i;
export const MERMAID_RE = /\.(mmd|mermaid)$/i;

const EXCLUDED_SEGMENTS: Record<string, true> = { node_modules: true, vendor: true };
const FILE_PRIORITY = [/^readme\.(md|markdown|mdx)$/i, /^index\.(md|markdown|mdx)$/i];

interface Folder {
  name: string;
  path: string;
  folders: Map<string, Folder>;
  files: BookNode[];
}

function filePriority(name: string): number {
  const i = FILE_PRIORITY.findIndex((re) => re.test(name));
  return i === -1 ? FILE_PRIORITY.length : i;
}

function compareNames(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function toNodes(folder: Folder): BookNode[] {
  const files = [...folder.files].sort(
    (a, b) => filePriority(a.name) - filePriority(b.name) || compareNames(a.name, b.name),
  );
  const dirs: BookNode[] = [...folder.folders.values()]
    .sort((a, b) => compareNames(a.name, b.name))
    .map((d) => ({ type: 'dir', name: d.name, path: d.path, children: toNodes(d) }));
  return [...files, ...dirs];
}

function collectPages(nodes: BookNode[], out: string[]): string[] {
  for (const node of nodes) {
    if (node.type === 'file') out.push(node.path);
    else collectPages(node.children, out);
  }
  return out;
}

/**
 * Builds the book for the folder `root` ('' = whole repo) from a flat list of blob paths.
 * `tree` is the children of `root`; `pages` is the depth-first reading order.
 */
export function buildBook(paths: string[], root: string): { tree: BookNode[]; pages: string[] } {
  const prefix = root ? `${root}/` : '';
  const top: Folder = { name: root, path: root, folders: new Map(), files: [] };

  for (const path of paths) {
    if (!DOC_RE.test(path)) continue;
    if (root && !path.startsWith(prefix)) continue;

    const segments = path.slice(prefix.length).split('/');
    if (segments.some((s) => EXCLUDED_SEGMENTS[s] === true)) continue;

    let folder = top;
    let folderPath = root;
    for (const segment of segments.slice(0, -1)) {
      folderPath = folderPath ? `${folderPath}/${segment}` : segment;
      let next = folder.folders.get(segment);
      if (!next) {
        next = { name: segment, path: folderPath, folders: new Map(), files: [] };
        folder.folders.set(segment, next);
      }
      folder = next;
    }
    folder.files.push({ type: 'file', name: segments[segments.length - 1], path });
  }

  const tree = toNodes(top);
  return { tree, pages: collectPages(tree, []) };
}
