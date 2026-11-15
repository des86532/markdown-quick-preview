import { refCandidates } from './detect';
import { getTokenRules } from './storage';
import { pickTokenRule, type TokenRule } from './tokens';

const API = 'https://api.github.com';
const NOT_FOUND_MESSAGE = '找不到 repo、分支或路徑（私有 repo 請到選項頁設定 Token）';

export class GithubError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'GithubError';
    this.status = status;
  }
}

export interface RepoTree {
  ref: string;
  paths: string[];
  dirs: Set<string>;
  truncated: boolean;
}

interface TreeResponse {
  tree: { path: string; type: string }[];
  truncated: boolean;
}

function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

function encodeRef(ref: string): string {
  return ref.split('/').map(encodeURIComponent).join('/');
}

function apiHeaders(accept: string, rule: TokenRule | null): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: accept,
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (rule) headers.Authorization = `Bearer ${rule.token}`;
  return headers;
}

async function githubFetch(
  url: string,
  rule: TokenRule | null,
  accept = 'application/vnd.github+json',
): Promise<Response> {
  const res = await fetch(url, { headers: apiHeaders(accept, rule) });
  if (res.ok) return res;
  if ((res.status === 403 || res.status === 429) && res.headers.get('x-ratelimit-remaining') === '0') {
    throw new GithubError('GitHub API 已達速率上限，請到選項頁設定 Token', res.status);
  }
  if (res.status === 401) throw new GithubError(rule ? `GitHub Token（規則 ${rule.pattern}）無效或已過期` : 'GitHub Token 無效或已過期', 401);
  throw new GithubError(`GitHub 請求失敗（HTTP ${res.status}）`, res.status);
}

function isMissing(error: unknown): boolean {
  return error instanceof GithubError && (error.status === 404 || error.status === 422);
}

async function fetchTree(owner: string, repo: string, ref: string, rule: TokenRule | null): Promise<RepoTree> {
  const url = `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(ref)}?recursive=1`;
  const data = (await (await githubFetch(url, rule)).json()) as TreeResponse;
  const paths: string[] = [];
  const dirs = new Set<string>();
  for (const entry of data.tree) {
    if (entry.type === 'blob') paths.push(entry.path);
    else if (entry.type === 'tree') dirs.add(entry.path);
  }
  return { ref, paths, dirs, truncated: data.truncated };
}

async function resolveTree(
  owner: string,
  repo: string,
  ref: string | null,
  type: 'repo' | 'tree' | 'blob',
  rest: string[],
  rule: TokenRule | null,
): Promise<RepoTree & { path: string }> {
  if (ref) {
    return { ...(await fetchTree(owner, repo, ref, rule)), path: '' };
  }

  if (type === 'repo') {
    const info = (await (
      await githubFetch(`${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, rule)
    ).json()) as { default_branch: string };
    return { ...(await fetchTree(owner, repo, info.default_branch, rule)), path: '' };
  }

  for (const candidate of refCandidates(type, rest)) {
    let tree: RepoTree;
    try {
      tree = await fetchTree(owner, repo, candidate.ref, rule);
    } catch (error) {
      if (isMissing(error)) continue;
      throw error;
    }
    const matches =
      type === 'blob'
        ? tree.paths.includes(candidate.path)
        : candidate.path === '' || tree.dirs.has(candidate.path);
    if (matches) return { ...tree, path: candidate.path };
  }
  throw new GithubError(NOT_FOUND_MESSAGE, 404);
}

/**
 * Resolves the repo tree. For `tree`/`blob` URLs the ref may contain `/`,
 * so the ref/path split is found by trial. Missing repo/ref/path → GithubError (404).
 */
export async function loadRepoTree(
  owner: string,
  repo: string,
  ref: string | null,
  type: 'repo' | 'tree' | 'blob',
  rest: string[],
): Promise<RepoTree & { path: string }> {
  try {
    const rule = pickTokenRule(await getTokenRules(), owner, repo);
    return await resolveTree(owner, repo, ref, type, rest, rule);
  } catch (error) {
    if (isMissing(error)) throw new GithubError(NOT_FOUND_MESSAGE, 404);
    throw error;
  }
}

export async function fetchFile(owner: string, repo: string, ref: string, path: string): Promise<string> {
  const rule = pickTokenRule(await getTokenRules(), owner, repo);
  if (rule) {
    const url = `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`;
    return (await githubFetch(url, rule, 'application/vnd.github.raw+json')).text();
  }

  const res = await fetch(rawUrl(owner, repo, ref, path));
  if (!res.ok) throw new GithubError(`檔案讀取失敗（HTTP ${res.status}）`, res.status);
  return res.text();
}

export function rawUrl(owner: string, repo: string, ref: string, path: string): string {
  return `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeRef(ref)}/${encodePath(path)}`;
}

export function blobUrl(owner: string, repo: string, ref: string, path: string): string {
  return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/blob/${encodeRef(ref)}/${encodePath(path)}`;
}
