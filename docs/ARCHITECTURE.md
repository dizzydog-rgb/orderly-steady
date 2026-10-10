# Architecture

本文件描述「Orderly & Steady」的架構設計、目錄結構、資料流與核心演算法邏輯。

## 1. 系統概述

本專案是一個全端控糖管理系統，採雙服務架構：

- **前端**（`src/`）：Vue 3 + TypeScript，Vite dev server，透過 `/api/*` proxy 呼叫後端；負責即時評分計算、動態視覺回饋與資料展示。
- **後端**（`server/`）：Node.js (Express 5) + Prisma (MySQL)；負責 AI 食物分類、最終評分計算、資料持久化與 JWT 驗證。
- **核心價值**：以「進食順序」為依據的 all_pair 加權矩陣評分，搭配 AI 分類與趨勢視覺化，引導使用者建立良好的飲食習慣。

---

## 2. 目錄結構

```
orderly-steady/
├── src/                        # 前端
│   ├── router/index.ts         # Vue Router + beforeEach guard（未登入自動 refresh，失敗跳 /login）
│   ├── stores/
│   │   ├── auth.ts             # Pinia auth store（user / accessToken / _refreshPromise 去重鎖）
│   │   └── history.ts          # Pinia history store（hasFetched / prependRecord・updateRecord・removeRecord 樂觀更新）
│   ├── composables/
│   │   ├── useGlucoseScore.ts  # HomeView 核心：mealSequence（最多 3 項）、scoreResult computed
│   │   ├── useTheme.ts         # System / Light / Dark 三態，matchMedia 追蹤 OS 偏好
│   │   └── useLang.ts          # CN / EN 語言切換
│   ├── components/
│   │   ├── NavBar.vue          # 品牌 logo、導覽連結、≤480px 漢堡選單
│   │   ├── ScoreTrendChart.vue # Chart.js 折線圖 + backgroundBandsPlugin 分數色帶；支援今日 / 7 / 14 / 30 / 90 / 180 天範圍切換
│   │   ├── FoodTypeEditor.vue  # 評分結果列的類別文字 + 編輯圖示 + 浮層選單（修正食物分類）
│   │   ├── ThemeSwitcher.vue   # 三態膠囊控件（含滑動指示器動畫）
│   │   └── LangSwitcher.vue    # 語言切換按鈕組
│   ├── utils/fetchWithAuth.ts  # 統一 API 入口；401 → refresh → retry，失敗跳 /login
│   ├── services/
│   │   └── scoringAlgorithm.ts # 前端即時評分（與 server/ 保持同步）
│   ├── types/index.ts          # 所有共用介面（IMealItem / IScoringResult / IMealRecord…）
│   └── views/
│       ├── HomeView.vue        # 三格輸入 + 評分結果 + 趨勢圖 + 歷史列表
│       ├── LoginView.vue       # 登入 / 註冊雙 tab
│       ├── MemberView.vue      # 會員資訊 + 登出
│       └── WhyView.vue         # 控糖科學衛教文章（公開頁面，支援 CN/EN）
├── server/                     # 後端
│   ├── app.ts                  # Express app 建立（CORS / cookieParser / routes；供測試 import）
│   ├── db.ts                   # Prisma client 實例
│   ├── index.ts                # 入口：import app → listen，dotenv 初始化
│   ├── routes/
│   │   ├── auth.ts             # register / login / refresh / logout / me
│   │   ├── meals.ts            # POST /api/meals（rate limit 10/min）、PATCH …/items/:sequenceIndex（修正分類）、GET /api/meals/:userId
│   │   ├── foodOverrides.ts    # PUT /api/food-overrides（個人分類覆寫）
│   │   └── foodDictionary.ts   # DELETE /api/food-dictionary（全清 / 單筆）
│   ├── schemas/
│   │   ├── auth.schemas.ts     # RegisterSchema / LoginSchema (Zod + z.infer 型別匯出)
│   │   └── meals.schemas.ts    # CreateMealSchema / UpdateFoodTypeSchema / UpsertFoodOverrideSchema
│   ├── services/
│   │   ├── ai.ts               # 分類查詢（個人覆寫 → FoodDictionary 快取 → Claude Haiku）、upsertFoodOverride
│   │   ├── foodLabel.ts        # normalizeLabel（NFKC + trim），字典與覆寫的查詢鍵共用
│   │   ├── scoringAlgorithm.ts # 後端評分（寫入 DB 前最終計算）
│   │   └── authService.ts      # JWT 產生與驗證、bcrypt
│   ├── middleware/
│   │   ├── authMiddleware.ts   # Bearer token 驗證，注入 req.user；optionalAuthMiddleware 供訪客／登入者共用端點
│   │   ├── rateLimit.ts        # isRateLimitDisabled（E2E 旁路）、修正分類共用的 limiter
│   │   └── validate.ts         # 通用 Zod validate() middleware factory
│   ├── __tests__/              # 後端測試（共 63 個 test cases）
│   │   ├── middleware/         # authMiddleware.spec.ts / validate.spec.ts
│   │   ├── routes/             # auth.spec.ts / meals.spec.ts
│   │   └── services/           # scoringAlgorithm.spec.ts
│   └── scripts/
│       └── clearFoodDictionary.ts
├── prisma/
│   ├── schema.prisma
│   └── seed.ts                 # 50 筆常見食物預設分類
├── e2e/                        # Playwright E2E 測試
│   ├── settings.spec.ts        # 帳號設定頁（名稱／密碼變更）
│   ├── food-correction.spec.ts # 修正食物分類（個人覆寫、浮層選單）
│   ├── testAccount.ts          # 專用測試帳號常數、resetE2ETestUser()、測試用 FoodDictionary 預置（含 localhost 防護）
│   ├── global-setup.ts         # 測試開始前建立測試帳號
│   ├── global-teardown.ts      # 清除測試用 FoodDictionary、收斂 Prisma 連線
│   └── seedTestAccount.ts      # 手動重置腳本（npm run seed:e2e）
├── playwright.config.ts        # testDir=e2e、baseURL=5173、workers=1（共用測試帳號需序列化）
└── docker-compose.yml
```

