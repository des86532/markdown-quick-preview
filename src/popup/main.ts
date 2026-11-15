import { classifyInput } from '../lib/detect';
import { type LinkKind, deleteLink, listLinks, type SavedLink } from '../lib/links';
import { purgeExpired, savePaste } from '../lib/storage';
import './popup.css';

const input = document.getElementById('input') as HTMLTextAreaElement;
const useTab = document.getElementById('use-tab') as HTMLButtonElement;
const previewButton = document.getElementById('preview') as HTMLButtonElement;
const errorEl = document.getElementById('error') as HTMLParagraphElement;
const linksSection = document.getElementById('links') as HTMLElement;
const linkList = document.getElementById('link-list') as HTMLUListElement;
const openOptions = document.getElementById('open-options') as HTMLAnchorElement;

function showError(message: string): void {
  errorEl.textContent = message;
}

function openViewer(query: string): Promise<chrome.tabs.Tab> {
  return chrome.tabs.create({ url: chrome.runtime.getURL(`viewer.html?${query}`) });
}

function shortLabel(url: string): string {
  const { host, pathname } = new URL(url);
  const text = host + pathname;
  return text.length > 40 ? `${text.slice(0, 40)}…` : text;
}

const KIND_LABEL: Record<LinkKind, string> = { github: 'GitHub', url: '網址', paste: '貼上' };

function linkMeta(link: SavedLink): string {
  const label = KIND_LABEL[link.kind];
  if (link.kind !== 'paste' || link.expiresAt === null) return label;
  if (Date.now() > link.expiresAt) return `${label} · 已過期`;
  const date = new Date(link.expiresAt).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' });
  return `${label} · ${date} 到期`;
}

function renderLink(link: SavedLink): HTMLLIElement {
  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'link-open';
  const title = document.createElement('span');
  title.className = 'link-title';
  title.textContent = link.title;
  const meta = document.createElement('span');
  meta.className = 'link-meta';
  meta.textContent = linkMeta(link);
  open.append(title, meta);
  open.addEventListener('click', () => {
    void openViewer(link.query).catch((error) => showError(`開啟失敗：${(error as Error).message}`));
  });

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'link-delete';
  remove.textContent = '×';
  remove.setAttribute('aria-label', '刪除');
  remove.addEventListener('click', () => {
    void deleteLink(link.query)
      .then(renderLinks)
      .catch((error) => showError(`刪除失敗：${(error as Error).message}`));
  });

  const item = document.createElement('li');
  item.append(open, remove);
  return item;
}

async function renderLinks(): Promise<void> {
  const links = await listLinks();
  linksSection.hidden = links.length === 0;
  linkList.replaceChildren(...links.map(renderLink));
}

async function preview(): Promise<void> {
  showError('');
  const detected = classifyInput(input.value);
  switch (detected.kind) {
    case 'empty':
      showError('請輸入內容');
      return;
    case 'invalid':
      showError(detected.reason);
      return;
    case 'paste': {
      let id: string;
      try {
        id = await savePaste(detected.content);
      } catch (error) {
        showError(`儲存失敗：${(error as Error).message}`);
        return;
      }
      await openViewer(`paste=${id}`);
      return;
    }
    case 'github': {
      const { owner, repo, type, rest } = detected.target;
      const params = new URLSearchParams({ gh: `${owner}/${repo}`, type });
      if (rest.length > 0) params.set('path', rest.join('/'));
      await openViewer(params.toString());
      return;
    }
    case 'url':
      await openViewer(`url=${encodeURIComponent(detected.url)}`);
      return;
  }
}

async function runPreview(): Promise<void> {
  previewButton.disabled = true;
  try {
    await preview();
  } catch (error) {
    showError(`開啟失敗：${(error as Error).message}`);
  } finally {
    previewButton.disabled = false;
  }
}

async function offerCurrentTab(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url || !/^https?:/.test(tab.url)) return;

  const url = tab.url;
  useTab.textContent = `使用目前分頁：${shortLabel(url)}`;
  useTab.hidden = false;
  useTab.addEventListener('click', () => {
    input.value = url;
    input.focus();
  });
}

previewButton.addEventListener('click', () => void runPreview());

input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    void runPreview();
  }
});

openOptions.addEventListener('click', (event) => {
  event.preventDefault();
  void chrome.runtime.openOptionsPage();
});

void renderLinks().catch((error) => showError(`讀取快速連結失敗：${(error as Error).message}`));
void purgeExpired().catch((error) => console.error('purgeExpired failed', error));
void offerCurrentTab().catch((error) => console.error('tab lookup failed', error));
input.focus();
