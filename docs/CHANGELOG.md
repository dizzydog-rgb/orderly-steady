# Changelog

所有對「控糖網站」專案的重要變更都將記錄在此文件中。

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
