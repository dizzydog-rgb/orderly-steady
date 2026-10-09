# [2026-10-09] 使用者設定（暱稱與密碼變更）

## 1. User Story

作為一個已登入的使用者，我希望能夠在「會員中心」進入一個「帳號設定」頁面，修改我的暱稱與密碼，以便維護個人資料的正確性與帳號安全。Email 作為帳號唯一識別碼，此功能不提供變更。

**核心變更**：
- 新增 `PATCH /api/auth/me`（暱稱變更）與 `PATCH /api/auth/password`（密碼變更）兩個後端端點。
- 新增前端 `SettingsView.vue`，於 `/member/settings` 路由提供兩個獨立表單（暱稱／密碼）。
- 密碼變更成功後，後端刪除該使用者「所有」RefreshToken（含目前裝置），前端清空登入狀態並導向 `/login`，要求重新登入——視為一次完整的重新身分驗證。
- 暱稱欄位不可清空，至少需 1 個字元（trim 後）。

## 2. 測試流程驗證 (Test Flow)

改為 **Playwright E2E 自動化測試**，取代手動操作驗證。使用一組「專用測試帳號」而非既有的 demo 帳號（`demo@example.com` 是 `prisma/seedDemo.ts` 用於產生圖表示範資料的帳號，密碼變更測試會改掉它的密碼，污染示範資料；因此需獨立一組帳號專供自動化測試使用、可被重複重置）。

**測試帳號**（新增於 `e2e/testAccount.ts`，並記錄於 `CLAUDE.md`）：
```
Email   : e2e.settings@orderly-steady.test
Password: E2eTest1234!
Name    : E2E 測試員
```
此帳號僅供自動化測試使用；每次測試執行前由 Playwright `globalSetup` 透過 Prisma 直接刪除重建（同 `prisma/seedDemo.ts` 的 delete-then-create 模式），確保密碼變更測試不會讓帳號狀態累積髒資料。

1. **一次性前置**：`npx playwright install chromium` 下載瀏覽器執行檔（repo 目前只裝了套件，沒有瀏覽器 binary，不先跑這步 `playwright test` 會直接失敗）。
2. **準備環境**（人工啟動，Playwright 不自動啟動服務）：`docker-compose up -d` 啟動 MySQL；`RATE_LIMIT_DISABLED=true npm run dev:server`（見 3.1 速率限制說明）、`npm run dev` 分別啟動後端（3100）與前端（5173）。
   > ⚠️ E2E 測試會對 `DATABASE_URL` 指向的資料庫**實際寫入／刪除**測試帳號資料列。`resetE2ETestUser()` 內需加防護：若 `DATABASE_URL` 的 host 不是 `localhost`／`127.0.0.1` 就直接 throw，避免誤對正式資料庫執行。
3. **測試帳號重置時機**：
   - `globalSetup`（`e2e/global-setup.ts`）：整個測試執行前建立帳號一次。
   - **每個 test 的 `beforeEach` 也要再呼叫 `resetE2ETestUser()`**——因為密碼變更測試會把密碼改掉，若只在 globalSetup 重置，後續案例（或 Playwright retry）用 `E2E_TEST_PASSWORD` 登入就會失敗。每個案例都從已知密碼、已知暱稱的乾淨狀態開始。
4. **`e2e/settings.spec.ts` 測試案例**（每個案例以 `beforeEach` 重置帳號 → 登入 → 進入 `/member/settings`）：
   - Email 顯示為唯讀：頁面上看得到 Email 值，但**不存在可編輯的 email input**（守住「Email 不可變更」這條核心需求）。
   - 暱稱更新成功 → 顯示成功訊息，重新整理頁面後新暱稱仍保留。
   - 暱稱清空送出 → 前端 `required` 擋下（檢查 input 的 `required` 屬性與未發出請求）。
   - 密碼表單輸入錯誤「目前密碼」→ 顯示「目前密碼不正確」，停留在 `/member/settings`（驗證**不會**觸發 `fetchWithAuth` 的 401 refresh/強制登出流程）。
   - 新密碼與確認新密碼不一致 → 前端擋下並顯示錯誤，不發出請求。
   - 正確「目前密碼」+ 新密碼 + 確認密碼一致 → 成功後導向 `/login`；以舊密碼登入應失敗（顯示「帳號或密碼錯誤」），以新密碼登入應成功。
