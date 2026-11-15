export type GithubTarget = {
  owner: string;
  repo: string;
  type: 'repo' | 'tree' | 'blob';
  rest: string[];
};

export type Detected =
  | { kind: 'empty' }
  | { kind: 'invalid'; reason: string }
  | { kind: 'paste'; content: string }
  | { kind: 'github'; target: GithubTarget }
  | { kind: 'url'; url: string };

const REPO_HINT = '請提供 GitHub repo 網址，例如 https://github.com/owner/repo';
const NON_FILE_HINT = '只支援 repo 首頁、tree（資料夾）或 blob（檔案）網址';

export function classifyInput(raw: string): Detected {
  const trimmed = raw.trim();
  if (!trimmed) return { kind: 'empty' };
  if (/\s/.test(trimmed)) return { kind: 'paste', content: raw };
  const candidate = /^(www\.)?github\.com\//i.test(trimmed) ? `https://${trimmed}` : trimmed;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { kind: 'paste', content: raw };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { kind: 'paste', content: raw };
  }
  if (url.hostname === 'github.com' || url.hostname === 'www.github.com') {
    return classifyGithub(url);
  }
  return { kind: 'url', url: trimmed };
}

function classifyGithub(url: URL): Detected {
  let segments: string[];
  try {
    segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  } catch {
    return { kind: 'invalid', reason: '網址格式不正確' };
  }
  if (segments.length < 2) return { kind: 'invalid', reason: REPO_HINT };

  const owner = segments[0];
  const repo = segments[1].replace(/\.git$/, '');
  if (!repo) return { kind: 'invalid', reason: REPO_HINT };

  const kind = segments[2];
  if ((kind === 'tree' || kind === 'blob') && segments.length > 3) {
    return {
      kind: 'github',
      target: { owner, repo, type: kind, rest: segments.slice(3) },
    };
  }
  if (segments.length === 2) {
    return { kind: 'github', target: { owner, repo, type: 'repo', rest: [] } };
  }
  return { kind: 'invalid', reason: NON_FILE_HINT };
}

/**
 * Branch names may contain `/`, so every split of `rest` into ref + path is a candidate.
 * Shortest ref first. Refs are limited to 4 segments.
 * For `blob`, the path must be non-empty.
 */
export function refCandidates(
  type: 'tree' | 'blob',
  rest: string[],
): { ref: string; path: string }[] {
  const max = type === 'tree' ? Math.min(rest.length, 4) : Math.min(rest.length - 1, 4);
  const out: { ref: string; path: string }[] = [];
  for (let i = 1; i <= max; i++) {
    out.push({ ref: rest.slice(0, i).join('/'), path: rest.slice(i).join('/') });
  }
  return out;
}
