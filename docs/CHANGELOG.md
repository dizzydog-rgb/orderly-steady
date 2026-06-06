# Changelog

所有對「Orderly & Steady」專案的重要變更都將記錄在此文件中。

## [0.9.2] - 2026-06-06

### Added
- **Vitest 後端測試套件**：新增 `server/__tests__/` 目錄，涵蓋 middleware、service、routes 三層共 24 個新測試案例，合計 47/47 通過。
  - `authMiddleware.spec.ts`：無 header / header 格式錯 / 有效 token / 過期 token 四個分支
  - `validate.spec.ts`：RegisterSchema / CreateMealSchema 合法與非法邊界，確認 `details[].field` 準確回報
  - `scoringAlgorithm.spec.ts`（後端版）：m=0/1/≥2 三分支決策樹 + tips 文字觸發條件
  - `routes/auth.spec.ts`：以 supertest + `vi.mock` Prisma 測試 register（201/400/409）與 login（200/400/401）
- **GitHub Actions CI**（`.github/workflows/ci.yml`）：push / PR 至 master 自動執行 `npm ci → npm test → npm run build`；CI job 名稱 `Test & Build` 可設為 PR required status check。
- **`server/app.ts`**：從 `server/index.ts` 拆出 Express app 建立邏輯並 export，讓測試可直接 import app 而不觸發 `listen`。
- **`npm run test:coverage`** script：以 `@vitest/coverage-v8` 產生文字與 HTML 覆蓋率報告。

### Changed
- **`server/index.ts`**：簡化為僅 import app 與呼叫 `app.listen()`，dotenv 仍在此初始化。
- **`vite.config.ts`**：test 區塊加入 `coverage: { provider: 'v8', reporter: ['text', 'html'] }`。

### Fixed
- **`server/middleware/validate.ts`**：`result.error.errors` 改為 `result.error.issues`（Zod v4 breaking change，舊屬性名稱在 v4 已移除）。

---

## [0.9.1] - 2026-06-06

### Added
- **Zod Input Validation**：引入 `zod` 套件，對所有 API 入口的 request body 進行 schema 驗證，型別錯誤在進入 Controller 前即被攔截，回傳結構化 `{ error, details }` 400 回應。
- **`server/middleware/validate.ts`**：通用 `validate()` middleware factory，接收任意 Zod schema；`safeParse` 失敗即中止請求，成功則以 `result.data`（已去除多餘欄位）覆寫 `req.body`。
- **`server/schemas/auth.schemas.ts`**：`RegisterSchema`（email 格式、password ≥8 碼、name 可選 ≤50 字）與 `LoginSchema`，含 `z.infer` 型別匯出。
- **`server/schemas/meals.schemas.ts`**：`CreateMealSchema`（email 格式、foods 1–3 項字串陣列），含 `z.infer` 型別匯出。

### Changed
- **`POST /api/auth/register` / `POST /api/auth/login`**：套用 `validate(RegisterSchema)` / `validate(LoginSchema)`，移除原有手動 `if (!email || !password)` truthy 檢查。
- **`POST /api/meals`**：套用 `validate(CreateMealSchema)`，移除原有 `if (!email || !Array.isArray(foods) || ...)` 手動檢查。

---

## [0.9.0] - 2026-06-06

### Added
- **ScoreTrendChart 元件**（`src/components/ScoreTrendChart.vue`）：整合 vue-chartjs + chart.js，折線圖呈現近期得分趨勢；支援 7 / 14 / 30 / 90 / 180 天範圍切換（GSAP 淡入淡出過場）；自訂 `backgroundBandsPlugin` 在 canvas 繪製分數色帶（≥80 綠、60–80 黃、40–60 橘、20–40 淡紅、<20 深紅）；篩選後 < 2 筆時顯示提示文字，不渲染折線。
- **Pinia history store**（`src/stores/history.ts`）：取代 module-level `useHistory` composable；`hasFetched` 旗標防重複請求；新增餐點後 `prependRecord()` 即時插入最新紀錄；`useAuthStore.logout()` 時自動重置快取。
- **FoodDictionary 管理端點**：`DELETE /api/food-dictionary`（清除全部快取）與 `DELETE /api/food-dictionary/:label`（清除單筆），均需 Bearer token。
- **`server/scripts/clearFoodDictionary.ts`**：可直接執行的快取清除 script。