5. **不納入 E2E 範圍、改為手動/既有測試覆蓋**：
   - Rate limit（429）：E2E 若觸發會污染其他案例的計時窗口，改為人工驗證（在**未**設 `RATE_LIMIT_DISABLED` 的後端上連續送出暱稱／密碼請求，確認超過限制後收到 429）。
   - 多裝置登出驗證（第二裝置 refresh token 失效）：需要雙瀏覽器 context 模擬，若時間允許可額外補一支 `e2e/settings-multi-device.spec.ts`（非必要，先手動驗證：兩個瀏覽器分別登入，密碼變更後第二個瀏覽器呼叫任何需登入 API 應收到 401 並被導回 `/login`）。
6. **單元測試（Vitest，與 E2E 互補不重疊）**：E2E 走真實瀏覽器＋真實 DB，不適合製造「使用者不存在」、「帳號 password=null」等邊界狀態；這些維持專案既有的 supertest + mock Prisma 做法（見 5. Tasks 第 3 項）。
7. **最終確認**：`npm run test`（Vitest，含新增的 route/schema 測試）與 `npm run test:e2e`（Playwright）皆全數通過；資料庫中 `User.name` / `User.password` 正確更新；密碼變更後 `RefreshToken` 表中該 userId 的所有紀錄均被刪除。

## 3. Spec 與架構設計

### 3.1 技術細節 / 邏輯設計

**端點拆分（不合併為單一 PATCH）**：暱稱屬低風險中繼資料；密碼屬高風險操作（需驗證目前密碼、需獨立且更嚴格的速率限制、成功後需做 session 失效處理）。混用同一端點會讓風險等級混在一起，拆分後各自的 Zod schema 與 rate limiter 可各自調整。

**暱稱更新**（`server/schemas/auth.schemas.ts` 新增）：
```ts
export const UpdateNicknameSchema = z.object({
  name: z.string().trim().min(1, '名稱不得為空').max(50, '名稱不得超過 50 字'),
});
```

**密碼更新**（`server/schemas/auth.schemas.ts` 新增）：
```ts
export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, '請輸入目前密碼'),
    newPassword: z.string().min(8, '密碼需要至少 8 個字元').max(100, '密碼不得超過 100 字'),
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: '新密碼不得與目前密碼相同',
    path: ['newPassword'],
  });
```
`validate<T extends z.ZodTypeAny>`（`server/middleware/validate.ts`）接受任何 Zod 型別，`.refine()` 的回傳值也符合，**不需修改 middleware**。（註：本專案用 zod ^4.4.3，Zod 4 已無 Zod 3 的 `ZodEffects` 概念，refinement 直接掛在原 schema 上。）

**密碼規則需與註冊共用，避免日後分歧**：`RegisterSchema` 現為 `password: z.string().min(8, '密碼需要至少 8 個字元')`。建議在 `auth.schemas.ts` 抽出 `const passwordField = z.string().min(8, '密碼需要至少 8 個字元').max(100, '密碼不得超過 100 字')`，讓 `RegisterSchema.password` 與 `ChangePasswordSchema.newPassword` 共用同一份規則與錯誤訊息。

**`validate()` 會回寫 `req.body = result.data`**：因此 `UpdateNicknameSchema` 的 `.trim()` 生效後，handler 收到的 `name` 已是 trim 過的字串，不需在 route 內再處理空白。

**密碼驗證錯誤用 400 而非 401**：`fetchWithAuth`（`src/utils/fetchWithAuth.ts`）會把任何 401 視為「access token 過期」而自動 refresh + retry，若把「目前密碼錯誤」設為 401，使用者打錯密碼會觸發不必要的 token 旋轉，連續打錯兩次甚至可能被 `fetchWithAuth` 的攔截邏輯導回 `/login`。因此固定回 `400 { error: "目前密碼不正確" }`，401 只保留給 `authMiddleware` 本身判定 token 無效的情況。

**密碼變更後的 session 處理（已與使用者確認）**：成功後以 `prisma.$transaction` 同時更新密碼雜湊與 `prisma.refreshToken.deleteMany({ where: { userId } })`（刪除含目前裝置的所有 refresh token），並 `res.clearCookie('refreshToken', ...)`。Access token 本身不由伺服器端追蹤，理論上仍可存活到剩餘 TTL（≤15 分鐘），此為標準 JWT 權衡，不額外實作 token 黑名單（無對應基礎設施，風險等級不需要）。前端收到成功回應後清空本地登入狀態並導向 `/login`，要求重新登入。

