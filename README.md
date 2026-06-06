# Orderly & Steady

> 以「進食順序」為核心的血糖管理系統——透過 AI 分類與演算法評分，幫助使用者建立更健康的飲食習慣。

---

## 專案簡介

Orderly & Steady 是一個全端 Web 應用程式。使用者依序輸入每餐的食物名稱，系統自動分類食物類型（膳食纖維 / 蛋白質 / 複合碳水 / 精緻碳水），依進食順序計算血糖穩定得分，並提供即時的飲食建議。

研究顯示，相同的食物以不同順序食用，對血糖的影響差異顯著。本系統的核心評分邏輯即基於此原理設計。

---

## 技術棧

| 層級 | 技術 |
|---|---|
| 前端 | Vue 3 (Composition API)、TypeScript、Vite、Vue Router、GSAP |
| 後端 | Node.js、Express 5、TypeScript、Prisma ORM |
| 資料庫 | MySQL（Docker 容器化） |
| 驗證 | JWT（Access Token + Refresh Token）、bcryptjs |
| 測試 | Vitest、@vue/test-utils |

---

## 核心功能

### 會員系統
- Email + 密碼註冊 / 登入
- JWT 雙 Token 機制：Access Token（15 分鐘）存記憶體、Refresh Token（7 天）存 localStorage
- **懶刷新策略**：不主動計時，僅在 API 回傳 401 時自動換發，對使用者完全透明
- Refresh Token 輪換（每次換發產生新 Token，舊 Token 立即失效，防止 replay attack）

### 飲食記錄與評分
- 三格輸入依序解鎖，強制引導使用者思考進食順序
- **槽位配分制**：第一口 50 分、第二口 30 分、第三口 20 分；唯一滿分路徑為膳食纖維 → 蛋白質 → 複合碳水（100 分）
- GSAP 動畫依評分區間差異化呈現（≥80 彈跳綠光、60–79 淡入黃示、<40 震動警告）

### AI 食物分類與快取
- 後端以關鍵字規則模擬 AI 分類（預留真實 LLM API 串接介面）
- 分類結果寫入 `FoodDictionary` 資料表，相同食物名稱直接命中快取，避免重複呼叫
- 預載 50 筆常見食物分類（`npm run seed`）

### 歷史紀錄
- 登入後自動拉取歷史餐點紀錄，依時間降冪顯示
- 送出新紀錄後樂觀插入清單頂部，不重新 fetch，體驗流暢

---

## 系統架構

```
orderly-steady/
├── src/                        # 前端（Vite + Vue 3）
│   ├── router/index.ts         # Vue Router + beforeEach 驗證 guard
│   ├── composables/
│   │   ├── useAuth.ts          # JWT 狀態管理（module singleton）
│   │   └── useHistory.ts       # 歷史紀錄快取
│   ├── utils/fetchWithAuth.ts  # 統一 API 入口，401 自動重試
│   └── views/                  # LoginView / HomeView / MemberView
├── server/                     # 後端（Express 5）
│   ├── routes/
│   │   ├── auth.ts             # register / login / refresh / me
│   │   └── meals.ts            # POST 建立紀錄 / GET 歷史查詢
│   ├── services/
│   │   ├── authService.ts      # JWT 產生與驗證、bcrypt
│   │   ├── scoringAlgorithm.ts # 槽位評分演算法
│   │   └── ai.ts               # 食物分類（含 DB 快取）
│   └── middleware/authMiddleware.ts
├── prisma/
│   ├── schema.prisma           # User / MealRecord / FoodItem / FoodDictionary
│   └── seed.ts                 # 50 筆食物預設分類
└── docker-compose.yml          # MySQL 容器
```

> 評分演算法同時存在於前後端（`src/services/` 與 `server/services/`），前端即時計算、後端寫入前最終驗證，確保資料一致性。

---

## 本地啟動

**前置需求**：Node.js 18+、Docker Desktop

```bash
# 1. 安裝依賴
npm install

# 2. 啟動 MySQL 容器
docker-compose up -d

# 3. 建立 .env（參考下方範例）

# 4. 執行 Prisma migration
npx prisma migrate dev

# 5. 寫入食物預設資料（選填）
npm run seed

# 6. 啟動後端（port 3000）
npm run dev:server

# 7. 啟動前端（port 5173）
npm run dev
```

### .env 設定範例

```env
DATABASE_URL="mysql://root:your_password@localhost:3306/glucose_db"
PORT=3000
JWT_SECRET=<64 字元隨機字串>
JWT_REFRESH_SECRET=<另一組 64 字元隨機字串>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

---

## API 端點

| 方法 | 路徑 | 說明 | 驗證 |
|---|---|---|---|
| POST | `/api/auth/register` | 新用戶註冊 | 無 |
| POST | `/api/auth/login` | 登入，回傳 Token 對 | 無 |
| POST | `/api/auth/refresh` | 換發新 Token | refreshToken |
| GET | `/api/auth/me` | 取得目前使用者 | Bearer Token |
| POST | `/api/meals` | 建立飲食紀錄 | Bearer Token |
| GET | `/api/meals/:userId` | 查詢歷史紀錄 | Bearer Token |

---

## 測試

```bash
npm run test                    # 執行所有單元測試
npm run build                   # TypeScript 型別檢查 + 打包
```

---

## 版本紀錄

| 版本 | 說明 |
|---|---|
| v0.5.0 | 前端三頁面重設計、Vue Router、JWT 會員系統整合 |
| v0.4.0 | 後端 JWT 驗證 API（register / login / refresh / me） |
| v0.3.0 | 飲食紀錄 API、槽位評分系統、FoodDictionary 快取 |
| v0.2.0 | 全端架構建立、Express + Prisma + Docker |
| v0.1.0 | 專案初始化 |
