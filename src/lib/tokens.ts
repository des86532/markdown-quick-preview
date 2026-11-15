export interface TokenRule {
  pattern: string;
  token: string;
}

export const DEFAULT_PATTERN = '*';

const PATTERN_FORMAT = /^(\*|[A-Za-z0-9-]+(\/[A-Za-z0-9._-]+)?)$/;

/** owner/repo exact → owner → '*'. Case-insensitive. No match → null. */
export function pickTokenRule(rules: TokenRule[], owner: string, repo: string): TokenRule | null {
  const o = owner.toLowerCase();
  const full = `${o}/${repo.toLowerCase()}`;
  const find = (target: string) => rules.find((rule) => rule.pattern.toLowerCase() === target);
  return find(full) ?? find(o) ?? find(DEFAULT_PATTERN) ?? null;
}

/** Returns the first error message, or null when valid. */
export function validateRules(rules: TokenRule[]): string | null {
  const seen = new Set<string>();
  for (const rule of rules) {
    if (rule.token.trim() === '') return `Token 不可為空（規則 ${rule.pattern}）`;
    if (!PATTERN_FORMAT.test(rule.pattern)) return `規則格式錯誤：${rule.pattern}`;
    const key = rule.pattern.toLowerCase();
    if (seen.has(key)) return `規則重複：${rule.pattern}`;
    seen.add(key);
  }
  return null;
}
