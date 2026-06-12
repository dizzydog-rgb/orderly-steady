# Features List

本文件記錄「Orderly & Steady」的功能清單、行為描述與目前開發狀態。

## 1. 核心功能：進食順序評分 (Meal Order Scoring)

### 1.1 記錄進食序列
- **行為描述**: 使用者依序在三個文字輸入欄（第一口 / 第二口 / 第三口）輸入食物名稱；第二欄在第一欄有值後才解鎖，第三欄同理，強制引導思考進食順序。清空前一欄時後續欄位自動清除。
- **狀態**: 🟢 已完成

### 1.2 即時分數計算與動態動畫
- **行為描述**: 在使用者點選標籤時，系統即時更新總分。透過 GSAP 實作差異化動畫，使變化過程更加平滑自然。
- **視覺回饋**（顏色 4 段、動畫 5 段）:
  - **≥80**: 綠色（`--score-high`）— 彈跳縮放動畫 ×3（優良，血糖平穩）
  - **60–79**: 黃色（`--score-medium`）— 淡入動畫（尚可，有改善空間）
  - **40–59**: 橘色（`--score-low`）— 小幅震動 ×5（需注意）
  - **20–39**: 深紅（`--score-critical`）— 中幅震動 ×7（警告）
  - **<20**: 深紅（`--score-critical`，同上色）— 強烈震動 ×10（嚴重警報）
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
  - 🟢 `POST /api/meals` — 建立飲食紀錄（含 email upsert、AI 分類、評分計算、寫入 DB；rate limit 10 req/min）
  - 🟢 `GET /api/meals/:userId` — 查詢使用者歷史紀錄（依時間倒序，含 foodItems；需 Bearer Token 且只能查詢自己）
  - 🟢 FoodDictionary 快取機制（AI 分類結果快取至 DB，避免重複呼叫）
  - 🟢 食物資料庫初始化（50 筆常見食物預設分類）
  - 🟢 **Zod Schema 驗證**：`server/middleware/validate.ts` 通用 middleware；`server/schemas/` 定義 RegisterSchema、LoginSchema、CreateMealSchema；格式錯誤回傳結構化 `{ error, details }` 400 回應
- **狀態**: 🟢 已完成

## 2.1 評分演算法（all_pair 加權矩陣）
- **行為描述**: 前端固定三個欄位（依序解鎖），總分 100 分制；以 all_pair 加權矩陣計算任意食物序列的得分。
- **演算法分支**:
  - **m=0**（全為 OTHER）：`totalScore: null`，不寫入 DB。
  - **m=1**（單一可評分食物）：SIMPLE_CARB → 20 分；COMPLEX_CARB → 40 分；FIBER / PROTEIN → 60 分。
  - **m≥2**：雙重迴圈所有 pair (i,j)，依距離加權（相鄰 ×1.5，跨越 ×1.0），查 SCORE_MATRIX（0–10）計算加權分比；SIMPLE_CARB index=0 懲罰 -10 分、index=1 懲罰 -10 分。
- **最佳路徑**: Fiber → Protein → Complex Carb = 100 分。
- **狀態**: 🟢 已完成

## 3. 會員系統與 JWT 驗證 (Authentication)
- **行為描述**：使用者可以註冊帳號、以 email + 密碼登入，取得 Access Token（15 分鐘有效）與 Refresh Token（7 天有效）存取受保護的 API。
- **目前進度**：
  - 🟢 `POST /api/auth/register` — 新用戶註冊（bcrypt 密碼雜湊）
  - 🟢 `POST /api/auth/login` — 登入，回傳 Access Token；Refresh Token 存入 httpOnly cookie
  - 🟢 `POST /api/auth/refresh` — Refresh Token 輪換換發（舊 token 立即失效）
  - 🟢 `POST /api/auth/logout` — 撤銷 DB 中 Refresh Token、清除 httpOnly cookie（需 Bearer Token）
  - 🟢 `GET /api/auth/me` — 取得目前登入使用者資訊（需 Bearer Token）
  - 🟢 `authMiddleware` — JWT 驗證中介層，可套用於任意受保護路由
  - 🟢 Refresh Token 存 httpOnly cookie（`sameSite=strict`），Access Token 存 Pinia 記憶體
  - 🟢 **訪客試用模式**：HomeView 為 public 路由，未登入可輸入食物取得評分（email upsert 建立 `password=null` 帳號）；送出後顯示註冊引導 CTA，歷史紀錄僅登入者可見
- **狀態**: 🟢 已完成

## 4. 歷史趨勢視覺化 (Analytics)
- **行為描述**: 在首頁歷史紀錄區塊上方，以 Chart.js 折線圖展示近期得分趨勢。圖表上方提供六個時間範圍按鈕（當日 / 7天 / 14天 / 30天 / 3個月 / 半年），預設顯示當日；切換時有 GSAP + Chart.js 過場動畫。歷史資料由 Pinia store 快取，不重複發起請求。
- **狀態**: 🟢 已完成

## 5. AI 食物分類 (AI Food Classification)
- **行為描述**: 使用者輸入食物名稱後，後端呼叫 Claude Haiku API 自動分類為 FIBER / PROTEIN / COMPLEX_CARB / SIMPLE_CARB / OTHER 之一；分類結果快取至 `FoodDictionary` 資料表，相同名稱下次直接命中快取（log: `[AI] Cache hit`）。
- **目前進度**:
  - 🟢 Claude Haiku API 串接（`claude-haiku-4-5-20251001`）
  - 🟢 DB 快取機制（`FoodDictionary` label 唯一索引）
  - 🟢 `DELETE /api/food-dictionary` — 全清快取（需 Bearer Token）
  - 🟢 `DELETE /api/food-dictionary/:label` — 清除單筆錯誤快取（需 Bearer Token）
- **狀態**: 🟢 已完成

## 6. 使用者介面 (UI / UX)
- **目前進度**:
  - 🟢 **主題切換**：System / Light / Dark 三態，`ThemeSwitcher` 膠囊控件含滑動指示器動畫；System 模式自動追蹤 OS 偏好（`matchMedia`）
  - 🟢 **語言切換**：`LangSwitcher` 元件搭配 `useLang` composable，提供 CN / EN 切換；目前套用於「控糖科學」頁面
  - 🟢 **衛教內容頁**（`/why`）：說明血糖波動原理與進食順序的科學依據，支援 CN/EN 語言切換，公開頁面無需登入
  - 🟢 **響應式設計**：全站三斷點（1024 / 768 / 480px）自適應；NavBar 在 ≤480px 收合為漢堡選單
- **狀態**: 🟢 已完成
