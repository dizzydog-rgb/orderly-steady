# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概述

GlucoseFlow — 結合 AI 分類邏輯的控糖管理系統，使用者紀錄進食順序，系統計算血糖穩定得分並視覺化呈現趨勢。

- **前端**: Vue 3 (Composition API), Vite, TypeScript, Pinia, GSAP, Chart.js
- **後端**: Node.js (Express 5), Prisma (MySQL), Docker
- **核心邏輯**: 基於「進食順序」的演算法評分系統（Fiber → Protein → Carb 為最佳）

## 常用指令

```bash
npm run dev            # 啟動前端 Vite 開發伺服器
npm run dev:server     # 啟動後端 Express 伺服器（port 3000，tsx watch 熱重載）
docker-compose up -d   # 啟動 MySQL 容器（後端依賴，須先啟動）
npm run build          # 型別檢查 + 打包前端
npm run test           # 執行所有 Vitest 單元測試
npx vitest run src/services/__tests__/scoringAlgorithm.spec.ts  # 執行單一測試檔
```

前後端為獨立程序，完整開發須同時啟動 `dev` 與 `dev:server`。後端需 `.env` 中的 `DATABASE_URL`（MySQL 連線字串）。

## 架構

### 雙服務架構

- **前端** (`src/`): Vite dev server，純靜態，透過 `/api/*` 呼叫後端
- **後端** (`server/`): Express，`POST /api/meals` 為核心端點，處理 AI 分類 → 評分 → 寫入資料庫

### 評分演算法（核心邏輯）

演算法同時存在於前後端，**兩份必須保持同步**：

- `src/services/scoringAlgorithm.ts` — 前端即時計算（使用者操作時）
- `server/services/scoringAlgorithm.ts` — 後端儲存前最終計算

| 類別     | 代碼 | 基礎分 | 備註     |
| -------- | ---- | ------ | -------- |
| 膳食纖維 | `F`  | 40     | 最佳首位 |
| 蛋白質   | `P`  | 30     |          |
| 複合碳水 | `CC` | 20     |          |
| 精緻糖   | `SC` | 10     |          |

modifier 規則：碳水出現在纖維之前 → ×0.5（扣分）；前兩位含纖維且碳水在第三位以後 → ×1.2（加成）。

### AI 分類與快取

`server/services/ai.ts` 目前使用**關鍵字規則**（`mockAIClassify`）模擬 LLM 分類，尚未串接真實 API。
分類結果寫入 `FoodDictionary` 資料表作為快取（label 唯一索引）；下次相同食物名稱直接從 DB 讀取，跳過 AI 呼叫。

### 資料模型（Prisma）

`User` → `MealRecord`（含 totalScore、tips JSON）→ `FoodItem`（含 sequenceIndex、modifier）。
`MealRecord` 有 `(userId, recordedAt)` 複合索引，`FoodItem` 有 `mealRecordId` 索引。

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