**密碼雜湊**：沿用既有 `server/services/authService.ts` 的 `hashPassword` / `comparePassword`（bcryptjs，`SALT_ROUNDS = 10`），不需新增工具函式。

**`src/stores/auth.ts` 匯入 `fetchWithAuth` 的循環依賴**：`fetchWithAuth` 本身會 `import { useAuthStore }`，形成兩節點循環。此處安全——`fetchWithAuth` 對 store 的取用都在 async 函式內部執行，不在模組 top-level，真正呼叫時 store 模組早已初始化完成。`src/stores/history.ts` 已同時匯入兩者並正常運作，可作為既有驗證。

**Rate Limiting**（沿用 `server/routes/meals.ts` 的 `express-rate-limit` 模式）：
- 暱稱：`windowMs: 5*60*1000, max: 10`（低風險，允許使用者多次嘗試修正錯字）。
- 密碼：`windowMs: 15*60*1000, max: 5`（與登入同等級風險——有 access token 的攻擊者可藉此暴力猜測目前密碼進而奪取帳號，需嚴格限制）。

**速率限制必須可在 E2E 測試時關閉（否則測試無法重跑）**：`express-rate-limit` 以 IP 計數，E2E 全部流量都來自同一個 localhost IP。一輪測試至少送出 2 次密碼變更請求（錯誤密碼 + 成功變更），開發除錯時連跑 3 輪就會超過 `max: 5` 而開始收到 429，造成與功能無關的測試失敗。因此兩個 limiter 都加上：
```ts
skip: () => process.env.NODE_ENV !== 'production' && process.env.RATE_LIMIT_DISABLED === 'true',
```
雙條件確保即使正式環境誤設 `RATE_LIMIT_DISABLED=true`，暴力破解防護也不會被關掉。跑 E2E 時以 `RATE_LIMIT_DISABLED=true npm run dev:server` 啟動後端；人工驗證 429 時則不帶此變數。

**暱稱不可清空**：Zod `min(1)` 搭配前端 `required`，使用者若不想變更暱稱，維持原值不送出即可；此次不支援「清空回到未設定」。

**Playwright E2E 測試基礎設施（新增）**：
- 現狀確認：`package.json` 原僅有 `playwright`（核心瀏覽器自動化函式庫，無任何程式碼實際使用它）而無測試執行器 `@playwright/test`；repo 內沒有任何 `playwright.config.*`、`e2e/` 目錄或既有 Playwright 測試。**已執行** `npm install -D @playwright/test`（計畫討論階段已先裝好，package.json 已反映）。建議同時移除未被使用的 `playwright` 核心套件，避免兩個版本的瀏覽器執行環境混用造成混淆。
- `playwright.config.ts`（新增於專案根目錄）：`testDir: './e2e'`、`globalSetup: './e2e/global-setup.ts'`、`use.baseURL: 'http://localhost:5173'`、`workers: 1` **且** `fullyParallel: false`。兩者都要設：`fullyParallel: false` 只讓**同一檔案內**的 test 依序執行，不同檔案仍會分配到多個 worker 平行跑；由於所有 spec 共用同一組測試帳號（一個 test 正在改密碼、另一個同時在登入會互相破壞），必須用 `workers: 1` 真正序列化。不使用 Playwright 的 `webServer` 自動啟動選項，因為本專案需要先啟動 Docker MySQL + 後端 + 前端三個獨立程序，與現有 `npm run dev`/`npm run dev:server` 的雙程序手動啟動慣例一致。
- `e2e/testAccount.ts`（新增）：匯出 `E2E_TEST_EMAIL`、`E2E_TEST_PASSWORD`、`E2E_TEST_NAME` 常數，以及 `resetE2ETestUser()`（直接用 Prisma `deleteMany` + `create`，密碼以 `bcryptjs` 雜湊，寫法比照 `prisma/seedDemo.ts`；刪除 User 時 `RefreshToken` 會因 cascade 一併清除）。被 `e2e/global-setup.ts` 與 `e2e/seedTestAccount.ts` 共用，避免邏輯重複。注意兩點：(1) `resetE2ETestUser()` 會在每個 test 的 `beforeEach` 被呼叫，`PrismaClient` 要用模組層單例（不要每次 new 一個，否則連線數會累積），並在 `globalTeardown` 做 `$disconnect()`；(2) 函式開頭檢查 `DATABASE_URL` 的 host 必須是 localhost／127.0.0.1，否則 throw。
- `e2e/global-setup.ts`（新增）：Playwright `globalSetup` 進入點，呼叫 `resetE2ETestUser()`。搭配 `e2e/global-teardown.ts` 做 Prisma `$disconnect()`。
- **tsconfig 覆蓋範圍**：`tsconfig.app.json` 只含 `src/**/*`、`tsconfig.node.json` 只含 `vite.config.ts`、`tsconfig.server.json` 含 `server/**/*` 與 `prisma/**/*`——新的 `e2e/**/*.ts` 與 `playwright.config.ts` **不在任何 project 內**，編輯器與 `npm run build`（`vue-tsc -b`）都不會檢查它們。需把它們加進 `tsconfig.node.json` 的 `include`（該 config 已有 `types: ["node"]`，適合工具類檔案）；注意它開了 `verbatimModuleSyntax`，型別匯入要寫 `import type`。`e2e/seedTestAccount.ts` 已被 `tsconfig.server.json` 的 `prisma/**/*` 涵蓋，不需調整。
- `e2e/seedTestAccount.ts`（新增，供人工手動重置用，`npm run seed:e2e`）：匯入並呼叫 `resetE2ETestUser()`，印出帳號資訊。
- `package.json` 新增 script：`"test:e2e": "playwright test"`、`"seed:e2e": "tsx e2e/seedTestAccount.ts"`。
- `.gitignore` 新增：`/playwright-report/`、`/test-results/`、`/blob-report/`。
- **既有 UI 可測試性缺口**：`src/views/LoginView.vue` 的 `<label>` 與 `<input>` 沒有用 `for`/`id` 關聯（純視覺排版），Playwright 的 `page.getByLabel()` 無法命中。為讓 E2E 測試可用穩定、不依賴 DOM 結構的選擇器，需要：
  - 在 `LoginView.vue` 的 email input、password input、submit button 上補 `data-testid="login-email"` / `data-testid="login-password"` / `data-testid="login-submit"`（純屬性新增，不影響現有行為與樣式）。
  - 新增的 `SettingsView.vue` 從一開始就用 `data-testid` 標記關鍵元素：`nickname-input`、`nickname-submit`、`nickname-success`、`current-password-input`、`new-password-input`、`confirm-password-input`、`password-submit`、`password-error`（取代原本計畫中僅用文字比對的做法）。

