# 2026-05-03 專案核心文件同步更新 (Project Documentation Update)

## 1. User Story
身為專案開發者，在完成 GlucoseFlow 專案從純前端應用至全端架構（Node.js, Express, Prisma, Docker）的升級，並導入了 GSAP 動態動畫及智慧健康建議 (Tips) 邏輯後，我需要同步更新專案的技術說明文件（`docs/`），以確保團隊成員與未來開發者能準確理解系統架構、啟動流程與核心功能行為。

**核心變更**：全面更新 `docs/` 目錄下的文件，以反映今日的後端基礎設施、演算法擴充與前端互動優化。

## 2. 測試流程驗證 (Test Flow)
由於此計畫為純文件更新，驗證方式為：
1. **人工檢閱**: 檢視 `docs/ARCHITECTURE.md` 是否包含後端服務架構與 `tips` 生成邏輯。
2. **指令驗證**: 檢視 `docs/DEVELOPMENT.md` 中關於 `npm run dev:server` 與 `docker-compose up` 的指令描述是否正確無誤。
3. **功能對齊**: 檢視 `docs/FEATURES.md` 是否已將 GSAP 動畫與健康建議提示框列為核心功能。
4. **版本控制**: 檢視 `docs/CHANGELOG.md` 是否已標記為新版本 (例如：`[0.2.0]`) 並列出今日的重大變更。

## 3. Spec 與架構設計 (文件更新細節)

### 3.1 ARCHITECTURE.md 更新
- **系統概述**: 修改為 Vue 3 前端 + Node.js (Express) 後端 + MySQL (Prisma) 資料庫的全端架構。
- **目錄結構**: 增加 `server/` (API 路由與服務)、`prisma/` (資料庫 Schema) 與 `docker-compose.yml` 的說明。
- **進食順序評分演算法**:
  - 新增「健康建議 (Tips) 產生邏輯」小節：說明根據纖維順序、碳水出現時機所觸發的動態建議字串。
- **資料流**: 擴充後端 API 處理層與資料持久化的描述。

### 3.2 FEATURES.md 更新
- **即時評分回饋**: 補充 GSAP 數值平滑滾動動畫與分數顏色動態切換的描述。
- **智慧飲食建議**: 新增功能區塊，說明系統如何根據進食順序自動產生個人化改善提示框。
- **資料持久化 (新增)**: 說明後端架構建立，為未來的歷史紀錄查詢與趨勢圖表奠定基礎。

### 3.3 DEVELOPMENT.md 更新
- **環境需求**: 增加 Docker 與 Node.js 的版本建議。
- **本地開發啟動流程**: 
  - 加入 `docker-compose up -d` 啟動資料庫。
  - 加入 `npm run dev:server` 啟動後端服務。
  - 說明 Prisma 的資料庫同步指令 (`npx prisma db push` 或 `npx prisma migrate dev`)。

### 3.4 TESTING.md 更新
- **測試策略**: 在「單元測試」中補充對於 `scoringAlgorithm.ts` 的測試範疇，特別是 `tips` 陣列產出邏輯與邊界情況的驗證。

### 3.5 CHANGELOG.md 更新
- **新增版本 `[0.2.0] - 2026-05-03`**：
  - Added: Express 後端與 Prisma 資料庫架構、Docker 容器化設定。
  - Added: 核心演算法新增動態健康建議 (Tips) 產出邏輯。
  - Added: 前端導入 GSAP 實現分數動畫、新增建議提示框 UI。
  - Changed: 將評分邏輯抽離至 `useGlucoseScore` composable。

## 4. Tasks
- [ ] 1. 更新 `docs/ARCHITECTURE.md` (全端架構、目錄結構、Tips 演算法)。
- [ ] 2. 更新 `docs/FEATURES.md` (GSAP 動畫、智慧建議、資料持久化預備)。
- [ ] 3. 更新 `docs/DEVELOPMENT.md` (Docker、後端啟動指令、Prisma 流程)。
- [ ] 4. 更新 `docs/TESTING.md` (演算法 Tips 單元測試策略)。
- [ ] 5. 更新 `docs/CHANGELOG.md` (記錄版本 `[0.2.0]`)。

## 5. 驗收結果
- 所有文件皆與目前的程式碼實作（全端基礎、GSAP 動畫、Tips 邏輯）保持一致。
- 開發者能依照 `DEVELOPMENT.md` 順利啟動包含資料庫與前後端的完整環境。