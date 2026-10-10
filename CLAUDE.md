# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概述

Orderly & Steady — 結合 AI 分類邏輯的控糖管理系統，使用者紀錄進食順序，系統計算血糖穩定得分並視覺化呈現趨勢。

- **前端**: Vue 3 (Composition API), Vite, TypeScript, Pinia, GSAP, Chart.js
- **後端**: Node.js (Express 5), Prisma (MySQL), Docker
- **核心邏輯**: 基於「進食順序」的演算法評分系統（Fiber → Protein → Carb 為最佳）

## 常用指令

```bash
npm run dev            # 啟動前端 Vite 開發伺服器
npm run dev:server     # 啟動後端 Express 伺服器（port 3100，tsx watch 熱重載）
docker-compose up -d   # 啟動 MySQL 容器（後端依賴，須先啟動）
npm run build          # 型別檢查 + 打包前端
npm run test           # 執行所有 Vitest 單元測試
npx vitest run src/services/__tests__/scoringAlgorithm.spec.ts  # 執行單一測試檔
npm run test:e2e      # 執行 Playwright E2E 測試（需先啟動 DB、後端、前端）
npm run seed:e2e      # 手動重置 E2E 測試帳號
```

前後端為獨立程序，完整開發須同時啟動 `dev` 與 `dev:server`。後端監聽 **port 3100**（Vite proxy 目標），`server/index.ts` 預設 3000，須在 `.env` 設 `PORT=3100`。

### 必要 `.env` 變數

```
DATABASE_URL=mysql://...
PORT=3100
JWT_SECRET=<secret>
JWT_REFRESH_SECRET=<secret>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
COOKIE_SECURE=false          # production 改 true
FRONTEND_URL=http://localhost:5173
ANTHROPIC_API_KEY=<key>      # 必填，AI 食物分類服務依賴
MYSQL_ROOT_PASSWORD=<pw>     # docker-compose.yml 以此初始化 MySQL；須與 DATABASE_URL 中的密碼一致
```

## 架構

### 雙服務架構

- **前端** (`src/`): Vite dev server，純靜態，透過 `/api/*` 呼叫後端
- **後端** (`server/`): Express，`POST /api/meals` 為核心端點，處理 AI 分類 → 評分 → 寫入資料庫（速率限制：10 req/min）

### 評分演算法（核心邏輯）

演算法同時存在於前後端，**兩份必須保持同步**：

- `src/services/scoringAlgorithm.ts` — 前端即時計算（使用者操作時）
- `server/services/scoringAlgorithm.ts` — 後端儲存前最終計算

**all_pair 加權矩陣演算法**（三分支決策樹）：

- **m=0**（全為 OTHER）：`totalScore: null`，不寫入 DB
- **m=1**（單一可評分食物）：SIMPLE_CARB → 20 分；COMPLEX_CARB → 40 分；FIBER / PROTEIN → 60 分；tips 硬編碼均衡建議
- **m≥2**：雙重迴圈所有 pair (i,j)，依距離加權（相鄰 ×1.5，跨越 ×1.0），查 SCORE_MATRIX（0–10）計算加權分比；SIMPLE_CARB index=0 懲罰 -10，index=1 懲罰 -10

SCORE_MATRIX（前者→後者，後端用 Prisma enum 名稱，前端用 FoodType value `'F'`/`'P'`/`'CC'`/`'SC'`）：

| 前 \ 後 | F | P | CC | SC |
|---------|---|---|----|----|
| **F**   | 5 | 10| 10 | 8  |
| **P**   | 8 | 5 | 10 | 8  |
| **CC**  | 5 | 5 | 5  | 3  |
| **SC**  | 6 | 6 | 4  | 0  |

### Auth 架構

**JWT 雙令牌**：access token（15m，存 Pinia 記憶體）+ refresh token（7d，httpOnly cookie）。

- `fetchWithAuth` (`src/utils/fetchWithAuth.ts`) — 所有需登入的 API 請求一律用此工具；自動處理 401 → refresh → retry，refresh 失敗則跳 `/login`
- `authStore._refreshPromise` — 去重鎖，防止並發多次 refresh
- Refresh token 採旋轉策略（每次 refresh 同時換發新 refresh token，舊的失效）
- Refresh token 存於獨立的 `RefreshToken` 資料表（非 User 欄位），支援多裝置同時登入；logout 只撤銷當前裝置的 token
- `POST /api/meals` **無需登入**：以 `email` 欄位 upsert user（password=null）；`GET /api/meals/:userId` 才需 Bearer token
- `POST /api/meals` 使用 `optionalAuthMiddleware`：未帶 `Authorization` 視為訪客；**帶了但無效則回 401**（不可靜默當成訪客，否則 token 過期的登入者不會套用個人分類覆寫，`fetchWithAuth` 也不會 refresh）
- `POST /api/auth/register`：若 email 已存在且 `password=null`（meals endpoint 自動建立的帳號），允許補全密碼完成註冊（回傳 201）；若 `password` 已設定則回傳 409