### 3.2 路由與 API 端點

- **API 端點**：
  - `PATCH /api/auth/me`（`authMiddleware` + `nicknameRateLimit` + `validate(UpdateNicknameSchema)`）：更新暱稱，回傳 `{ message, user }`。
  - `PATCH /api/auth/password`（`authMiddleware` + `passwordRateLimit` + `validate(ChangePasswordSchema)`）：驗證目前密碼並更新，成功刪除該使用者所有 RefreshToken 並清除 cookie，回傳 `{ message }`。
- **頁面路由**：
  - `GET /member/settings`（新增，`src/router/index.ts`，無 `meta.public`，沿用預設需登入的 `beforeEach` 導向規則）→ `SettingsView.vue`。

### 3.3 資料庫變動

無。`User.name`、`User.password` 欄位已存在（`prisma/schema.prisma`），不需新增 migration。

## 4. 環境與設定 (.env)

- `RATE_LIMIT_DISABLED=true` — **僅 E2E 測試時**在啟動後端的指令前加上此變數（不需寫入 `.env`，避免日常開發也關閉保護）。實作上以 `process.env.NODE_ENV !== 'production'` 雙重把關，正式環境即使誤設也無效。
- 無其他新增變數；E2E 沿用現有 `DATABASE_URL`（即開發資料庫，見 2. 的資料庫警告）。

## 5. Tasks

