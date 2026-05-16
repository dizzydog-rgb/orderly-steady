# Changelog

所有對「Orderly & Steady」專案的重要變更都將記錄在此文件中。

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
