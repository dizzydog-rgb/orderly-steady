# 2026-05-23 JWT 雙 Token 安全強化：HttpOnly Cookie + Pinia

## 1. User Story

作為系統開發者，我希望將 Refresh Token 從 `localStorage` 改存至 HttpOnly Cookie，使 XSS 腳本無法讀取 token，同時將 Access Token 以 Pinia store 管理於記憶體中，讓重整後能自動透過 `/api/auth/refresh` 恢復登入狀態，不影響使用者體驗。

**核心變更**：以 HttpOnly Cookie 取代 localStorage 儲存 Refresh Token；以 Pinia 取代 module-level ref 管理 Auth 狀態；前端新增 refresh deduplication 機制防止多 tab race condition。

## 2. 測試流程驗證 (Test Flow)

1. **準備環境**: 執行 `docker-compose up -d`、`npm run dev:server`、`npm run dev`，確認前後端同時運行
2. **登入驗證**:
   - 以帳號密碼登入
   - DevTools > Application > Cookies：確認 `refreshToken` 出現，且標記 HttpOnly ✓、SameSite=Strict ✓
   - Console 執行 `document.cookie`：不含 `refreshToken`
   - Console 執行 `localStorage.getItem('refreshToken')`：回傳 `null`
3. **重整恢復**:
   - 重整頁面，Network 出現 `POST /api/auth/refresh`
   - Request body 為空（token 由 cookie 自動帶入），status 200，頁面正常顯示
4. **API 正常流程**: 提交飲食記錄成功，確認 `fetchWithAuth` Bearer token 流程正常
5. **Deduplication**: 開兩個 tab 同時重整，Network 只出現一筆 `/api/auth/refresh` 請求
6. **登出**: 點擊登出後，Cookies 中 `refreshToken` 消失；重新登入可正常取得新 session

## 3. Spec 與架構設計

### 3.1 技術細節 / 邏輯設計

- **Cookie 安全設定**：`httpOnly: true`、`sameSite: 'strict'`、`path: '/api/auth'`（最小化 cookie 送出範圍）。`secure` 由環境變數 `COOKIE_SECURE` 控制，開發 `false`、正式 `true`，避免以 `NODE_ENV` 混用語義不同的判斷。
- **Refresh Token Rotation**：每次 `/refresh` 成功後廢棄舊 token 並下發新 token，後端比對 DB 中 `user.refreshToken !== receivedToken` 即觸發 reuse detection 回傳 401。
- **Deduplication**：Pinia store 中以 `_refreshPromise: Promise<boolean> | null` 記錄進行中的 refresh，後續呼叫直接 await 同一 Promise，避免多 tab 同時發出 refresh 造成第二個 tab 拿到已輪換的舊 token 而觸發 reuse detection。
- **Logout 順序**：先 `_clearState()` 清除記憶體 state，再 `await` server logout（clearCookie + DB refreshToken=null），若 server 失敗則靜默忽略，使用者仍視為已登出。
- **已知限制**：完整 token family 撤銷（多裝置 session 管理）需 DB schema 新增 `tokenFamily`、`tokenVersion` 欄位，超出本次範疇。

### 3.2 路由與 API 端點

- **API 端點**:
  - `POST /api/auth/login`（修改）：移除 response 中的 `refreshToken`，改以 `Set-Cookie` 下發；回傳 `{ accessToken, user }`
  - `POST /api/auth/refresh`（修改）：讀取來源改為 `req.cookies.refreshToken`；rotation 後新 token 同樣以 `Set-Cookie` 下發；回傳 `{ accessToken }`
  - `POST /api/auth/logout`（新增）：需 `authMiddleware`；DB `refreshToken` 清空並 `clearCookie`；回傳 `{ message: '已登出' }`

### 3.3 資料庫變動

無 schema 變更。`User.refreshToken` 欄位已存在，logout 時改為寫入 `null`。

## 4. 環境與設定 (.env)

- `FRONTEND_URL=http://localhost:5173`（CORS origin，正式環境改為實際網域）
- `COOKIE_SECURE=false`（開發環境；正式環境改為 `true`）

## 5. Tasks

- [x] 1. 安裝 `cookie-parser`、`@types/cookie-parser`、`pinia`
- [x] 2. `server/index.ts`：加入 `cookieParser()` middleware，CORS 加 `credentials: true` 與 `FRONTEND_URL`
- [x] 3. `server/routes/auth.ts`：定義 `REFRESH_COOKIE_OPTIONS`，login 改 cookie 下發，refresh 讀 cookie + rotation，新增 logout endpoint
- [x] 4. `.env`：新增 `FRONTEND_URL`、`COOKIE_SECURE`
- [x] 5. `src/main.ts`：掛載 `createPinia()`
- [x] 6. 新建 `src/stores/auth.ts`：Pinia auth store，含 login、register、refreshAccessToken（deduplication）、logout、_clearState
- [x] 7. 刪除 `src/composables/useAuth.ts`
- [x] 8. `src/views/LoginView.vue`、`HomeView.vue`、`MemberView.vue`：import 改為 `useAuthStore`
- [x] 9. `src/utils/fetchWithAuth.ts`：改用 store，所有 fetch 加 `credentials: 'include'`
- [x] 10. `src/router/index.ts`：改用 `useAuthStore`，保留 `!isLoggedIn` 條件防止每次導航都觸發 refresh

## 6. 驗收結果

- 所有 10 項 tasks 完成，`.env` 補齊兩個環境變數後達到完整實作
- Refresh Token 已從 localStorage 移除，改存 HttpOnly Cookie，無法被 XSS 腳本讀取
- Access Token 存於 Pinia 記憶體 store，重整後自動透過 `/refresh` 恢復，不需使用者重新登入
- `_refreshPromise` deduplication 機制防止多 tab race condition 觸發 reuse detection
- `src/composables/useAuth.ts` 已刪除，無多餘 indirection
- 未修改 Prisma schema，無需 migration