### Changed
- **AI 分類精準化**：`server/services/ai.ts` 補充雞翅、火龍果等具體食物範例；回傳值改用 regex 解析，防止模型多餘文字導致分類 fallback。
- **評分建議門檻**：`buildTips` 中「完美均衡飲食」正向提示改為 `totalScore >= 80` 觸發（原 `=== 100`）。
- **`GET /api/meals/:userId`**：補上 `authMiddleware` 並驗證 userId 所有權（禁止跨帳號查詢）。
- **全站用語**：「精緻糖」統一改為「精緻碳水」（AI prompt、演算法 tips、測試、文件全面同步）。

### Fixed
- 食物分類亂碼：`DATABASE_URL` 須含 `?charset=utf8mb4`，確保中文 label 正確寫入 DB。
- `.tips li` 文字對齊改為 `text-align: left`。

---

## [0.8.0] - 2026-05-24

### Added
- **all_pair 加權矩陣演算法**：三分支決策樹（m=0 / m=1 / m≥2）。m≥2 時雙重迴圈所有 pair (i,j)，相鄰距離乘 ×1.5、跨越乘 ×1.0；查 SCORE_MATRIX（0–10）計算加權分比；SIMPLE_CARB 首位懲罰 -30（index=0）、-10（index=1）。
- **Prisma schema 擴充**：`FoodItem` 新增 `finalScore Float` 欄位，記錄每個槽位的得分貢獻。

### Changed
- **SCORE_MATRIX 校調**：F→CC 調至 8、P→CC 調至 7；SC row 加入回補值（SC→F:6、SC→P:6、SC→CC:4），防止 SC 首位過度懲罰；SIMPLE_CARB_PENALTY 統一降低至 {0: -30, 1: -10}。
- **m=1 分支**：COMPLEX_CARB 單項得分由 60 分調至 40 分；tips 不再建議補充精緻碳水。
- 前後端 `scoringAlgorithm.ts` 同步更新；單元測試案例同步補齊（15 項全過）。

### Fixed
- breakdown-row 版面：OTHER「不計分」標籤移至 `slot-type` 左側；`slot-right` 加上 `width: 96px + justify-content: flex-end`，避免標籤出現時食物名稱欄位位移。

---

## [0.7.0] - 2026-05-23

### Added
- **真實 AI 分類**：`server/services/ai.ts` 串接 Claude Haiku API（`claude-haiku-4-5-20251001`），取代關鍵字 mock 分類；需設定 `ANTHROPIC_API_KEY` 環境變數。
- **OTHER 食物類別**：新增 `OTHER` Prisma enum 值（含 migration），酪梨、堅果、醬料等複合食物歸入此類，排除計分；HomeView breakdown 顯示「不計分」標籤。
- **逆序對評分演算法**（此版過渡，v0.8.0 再重構）：以序列中違反 F→P→CC→SC 最佳順序的對數計算扣分；scorable ≤ 1 時回傳 100 分。
- **RWD 三斷點**：1024 / 768 / 480px media query，全站字體尺寸與間距在各斷點自動縮放。
- **NavBar 漢堡選單**：≤480px 收合為漢堡按鈕，展開顯示全頁導覽連結。
- **`POST /api/meals` Rate Limiting**：每 IP 每分鐘 10 次（express-rate-limit），超過回 429。

### Changed
- **CSS 字體尺寸變數系統**：新增 `--f56` ~ `--f14` 變數，各 View 硬碼 font-size 全面替換為變數。
- **`scoreColor()` 回傳格式**：改回傳 CSS 變數字串（如 `var(--score-green)`）而非 hex。

### Fixed
- `POST /api/meals` 回傳的 `foodItems` 補上 `orderBy: { sequenceIndex: 'asc' }`，修正未指定排序時 Prisma 回傳順序不確定的問題。

---

## [0.6.0] - 2026-05-23

