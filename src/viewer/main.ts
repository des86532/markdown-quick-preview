import { MERMAID_RE, buildBook, type BookNode } from '../lib/book';
import { GithubError, blobUrl, fetchFile, loadRepoTree, rawUrl } from '../lib/github';
import { type LinkResolver, renderDocument } from '../lib/render';
import { deleteLink, getLink, putLink, type SavedLink } from '../lib/links';
import { PASTE_TTL_MS, deriveTitle, loadPaste, purgeExpired } from '../lib/storage';
import 'github-markdown-css/github-markdown-light.css';
import 'highlight.js/styles/github.css';
import './viewer.css';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const titleEl = $<HTMLHeadingElement>('doc-title');
const sourceLabel = $<HTMLSpanElement>('source-label');
const sourceLink = $<HTMLAnchorElement>('source-link');
const banner = $<HTMLDivElement>('banner');
const sidebar = $<HTMLElement>('sidebar');
const main = $<HTMLElement>('main');
const content = $<HTMLElement>('content');
const pager = $<HTMLElement>('pager');
const prevButton = $<HTMLButtonElement>('prev');
const nextButton = $<HTMLButtonElement>('next');
const saveButton = $<HTMLButtonElement>('save-link');

const ABSOLUTE_URL = /^[a-z][a-z0-9+.-]*:/i;

interface Book {
  owner: string;
  repo: string;
  ref: string;
  pages: string[];
  pageSet: Set<string>;
}

interface Action {
  label: string;
  run: () => void;
}

let book: Book | null = null;
let currentPage = '';
let pendingFragment = '';
let currentLink: Omit<SavedLink, 'createdAt'> | null = null;
// Incremented by every navigation; async steps compare against it to drop stale results.
let generation = 0;
const fileCache = new Map<string, string>();

function absoluteHref(href: string): string | null {
  if (ABSOLUTE_URL.test(href)) return href;
  if (href.startsWith('//')) return `https:${href}`;
  return null;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function encodePath(page: string): string {
  return page.split('/').map(encodeURIComponent).join('/');
}

function pageHash(page: string): string {
  return `#${encodePath(page)}`;
}

function currentHashPage(): string {
  return safeDecode(location.hash.slice(1));
}

function fileName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

function setBanner(notes: string[]): void {
  banner.textContent = notes.join('　');
  banner.hidden = notes.length === 0;
}

function setTitles(heading: string, windowTitle: string): void {
  titleEl.textContent = heading;
  document.title = windowTitle;
}

function setSource(label: string, href: string | null): void {
  sourceLabel.textContent = label;
  sourceLink.hidden = href === null;
  if (href !== null) sourceLink.href = href;
}

function showMessage(message: string, action?: Action): void {
  const status = document.createElement('p');
  status.className = 'status';
  status.textContent = message;

  const nodes: HTMLElement[] = [status];
  if (action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = action.label;
    button.addEventListener('click', action.run);
    nodes.push(button);
  }
  content.replaceChildren(...nodes);
}

function showError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  const needsToken = error instanceof GithubError && message.includes('Token');
  showMessage(
    message,
    needsToken ? { label: '開啟設定', run: () => void chrome.runtime.openOptionsPage() } : undefined,
  );
}

function scrollToId(id: string): void {
  if (!id) return;
  content.querySelector<HTMLElement>(`[id="${CSS.escape(id)}"]`)?.scrollIntoView();
}

// Paste: content is user-owned, links are passed through; only absolute URLs are external.
const pasteResolver: LinkResolver = {
  link(href) {
    const abs = absoluteHref(href);
    return abs ? { href: abs, external: true } : { href, external: false };
  },
  image(src) {
    return absoluteHref(src) ?? src;
  },
};

// Direct URL: every link resolves against the source URL and opens externally.
function urlResolver(base: URL): LinkResolver {
  return {
    link(href) {
      try {
        return { href: new URL(href, base).href, external: true };
      } catch {
        return { href, external: false };
      }
    },
    image(src) {
      try {
        return new URL(src, base).href;
      } catch {
        return src;
      }
    },
  };
}

// Repo: links between documents stay inside the book; everything else goes to GitHub.
function githubResolver(target: Book, page: string): LinkResolver {
  const base = new URL(`https://repo.invalid/${encodePath(page)}`);
  return {
    link(href) {
      const abs = absoluteHref(href);
      if (abs) return { href: abs, external: true };

      const url = new URL(href, base);
      const path = safeDecode(url.pathname.slice(1));
      if (target.pageSet.has(path)) {
        return {
          href: pageHash(path),
          page: path,
          fragment: safeDecode(url.hash.slice(1)),
          external: false,
        };
      }
      return { href: blobUrl(target.owner, target.repo, target.ref, path) + url.hash, external: true };
    },
    image(src) {
      const abs = absoluteHref(src);
      if (abs) return abs;

      const path = safeDecode(new URL(src, base).pathname.slice(1));
      return rawUrl(target.owner, target.repo, target.ref, path);
    },
  };
}

