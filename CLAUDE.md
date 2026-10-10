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
npm run test:e2e      # 執行 Playwright E2E 測試（需先啟動 DB、後端、前端，見 docs/TESTING.md 2.1）
npm run seed:e2e      # 手動重置 E2E 測試帳號
npm run seed:demo:remote  # 對遠端資料庫重建示範帳號（連線字串讀自 .env.railway.local）
npm run hooks:install  # 啟用 pre-commit／pre-push 機密掃描（每個 clone 執行一次）
npm run check:secrets  # 手動掃描所有被追蹤的檔案
```

前後端為獨立程序，完整開發須同時啟動 `dev` 與 `dev:server`。後端監聽 **port 3100**（Vite proxy 目標），`server/index.ts` 預設 3000，須在 `.env` 設 `PORT=3100`。

環境變數清單見 `.env.example` 與 `docs/DEVELOPMENT.md` 第 4 節。`DATABASE_URL` 須含 `?charset=utf8mb4`（中文食物名稱才能正確儲存），`ANTHROPIC_API_KEY` 必填。

## 架構重點

僅列出會影響跨模組開發的事項，完整說明見 `docs/ARCHITECTURE.md`。

- **雙服務**：前端 `src/`（Vite，透過 `/api/*` 呼叫後端）＋後端 `server/`（Express）。核心端點 `POST /api/meals`：AI 分類 → 評分 → 寫入資料庫。
- **Auth（JWT 雙令牌）**：access token 15m 存 Pinia 記憶體；refresh token 7d 存 httpOnly cookie，採旋轉策略。
  - 需登入的前端請求一律用 `fetchWithAuth`（`src/utils/fetchWithAuth.ts`），由它處理 401 → refresh → retry。
  - `POST /api/meals` 無需登入（以 `email` upsert user，`password=null`），使用 `optionalAuthMiddleware`：未帶 `Authorization` 視為訪客；**帶了但無效必須回 401**，不可靜默當成訪客，否則 `fetchWithAuth` 不會 refresh。
- **AI 分類**：`server/services/ai.ts` 呼叫 Claude Haiku（`claude-haiku-4-5-20251001`），結果快取於 `FoodDictionary`。食物名稱一律先經 `normalizeLabel`（`server/services/foodLabel.ts`）再作為查詢鍵。
- **資料模型**：`User` → `MealRecord` → `FoodItem`；`User` → `RefreshToken`、`UserFoodOverride`。欄位與索引見 `prisma/schema.prisma`。

### 評分演算法（核心邏輯）

演算法有兩份，**必須保持同步**：`src/services/scoringAlgorithm.ts`（前端即時計算）與 `server/services/scoringAlgorithm.ts`（後端寫入前最終計算）。全為 OTHER 時 `totalScore: null` 且**不寫入 DB**。

SCORE_MATRIX（前者→後者，後端用 Prisma enum 名稱，前端用 FoodType value `'F'`/`'P'`/`'CC'`/`'SC'`）：

| 前 \ 後 | F | P | CC | SC |
|---------|---|---|----|----|
| **F**   | 5 | 10| 10 | 8  |
| **P**   | 8 | 5 | 10 | 8  |
| **CC**  | 5 | 5 | 5  | 3  |
| **SC**  | 6 | 6 | 4  | 0  |

分支規則（m=0／1／≥2）、距離加權與懲罰見 `docs/ARCHITECTURE.md` 第 4 節。

## E2E 測試帳號

Playwright E2E 測試專用帳號（定義於 `e2e/testAccount.ts`，**僅供自動化測試**，勿用於其他用途）：

```
Email   : e2e.settings@orderly-steady.test
Password: E2eTest1234!
Name    : E2E 測試員
```

執行前置條件、帳號重置與測試資料的說明見 `docs/TESTING.md` 2.1。

## 關鍵規則

- **型別安全**：嚴格禁止 `any`，所有 API 回傳與組件 Props 必須定義 Interface（型別定義在 `src/types/index.ts`）
- **組件化設計**：UI 組件與邏輯組件分離，遵循單一職責原則
- **GSAP 動畫**：僅在 `onMounted` 觸發，使用 `gsap.context()` 清理；各評分區間的差異化動畫見 `docs/FEATURES.md` 1.2
- **Loading State**：串接 AI API 及高頻搜尋一律實作 Loading State + Debounce 防抖
- **機密不得出現在指令列或被追蹤的檔案**：連線字串、API 金鑰只能放在 `.env` 或 `.env.<名稱>.local`（皆已被忽略）。
  - 對遠端資料庫執行指令一律用 `npx tsx --env-file=.env.railway.local <script>`（或 `npm run seed:demo:remote`）。**禁止** `DATABASE_URL="…" <指令>` 這種內嵌寫法——指令全文可能被存進有被追蹤的 `.claude/settings.json` 允許清單，密碼就會跟著進版本庫。
  - 輸出或檢視可能含機密的內容時先遮蔽（例如只印主機名稱），不要把密碼印到對話中。
  - `.githooks/pre-commit`、`.githooks/pre-push` 與 CI 會以 `scripts/check-secrets.ts` 掃描並中止；誤判時在該行加上 `secret-scan:allow`，不要用 `--no-verify`。詳見 `docs/DEVELOPMENT.md` 4.1。
- **開發前必須建立計畫**：每次進行功能修改或新增前，先依照 `docs/plans/_template.md` 的格式，在 `docs/plans/` 建立一份今日計畫（`YYYY-MM-DD-<feature-name>.md`），與使用者確認計畫內容後才開始撰寫程式碼；功能完成後移至 `docs/plans/archive/`

## 必要遵守項目

- 如果你有任何問題，請跟我討論
- 後端高頻查詢（使用者 ID、時間範圍）必須建立資料庫索引（Prisma schema 已有 `@@index`，新查詢模式須一併新增）
- 前端以 Pinia（`src/stores/history.ts`）快取已拉取的歷史紀錄，避免重複發起請求；新增或修正紀錄後直接更新 store，不重新拉取
- Chart.js (vue-chartjs) 繪製分數趨勢圖時必須實作資料載入中的 Loading 狀態
- 修改評分演算法時，前後端兩份實作必須同步更新

## 詳細文件

- `README.md` — 項目介紹與快速開始
- `docs/ARCHITECTURE.md` — 架構、目錄結構、資料模型、評分規則、Auth、AI 分類與個人分類覆寫、前端資料流
- `docs/DEVELOPMENT.md` — 開發規範、命名規則、環境變數、機密管理
- `docs/FEATURES.md` — 功能列表與完成狀態
- `docs/TESTING.md` — 測試規範與指南、E2E 前置條件與測試資料
- `docs/CHANGELOG.md` — 更新日誌
- `docs/API.md` — API 端點參考文件（請求/回應格式、認證、速率限制、錯誤碼）
