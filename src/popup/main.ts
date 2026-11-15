import { classifyInput } from '../lib/detect';
import { purgeExpired, savePaste } from '../lib/storage';
import './popup.css';

const input = document.getElementById('input') as HTMLTextAreaElement;
const useTab = document.getElementById('use-tab') as HTMLButtonElement;
const previewButton = document.getElementById('preview') as HTMLButtonElement;
const errorEl = document.getElementById('error') as HTMLParagraphElement;
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

void purgeExpired().catch((error) => console.error('purgeExpired failed', error));
void offerCurrentTab().catch((error) => console.error('tab lookup failed', error));
input.focus();
