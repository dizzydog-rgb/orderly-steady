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
| 前端 | Vue 3 (Composition API)、TypeScript、Vite、Vue Router、Pinia、GSAP、Chart.js |
| 後端 | Node.js、Express 5、TypeScript、Prisma ORM |
| 資料庫 | MySQL（Docker 容器化） |
| 驗證 | JWT（Access Token + Refresh Token）、bcryptjs |
| AI 分類 | Anthropic Claude Haiku API |
| 測試 | Vitest |

---

## 核心功能

### 會員系統
- Email + 密碼註冊 / 登入
- JWT 雙 Token 機制：Access Token（15 分鐘）存 Pinia 記憶體、Refresh Token（7 天）存 httpOnly cookie
- **懶刷新策略**：不主動計時，僅在 API 回傳 401 時自動換發，對使用者完全透明
- Refresh Token 輪換（每次換發產生新 Token，舊 Token 立即失效，防止 replay attack）

### 飲食記錄與評分
- 三格輸入依序解鎖，強制引導使用者思考進食順序
- **all_pair 加權矩陣演算法**：雙重迴圈計算所有食物對，相鄰距離乘 ×1.5；最佳路徑為膳食纖維 → 蛋白質 → 複合碳水（100 分）
- GSAP 動畫依評分區間差異化呈現（≥80 彈跳綠光、60–79 淡入黃示、40–59 震動黃綠、20–39 震動橘警告、<20 強烈震動紅色）

### AI 食物分類與快取
- 後端串接 Claude Haiku API 自動分類食物（FIBER / PROTEIN / COMPLEX_CARB / SIMPLE_CARB / OTHER）
- 分類結果寫入 `FoodDictionary` 資料表，相同食物名稱直接命中快取，避免重複呼叫

### 歷史趨勢視覺化
- 登入後自動拉取歷史餐點紀錄，Chart.js 折線圖呈現得分趨勢
- 支援當日 / 7天 / 14天 / 30天 / 3個月 / 半年範圍切換，預設顯示當日
- 送出新紀錄後樂觀插入清單頂部，不重新 fetch

---

## 系統架構

```
orderly-steady/
├── src/                        # 前端（Vite + Vue 3）
│   ├── router/index.ts         # Vue Router + beforeEach 驗證 guard
│   ├── stores/
│   │   ├── auth.ts             # Pinia auth store（含 _refreshPromise 去重鎖）
│   │   └── history.ts          # Pinia history store（hasFetched 防重複請求）
│   ├── composables/
│   │   ├── useGlucoseScore.ts  # 即時評分狀態（mealSequence / scoreResult）
│   │   ├── useTheme.ts         # System / Light / Dark 主題切換
│   │   └── useLang.ts          # CN / EN 語言切換
│   ├── components/
│   │   ├── NavBar.vue          # 含漢堡選單（≤480px）
│   │   ├── ScoreTrendChart.vue # Chart.js 折線圖 + 分數色帶
│   │   ├── ThemeSwitcher.vue   # 三態膠囊控件
│   │   └── LangSwitcher.vue    # 語言切換
│   ├── utils/fetchWithAuth.ts  # 統一 API 入口，401 自動重試
│   ├── services/
│   │   └── scoringAlgorithm.ts # 前端即時評分（與後端保持同步）
│   ├── types/index.ts          # 共用 TypeScript 介面
│   └── views/                  # LoginView / HomeView / MemberView / WhyView
├── server/                     # 後端（Express 5）
│   ├── app.ts                  # Express app 建立（供測試 import）
│   ├── db.ts                   # Prisma client 實例
│   ├── index.ts                # 入口：import app → listen
│   ├── routes/
│   │   ├── auth.ts             # register / login / refresh / logout / me
│   │   ├── meals.ts            # POST 建立紀錄 / GET 歷史查詢
│   │   └── foodDictionary.ts   # DELETE 快取管理
│   ├── schemas/
│   │   ├── auth.schemas.ts     # RegisterSchema / LoginSchema (Zod)
│   │   └── meals.schemas.ts    # CreateMealSchema (Zod)
│   ├── services/
│   │   ├── authService.ts      # JWT 產生與驗證、bcrypt
│   │   ├── scoringAlgorithm.ts # 後端評分（寫入前最終計算）
│   │   └── ai.ts               # Claude Haiku 分類 + DB 快取
│   ├── middleware/
│   │   ├── authMiddleware.ts   # Bearer token 驗證
│   │   └── validate.ts         # Zod 通用驗證 middleware
│   ├── __tests__/              # 後端測試（v0.9.2）
│   └── scripts/
│       └── clearFoodDictionary.ts
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

# 6. 啟動後端（port 3100）
npm run dev:server

# 7. 啟動前端（port 5173）
npm run dev
```

### .env 設定範例

```env
DATABASE_URL="mysql://root:your_password@localhost:3306/glucose_db?charset=utf8mb4"
PORT=3100
JWT_SECRET=<64 字元隨機字串>
JWT_REFRESH_SECRET=<另一組 64 字元隨機字串>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
COOKIE_SECURE=false
FRONTEND_URL=http://localhost:5173
ANTHROPIC_API_KEY=<Anthropic API 金鑰>
```

---

## API 端點

| 方法 | 路徑 | 說明 | 驗證 |
|---|---|---|---|
| POST | `/api/auth/register` | 新用戶註冊 | 無 |
| POST | `/api/auth/login` | 登入，回傳 Access Token；Refresh Token 存 cookie | 無 |
| POST | `/api/auth/refresh` | 換發新 Token 對 | httpOnly cookie |
| POST | `/api/auth/logout` | 登出，撤銷 Refresh Token | Bearer Token |
| GET | `/api/auth/me` | 取得目前使用者 | Bearer Token |
| POST | `/api/meals` | 建立飲食紀錄（含 AI 分類與評分） | 無（email upsert） |
| GET | `/api/meals/:userId` | 查詢歷史紀錄 | Bearer Token |
| DELETE | `/api/food-dictionary` | 清除全部 AI 分類快取 | Bearer Token |
| DELETE | `/api/food-dictionary/:label` | 清除單筆 AI 分類快取 | Bearer Token |

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
| v0.9.2 | Vitest 後端測試套件（47 tests）、GitHub Actions CI |
| v0.9.1 | Zod schema 驗證全面導入 |
| v0.9.0 | ScoreTrendChart 折線圖、Pinia history store、FoodDictionary 管理端點 |
| v0.8.0 | all_pair 加權矩陣評分演算法重構 |
| v0.7.0 | Claude Haiku AI 分類、OTHER 類別、RWD 三斷點 |
| v0.6.0 | Refresh Token 改存 httpOnly cookie、Pinia auth store、ThemeSwitcher、WhyView |
| v0.5.0 | 前端三頁面重設計、Vue Router、JWT 會員系統整合 |
| v0.4.0 | 後端 JWT 驗證 API（register / login / refresh / me） |
| v0.3.0 | 飲食紀錄 API、FoodDictionary 快取 |
| v0.2.0 | 全端架構建立、Express + Prisma + Docker |
| v0.1.0 | 專案初始化 |
