# Features List

本文件記錄「控糖網站」的功能清單、行為描述與目前開發狀態。

## 1. 核心功能：進食順序評分 (Meal Order Scoring)

### 1.1 記錄進食序列
- **行為描述**: 使用者可以依序點選「植物纖維」、「優質蛋白質」、「複合碳水」、「精緻糖」標籤，建立當前餐點的進食順序。
- **狀態**: 🟢 已完成

### 1.2 即時分數計算與動態動畫
- **行為描述**: 在使用者點選標籤時，系統即時更新總分。透過 GSAP 實作數值滾動動畫，使變化過程更加平滑自然。
- **視覺回饋**: 
  - **80-100**: 綠色（優良，血糖平穩）。
  - **60-79**: 黃色（尚可，有改善空間）。
  - **< 60**: 紅色（警示，建議調整順序）。
- **狀態**: 🟢 已完成

### 1.3 智慧飲食建議 (Health Tips)
- **行為描述**: 根據當前進食序列，系統自動分析並產出具體的改善建議（例如：「嘗試將蔬菜放在第一口，對穩定血糖更有幫助」）。
- **狀態**: 🟢 已完成

## 2. 後端服務與資料持久化 (Backend Infrastructure)
- **行為描述**: Node.js (Express) 後端架構，整合 Prisma ORM 與 MySQL，提供飲食紀錄的儲存與查詢。
- **目前進度**:
  - 🟢 基礎架構建立
  - 🟢 Docker 容器化資料庫
  - 🟢 Prisma Schema 設計與 Migration（User、MealRecord、FoodItem、FoodDictionary）
  - 🟢 `POST /api/meals` — 建立飲食紀錄（含 email upsert、AI 分類、評分計算、寫入 DB）
  - 🟢 `GET /api/meals/:userId` — 查詢使用者歷史紀錄（依時間倒序，含 foodItems）
  - 🟢 FoodDictionary 快取機制（AI 分類結果快取至 DB，避免重複呼叫）
  - 🟢 食物資料庫初始化（50 筆常見食物預設分類）
- **狀態**: 🟢 已完成

## 2.1 評分系統重設計（槽位配分制）
- **行為描述**: 前端固定三個欄位（依序解鎖），總分 100 分制；唯一滿分路徑為 Fiber → Protein → Complex Carb。
- **槽位配分**: Slot1（第一口）50 分、Slot2（第二口）30 分、Slot3（第三口）20 分；各槽依食物類別查表得分，空槽得 0 分。
- **狀態**: 🟢 已完成

## 3. 會員系統與 JWT 驗證 (Authentication)
- **行為描述**：使用者可以註冊帳號、以 email + 密碼登入，取得 Access Token（15 分鐘有效）與 Refresh Token（7 天有效）存取受保護的 API。
- **目前進度**：
  - 🟢 `POST /api/auth/register` — 新用戶註冊（bcrypt 密碼雜湊）
  - 🟢 `POST /api/auth/login` — 登入，回傳 JWT token 對
  - 🟢 `POST /api/auth/refresh` — Refresh Token 輪換換發（舊 token 立即失效）
  - 🟢 `GET /api/auth/me` — 取得目前登入使用者資訊（需 Bearer Token）
  - 🟢 `authMiddleware` — JWT 驗證中介層，可套用於任意受保護路由
- **狀態**: 🟢 已完成

## 4. 歷史趨勢視覺化 (Analytics) - *未來規劃*
- **行為描述**: 使用圖表（如 Chart.js）展示使用者過去一段時間內的得分趨勢，並根據評分結果觸發差異化 GSAP 動畫效果。
- **狀態**: ⚪ 待規劃
