# 2026-06-12 HomeView 訪客試用模式（先用、後註冊）

## 1. User Story

作為一個尚未註冊的訪客，我希望能直接在首頁輸入食物並取得血糖穩定評分，以便於先體驗產品價值；送出後再引導我註冊，把這次的紀錄保存下來。

**核心變更**：`POST /api/meals` 後端原本就不需登入（以 email upsert 自動建立帳號），但前端路由守衛將 HomeView 設為受保護路由，訪客無法進入輸入介面。本次開放 HomeView 為 public 路由，並在前端加入訪客 email 輸入、訪客/登入者 fetch 分流，與送出後的註冊引導 CTA。後端不做任何修改。

## 2. 測試流程驗證 (Test Flow)

1. **準備環境**: `docker-compose up -d` 啟動 MySQL，同時啟動 `npm run dev` 與 `npm run dev:server`，以無痕視窗（未登入）開啟 `http://localhost:5173/`
2. **操作路徑**:
   - 未登入直接開啟 `/` → 不應跳轉 `/login`，看見輸入區與「你的 Email」欄位
   - 輸入食物但不填 email 按送出 → 顯示「請輸入 Email 以儲存紀錄」
   - 填入格式錯誤的 email → 顯示「Email 格式不正確」
   - 填入合法 email + 食物 → 送出成功
3. **預期結果**: 顯示評分結果與動畫；歷史紀錄區塊隱藏，改顯示「📊 註冊帳號，追蹤每餐的血糖穩定趨勢」CTA（連往 `/login`）；DB 中建立 `password=null` 的 User 記錄
4. **最終確認**: 已登入使用者行為與原本完全相同（email 取自 authStore、`fetchWithAuth`、歷史紀錄顯示、樂觀更新）；`npm run test` 47 個測試全部通過

## 3. Spec 與架構設計

### 3.1 技術細節 / 邏輯設計

- **路由守衛** (`src/router/index.ts`): HomeView 路由加上 `meta: { public: true }`，`beforeEach` guard 不再強制跳轉 `/login`；`/member` 維持受保護，不動
- **訪客 email 輸入** (`src/views/HomeView.vue`): 新增 `guestEmail` / `guestEmailError` ref；email 輸入欄插在 `.slots` 區塊上方，只在 `!authStore.isLoggedIn` 顯示
- **訪客 email 驗證**: 未登入送出時先驗證非空與格式（regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`），錯誤顯示於 `guestEmailError`
- **handleSubmit fetch 分流**: 登入者用 `fetchWithAuth`、訪客用原生 fetch。注意：不可直接寫 `const fetchFn = isLoggedIn ? fetchWithAuth : fetch`（`fetch` 脫離 window 的 this 綁定會拋 `Illegal invocation`），須用 `fetch.bind(window)` 或 arrow function 包裝
- **email 來源**: `authStore.isLoggedIn ? authStore.user!.email : guestEmail.value.trim()`
- **樂觀更新分流**: 只有登入者且 `totalScore !== null` 才呼叫 `prependRecord`；訪客不執行
- **onMounted**: `fetchHistory()` 只在 `authStore.isLoggedIn` 時執行
- **歷史區塊條件渲染**: `history-section` 整體用 `v-if="authStore.isLoggedIn"` 包住（內容不變）；未登入時改用 `v-else-if="scoreResult"` 顯示 `.guest-cta` 引導區塊（含 `<router-link to="/login">` 按鈕）
- **CSS**: 新增 `.guest-cta` / `.cta-text` / `.cta-btn` 樣式（accent 色系背景與邊框、置中佈局、hover opacity 0.85）

| 狀態 | email 來源 | fetch 方式 | 歷史區塊 | 樂觀更新 |
|------|-----------|-----------|----------|----------|
| 未登入 | guestEmail input | 原生 fetch | 隱藏，送出後顯示 CTA | 不執行 |
| 已登入 | authStore.user.email | fetchWithAuth | 顯示（原有行為） | 執行 |

### 3.2 路由與 API 端點

- **API 端點**:
  - `POST /api/meals`（既有端點，無需登入，本次不修改後端）
- **頁面路由**:
  - `GET /`（HomeView，由受保護改為 `meta: { public: true }`）

### 3.3 資料庫變動

- 無。沿用既有 `POST /api/meals` 的 email upsert 行為（建立 `password=null` 帳號，之後可經 `POST /api/auth/register` 補全密碼完成註冊）。

## 4. 環境與設定 (.env)

- 無新增環境變數。

## 5. Tasks

- [x] 1. `src/router/index.ts`：HomeView 路由加 `meta: { public: true }`
- [x] 2. `src/views/HomeView.vue` script：新增 `guestEmail` / `guestEmailError` ref；修改 `handleSubmit`（訪客 email 驗證、fetch 分流、email 來源、樂觀更新加登入條件）；`onMounted` 的 `fetchHistory` 加登入條件
- [x] 3. `src/views/HomeView.vue` template：`.slots` 上方加訪客 email 輸入欄；歷史區塊加 `v-if="authStore.isLoggedIn"`；新增 `v-else-if="scoreResult"` 的 guest-cta 區塊
- [x] 4. `src/views/HomeView.vue` style：新增 `.guest-cta` / `.cta-text` / `.cta-btn` CSS
- [x] 5. 執行 `npm run test` 確認測試全部通過（第 2 節手動流程留待瀏覽器驗證）

## 6. 驗收結果

- [x] `npm run test` 49/49 通過（測試數已從計畫撰寫時的 47 增至 49）；`npm run build`（vue-tsc 型別檢查 + Vite 打包）通過
- [x] 已同步更新 docs/FEATURES.md（會員系統節新增訪客試用模式）、docs/CHANGELOG.md（v0.9.3）
- [ ] 第 2 節手動測試流程（無痕視窗訪客流程、DB password=null 確認）留待瀏覽器實測