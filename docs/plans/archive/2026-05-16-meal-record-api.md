# 2026-05-16 飲食紀錄 API 完整實作

## 1. User Story

作為一個使用者，我希望在記錄每餐的進食順序後，系統能將這筆資料（包含每項食物的類別、順序、得分）永久儲存至資料庫，並可查詢歷史紀錄，以便追蹤我長期的控糖趨勢。

**核心變更**：
1. **重設計評分系統**：前端最多填入三個項目，總分 100 分制，唯一滿分路徑為 Fiber → Protein → ComplexCarb
2. 確認 Prisma Schema 最終設計、訂定 API JSON 契約
3. 補全 `POST /api/meals`（修正使用者建立邏輯）、新增 `GET /api/meals/:userId`（查詢歷史）

---

## 2. 測試流程驗證 (Test Flow)

1. **準備環境**
   - `docker-compose up -d` 啟動 MySQL
   - `.env` 設定 `DATABASE_URL`
   - `npx prisma migrate dev --name init` 建立資料表
   - `npm run dev:server` 啟動 Express

2. **操作路徑**
   - 用 Postman / curl 呼叫 `POST /api/users` 或直接透過 meals 路由自動建立使用者
   - 呼叫 `POST /api/meals`，body 含 `email` 與 `foods` 陣列
   - 呼叫 `GET /api/meals/:userId` 確認資料已寫入並可讀回

3. **預期結果**
   - POST 回傳 201，JSON 含 `record.id`、`analysis.totalScore`、`analysis.tips`
   - GET 回傳 200，JSON 含 `records` 陣列，每筆含 `totalScore` 與 `foodItems`
   - 相同食物名稱第二次呼叫時，`FoodDictionary` 快取命中，不再呼叫 AI 分類

4. **最終確認**
   - MySQL 中 `MealRecord`、`FoodItem` 各有對應資料列
   - `FoodDictionary` 已快取本次用到的食物名稱
   - Vitest 單元測試 `scoringAlgorithm.spec.ts` 全數通過

---

## 3. Spec 與架構設計

### 3.1 技術細節 / 邏輯設計

- **使用者識別**：前端傳入 `email`，後端以 `prisma.user.upsert` 取得或建立使用者，回傳 `userId`，避免前端持有 UUID 的依賴
- **AI 分類快取**：`getFoodType()` 先查 `FoodDictionary`（by `label`），未命中才呼叫 `mockAIClassify`，並寫入快取；此邏輯已存在，本次不動
- **評分計算**：`calculateMealScore(sequence)` 完整重寫為槽位配分制（見 §3.1.1），回傳 `totalScore`、`breakdown[]`、`tips[]`
- **tips 型別**：Prisma `Json?` 欄位存 `string[]`，路由層以 `scoreResult.tips satisfies string[]` 取代現有 `any` 強制轉型

---

### 3.1.1 新評分系統設計（槽位配分制，方案 C）

#### 前端欄位規則

- 顯示固定的 **三個欄位**（Slot 1、Slot 2、Slot 3）
- **依序解鎖**：Slot 1 填入後 Slot 2 才開放，Slot 2 填入後 Slot 3 才開放；未解鎖欄位狀態為 `not-allowed`（灰色不可點擊）
- 因此合法輸入只有三種：`[1項]`、`[1+2項]`、`[1+2+3項]`，不存在中間空欄的情況
- 至少需填入 Slot 1 才能送出

#### 槽位配分

| 槽位 | 滿分 | 意義 |
|:---:|:---:|---|
| Slot 1（第一口） | 50 分 | 最關鍵，應放 Fiber |
| Slot 2（第二口） | 30 分 | 次重要，應放 Protein |
| Slot 3（第三口） | 20 分 | 收尾，應放 Complex Carb |

#### 食物類別得分矩陣

| 食物類別 | Slot 1（/50） | Slot 2（/30） | Slot 3（/20） |
|:---|:---:|:---:|:---:|
| Fiber        | **50** |  10  |   5  |
| Protein      |  30    | **30** |   8  |
| Complex Carb |  15    |  18  | **20** |
| Simple Carb  |   5    |   5  |   5  |
| 未填（空）    |   0    |   0  |   0  |

#### 得分範例

| 輸入序列 | 計算 | 總分 |
|---|---|:---:|
| Fiber → Protein → Complex Carb | 50+30+20 | **100** |
| Fiber → Protein → Simple Carb  | 50+30+5  | **85**  |
| Fiber → Protein → （未填）      | 50+30+0  | **80**  |
| Fiber → Complex Carb → （未填） | 50+18+0  | **68**  |
| Fiber → （未填） → （未填）      | 50+0+0   | **50**  |
| Simple Carb → （未填） → （未填）| 5+0+0    | **5**   |

#### TypeScript 型別設計

```typescript
// src/types/index.ts 異動

// 新增
export interface ISlotBreakdown {
  slot: 1 | 2 | 3;
  input: FoodType | null; // null = 未填
  slotMax: 50 | 30 | 20;
  score: number;
}

// 修改 IScoringResult
export interface IScoringResult {
  totalScore: number;           // 0–100
  breakdown: ISlotBreakdown[];
  tips: string[];
}
```

#### 演算法核心