---

## 3. 資料模型（Prisma Schema）

```
User
  id            String         @id @default(uuid())
  email         String         @unique
  name          String?
  password      String?        (bcrypt hash；null = 由 meals endpoint 自動建立、尚未完成註冊)
  records       MealRecord[]
  refreshTokens RefreshToken[]
  foodOverrides UserFoodOverride[]
  @@index([email])

UserFoodOverride                 ← 個人分類覆寫，優先於 FoodDictionary，只影響該使用者
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(..., onDelete: Cascade)
  label     String   @db.VarChar(100)   (已正規化的食物名稱)
  type      FoodType
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@unique([userId, label])      ← 同時作為 (userId, label) 查詢索引

RefreshToken
  id        String   @id @default(uuid())
  token     String   @unique @db.VarChar(512)
  userId    String
  user      User     @relation(...)
  expiresAt DateTime
  createdAt DateTime @default(now())
  @@index([userId])

MealRecord
  id          String     @id @default(uuid())
  userId      String
  totalScore  Int
  tips        Json?      (string[]；可空)
  recordedAt  DateTime   @default(now())
  foodItems   FoodItem[]
  @@index([userId, recordedAt])

FoodItem
  id            String     @id @default(uuid())
  mealRecordId  String
  type          FoodType   (enum)
  label         String
  sequenceIndex Int
  @@index([mealRecordId])

FoodDictionary
  id    String   @id @default(uuid())
  label String   @unique   ← AI 分類快取，命中直接回傳
  type  FoodType

FoodType enum: FIBER | PROTEIN | COMPLEX_CARB | SIMPLE_CARB | OTHER
```

---

## 4. 核心演算法：all_pair 加權矩陣

演算法同時存在於前後端，**兩份必須保持同步**：
- `src/services/scoringAlgorithm.ts` — 前端即時計算（使用者操作時）
- `server/services/scoringAlgorithm.ts` — 後端寫入 DB 前最終計算

### 4.1 三分支決策樹

| 分支 | 條件 | 結果 |
|------|------|------|
| m=0 | 所有食物均為 OTHER | `totalScore: null`，不寫入 DB |
| m=1 | 僅 1 項可評分食物 | SIMPLE_CARB → 20 分；COMPLEX_CARB → 40 分；FIBER / PROTEIN → 60 分 |
| m≥2 | 2–3 項可評分食物 | all_pair 加權矩陣計算 |

### 4.2 SCORE_MATRIX（m≥2 時使用）

前者食物 → 後者食物，數值 0–10（越高越好）：

| 前 \ 後 | F | P  | CC | SC |
|---------|---|----|----|----|
| **F**   | 5 | 10 | 10 | 8  |
| **P**   | 8 |  5 | 10 | 8  |
| **CC**  | 5 |  5 |  5 | 3  |
| **SC**  | 6 |  6 |  4 | 0  |

- 前端使用 FoodType value（`'F'`/`'P'`/`'CC'`/`'SC'`）
- 後端使用 Prisma enum 名稱（`FIBER`/`PROTEIN`/`COMPLEX_CARB`/`SIMPLE_CARB`）

### 4.3 距離加權與懲罰

- **相鄰 pair**（j = i+1）：乘 ×1.5
- **跨越 pair**（j > i+1）：乘 ×1.0
- **SIMPLE_CARB 首位懲罰**：index=0 → -10 分；index=1 → -10 分