### Added
- **ThemeSwitcher 元件**：System / Light / Dark 三態膠囊控件，含滑動指示器動畫與完整 ARIA 屬性；`useTheme` composable 搭配 `matchMedia` 自動追蹤 OS 偏好；`style.css` 改為 `html[data-theme="dark"]` class-based 切換。
- **WhyView 頁面**（`/why`）：「控糖科學」衛教文章，公開頁面（`meta.public`）；NavBar 新增對應導覽連結。
- **CN/EN 語言切換**：`LangSwitcher.vue` 元件與 `useLang` composable，切換中英文顯示。
- **`POST /api/auth/logout` 端點**：撤銷 DB 中 `refreshToken`、清除 httpOnly cookie。
- **`.env.example`**：新增所有必要環境變數範本。
- **品牌資產更新**：favicon 改為 `oas_favicon.png`；NavBar logo 改為 `oas_logo.png`。

### Changed
- **Refresh Token 安全強化**：從 `localStorage` 遷移至 `httpOnly cookie`（`sameSite=strict`）；`COOKIE_SECURE` 改由獨立環境變數控制，不再依賴 `NODE_ENV`。
- **Pinia auth store**（`src/stores/auth.ts`）：取代 `useAuth.ts` composable；含 `_refreshPromise` 去重鎖，防止多 tab 並發觸發多次 refresh。
- **CSS 設計系統**：建立 Primary Teal / Secondary Blue 色彩 CSS 變數；命名規範統一（`--text`→`--font-color`、`--bg`→`--bg-color`、`--border`→`--border-color` 等）；導入 Google Fonts（Sigmar / Nunito / Noto Sans TC）。
- **三態 UI**：HomeView 歷史區塊由兩態（loading / list）擴展為四態（skeleton → error+重試按鈕 → 引導畫面 → 列表）；MemberView 登出加入 `isLoggingOut` loading 狀態。

---

## [0.5.0] - 2026-05-16

### Added
- **Vue Router 三頁面架構**：`/login`（公開）、`/`（需登入）、`/member`（需登入），`beforeEach` guard 攔截未登入請求並自動導向 `/login`。
- **JWT 懶刷新策略**：accessToken 存記憶體（不寫 localStorage），refreshToken 存 `localStorage`；收到 401 才呼叫 `/api/auth/refresh`，成功後自動重試原請求，失敗則登出並跳回 `/login`。
- **`useAuth` composable**：module singleton，管理 `user`、`accessToken`、`isLoggedIn`，提供 `login`、`register`、`logout`、`refreshAccessToken`、`getAuthHeaders`。
- **`fetchWithAuth` utility**：統一 API 請求入口，自動附加 Bearer header，401 時自動換發並重試。
- **`useHistory` composable**：module singleton，管理歷史紀錄快取；`fetchHistory` 拉取、`prependRecord` 樂觀插入最新紀錄不重新 fetch。
- **NavBar 元件**：左側品牌 Logo、右側已登入顯示 👤 icon（router-link → `/member`）。
- **LoginView**：登入 / 註冊雙 tab，行內錯誤訊息，成功後跳轉 `/`。
- **HomeView**：三格文字輸入依序解鎖（第一口 → 第二口 → 第三口），送出後顯示評分、GSAP 差異化動畫、breakdown 與 tips，下方顯示歷史紀錄卡片（skeleton loading）。
- **MemberView**：顯示 email、name，登出按鈕清除狀態並跳回 `/login`。
- **Vite `/api` proxy**：開發環境將 `/api/*` 代理至 `http://localhost:3000`。

### Changed
- **網站更名**：「GlucoseFlow」→「Orderly & Steady」（NavBar logo、登入頁標題、瀏覽器 tab title）。
- **口數標籤**：輸入欄與評分 breakdown 一律使用中文數字（第一口 / 第二口 / 第三口）。
- **`src/App.vue`**：大幅簡化，僅保留 `<NavBar />` + `<RouterView />`。
- **`src/types/index.ts`**：新增 `IUser`、`IFoodItemRecord`、`IMealRecord` 介面。

### Fixed
- `HomeView` 送出後顯示「提交失敗」：API 回傳 key 為 `analysis`，前端誤讀 `data.score`，已統一更正。
- `useHistory` 歷史紀錄不顯示：GET `/api/meals/:userId` 回傳 `{ records: [] }` 物件，前端直接當陣列使用，已修正為正確解析 `data.records`。