```typescript
// src/services/scoringAlgorithm.ts

const SLOT_MAX = [50, 30, 20] as const;

const SCORE_MATRIX: Record<FoodType, readonly [number, number, number]> = {
  [FoodType.FIBER]:        [50, 10,  5],
  [FoodType.PROTEIN]:      [30, 30,  8],
  [FoodType.COMPLEX_CARB]: [15, 18, 20],
  [FoodType.SIMPLE_CARB]:  [ 5,  5,  5],
};

// sequence 長度 1–3，元素為依序填入的食物類別
export function calculateMealScore(
  sequence: [FoodType] | [FoodType, FoodType] | [FoodType, FoodType, FoodType]
): IScoringResult
```

### 3.2 路由與 API 端點

#### `POST /api/meals` — 建立飲食紀錄

**Request Body:**
```json
{
  "email": "user@example.com",
  "foods": ["花椰菜", "雞胸肉", "白飯"]
}
```
> `foods` 為長度 1–3 的陣列，順序即 Slot 1→2→3；前端依序解鎖，不允許跳空。

**Response 201:**
```json
{
  "message": "Meal record created successfully",
  "record": {
    "id": "uuid",
    "userId": "uuid",
    "totalScore": 100,
    "recordedAt": "2026-05-16T12:00:00.000Z",
    "foodItems": [
      { "label": "花椰菜", "type": "FIBER",        "sequenceIndex": 0, "finalScore": 50 },
      { "label": "雞胸肉", "type": "PROTEIN",       "sequenceIndex": 1, "finalScore": 30 },
      { "label": "白飯",   "type": "COMPLEX_CARB",  "sequenceIndex": 2, "finalScore": 20 }
    ]
  },
  "analysis": {
    "totalScore": 100,
    "breakdown": [
      { "slot": 1, "input": "FIBER",        "slotMax": 50, "score": 50 },
      { "slot": 2, "input": "PROTEIN",      "slotMax": 30, "score": 30 },
      { "slot": 3, "input": "COMPLEX_CARB", "slotMax": 20, "score": 20 }
    ],
    "tips": []
  }
}
```

**Error 400:**
```json
{ "error": "Missing email or foods array" }
```

---

#### `GET /api/meals/:userId` — 查詢使用者歷史紀錄

**Response 200:**
```json
{
  "records": [
    {
      "id": "uuid",
      "totalScore": 94,
      "tips": ["嘗試將「膳食纖維」放在第一順位，控糖效果更佳。"],
      "recordedAt": "2026-05-16T12:00:00.000Z",
      "foodItems": [
        { "label": "白飯", "type": "COMPLEX_CARB", "sequenceIndex": 0, "finalScore": 10 }
      ]
    }
  ]
}
```

**Error 404:**
```json
{ "error": "User not found" }
```

---

### 3.3 資料庫變動

Prisma Schema 已完整定義（`User`, `MealRecord`, `FoodItem`, `FoodDictionary`），**不需新增欄位**。  
本次唯一的資料庫操作為執行首次 migration：

```bash
npx prisma migrate dev --name init
```

確認生成的 migration SQL 包含以下索引：
- `User.email` — `@@index([email])`
- `MealRecord.(userId, recordedAt)` — `@@index([userId, recordedAt])`
- `FoodItem.mealRecordId` — `@@index([mealRecordId])`
- `FoodDictionary.label` — `@@index([label])`（即 `@unique` 附帶）

---

## 4. 環境與設定 (.env)

```
DATABASE_URL="mysql://root:your_password@localhost:3306/glucose_db"
PORT=3000
```

> `your_password` 對應 `docker-compose.yml` 的 `MYSQL_ROOT_PASSWORD`

---

## 5. Tasks

- [ ] 1. 更新 `src/types/index.ts`：新增 `ISlotBreakdown`，修改 `IScoringResult`
- [ ] 2. 重寫 `src/services/scoringAlgorithm.ts`：實作槽位配分制（SCORE_MATRIX + SLOT_MAX）
- [ ] 3. 同步重寫 `server/services/scoringAlgorithm.ts`（與前端保持一致）
- [ ] 4. 更新 `src/services/__tests__/scoringAlgorithm.spec.ts`：補齊新規則的測試案例
- [ ] 5. 執行 `npx prisma migrate dev --name init`，確認 Schema 完整建立（含所有索引）
- [ ] 6. 修改 `server/routes/meals.ts`：改接收 `email` + `foods`（1–3 項），以 `prisma.user.upsert` 自動建立或取得使用者，移除 `tips` 的 `any` 轉型
- [ ] 7. 新增 `GET /api/meals/:userId` 路由，回傳歷史紀錄（含 `foodItems`，依 `recordedAt` 降冪排序）
- [ ] 8. 以 Postman 或 curl 手動測試兩支端點，確認回傳結構符合 §3.2
- [ ] 9. 確認 `npm run test` 全數通過

---

## 6. 驗收結果

- [ ] `POST /api/meals` 回傳 201，資料庫出現對應 `MealRecord` 與 `FoodItem`
- [ ] `GET /api/meals/:userId` 回傳 200，`records` 依時間倒序排列
- [ ] 同一食物名稱第二次 POST 時，後端 log 顯示「FoodDictionary cache hit」（無二次 AI 呼叫）
- [ ] `npm run test` 通過，無 TypeScript 型別錯誤（`npm run build` 成功）
- [ ] 更新 `docs/FEATURES.md`（標記飲食紀錄 API 為完成）與 `docs/CHANGELOG.md`
