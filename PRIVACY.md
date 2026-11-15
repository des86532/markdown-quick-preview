# Markdown Quick Preview 隱私權政策 / Privacy Policy

最後更新 / Last updated: 2026-11-16

## 繁體中文

### 資料收集
Markdown Quick Preview 不會收集、販售或傳送任何個人資料給開發者或第三方。本擴充功能沒有開發者伺服器，也不含分析、追蹤或廣告程式。

### 僅保存在本機的資料
以下資料只保存在使用者的瀏覽器中，不會同步或上傳：

- **GitHub Token 規則**：使用者在選項頁設定的規則與 Token，存於 `chrome.storage.local`。
- **貼上的 Markdown 內容**：存於 `chrome.storage.local`，7 天後自動刪除。
- **快速連結**：使用者選擇儲存的預覽紀錄（標題、類型，以及 GitHub repo、網址或貼上內容的識別碼），存於 IndexedDB。

### 對外連線
- 預覽 GitHub repo 時，擴充功能會直接向 `api.github.com` 與 `raw.githubusercontent.com` 讀取資料。若使用者設定了符合該 repo 的 Token，Token 只會以 `Authorization` 標頭傳送給這兩個網域。
- 預覽使用者輸入的 http(s) 網址時，擴充功能會直接請求該網址以取得內容。若需存取該網站，會先徵求使用者同意。
- 除上述由使用者觸發的請求外，擴充功能不會連線至任何其他伺服器。

### 權限用途
- `storage`、`unlimitedStorage`：在本機保存 Token 規則、貼上內容與快速連結。
- `activeTab`：僅在使用者點擊「使用目前分頁」時讀取目前分頁的網址。
- `https://api.github.com/*`、`https://raw.githubusercontent.com/*`：讀取 GitHub repo 目錄與檔案內容。
- 選用的 `http://*/*`、`https://*/*`：只有在使用者要預覽某個網址並同意授權時，才會請求該網站的存取權限。

### 刪除資料
使用者可在選項頁刪除 Token 規則、在彈出視窗刪除快速連結，或移除擴充功能以清除所有本機資料。

### 聯絡方式
如有問題，請至 https://github.com/des86532/markdown-quick-preview/issues 提出。

## English

### Data collection
Markdown Quick Preview does not collect, sell, or transmit any personal data to the developer or third parties. The extension has no developer-operated server and contains no analytics, tracking, or advertising code.

### Data stored locally
The following data is stored only in the user's browser and is never synced or uploaded:

- **GitHub token rules**: rules and tokens entered on the options page, stored in `chrome.storage.local`.
- **Pasted Markdown content**: stored in `chrome.storage.local` and automatically deleted after 7 days.
- **Quick links**: preview entries the user chooses to save (title, type, and the GitHub repo, URL, or paste identifier), stored in IndexedDB.

### Network requests
- When previewing a GitHub repository, the extension fetches data directly from `api.github.com` and `raw.githubusercontent.com`. If the user has configured a token matching that repository, the token is sent only to these two domains in the `Authorization` header.
- When previewing an http(s) URL entered by the user, the extension requests that URL directly to read its content, asking for the user's permission for that site first when required.
- Apart from these user-initiated requests, the extension does not connect to any other server.

### Permissions
- `storage`, `unlimitedStorage`: store token rules, pasted content, and quick links locally.
- `activeTab`: read the current tab's URL only when the user clicks "Use current tab".
- `https://api.github.com/*`, `https://raw.githubusercontent.com/*`: read GitHub repository trees and file contents.
- Optional `http://*/*`, `https://*/*`: requested per site only when the user previews a URL on that site and grants access.

### Deleting data
Users can delete token rules on the options page, delete quick links in the popup, or uninstall the extension to remove all local data.

### Contact
Questions: https://github.com/des86532/markdown-quick-preview/issues