- [x] 0. **先同步專案計畫文件**：`docs/plans/2026-10-09-user-settings.md` 目前仍是改用 Playwright 之前的版本（測試章節寫「手動測試」、任務清單只有 9 項、沒有測試帳號與 Playwright 內容），需以本計畫的最新內容覆寫，兩份才不會分歧。
- [x] 1. `server/schemas/auth.schemas.ts`：抽出共用 `passwordField` 規則；新增 `UpdateNicknameSchema`、`ChangePasswordSchema`（含型別 `UpdateNicknameInput`、`ChangePasswordInput`）。
- [x] 2. `server/routes/auth.ts`：新增 `nicknameRateLimit`、`passwordRateLimit`（含 `skip` 測試旁路）；新增 `PATCH /me`、`PATCH /password` 路由（沿用檔案現有的無 try/catch、Express 5 原生錯誤傳遞風格，與 `register`/`login`/`me` 一致）。
- [x] 3. **Vitest 單元測試**（沿用專案既有慣例，E2E 不覆蓋這些邊界）：
  - `server/__tests__/routes/auth.spec.ts`：新增 `PATCH /me`（200、400 空名稱）與 `PATCH /password`（200、400 目前密碼錯誤、400 新舊密碼相同、400 帳號 password=null、404 使用者不存在）。**兩個既有 mock 需要擴充**：`vi.mock('../../db')` 的 factory 目前沒有 `$transaction`（新路由會用到），`vi.mock('../../services/authService')` 的 factory 目前沒有 `verifyAccessToken`——因 `vi.mock` 會整個替換模組，缺這個 export 會讓 `authMiddleware` 呼叫到 `undefined` 而一律回 401，受保護路由測不起來。
  - `server/__tests__/middleware/validate.spec.ts`：補 `UpdateNicknameSchema`（空字串／純空白／51 字）與 `ChangePasswordSchema`（新舊密碼相同、新密碼 < 8 字）的合法與非法邊界，確認 `details[].field` 正確。
- [x] 5. `src/stores/auth.ts`：新增 `updateNickname(name)`（透過 `fetchWithAuth` 呼叫 `PATCH /api/auth/me`，成功後 `this.user = data.user`）與 `changePassword(currentPassword, newPassword)`（透過 `fetchWithAuth` 呼叫 `PATCH /api/auth/password`，成功後呼叫 `this._clearState()` + `useHistoryStore().reset()`，不在 store 內導航）。
- [x] 6. 新增 `src/views/SettingsView.vue`：三個區塊——**Email 唯讀顯示**（附「Email 為帳號識別碼，不可變更」說明文字，不放任何 input）、暱稱表單、密碼表單；沿用 `LoginView.vue`/`MemberView.vue` 的 `ref` + `errorMsg` + `isLoading` + 按鈕文字替換 + `.xxx-card` scoped CSS 慣例；密碼表單含 `currentPassword`/`newPassword`/`confirmPassword`，前端先檢查兩次新密碼一致後才呼叫 store action，成功後 `router.push('/login')`；關鍵元素補 `data-testid`（見 3.1）。
- [x] 7. `src/router/index.ts`：新增 `{ path: '/member/settings', component: SettingsView }`。
- [x] 8. `src/views/MemberView.vue`：於 `.actions` 區塊新增「帳號設定」連結（沿用現有 `.back-link` 樣式），指向 `/member/settings`。
- [x] 9. `src/views/LoginView.vue`：補上 `data-testid="login-email"` / `login-password` / `login-submit`（供 E2E 測試穩定選取，不影響現有行為）。
- [x] 10. Playwright 基礎設施：`playwright.config.ts`（`workers: 1`）、`e2e/testAccount.ts`（含 localhost 防護與 Prisma 單例）、`e2e/global-setup.ts`、`e2e/global-teardown.ts`；`tsconfig.node.json` 的 `include` 加入 `playwright.config.ts` 與 `e2e/**/*.ts`；`package.json` 新增 `test:e2e`、`seed:e2e` script；`.gitignore` 新增 `/playwright-report/`、`/test-results/`、`/blob-report/`；移除未使用的 `playwright` 核心套件（改用已安裝的 `@playwright/test`）。
- [x] 11. `e2e/seedTestAccount.ts`：人工手動重置測試帳號的便利腳本。
- [x] 12. 執行 `npx playwright install chromium`（一次性下載瀏覽器）；撰寫並執行 `e2e/settings.spec.ts`（依「2. 測試流程驗證」的案例，每個 test 以 `beforeEach` 重置帳號），`npm run test:e2e` 全數通過；Rate limit 與多裝置登出改人工驗證。
- [x] 13. `CLAUDE.md` 同步更新三處：(a) 新增「E2E 測試帳號」段落（帳號/密碼、僅供測試用途、每次測試自動重置、`RATE_LIMIT_DISABLED` 說明）；(b) 常用指令加入 `npm run test:e2e`、`npm run seed:e2e`；(c) **「Auth API 端點」表格補上 `PATCH /me` 與 `PATCH /password` 兩列**（現有表格只列到 `GET /me`）。
- [x] 14. 其他文件同步：`docs/TESTING.md` 新增 Playwright E2E 章節並更新測試總數；`docs/API.md` 新增兩個端點；`docs/FEATURES.md` 加入設定功能；`docs/ARCHITECTURE.md` 目錄結構補上 `e2e/`；`docs/CHANGELOG.md` 記錄本次變更。
- [x] 15. 依 CLAUDE.md 規則，完成後將 `docs/plans/2026-10-09-user-settings.md` 移至 `docs/plans/archive/`。

