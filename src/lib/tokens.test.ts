import { describe, expect, it } from 'vitest';
import { pickTokenRule, validateRules } from './tokens';

const rule = (pattern: string, token = 't') => ({ pattern, token });

describe('pickTokenRule', () => {
  it('prefers owner/repo over owner over *', () => {
    const rules = [rule('*', 'any'), rule('org', 'owner'), rule('org/repo', 'exact')];
    expect(pickTokenRule(rules, 'org', 'repo')?.token).toBe('exact');
    expect(pickTokenRule(rules, 'org', 'other')?.token).toBe('owner');
    expect(pickTokenRule(rules, 'x', 'y')?.token).toBe('any');
  });

  it('matches case-insensitively', () => {
    expect(pickTokenRule([rule('org')], 'Org', 'Repo')?.pattern).toBe('org');
  });

  it('returns null without a match or default', () => {
    expect(pickTokenRule([rule('org')], 'x', 'y')).toBeNull();
  });
});

describe('validateRules', () => {
  it('reports duplicates case-insensitively', () => {
    expect(validateRules([rule('Org'), rule('org')])).toBe('規則重複：org');
  });

  it('rejects malformed patterns', () => {
    expect(validateRules([rule('a/b/c')])).toBe('規則格式錯誤：a/b/c');
  });

  it('rejects empty tokens', () => {
    expect(validateRules([rule('org', '  ')])).toBe('Token 不可為空（規則 org）');
  });

  it('accepts a valid list', () => {
    expect(validateRules([rule('*'), rule('org'), rule('org/repo.js')])).toBeNull();
  });
});