function renderSidebar(nodes: BookNode[]): HTMLUListElement {
  const list = document.createElement('ul');
  for (const node of nodes) {
    const item = document.createElement('li');
    if (node.type === 'dir') {
      const details = document.createElement('details');
      details.open = true;
      const summary = document.createElement('summary');
      summary.textContent = node.name;
      details.append(summary, renderSidebar(node.children));
      item.append(details);
    } else {
      const link = document.createElement('a');
      link.href = pageHash(node.path);
      link.dataset.page = node.path;
      link.title = node.path;
      link.textContent = node.name;
      item.append(link);
    }
    list.append(item);
  }
  return list;
}

function markActive(page: string): void {
  for (const link of sidebar.querySelectorAll<HTMLAnchorElement>('a[data-page]')) {
    const active = link.dataset.page === page;
    link.classList.toggle('active', active);
    if (active) link.scrollIntoView({ block: 'nearest' });
  }
}

function updatePager(page: string): void {
  if (!book) return;
  const index = book.pages.indexOf(page);
  const prev = book.pages[index - 1];
  const next = book.pages[index + 1];

  prevButton.disabled = prev === undefined;
  prevButton.textContent = prev === undefined ? '上一頁' : `上一頁：${fileName(prev)}`;
  nextButton.disabled = next === undefined;
  nextButton.textContent = next === undefined ? '下一頁' : `下一頁：${fileName(next)}`;
  pager.hidden = false;
}

function goToPage(offset: number): void {
  if (!book) return;
  const page = book.pages[book.pages.indexOf(currentPage) + offset];
  if (page !== undefined) location.hash = pageHash(page);
}

async function showPage(page: string, fragment: string): Promise<void> {
  if (!book) return;
  const gen = ++generation;
  const { owner, repo, ref } = book;
  currentPage = page;
  markActive(page);
  updatePager(page);

  try {
    let source = fileCache.get(page);
    if (source === undefined) {
      showMessage('載入中…');
      source = await fetchFile(owner, repo, ref, page);
      if (gen !== generation) return;
      fileCache.set(page, source);
    }

    setTitles(page, `${fileName(page)} · ${owner}/${repo}`);
    setSource(`GitHub · ${owner}/${repo}`, blobUrl(owner, repo, ref, page));
    const kind = MERMAID_RE.test(page) ? 'mermaid' : 'markdown';
    await renderDocument(content, source, kind, githubResolver(book, page));
    if (gen !== generation) return;

    main.scrollTop = 0;
    scrollToId(fragment);
  } catch (error) {
    if (gen === generation) showError(error);
  }
}

function setSaved(saved: boolean): void {
  saveButton.textContent = saved ? '已儲存' : '儲存連結';
  saveButton.setAttribute('aria-pressed', String(saved));
  saveButton.title = saved ? '點擊移除快速連結' : '';
}

async function offerSave(link: Omit<SavedLink, 'createdAt'>): Promise<void> {
  currentLink = link;
  try {
    setSaved(Boolean(await getLink(link.query)));
    saveButton.hidden = false;
  } catch (error) {
    console.error('link lookup failed', error);
  }
}

async function openPaste(id: string): Promise<void> {
  setSource('貼上內容', null);
  const record = await loadPaste(id);
  if (!record) {
    setTitles('', 'MD Preview');
    showMessage('此預覽已過期或不存在');
    return;
  }
  setTitles(record.title, `${record.title} · MD Preview`);
  void offerSave({
    query: `paste=${encodeURIComponent(id)}`,
    title: record.title,
    kind: 'paste',
    expiresAt: record.createdAt + PASTE_TTL_MS,
  });
  await renderDocument(content, record.content, 'markdown', pasteResolver);
}

function showAuthPrompt(origin: string, src: string): void {
  showMessage(`需要授權讀取 ${origin} 才能預覽`, {
    label: '授權並重試',
    run: () => {
      // First await is the permission request so the click's user gesture is still valid.
      void chrome.permissions
        .request({ origins: [`${origin}/*`] })
        .then((granted) => {
          if (granted) return openUrl(src);
          showMessage('未授權，無法讀取此網站');
        })
        .catch(showError);
    },
  });
}

async function openUrl(src: string): Promise<void> {
  const url = new URL(src);
  const kind = MERMAID_RE.test(url.pathname) ? 'mermaid' : 'markdown';
  setSource('網址', src);
  showMessage('載入中…');

  let response: Response;
  try {
    response = await fetch(src);
  } catch (error) {
    const granted = await chrome.permissions.contains({ origins: [`${url.origin}/*`] });
    if (error instanceof TypeError && !granted) {
      showAuthPrompt(url.origin, src);
      return;
    }
    throw error;
  }
  if (!response.ok) {
    showMessage(`讀取失敗（HTTP ${response.status}）`);
    return;
  }

  const source = await response.text();
  const title = kind === 'mermaid' ? safeDecode(fileName(url.pathname)) : deriveTitle(source);
  setTitles(title, `${title} · MD Preview`);
  void offerSave({ query: `url=${encodeURIComponent(src)}`, title, kind: 'url', expiresAt: null });
  await renderDocument(content, source, kind, urlResolver(url));
}

