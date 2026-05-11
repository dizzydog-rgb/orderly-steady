# CLAUDE.md

## 專案概述

GlucoseFlow — 結合 AI 分類邏輯的控糖管理系統，使用者紀錄進食順序，系統計算血糖穩定得分並視覺化呈現趨勢。

- **前端**: Vue 3 (Composition API), Vite, TypeScript, Pinia, GSAP, Chart.js
- **後端**: Node.js (Express), MySQL (Sequelize/Prisma), Docker
- **核心邏輯**: 基於「進食順序」的演算法評分系統（Fiber → Protein → Carb 為最佳）

## 常用指令

- `npm run dev` — 啟動前端開發環境
- `docker-compose up -d` — 啟動資料庫與後端服務
- `npm run lint` — 執行程式碼檢查

## 關鍵規則

- **型別安全**：嚴格禁止 `any`，所有 API 回傳與組件 Props 必須定義 Interface
- **組件化設計**：UI 組件與邏輯組件分離，遵循單一職責原則
- **GSAP 動畫**：僅在 `onMounted` 觸發，使用 `gsap.context()` 清理，避免記憶體洩漏
- **Loading State**：串接 AI API 及高頻搜尋一律實作 Loading State + Debounce 防抖
- **開發前必須建立計畫**：每次進行功能修改或新增前，先依照 `docs/plans/2026-04-26-ecpay-full-integration(as structure model).md` 的格式，在 `docs/plans/` 建立一份今日計畫（`YYYY-MM-DD-<feature-name>.md`），與使用者確認計畫內容後才開始撰寫程式碼；功能完成後移至 `docs/plans/archive/`

## 詳細文件

- ./docs/README.md — 項目介紹與快速開始
- ./docs/ARCHITECTURE.md — 架構、目錄結構、資料流
- ./docs/DEVELOPMENT.md — 開發規範、命名規則
- ./docs/FEATURES.md — 功能列表與完成狀態
- ./docs/TESTING.md — 測試規範與指南
- ./docs/CHANGELOG.md — 更新日誌

## 必要遵守項目

- 後端高頻查詢（使用者 ID、時間範圍）必須建立資料庫索引 (Index)
- 前端以 Pinia 快取已拉取的歷史紀錄，避免重複發起請求
- Chart.js (vue-chartjs) 繪製分數趨勢圖時必須實作資料載入中的 Loading 狀態
- GSAP 動畫依評分區間差異化：80+ 彈跳綠光、60-79 淡入綠示、40-59 震動黃綠、20-39 震動橘警告、<20 強烈震動紅色嚴重警報
- 飲食評分最佳順序：蔬菜(Fiber) → 蛋白質(Protein) → 澱粉(Carb)