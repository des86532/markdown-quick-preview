import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTokenRules, isTokenSyncEnabled, setTokenRules } from './storage';

type Area = Record<string, unknown>;

function fakeArea(data: Area) {
  return {
    async get(keys: string | string[] | null) {
      const list = keys === null ? Object.keys(data) : Array.isArray(keys) ? keys : [keys];
      return Object.fromEntries(list.filter((key) => key in data).map((key) => [key, data[key]]));
    },
    async set(items: Area) {
      Object.assign(data, items);
    },
    async remove(keys: string | string[]) {
      for (const key of Array.isArray(keys) ? keys : [keys]) delete data[key];
    },
  };
}

let local: Area;
let sync: Area;
const RULES = [{ pattern: '*', token: 't1' }];

beforeEach(() => {
  local = {};
  sync = {};
  vi.stubGlobal('chrome', { storage: { local: fakeArea(local), sync: fakeArea(sync) } });
});

describe('token rule storage', () => {
  it('saves locally by default and leaves sync empty', async () => {
    await setTokenRules(RULES);
    expect(local.githubTokens).toEqual(RULES);
    expect(sync).toEqual({});
    expect(await isTokenSyncEnabled()).toBe(false);
    expect(await getTokenRules()).toEqual(RULES);
  });

  it('moves rules to sync when enabled', async () => {
    await setTokenRules(RULES);
    await setTokenRules(RULES, true);
    expect(sync.githubTokens).toEqual(RULES);
    expect(local).toEqual({});
    expect(await isTokenSyncEnabled()).toBe(true);
    expect(await getTokenRules()).toEqual(RULES);
  });

  it('keeps sync enabled with an empty rule list', async () => {
    await setTokenRules([], true);
    expect(await isTokenSyncEnabled()).toBe(true);
    expect(await getTokenRules()).toEqual([]);
  });

  it('moves rules back to local when disabled', async () => {
    await setTokenRules(RULES, true);
    await setTokenRules(RULES, false);
    expect(local.githubTokens).toEqual(RULES);
    expect(sync).toEqual({});
  });

  it('prefers synced rules over local ones', async () => {
    local.githubTokens = [{ pattern: '*', token: 'local' }];
    sync.githubTokens = RULES;
    expect(await getTokenRules()).toEqual(RULES);
  });

  it('keeps local rules when the sync write fails', async () => {
    await setTokenRules(RULES);
    vi.stubGlobal('chrome', {
      storage: {
        local: fakeArea(local),
        sync: { ...fakeArea(sync), set: () => Promise.reject(new Error('QUOTA_BYTES_PER_ITEM quota exceeded')) },
      },
    });
    await expect(setTokenRules(RULES, true)).rejects.toThrow(/QUOTA/);
    expect(local.githubTokens).toEqual(RULES);
  });

  it('migrates the legacy single token', async () => {
    local.githubToken = 'old';
    expect(await getTokenRules()).toEqual([{ pattern: '*', token: 'old' }]);
    expect(local).toEqual({ githubTokens: [{ pattern: '*', token: 'old' }] });
  });
});