function parseType(value: string | null): 'repo' | 'tree' | 'blob' {
  return value === 'tree' || value === 'blob' ? value : 'repo';
}

async function openRepo(params: URLSearchParams): Promise<void> {
  const [owner, repo] = (params.get('gh') ?? '').split('/');
  if (!owner || !repo) {
    showMessage('repo 參數格式錯誤');
    return;
  }

  const gen = ++generation;
  setSource(`GitHub · ${owner}/${repo}`, `https://github.com/${owner}/${repo}`);
  setBanner([]);
  showMessage('載入 repo 結構中…');

  // `ref` present means this is a canonical reload: the hash names the page, the tree is re-read at that ref.
  const refParam = params.get('ref');
  const type = parseType(params.get('type'));
  const pathParam = params.get('path') ?? '';
  const repoTree = refParam
    ? await loadRepoTree(owner, repo, refParam, 'repo', [])
    : await loadRepoTree(owner, repo, null, type, pathParam ? pathParam.split('/') : []);
  if (gen !== generation) return;

  const root = refParam ? (params.get('root') ?? '') : type === 'tree' ? repoTree.path : '';
  const { tree, pages } = buildBook(repoTree.paths, root);
  const pageSet = new Set(pages);
  book = { owner, repo, ref: repoTree.ref, pages, pageSet };
  fileCache.clear();

  const notes: string[] = [];
  if (type === 'blob' && !refParam && !pageSet.has(repoTree.path)) {
    notes.push('指定的檔案不是 Markdown / Mermaid，已改開第一頁');
  }
  if (repoTree.truncated) notes.push('repo 檔案過多，GitHub 只回傳部分結構，部分文件可能缺漏');
  setBanner(notes);

  if (pages.length === 0) {
    showMessage('此範圍內找不到 Markdown / Mermaid 檔案');
    return;
  }

  const requested = refParam ? currentHashPage() : type === 'blob' ? repoTree.path : '';
  const start = pageSet.has(requested) ? requested : pages[0];
  const rootQuery = root ? `&root=${encodeURIComponent(root)}` : '';
  history.replaceState(null, '', `?gh=${owner}/${repo}&ref=${encodeURIComponent(repoTree.ref)}${rootQuery}${pageHash(start)}`);
  void offerSave({
    query: location.search.slice(1),
    title: root ? `${owner}/${repo}/${root}` : `${owner}/${repo}`,
    kind: 'github',
    expiresAt: null,
  });

  sidebar.replaceChildren(renderSidebar(tree));
  sidebar.hidden = false;
  await showPage(start, '');
}

function goToHashPage(): void {
  if (!book) return;
  const fragment = pendingFragment;
  pendingFragment = '';

  const requested = currentHashPage();
  const page = book.pageSet.has(requested) ? requested : book.pages[0];
  if (page !== requested) history.replaceState(null, '', `${location.search}${pageHash(page)}`);
  void showPage(page, fragment);
}

async function start(): Promise<void> {
  const params = new URLSearchParams(location.search);
  try {
    const paste = params.get('paste');
    const url = params.get('url');
    if (paste !== null) await openPaste(paste);
    else if (url !== null) await openUrl(url);
    else if (params.has('gh')) await openRepo(params);
    else showMessage('沒有可預覽的內容');
  } catch (error) {
    showError(error);
  }
}

content.addEventListener('click', (event) => {
  const anchor = event.target instanceof Element ? event.target.closest('a') : null;
  if (!anchor || !content.contains(anchor)) return;

  const page = anchor.dataset.page;
  if (page !== undefined) {
    event.preventDefault();
    const fragment = anchor.dataset.fragment ?? '';
    if (page === currentPage) {
      scrollToId(fragment);
      return;
    }
    pendingFragment = fragment;
    location.hash = pageHash(page);
    return;
  }

  const href = anchor.getAttribute('href') ?? '';
  if (href.startsWith('#')) {
    event.preventDefault();
    scrollToId(safeDecode(href.slice(1)));
  }
});

window.addEventListener('hashchange', goToHashPage);

saveButton.addEventListener('click', () => {
  const link = currentLink;
  if (!link) return;
  saveButton.disabled = true;
  void (async () => {
    try {
      if (saveButton.getAttribute('aria-pressed') === 'true') {
        await deleteLink(link.query);
        setSaved(false);
      } else {
        await putLink({ ...link, createdAt: Date.now() });
        setSaved(true);
      }
    } catch (error) {
      saveButton.textContent = '儲存失敗';
      saveButton.title = (error as Error).message;
      console.error('save link failed', error);
    } finally {
      saveButton.disabled = false;
    }
  })();
});

prevButton.addEventListener('click', () => goToPage(-1));
nextButton.addEventListener('click', () => goToPage(1));

document.addEventListener('keydown', (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

  const active = document.activeElement;
  const typing =
    active instanceof HTMLInputElement ||
    active instanceof HTMLTextAreaElement ||
    (active instanceof HTMLElement && active.isContentEditable);
  if (!book || typing) return;
  goToPage(event.key === 'ArrowLeft' ? -1 : 1);
});

void purgeExpired().catch((error) => console.error('purgeExpired failed', error));
void start();