**Auth API 端點**（`/api/auth/*`）：

| 方法 | 路徑 | 登入需求 | 說明 |
|------|------|----------|------|
| POST | `/register` | 否 | 建立帳號（email + password + name） |
| POST | `/login` | 否 | 回傳 accessToken；refresh token 存 httpOnly cookie |
| POST | `/refresh` | Cookie | 換發新 access + refresh token |
| POST | `/logout` | Bearer | 清除 DB 中 refresh token 及 cookie |
| GET  | `/me` | Bearer | 回傳目前使用者資訊 |
| PATCH | `/me` | Bearer | 變更名稱（暱稱）；10 req/5min |
| PATCH | `/password` | Bearer | 變更密碼，需帶 `currentPassword`；成功後撤銷該使用者所有裝置的 refresh token；5 req/15min |

### E2E 測試帳號

Playwright E2E 測試專用帳號（定義於 `e2e/testAccount.ts`，**僅供自動化測試**，勿用於其他用途）：

```
Email   : e2e.settings@orderly-steady.test
Password: E2eTest1234!
Name    : E2E 測試員
```

- 每個 test 的 `beforeEach` 都會透過 Prisma 刪除重建此帳號（密碼變更測試會改掉密碼，必須逐案例重置）。
- `resetE2ETestUser()` 會檢查 `DATABASE_URL` 的 host 必須是 `localhost`／`127.0.0.1`，避免誤對遠端資料庫執行。
- 與 `prisma/seedDemo.ts` 的示範帳號（`demo@example.com`）刻意分開：示範帳號用於圖表資料，密碼不應被測試改動。
- 跑 E2E 前請以 `RATE_LIMIT_DISABLED=true npm run dev:server` 啟動後端，否則連跑數輪會觸發密碼端點的 5 req/15min 限制而收到 429；`e2e/food-correction.spec.ts` 一輪就會用完 `POST /api/meals` 的 10 req/min，一分鐘內跑第二輪同樣會 429。此旁路僅在 `NODE_ENV !== production` 時有效。
- 修正分類的 E2E 使用 `E2E_FOODS` 測試食物，由 `seedE2EFoodDictionary()` 預先寫入 `FoodDictionary`（不呼叫 Claude API），`globalTeardown` 會清除；訪客流程使用 `E2E_GUEST_EMAIL`，隨 `resetE2ETestUser()` 一併刪除。

### 前端 Composables

- `useGlucoseScore` (`src/composables/useGlucoseScore.ts`) — HomeView 核心：管理 `mealSequence`（最多 3 項），computed `scoreResult` 即時呼叫 `calculateMealScore`，`scoreColor` 依分數區間回傳顏色
- `useTheme` / `useLang` — 全域主題與語言切換，不涉及評分邏輯

### 歷史紀錄 Store

`src/stores/history.ts`：`hasFetched` 旗標防止重複請求；新增餐點後呼叫 `prependRecord(record)` 做樂觀 UI 更新，不重新拉取。修正食物分類後以 `updateRecord(record)` 更新該筆，或在修正後無法計分時以 `removeRecord(id)` 移除。

### ScoreTrendChart 組件

`src/components/ScoreTrendChart.vue`：接收 `records: IMealRecord[]`，支援 7/14/30/90/180 天範圍切換（GSAP fade 過場），使用自訂 `backgroundBandsPlugin` 在 Chart.js canvas 上繪製分數區間色帶（≥80 綠、60–80 黃、40–60 橘、20–40 紅淡、<20 深紅）。需 ≥2 筆才渲染折線圖。

### AI 分類與快取

`server/services/ai.ts` 串接 **Claude Haiku API**（`claude-haiku-4-5-20251001`）進行食物分類，回傳 FIBER / PROTEIN / COMPLEX_CARB / SIMPLE_CARB / OTHER 之一。
分類結果寫入 `FoodDictionary` 資料表作為快取（label 唯一索引）；下次相同食物名稱直接從 DB 讀取，跳過 AI 呼叫（log 顯示 `[AI] Cache hit`）。
`DATABASE_URL` 須含 `?charset=utf8mb4` 確保中文 label 正確儲存。管理端點 `DELETE /api/food-dictionary`（全清）與 `DELETE /api/food-dictionary/:label`（單筆）可清除錯誤快取，均需 Bearer token。

