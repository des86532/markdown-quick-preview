import { getTokenRules, setTokenRules } from '../lib/storage';
import { type TokenRule, validateRules } from '../lib/tokens';
import './options.css';

const rulesEl = document.getElementById('rules') as HTMLDivElement;
const addButton = document.getElementById('add-rule') as HTMLButtonElement;
const saveButton = document.getElementById('save') as HTMLButtonElement;
const status = document.getElementById('status') as HTMLParagraphElement;

async function run(action: () => Promise<void>, successMessage: string): Promise<void> {
  try {
    await action();
    status.textContent = successMessage;
  } catch (error) {
    status.textContent = `操作失敗：${(error as Error).message}`;
  }
}

function addRow(rule: TokenRule): HTMLInputElement {
  const row = document.createElement('div');
  row.className = 'rule';

  const pattern = document.createElement('input');
  pattern.type = 'text';
  pattern.className = 'pattern';
  pattern.setAttribute('aria-label', '規則');
  pattern.placeholder = 'owner 或 owner/repo，* 為預設';
  pattern.spellcheck = false;
  pattern.value = rule.pattern;

  const token = document.createElement('input');
  token.type = 'password';
  token.className = 'token';
  token.setAttribute('aria-label', 'Token');
  token.autocomplete = 'off';
  token.spellcheck = false;
  token.value = rule.token;

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.textContent = '刪除';
  remove.addEventListener('click', () => row.remove());

  row.append(pattern, token, remove);
  rulesEl.append(row);
  return pattern;
}

function collectRules(): TokenRule[] {
  return Array.from(rulesEl.querySelectorAll<HTMLDivElement>('.rule'))
    .map((row) => ({
      pattern: row.querySelector<HTMLInputElement>('.pattern')!.value.trim(),
      token: row.querySelector<HTMLInputElement>('.token')!.value.trim(),
    }))
    .filter((rule) => rule.pattern !== '' || rule.token !== '');
}

addButton.addEventListener('click', () => {
  addRow({ pattern: '', token: '' }).focus();
});

saveButton.addEventListener('click', () => {
  const rules = collectRules();
  const error = validateRules(rules);
  if (error) {
    status.textContent = error;
    return;
  }
  void run(() => setTokenRules(rules), '已儲存');
});

void getTokenRules()
  .then((rules) => {
    if (rules.length === 0) addRow({ pattern: '*', token: '' });
    for (const rule of rules) addRow(rule);
  })
  .catch((error) => {
    status.textContent = `讀取設定失敗：${(error as Error).message}`;
  });
