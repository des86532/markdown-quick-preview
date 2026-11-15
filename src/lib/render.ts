import DOMPurify from 'dompurify';
import GithubSlugger from 'github-slugger';
import hljs from 'highlight.js/lib/common';
import MarkdownIt from 'markdown-it';
import anchor from 'markdown-it-anchor';

export interface LinkTarget {
  href: string;
  page?: string;
  fragment?: string;
  external: boolean;
}

export interface LinkResolver {
  link(href: string): LinkTarget;
  image(src: string): string;
}

const FRONT_MATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n/;

const slugger = new GithubSlugger();

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: false,
  highlight(str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(str, { language: lang, ignoreIllegals: true }).value;
    }
    return '';
  },
});

md.use(anchor, { slugify: (s: string) => slugger.slug(s) });

const defaultFence = md.renderer.rules.fence!;
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const lang = token.info.trim().split(/\s+/)[0]?.toLowerCase();
  if (lang === 'mermaid') {
    return `<pre class="mermaid">${md.utils.escapeHtml(token.content)}</pre>\n`;
  }
  return defaultFence(tokens, idx, options, env, self);
};

let mermaidReady = false;

function postProcess(el: HTMLElement, resolver: LinkResolver): void {
  for (const a of el.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    const href = a.getAttribute('href') ?? '';
    if (href.startsWith('#')) continue;

    const target = resolver.link(href);
    a.setAttribute('href', target.href);
    if (target.page !== undefined) {
      a.dataset.page = target.page;
      if (target.fragment) a.dataset.fragment = target.fragment;
    }
    if (target.external) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }
  }

  for (const img of el.querySelectorAll<HTMLImageElement>('img[src]')) {
    img.setAttribute('src', resolver.image(img.getAttribute('src') ?? ''));
  }
}

async function runMermaid(el: HTMLElement): Promise<void> {
  const nodes = [...el.querySelectorAll<HTMLElement>('pre.mermaid')];
  if (nodes.length === 0) return;

  // Lazy: mermaid is large; load it only when the document contains a diagram.
  const { default: mermaid } = await import('mermaid');
  if (!mermaidReady) {
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'default' });
    mermaidReady = true;
  }
  await mermaid.run({ nodes, suppressErrors: true });
}

export async function renderDocument(
  el: HTMLElement,
  source: string,
  kind: 'markdown' | 'mermaid',
  resolver: LinkResolver,
): Promise<void> {
  if (kind === 'mermaid') {
    const pre = document.createElement('pre');
    pre.className = 'mermaid';
    pre.textContent = source;
    el.replaceChildren(pre);
  } else {
    slugger.reset();
    // Remote markdown is untrusted and this page has chrome.* access: always sanitize.
    el.innerHTML = DOMPurify.sanitize(md.render(source.replace(FRONT_MATTER, '')));
    postProcess(el, resolver);
  }
  await runMermaid(el);
}
