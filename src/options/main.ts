import { getToken, setToken } from '../lib/storage';
import './options.css';

const tokenInput = document.getElementById('token') as HTMLInputElement;
const saveButton = document.getElementById('save') as HTMLButtonElement;
const clearButton = document.getElementById('clear') as HTMLButtonElement;
const status = document.getElementById('status') as HTMLParagraphElement;

async function run(action: () => Promise<void>, successMessage: string): Promise<void> {
  try {
    await action();
    status.textContent = successMessage;
  } catch (error) {
    status.textContent = `操作失敗：${(error as Error).message}`;
  }
}

saveButton.addEventListener('click', () => {
  void run(() => setToken(tokenInput.value.trim()), '已儲存');
});

clearButton.addEventListener('click', () => {
  void run(async () => {
    await setToken('');
    tokenInput.value = '';
  }, '已清除');
});

void getToken()
  .then((token) => {
    tokenInput.value = token;
  })
  .catch((error) => {
    status.textContent = `讀取設定失敗：${(error as Error).message}`;
  });
