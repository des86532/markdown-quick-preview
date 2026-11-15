import type { TokenRule } from './tokens';

export interface PasteRecord {
  content: string;
  title: string;
  createdAt: number;
}

export const PASTE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const PASTE_PREFIX = 'paste:';
const TOKENS_KEY = 'githubTokens';
const LEGACY_TOKEN_KEY = 'githubToken';

export function deriveTitle(content: string): string {
  const heading = content.match(/^#[ \t]+(.+)$/m);
  if (heading) return heading[1].trim();

  const firstLine = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (firstLine) return firstLine.slice(0, 40);

  return 'Untitled';
}

function isExpired(record: PasteRecord, now: number): boolean {
  return now - record.createdAt > PASTE_TTL_MS;
}

export async function savePaste(content: string): Promise<string> {
  const id = crypto.randomUUID();
  const record: PasteRecord = {
    content,
    title: deriveTitle(content),
    createdAt: Date.now(),
  };
  await chrome.storage.local.set({ [PASTE_PREFIX + id]: record });
  return id;
}

export async function loadPaste(id: string): Promise<PasteRecord | null> {
  const key = PASTE_PREFIX + id;
  const stored = await chrome.storage.local.get(key);
  const record = stored[key] as PasteRecord | undefined;
  if (!record) return null;
  if (isExpired(record, Date.now())) {
    await chrome.storage.local.remove(key);
    return null;
  }
  return record;
}

export async function purgeExpired(): Promise<void> {
  const all = await chrome.storage.local.get(null);
  const now = Date.now();
  const expired = Object.entries(all)
    .filter(([key, value]) => key.startsWith(PASTE_PREFIX) && isExpired(value as PasteRecord, now))
    .map(([key]) => key);
  if (expired.length > 0) await chrome.storage.local.remove(expired);
}

export async function getTokenRules(): Promise<TokenRule[]> {
  const stored = await chrome.storage.local.get([TOKENS_KEY, LEGACY_TOKEN_KEY]);
  const rules = stored[TOKENS_KEY];
  if (Array.isArray(rules)) return rules as TokenRule[];

  const legacy = stored[LEGACY_TOKEN_KEY];
  if (typeof legacy === 'string' && legacy) {
    const migrated: TokenRule[] = [{ pattern: '*', token: legacy }];
    await chrome.storage.local.set({ [TOKENS_KEY]: migrated });
    await chrome.storage.local.remove(LEGACY_TOKEN_KEY);
    return migrated;
  }
  return [];
}

export async function setTokenRules(rules: TokenRule[]): Promise<void> {
  await chrome.storage.local.set({ [TOKENS_KEY]: rules });
}
