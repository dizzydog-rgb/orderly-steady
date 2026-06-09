# 2026-06-08 Production Deployment Fixes（Railway + Cloudflare Pages）

## 1. User Story

作為開發者，我希望能將 Orderly & Steady 完整部署至雲端（Railway MySQL → Railway Node.js → Cloudflare Pages），以便使用者透過公開網址使用系統。

**核心變更**：修復三個阻止部署的致命問題——後端缺少 build/start 機制、前端 API 路徑在跨域部署後全部 404、httpOnly cookie 在跨域環境下因 SameSite 設定錯誤無法傳送。

---

## 2. 測試流程驗證 (Test Flow)

1. **準備環境**
   - Railway 已建立 MySQL Plugin 並取得 `DATABASE_URL`
   - Railway Node.js Service 已設定所有環境變數（含 `FRONTEND_URL`）
   - CF Pages 已設定 `VITE_API_URL=https://<railway-backend>.up.railway.app`

2. **操作路徑**
   1. 在 Railway Service 觸發 deploy，確認 build log 出現 `Server is running on port 3000`
   2. 開啟 CF Pages 網域，進入 `/login` 頁面
   3. 註冊新帳號 → 登入 → 進入 `/history`
   4. 重新整理頁面確認仍維持登入狀態（refresh token cookie 有效）
   5. 直接在網址列輸入 `/history` 確認不出現 404

3. **預期結果**
   - Railway deploy log：`Server is running on port 3000`
   - Network：`/api/auth/login` 請求打到 Railway 後端，回傳 200 + Set-Cookie
   - Network：Cookie 帶有 `Secure; SameSite=None`（DevTools → Application → Cookies）
   - 重新整理後 `/api/auth/refresh` 成功回傳新 access token
   - 直接輸入子路由不 404

4. **最終確認**
   - 能完整走完「登入 → 新增飲食 → 查看歷史」流程
   - DevTools Network 無 CORS 錯誤、無 401 非預期錯誤

---

## 3. Spec 與架構設計

### 3.1 技術細節 / 邏輯設計

#### 問題 A — 後端 build & start（Railway 無法啟動）

Railway 預設執行 `npm start`，但目前 `package.json` 無此 script；`build` 也只編譯前端。

**方案**：新增獨立的 `tsconfig.server.json`（不影響前端 build），使用 tsc 將 `server/` 編譯至 `dist/server/`，再以 `node` 執行。

**tsconfig.server.json 內容**：
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node",
    "outDir": "dist",
    "rootDir": ".",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "strict": true
  },
  "include": ["server/**/*"],
  "exclude": ["node_modules", "src", "dist"]
}
```
> `rootDir: "."` → `server/index.ts` 編譯輸出為 `dist/server/index.js`

**package.json 新增 scripts**：
```jsonc
"build:server": "tsc --project tsconfig.server.json",
"start": "node dist/server/index.js"
```

**railway.json 內容**（指定 buildCommand / startCommand / preDeployCommand）：
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "buildCommand": "npm run build:server"
  },
  "deploy": {
    "startCommand": "npm start",
    "preDeployCommand": "npx prisma migrate deploy",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

#### 問題 B — 前端 API 路徑跨域 404（CF Pages）

CF Pages 是純靜態，不會 proxy `/api/*`。前端目前所有 fetch 都用相對路徑，部署後會打到 `https://<cf-domain>/api/xxx`（不存在）。

**方案**：新增 `src/utils/apiUrl.ts`，集中管理 base URL：

```typescript
const BASE = import.meta.env.VITE_API_URL ?? ''
export const apiUrl = (path: string) => `${BASE}${path}`
```

修改所有 fetch 呼叫改用 `apiUrl('/api/...')`：
- `src/stores/auth.ts`（5 處：login、register、refresh、me、logout）
- `src/stores/history.ts`（1 處：GET meals）
- `src/utils/fetchWithAuth.ts` 本身不改，呼叫方傳入已修正的 URL 即可

`.env.production`（本機參考，不 commit）：
```
VITE_API_URL=https://<railway-backend>.up.railway.app
```

CF Pages 環境變數（Build 時期）：
```
VITE_API_URL=https://<railway-backend>.up.railway.app
```

開發時 `VITE_API_URL` 留空（或不設），相對路徑照舊走 Vite proxy，無需改動 `vite.config.ts`。

#### 問題 C — SameSite=Strict 導致跨域 cookie 無法送出

CF Pages（`*.pages.dev`）與 Railway（`*.up.railway.app`）為不同 eTLD+1，瀏覽器在 `SameSite=Strict` 下不會在跨站請求中帶 cookie，refresh token 完全失效。

**方案**：修改 `server/routes/auth.ts`（`REFRESH_COOKIE_OPTIONS`）：

```typescript
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,           // HTTPS 才能用 SameSite=None
  sameSite: 'none' as const,   // 跨域必要
  maxAge: REFRESH_TOKEN_TTL_MS,
  path: '/api/auth',
}
```

> `secure: true` 寫死（production 一定是 HTTPS）；`COOKIE_SECURE` env var 可移除或保留給本機開發旗標。

### 3.2 路由與 API 端點

無新增端點，僅修改現有行為。

### 3.3 資料庫變動

無 Schema 變動，無新 Migration。

---

## 4. 環境與設定 (.env)

**CF Pages（Build 環境變數）**
```
VITE_API_URL=https://<railway-backend>.up.railway.app
```

**Railway Node.js Service（Runtime 環境變數）**
```
NODE_ENV=production
PORT=3000
DATABASE_URL=${{MYSQL_PRIVATE_URL}}
JWT_SECRET=<64-char random>
JWT_REFRESH_SECRET=<64-char random>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
COOKIE_SECURE=true
FRONTEND_URL=https://<cf-pages-domain>.pages.dev
ANTHROPIC_API_KEY=sk-ant-...
```

---

## 5. Tasks

- [x] A-1. 新增 `tsconfig.server.json`（target ES2022，outDir `dist/`，include `server/**/*`，skipLibCheck true）
- [x] A-2. `package.json` 新增 `build:server` 與 `start` script
- [x] A-3. 新增 `railway.json`（指定 buildCommand、startCommand、Pre-Deploy migrate）
- [x] B-1. 新增 `src/utils/apiUrl.ts`
- [x] B-2. 修改 `src/stores/auth.ts` 5 處 fetch 改用 `apiUrl()`
- [x] B-3. 修改 `src/stores/history.ts` 1 處 fetch 改用 `apiUrl()`
- [x] C-1. 修改 `server/routes/auth.ts` 的 `REFRESH_COOKIE_OPTIONS`（sameSite → none，secure → true）
- [x] D-1. 新增 `public/_redirects`（SPA routing fallback，屬阻塞問題一併處理）
- [x] E-1. `npm run build:server` 確認 server 編譯，輸出 `dist/server/index.js`
- [x] E-2. `npm run build` 確認前端 build 通過（vue-tsc 型別檢查）

---

## 6. 驗收結果

- Railway deploy 成功，log 顯示 `Server is running on port 3000`
- CF Pages build 成功，bundle 包含 `VITE_API_URL`（可在 DevTools Sources 確認）
- 端對端登入 → refresh → 歷史紀錄流程正常
- 直接輸入子路由不 404
- Cookie 帶有 `Secure; SameSite=None`