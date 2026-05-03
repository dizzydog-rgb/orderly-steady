# 2026-05-03 GlucoseFlow 全端架構建立與動態評分回饋優化

## 1. User Story
本專案（GlucoseFlow）是一個結合 AI 分類邏輯的控糖管理系統。為了將專案從純前端原型升級為具備資料持久化與後端服務的完整應用，今天進行了全端基礎設施的建置。

**核心變更**：
1. **後端與資料庫初始化**：建立 Node.js (Express) 後端與 MySQL (Prisma) 資料庫環境，並引入 Docker 進行容器化管理。
2. **核心演算法升級**：升級評分演算法，系統現在會根據進食順序（如：是否先吃纖維、澱粉出現的時機）自動產生專屬的控糖建議 (Tips)。
3. **前端互動與視覺優化**：導入 GSAP 動畫庫，實現分數變動時的平滑數值跳動動畫；並新增建議顯示區塊，提升使用者互動體驗。

## 2. 測試流程驗證 (Test Flow)
1. **啟動環境**:
   - 執行 `docker-compose up -d` 啟動 MySQL 資料庫服務。
   - 執行 `npm run dev:server` 啟動 Express 後端伺服器。
   - 執行 `npm run dev` 啟動 Vite 前端開發伺服器。
2. **操作體驗**: 
   - 開啟瀏覽器進入前端頁面。
   - 點擊「植物纖維」、「優質蛋白質」、「複合碳水」等按鈕，將食物加入進食順序。
3. **評分與動畫驗證**:
   - 觀察上方「總分」數字，確認分數變動時是否帶有 GSAP 的平滑滾動 (數字遞增/遞減) 動畫。
   - 確認分數卡片的邊框與文字顏色是否根據分數級距（優良綠、普通黃、不佳紅）即時切換。
4. **建議系統驗證**:
   - 故意不點擊纖維，直接點擊碳水，確認下方是否出現橘黃色的「健康飲食建議」提示框，並顯示對應的警告（例如：建議先攝取植物纖維）。
   - 測試各種進食組合，驗證 `scoringAlgorithm.ts` 產生的 tips 陣列是否正確顯示於畫面上。
5. **單元測試**:
   - 執行 `npm run test` (Vitest)，確認 `scoringAlgorithm.spec.ts` 中關於 `tips` 與總分計算的測試案例皆通過。

## 3. Spec 與架構設計

### 3.1 後端與資料庫設計 (Backend & Database)
- **環境建置**: 引入 `express`, `cors`, `dotenv` 以及 `@prisma/client`。
- **資料庫架構**: 新增 `prisma/schema.prisma` 與 `docker-compose.yml`，奠定 MySQL 資料庫基礎。
- **後端入口**: 建立 `server/index.ts` 作為 API 服務起點，並透過 `tsx` 支援開發時的熱重載 (`npm run dev:server`)。

### 3.2 核心邏輯 (Scoring Algorithm)
- **`calculateMealScore`**:
  - 新增陣列 `tips`，用於收集並回傳動態飲食建議。
  - 邏輯判斷：若未攝取纖維、纖維順序太後、或碳水攝取過早，則推入對應的中文建議字串。
- **介面更新**: `IScoringResult` 新增 `tips: string[]` 屬性。

### 3.3 前端設計 (Vue 3 UI & GSAP)
- **Composables 重構**: 將狀態與邏輯抽離至 `src/composables/useGlucoseScore.ts`，落實單一職責原則並提高可維護性。
- **GSAP 動畫**: 
  - 於 `App.vue` 中使用 `gsap.to()` 實作 `displayScore` 的平滑數值動畫。
  - 嚴格遵守 Vue 3 生命週期，於 `onMounted` 初始化 `gsap.context()` 並於 `onUnmounted` 進行清理，避免 Memory Leak。
- **UI 元件**: 新增 `.tips-container` 區塊，搭配 `v-if` 與 `v-for` 動態渲染建議列表。

## 4. 環境與設定 (.env & Config)
- **`.gitignore`**: 新增排除 `.env` 與 `/src/generated/prisma`。
- **`package.json`**: 新增 `dev:server` 指令，並補齊前後端所需之 dependencies (`express`, `@prisma/client`, `gsap` 等) 與 devDependencies (`tsx`, `prisma` 等)。
- **`GEMINI.md`**: 更新專案核心目標與執行準則，明確規範 GSAP 動畫清理機制與資料庫效能優化方針。

## 5. Tasks (今日已完成)
- [x] 1. 初始化後端資料夾結構 (`server/`, `prisma/`) 與 Docker 設定。
- [x] 2. 更新 `package.json` 安裝 Prisma, Express, GSAP 等套件。
- [x] 3. 改寫 `scoringAlgorithm.ts`，加入 `tips` 陣列與相關判斷邏輯。
- [x] 4. 更新 `scoringAlgorithm.spec.ts` 單元測試以涵蓋 `tips` 產出。
- [x] 5. 抽離前端邏輯至 `useGlucoseScore` composable。
- [x] 6. 於 `App.vue` 導入 GSAP 數字跳動動畫與 Context 清理機制。
- [x] 7. 於 `App.vue` 實作動態建議提示框 (Tips Container) UI。
- [x] 8. 更新 `GEMINI.md` 與 `.gitignore` 以符合最新專案架構。

## 6. 驗收結果
- 已成功將專案從純前端狀態升級為包含資料庫與伺服器基礎的全端開發結構。
- 前端能流暢地利用 GSAP 展示分數動畫，並精準呈現根據使用者進食順序生成的健康建議，符合核心目標的「動態視覺回饋」要求。
- 測試案例已覆蓋新的評分與建議邏輯，確保核心演算法的正確性。