## [0.4.0] - 2026-05-16

### Added
- **會員系統**：`POST /api/auth/register`、`POST /api/auth/login`、`POST /api/auth/refresh`、`GET /api/auth/me` 四支端點，完整 JWT 驗證流程。
- **JWT 機制**：Access Token（15m，`JWT_SECRET`）+ Refresh Token（7d，`JWT_REFRESH_SECRET`），登入後寫入 DB，refresh 時輪換，舊 token 立即失效（防 replay）。
- **bcrypt 密碼雜湊**：saltRounds=10，response 一律不回傳 `password` 與 `refreshToken` 欄位。
- **authMiddleware**：從 `Authorization: Bearer` header 驗證 Access Token，注入 `req.user`，可套用至任意路由。
- **Prisma Schema 擴充**：User 新增 `password String?`（bcrypt hash）、`refreshToken String? @db.Text`（TEXT 型別，避免 VARCHAR 191 上限）。

### Fixed
- `generateRefreshToken` 加入 `jti: crypto.randomUUID()`，確保同一秒內產生的 token 字串不同，修正輪換機制失效問題。
- `refreshToken` 欄位由 `VARCHAR(191)` 改為 `TEXT`，修正 JWT 字串超長導致的 500 錯誤。

## [0.3.0] - 2026-05-16

### Added
- **飲食紀錄 API**：`POST /api/meals` 接收 `email` + `foods`（1–3 項），以 `upsert` 自動建立使用者，完成 AI 分類 → 評分 → 寫入 DB 完整流程。
- **歷史查詢 API**：`GET /api/meals/:userId` 回傳該使用者所有紀錄，依 `recordedAt` 降冪排序，含 `foodItems` 明細。
- **FoodDictionary 快取**：AI 分類結果持久化至 DB；相同食物名稱再次輸入時直接命中快取，跳過 AI 呼叫。
- **食物資料庫初始化**：`npm run seed` 寫入 50 筆常見食物預設分類（FIBER×18、PROTEIN×16、COMPLEX_CARB×10、SIMPLE_CARB×6）。
- **Prisma Migration**：完成首次 migration，建立 `User`、`MealRecord`、`FoodItem`、`FoodDictionary` 四張資料表及複合索引。

### Changed
- **評分系統重設計**：由舊版加權 modifier 制改為槽位配分制（Slot1=50、Slot2=30、Slot3=20），唯一滿分路徑為 Fiber → Protein → Complex Carb = 100 分；前端固定三欄依序解鎖。
- **型別重構**：`IScoringResult.breakdown` 由 `{ baseScore, modifier, finalItemScore }` 改為 `ISlotBreakdown { slot, input, slotMax, score }`，前後端型別定義同步。
- **API 輸入格式**：`POST /api/meals` 由接收 `userId` 改為接收 `email`，後端自動 upsert 使用者。
- **Mock AI 修正**：調整關鍵字判斷順序，完整詞彙（`蛋糕`）優先於單字（`蛋`），避免誤判為 PROTEIN。

### Fixed
- 移除 `server/routes/meals.ts` 的 `tips as any` 強制轉型。
- `App.vue` breakdown 顯示欄位更新，消除 TypeScript 型別錯誤。

## [0.2.0] - 2026-05-03

### Added
- **全端架構**: 建立 Node.js (Express) 後端服務、Prisma ORM 配置與 Docker 容器化資料庫設定。
- **健康建議系統**: 在 `scoringAlgorithm.ts` 中實作智慧飲食建議 (Tips) 邏輯。
- **動態視覺回饋**: 整合 GSAP 實作分數變動的數值滾動動畫，並加入自動清理機制。
- **UI 優化**: 新增健康建議提示框 (Tips Container)，並優化分數顏色回饋。

### Changed
- **架構重構**: 將前端評分狀態邏輯抽離至 `useGlucoseScore` composable。
- **測試更新**: 擴充單元測試以涵蓋 `tips` 邏輯。

## [0.1.0] - 2026-04-26

### Added
- 初始化專案架構。
- 建立 `docs/` 文件系統。
- 完成 `ARCHITECTURE.md`, `DEVELOPMENT.md`, `FEATURES.md`, `TESTING.md`。

---
*格式參考自 [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).*
