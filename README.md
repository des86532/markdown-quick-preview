# Markdown Quick Preview

Chrome / Edge（Manifest V3）擴充功能：快速預覽 Markdown 與 Mermaid 圖表。貼上文字、輸入網址，或直接指定 GitHub repo，即可開啟一個臨時預覽頁面。

## 功能

- **貼上內容**：貼上 Markdown 文字，產生預覽；內容保存 7 天後自動過期。
- **目前分頁**：將目前分頁的網址送入預覽流程。
- **直接網址**：輸入任意 `http(s)` 網址（例如 `.md`、`.mmd` 檔案連結），由預覽頁讀取並渲染。
- **GitHub repo / tree / blob**：
  - `https://github.com/owner/repo`：列出 repo 內所有 Markdown / Mermaid 文件，以目錄樹呈現，`README` 優先。
  - `https://github.com/owner/repo/tree/<ref>/<path>`：預覽指定資料夾。分支名稱可含 `/`，會自動嘗試拆分 ref 與路徑。
  - `https://github.com/owner/repo/blob/<ref>/<path>`：預覽單一檔案。
- **快速連結**：預覽過的 GitHub repo、網址與貼上內容可儲存在 IndexedDB 中，於彈出視窗列出、開啟或刪除。
- **Mermaid 圖表**：```` ```mermaid ```` 區塊與 `.mmd` / `.mermaid` 檔案會被渲染為圖表（Mermaid 採延遲載入）。
- **程式碼高亮**：使用 highlight.js。
- **GitHub Token**：私有 repo 或需提高 API 額度時，可在選項頁設定一或多組 Token。

## 安裝（開發者模式）

1. 安裝相依套件並建置：

   ```bash
   npm install
   npm run build
   ```

2. 開啟 `chrome://extensions`（Edge 為 `edge://extensions`）。
3. 開啟右上角「開發人員模式」。
4. 點選「載入未封裝項目」，選擇本專案的 `dist/` 資料夾。

開發時可使用 `npm run dev` 進行監看建置，修改後到擴充功能頁面重新載入即可。

## 使用方式

1. 點擊工具列上的 Markdown Quick Preview 圖示。
2. 在輸入框貼上 Markdown 文字、網址或 GitHub 連結，或按「使用目前分頁」。
3. 按下預覽，系統會自動判斷輸入類型並開啟新的預覽分頁。
4. 若要保存，於預覽頁點選儲存連結；之後可從彈出視窗的快速連結清單再次開啟。

## GitHub Token 設定

選項頁提供 Token 規則清單，每條規則包含 **規則** 與 **Token**：

| 規則格式 | 範例 | 適用範圍 |
| --- | --- | --- |
| `owner/repo` | `acme/private-docs` | 僅該 repo |
| `owner` | `acme` | 該 owner 下所有 repo |
| `*` | `*` | 其餘所有請求（預設） |

比對順序為 `owner/repo` → `owner` → `*`，大小寫不敏感。規則不可重複，Token 不可為空。

Token 僅存於 `chrome.storage.local`，只會以 `Authorization` 標頭傳送至 `api.github.com` 與 `raw.githubusercontent.com`。舊版的單一 `githubToken` 會自動遷移為 `*` 規則。

建議使用僅具備唯讀權限的 Fine-grained Personal Access Token。

## 權限說明

| 權限 | 用途 |
| --- | --- |
| `storage` | 保存 Token 規則與暫存貼上內容 |
| `activeTab` | 取得目前分頁網址 |
| `unlimitedStorage` | 允許保存較大的貼上內容與連結快取 |
| `https://api.github.com/*` | 讀取 GitHub repo 目錄樹與 API |
| `https://raw.githubusercontent.com/*` | 讀取 GitHub 檔案內容 |
| `optional_host_permissions`（`http://*/*`、`https://*/*`） | 依需要讀取使用者指定的網址 |

## 專案結構

```
src/
  popup/     彈出視窗：輸入、分類、快速連結清單
  viewer/    預覽頁：目錄、文件渲染、導覽
  options/   選項頁：GitHub Token 規則
  lib/
    detect.ts   輸入分類與 GitHub 網址解析
    book.ts     由檔案路徑建立目錄樹與閱讀順序
    github.ts   GitHub API 與 raw 內容讀取
    render.ts   markdown-it 渲染、DOMPurify 淨化、Mermaid
    storage.ts  貼上內容與 Token 規則存取
    links.ts    快速連結（IndexedDB）
    tokens.ts   Token 規則比對與驗證
public/manifest.json   擴充功能 manifest（建置時複製至 dist）
```

## 開發指令

| 指令 | 說明 |
| --- | --- |
| `npm run dev` | 監看模式建置至 `dist/` |
| `npm run build` | 型別檢查後建置 |
| `npm run typecheck` | 僅執行 TypeScript 型別檢查 |
| `npm test` | 執行 Vitest 單元測試 |

## 技術棧

- TypeScript、Vite
- markdown-it（含 markdown-it-anchor、github-slugger）
- highlight.js
- Mermaid
- DOMPurify（渲染結果淨化）
- github-markdown-css
- Vitest

## 已知限制

- GitHub 目錄樹 API 回傳 `truncated` 時，大型 repo 只會列出部分檔案。
- 未設定 Token 時受 GitHub API 未認證速率限制約束。
- 貼上內容與快速連結為本機保存，清除瀏覽器資料後會遺失。