---

## 5. Auth 架構

**JWT 雙令牌**：

| Token | 有效期 | 存放位置 |
|-------|--------|----------|
| Access Token | 15m | Pinia 記憶體（`authStore.accessToken`） |
| Refresh Token | 7d | httpOnly cookie（`sameSite=strict`） |

- **Token 輪換**：每次 `/api/auth/refresh` 同時換發新 Refresh Token，舊的 DB 記錄立即失效。
- **`fetchWithAuth`**：所有需登入的請求統一走此工具；自動附加 Bearer header，401 時觸發 refresh → retry；refresh 失敗則清除狀態並跳 `/login`。
- **`_refreshPromise`**：去重鎖，防止多個並發請求同時觸發 refresh。
- **`POST /api/meals` 無需登入**：以 `email` 欄位 upsert user，允許未登入訪客快速試用。
- **`optionalAuthMiddleware`**（`POST /api/meals` 使用）：未帶 `Authorization` 視為訪客放行；有帶但無效則回 401。若把無效 token 靜默當成訪客，access token 過期的登入者就不會套用個人分類覆寫，且 `fetchWithAuth` 收不到 401 也不會 refresh。

---

## 6. AI 食物分類流程

```
使用者輸入食物名稱
       ↓
normalizeLabel（NFKC + trim）
       ↓
已登入且 token 屬於此 email？
  └─ YES → UserFoodOverride 查詢（(userId, label) 唯一鍵）
              └─ 有覆寫 → 直接回傳 type（log: [AI] User override）
       ↓
FoodDictionary DB 查詢（label 唯一索引）
       ↓
  命中快取？
  ├─ YES → 直接回傳 type（log: [AI] Cache hit）
  └─ NO  → 呼叫 Claude Haiku API
              ↓
           regex 解析回傳值
              ↓
           寫入 FoodDictionary
              ↓
           回傳 type
```

模型：`claude-haiku-4-5-20251001`，`max_tokens: 20`，system prompt 要求只回傳 5 個英文代號之一。

### 6.1 個人分類覆寫

AI 分類結果永久快取於全域 `FoodDictionary`，分錯時使用者無從補救；部分「錯誤」其實是見解差異（例如 prompt 將水果列為精緻碳水）。因此讓登入者自行修正，但寫入的是 `UserFoodOverride` 而非全域字典：

- **互不影響**：A 把蘋果改成複合碳水、B 改成纖維，兩者並存，沒有衝突要解決；刷分或誤改也只影響自己。
- **全域字典只由 AI 寫入**，使用者操作不會改動它。
- **訪客不套用**：`POST /api/meals` 只憑 email 就能送出，因此只有 token 的 `userId` 與該 email 的使用者相符時才查覆寫。
- **只影響當餐與未來**：不回溯重算過去的紀錄。

修正當餐的兩條路徑（`HomeView.handleTypeChange`）：

| 情況 | 流程 |
|------|------|
| 當餐已有紀錄 | `PATCH /api/meals/:recordId/items/:sequenceIndex` — 同一 transaction 內 upsert 覆寫、更新 `FoodItem.type`、重算並更新 `totalScore`／`tips`；若重算後全為 OTHER 則刪除紀錄 |
| 當餐全為 OTHER（m=0，沒有紀錄） | `PUT /api/food-overrides` 存覆寫 → 以相同食物重送 `POST /api/meals`，走既有流程建立紀錄 |

---

## 7. 前端資料流

```
使用者輸入食物
       ↓
useGlucoseScore（mealSequence ref）
       ↓
computed scoreResult → calculateMealScore()  ← 即時分數
       ↓
HomeView 送出
       ↓
fetchWithAuth POST /api/meals
       ↓
後端：AI 分類 → calculateMealScore() → Prisma create
       ↓
回傳 { record, analysis }
       ↓
historyStore.prependRecord(record)  ← 樂觀更新
       ↓
ScoreTrendChart 自動更新（computed from store.records）
       ↓
（登入者修正分類）FoodTypeEditor emit change
       ↓
fetchWithAuth PATCH /api/meals/:recordId/items/:sequenceIndex
       ↓
回傳 { record | null, analysis }
       ↓
historyStore.updateRecord(record) 或 removeRecord(id)  ← 不重新拉取
```

---

## 8. 路由與頁面守衛

| 路由 | 元件 | 存取權限 |
|------|------|----------|
| `/login` | LoginView | 公開；已登入自動跳 `/` |
| `/why` | WhyView | 公開 |
| `/` | HomeView | 需登入 |
| `/member` | MemberView | 需登入 |

`beforeEach` guard：非公開路由 → 若無 accessToken 先嘗試 refresh → 失敗則跳 `/login`。