食物名稱一律先經 `normalizeLabel`（`server/services/foodLabel.ts`，NFKC + trim）再作為查詢鍵。

### 個人分類覆寫（使用者修正 AI 分類）

登入者可在評分結果上修正食物類別。修正寫入 `UserFoodOverride`（**只影響該使用者**），**不可**寫入全域 `FoodDictionary`——字典只由 AI 寫入，不同使用者對同一食物可有不同分類。

- **查詢順序**（`getFoodType(label, userId?)`）：個人覆寫 → `FoodDictionary` → Claude API。只有 token 的 `userId` 與該 email 的使用者相符時才傳入 `userId`；訪客只憑 email 不套用任何人的覆寫。
- **`PATCH /api/meals/:recordId/items/:sequenceIndex`**（Bearer）：同一 transaction 內 upsert 覆寫、更新 `FoodItem.type`、重算 `totalScore`／`tips`。重算後全為 OTHER 時**刪除該筆紀錄**並回傳 `record: null`（`totalScore` 不允許 null）。
- **`PUT /api/food-overrides`**（Bearer）：當餐全為 OTHER、沒有紀錄可 PATCH 時使用；前端存完覆寫後以相同食物重送 `POST /api/meals`。
- 兩個端點共用 20 req/min（`server/middleware/rateLimit.ts`）。
- 只影響當餐與之後送出的餐點，不回溯重算歷史紀錄。
- 前端：`src/components/FoodTypeEditor.vue`（類別文字＋編輯圖示＋絕對定位的浮層選單）。`HomeView.vue` 的 `.breakdown` **不可加 `overflow: hidden`**，否則會裁掉選單。

### 資料模型（Prisma）

`User` → `MealRecord`（含 totalScore、tips JSON）→ `FoodItem`（含 sequenceIndex）。
`User` → `RefreshToken`（含 token、expiresAt），支援多裝置登入。
`User` → `UserFoodOverride`（含 label、type），個人分類覆寫。
`MealRecord` 有 `(userId, recordedAt)` 複合索引，`FoodItem` 有 `mealRecordId` 索引，`RefreshToken` 有 `token` unique 索引與 `userId` 索引，`UserFoodOverride` 有 `(userId, label)` unique 索引。

## 關鍵規則

- **型別安全**：嚴格禁止 `any`，所有 API 回傳與組件 Props 必須定義 Interface（型別定義在 `src/types/index.ts`）
- **組件化設計**：UI 組件與邏輯組件分離，遵循單一職責原則
- **GSAP 動畫**：僅在 `onMounted` 觸發，使用 `gsap.context()` 清理；依評分區間差異化——80+ 彈跳綠光、60-79 淡入黃示、40-59 震動黃綠、20-39 震動橘警告、<20 強烈震動紅色嚴重警報
- **Loading State**：串接 AI API 及高頻搜尋一律實作 Loading State + Debounce 防抖
- **開發前必須建立計畫**：每次進行功能修改或新增前，先依照 `docs/plans/_template.md` 的格式，在 `docs/plans/` 建立一份今日計畫（`YYYY-MM-DD-<feature-name>.md`），與使用者確認計畫內容後才開始撰寫程式碼；功能完成後移至 `docs/plans/archive/`

## 必要遵守項目

- 如果你有任何問題，請跟我討論
- 後端高頻查詢（使用者 ID、時間範圍）必須建立資料庫索引（Prisma schema 已有 `@@index`，新查詢模式須一併新增）
- 前端以 Pinia 快取已拉取的歷史紀錄，避免重複發起請求
- Chart.js (vue-chartjs) 繪製分數趨勢圖時必須實作資料載入中的 Loading 狀態
- 修改評分演算法時，前後端兩份實作必須同步更新

## 詳細文件

- `README.md` — 項目介紹與快速開始
- `docs/ARCHITECTURE.md` — 架構、目錄結構、資料流、評分規則詳述
- `docs/DEVELOPMENT.md` — 開發規範、命名規則
- `docs/FEATURES.md` — 功能列表與完成狀態
- `docs/TESTING.md` — 測試規範與指南
- `docs/CHANGELOG.md` — 更新日誌
- `docs/API.md` — API 端點參考文件（請求/回應格式、認證、錯誤碼）
