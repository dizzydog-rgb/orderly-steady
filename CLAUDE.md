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
- **m=1**（單一可評分食物）：SIMPLE_CARB → 20 分；COMPLEX_CARB → 40 分；其餘 → 60 分；tips 硬編碼均衡建議
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
- `POST /api/auth/register`：若 email 已存在且 `password=null`（meals endpoint 自動建立的帳號），允許補全密碼完成註冊（回傳 201）；若 `password` 已設定則回傳 409

**Auth API 端點**（`/api/auth/*`）：

| 方法 | 路徑 | 登入需求 | 說明 |
|------|------|----------|------|
| POST | `/register` | 否 | 建立帳號（email + password + name） |
| POST | `/login` | 否 | 回傳 accessToken；refresh token 存 httpOnly cookie |
| POST | `/refresh` | Cookie | 換發新 access + refresh token |
| POST | `/logout` | Bearer | 清除 DB 中 refresh token 及 cookie |
| GET  | `/me` | Bearer | 回傳目前使用者資訊 |

### 前端 Composables

- `useGlucoseScore` (`src/composables/useGlucoseScore.ts`) — HomeView 核心：管理 `mealSequence`（最多 3 項），computed `scoreResult` 即時呼叫 `calculateMealScore`，`scoreColor` 依分數區間回傳顏色
- `useTheme` / `useLang` — 全域主題與語言切換，不涉及評分邏輯

### 歷史紀錄 Store

`src/stores/history.ts`：`hasFetched` 旗標防止重複請求；新增餐點後呼叫 `prependRecord(record)` 做樂觀 UI 更新，不重新拉取。

### ScoreTrendChart 組件

`src/components/ScoreTrendChart.vue`：接收 `records: IMealRecord[]`，支援 7/14/30/90/180 天範圍切換（GSAP fade 過場），使用自訂 `backgroundBandsPlugin` 在 Chart.js canvas 上繪製分數區間色帶（≥80 綠、60–80 黃、40–60 橘、20–40 紅淡、<20 深紅）。需 ≥2 筆才渲染折線圖。

### AI 分類與快取

`server/services/ai.ts` 串接 **Claude Haiku API**（`claude-haiku-4-5-20251001`）進行食物分類，回傳 FIBER / PROTEIN / COMPLEX_CARB / SIMPLE_CARB / OTHER 之一。
分類結果寫入 `FoodDictionary` 資料表作為快取（label 唯一索引）；下次相同食物名稱直接從 DB 讀取，跳過 AI 呼叫（log 顯示 `[AI] Cache hit`）。
`DATABASE_URL` 須含 `?charset=utf8mb4` 確保中文 label 正確儲存。管理端點 `DELETE /api/food-dictionary`（全清）與 `DELETE /api/food-dictionary/:label`（單筆）可清除錯誤快取，均需 Bearer token。

### 資料模型（Prisma）

`User` → `MealRecord`（含 totalScore、tips JSON）→ `FoodItem`（含 sequenceIndex）。
`User` → `RefreshToken`（含 token、expiresAt），支援多裝置登入。
`MealRecord` 有 `(userId, recordedAt)` 複合索引，`FoodItem` 有 `mealRecordId` 索引，`RefreshToken` 有 `token` unique 索引與 `userId` 索引。

## 關鍵規則

- **型別安全**：嚴格禁止 `any`，所有 API 回傳與組件 Props 必須定義 Interface（型別定義在 `src/types/index.ts`）
- **組件化設計**：UI 組件與邏輯組件分離，遵循單一職責原則
- **GSAP 動畫**：僅在 `onMounted` 觸發，使用 `gsap.context()` 清理；依評分區間差異化——80+ 彈跳綠光、60-79 淡入黃示、40-59 震動黃綠、20-39 震動橘警告、<20 強烈震動紅色嚴重警報
- **Loading State**：串接 AI API 及高頻搜尋一律實作 Loading State + Debounce 防抖
- **開發前必須建立計畫**：每次進行功能修改或新增前，先依照 `docs/plans/2026-04-26-ecpay-full-integration(as structure model).md` 的格式，在 `docs/plans/` 建立一份今日計畫（`YYYY-MM-DD-<feature-name>.md`），與使用者確認計畫內容後才開始撰寫程式碼；功能完成後移至 `docs/plans/archive/`

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