## 6. 驗收結果

**測試結果**

- `npm run test`（Vitest）：**63 passed**（原 47，新增 16 個：`PATCH /me` 3 項、`PATCH /password` 5 項、`UpdateNicknameSchema` 3 項、`ChangePasswordSchema` 3 項，另 2 項為既有測試重整後計入）。
- `npm run test:e2e`（Playwright chromium，6 tests）：**6 passed**（12.3s）。涵蓋 Email 唯讀、名稱更新後重整保留、名稱清空被擋、目前密碼錯誤顯示 400 訊息且未被登出、新密碼不一致被擋、密碼變更後導向 `/login` 且舊密碼失效／新密碼可登入。
- `npx vue-tsc -b`：型別檢查通過（含納入 `tsconfig.node.json` 的 `e2e/**/*.ts` 與 `playwright.config.ts`）。

**人工驗證（E2E 不覆蓋的項目）**

- 速率限制：以臨時後端實例（3101／3102）連續送出 7 次密碼變更請求驗證兩個方向——
  - `RATE_LIMIT_DISABLED=true`：`400 400 400 400 400 400 400`（旁路生效，從不回 429）。
  - 預設啟用：`400 400 400 400 400 429 429`（第 6 次起擋下，符合 `max: 5`）。
- 多裝置登出：由單元測試斷言 `$transaction` 內呼叫 `refreshToken.deleteMany({ where: { userId } })`，加上 E2E 驗證變更後必須重新登入。**尚未**以雙瀏覽器 context 實際跑過第二裝置的 refresh 401，建議日後補 `e2e/settings-multi-device.spec.ts`。

**環境修正（實作過程中發現的既有問題）**

- `docker-compose.yml` 需要 `${MYSQL_ROOT_PASSWORD}`，但 `.env` 缺此變數，導致 MySQL 容器反覆重啟（`Database is uninitialized and password option is not specified`）。已於 `.env` 補上（值取自 `DATABASE_URL`），並以 `npx prisma migrate deploy` 套用 6 個 migration 建表。CLAUDE.md 的 `.env` 清單也已補上此變數。

**文件同步狀態**

- `CLAUDE.md`：新增 E2E 測試帳號段落、`test:e2e`／`seed:e2e` 指令、Auth API 表格補 `PATCH /me` 與 `PATCH /password`、`.env` 補 `MYSQL_ROOT_PASSWORD`。
- `docs/API.md`：新增兩個端點完整文件（含 400 vs 401 的設計理由）。
- `docs/FEATURES.md`：新增「3.1 帳號設定」並補兩個端點進度。
- `docs/TESTING.md`：新增 Playwright E2E 章節、測試數量更新為 Vitest 63 + E2E 6。
- `docs/ARCHITECTURE.md`：目錄結構補 `e2e/` 與 `playwright.config.ts`。
- `docs/CHANGELOG.md`：新增 `[0.9.4] - 2026-10-09`。

## 7. 實作與計畫的差異

實作過程中與原計畫不同、或額外補上的項目：

- **測試帳號重置腳本放在 `e2e/seedTestAccount.ts`**（原計畫寫 `prisma/seedE2E.ts`）：`tsconfig.server.json` 的 include 含 `prisma/**/*`，若放在 prisma 下會把 e2e 程式碼一併編進 `npm run build:server` 的產物。
- **未建立 `IChangePasswordResponse`**：密碼變更的回應只有 `{ message }` 且前端不讀取，建了會是死碼（`noUnusedLocals` 也會擋下未使用的區域變數）。實際新增的型別為 `IUpdateNicknameRequest`、`IUpdateNicknameResponse`、`IChangePasswordRequest`、`IApiErrorResponse`。
- **額外修正 `vite.config.ts`**：Vitest 預設 include 會抓 `**/*.spec.ts`，連 Playwright 的 `e2e/settings.spec.ts` 也會被當單元測試執行並失敗，因此加上 `exclude: [...configDefaults.exclude, 'e2e/**']`。
- **`e2e/global-teardown.ts`**：收斂 `resetE2ETestUser()` 共用的 PrismaClient 連線（`$disconnect()`）。
- **移除未使用的 `playwright` 核心套件**，改用 `@playwright/test`（測試執行器）。
