# 2026-05-23 真實 AI 串接 + OTHER 類別 + 逆序對計分演算法

## 1. User Story

作為系統管理者，我希望食物分類不只有依賴關鍵字規則，而是先使用關鍵字查詢資料庫是否有已存在的結果，若無資料則呼叫 Claude API 進行語義理解，正確辨識「香蕉」、「菠菜」、「糙米飯」等真實詞彙的食物類別；分類結果寫入資料庫快取，相同食物不重複呼叫 API。API Key 僅存後端環境變數，前端完全無法接觸。

**核心變更**：
- 安裝 `@anthropic-ai/sdk`、`express-rate-limit`
- 新增 `OTHER` 到 `FoodType` enum（Prisma + 前端各一份）並執行 DB migration
- 改寫 `server/services/ai.ts`，以 Claude API 取代 `mockAIClassify`（五分類 prompt）
- 新增 `ANTHROPIC_API_KEY` 至 `.env` 與 `.env.example`
- 完整重寫評分演算法為逆序對計分（前後端兩份同步），OTHER 排除在計分之外
- 對 `POST /api/meals` 加入 Rate Limiting，每 IP 每分鐘上限 10 次

---

## 2. 測試流程驗證 (Test Flow)

1. 第一次輸入「菠菜」→ 後端 log 顯示 Claude API 被呼叫，分類為 `FIBER`
2. 第二次輸入「菠菜」→ 後端 log 顯示直接走 DB 快取，無 API 呼叫
3. 輸入「豆乾」→ `PROTEIN`；「糙米」→ `COMPLEX_CARB`；「烏龍麵」→ `SIMPLE_CARB`；「酪梨」→ `OTHER`
4. 逆序對計分驗證：
   - FIBER → PROTEIN → SIMPLE_CARB（完美順序，0 逆序對）→ score = 100
   - SIMPLE_CARB → PROTEIN → FIBER（完全逆序，3 逆序對 / max 3）→ score = 0
   - FIBER → OTHER → SIMPLE_CARB（OTHER 排除，scorable=[FIBER,SIMPLE_CARB]，FIBER(0)<SIMPLE_CARB(3) 無逆序）→ score = 100
   - OTHER → OTHER → OTHER（scorable=0，無法評估）→ score = 100
5. 前端 breakdown 中 OTHER 項目顯示「不計分」標示
6. 移除 `.env` 的 `ANTHROPIC_API_KEY` 後重啟後端 → 應拋出明確錯誤

---

## 3. 技術設計

### 3.1 快取流程（現有架構不變）

```
getFoodType("香蕉")
  └─ DB 查詢 FoodDictionary where label="香蕉"
       ├─ 命中 → 直接回傳 type（不呼叫 Claude API）
       └─ 未命中 → claudeClassify("香蕉") → 寫入 FoodDictionary → 回傳 type
```

`FoodDictionary` 資料表已有 `label` unique index，快取架構完整保留。

### 3.2 `claudeClassify` 實作

- **模型**：`claude-haiku-4-5-20251001`（速度快、成本低，分類任務 max_tokens: 16 足夠）
- **System prompt**：限定只能回傳**五個**英文代號之一（`FIBER` / `PROTEIN` / `COMPLEX_CARB` / `SIMPLE_CARB` / `OTHER`）
- **Fallback**：Claude 回傳無法識別的文字時，fallback 為 `OTHER`（語意最誠實；OTHER 被排除計分，不會錯誤懲罰使用者）

```typescript
const VALID_TYPES: Record<string, FoodType> = {
  FIBER: FoodType.FIBER, PROTEIN: FoodType.PROTEIN,
  COMPLEX_CARB: FoodType.COMPLEX_CARB, SIMPLE_CARB: FoodType.SIMPLE_CARB,
  OTHER: FoodType.OTHER,
};

async function claudeClassify(label: string): Promise<FoodType> {
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 16,
    system: `你是食物分類助手。根據食物名稱判斷其最主要營養類別，只能回答以下五個英文代號之一：
FIBER（蔬菜、菇類、海藻等高膳食纖維）
PROTEIN（肉、蛋、魚、豆腐、乳製品等高蛋白）
COMPLEX_CARB（糙米、燕麥、全麥、地瓜、玉米等複合碳水）
SIMPLE_CARB（白飯、白麵、麵包、水果、甜點、含糖飲料等精緻糖）
OTHER（酪梨、堅果、醬料、複合料理等無法明確歸類的食物）`,
    messages: [{ role: 'user', content: label }],
  });

  const text = (message.content[0] as { type: 'text'; text: string }).text.trim();
  return VALID_TYPES[text] ?? FoodType.OTHER;
}
```

### 3.3 Rate Limiting

使用 `express-rate-limit`，套用為 `POST /api/meals` 的前置 middleware：

```typescript
import rateLimit from 'express-rate-limit';

const mealsRateLimit = rateLimit({
  windowMs: 60 * 1000,       // 1 分鐘視窗
  max: 10,                   // 每 IP 上限 10 次
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: '請求過於頻繁，請稍後再試' },
});

router.post('/', mealsRateLimit, async (req, res) => { ... });
```

**選擇 per-IP 而非 per-user 的理由**：`POST /api/meals` 目前從 body 取 email 而非驗證 JWT，IP 是最可靠的識別維度。每分鐘 10 次對正常用餐記錄足夠，對自動化濫用有效阻擋。

### 3.4 逆序對計分演算法（取代 slot 制）

理想進食順序優先級：FIBER(0) → PROTEIN(1) → COMPLEX_CARB(2) → SIMPLE_CARB(3)；OTHER 排除。

```typescript
const PRIORITY: Record<string, number> = { FIBER: 0, PROTEIN: 1, COMPLEX_CARB: 2, SIMPLE_CARB: 3 };

export function calculateMealScore(sequence: FoodType[]): IScoringResult {
  const scorable = sequence.filter(t => t !== FoodType.OTHER);
  const n = scorable.length;

  if (n <= 1) {
    return { totalScore: 100, scorableCount: n, inversions: 0, maxInversions: 0,
             breakdown: buildBreakdown(sequence), tips: [] };
  }

  let inversions = 0;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      if (PRIORITY[scorable[i]] > PRIORITY[scorable[j]]) inversions++;

  const maxInversions = n * (n - 1) / 2;
  const totalScore = Math.round((1 - inversions / maxInversions) * 100);
  return { totalScore, scorableCount: n, inversions, maxInversions,
           breakdown: buildBreakdown(sequence), tips: buildTips(scorable, inversions) };
}
```

前後端各有一份實作（`server/services/scoringAlgorithm.ts` 與 `src/services/scoringAlgorithm.ts`），**必須同步**。

### 3.5 更新後的 Interface（`src/types/index.ts`）

```typescript
// FoodType 新增 OTHER
export const FoodType = {
  FIBER: 'F', PROTEIN: 'P', COMPLEX_CARB: 'CC', SIMPLE_CARB: 'SC', OTHER: 'OT',
} as const;

// 取代 ISlotBreakdown
export interface IFoodBreakdown {
  slot: number;
  label: string | null;
  type: string | null;
  isOther: boolean;
}

// IScoringResult 新增逆序對欄位
export interface IScoringResult {
  totalScore: number;
  scorableCount: number;
  inversions: number;
  maxInversions: number;
  breakdown: IFoodBreakdown[];
  tips: string[];
}
```

### 3.6 DB 模型處理

`FoodItem` 現有 `baseScore / modifier / finalScore` 欄位是 slot 制遺留，新演算法無逐項分數。**不修改 schema**，寫入時統一填 `baseScore: 0, modifier: 1.0, finalScore: 0`；整餐得分僅存於 `MealRecord.totalScore`。

---

## 4. 涉及檔案

| 檔案 | 動作 |
|------|------|
| `prisma/schema.prisma` | `FoodType` enum 新增 `OTHER` |
| Prisma migration | `npx prisma migrate dev --name add-other-food-type` |
| `package.json` | 新增 `@anthropic-ai/sdk`、`express-rate-limit` 相依 |
| `.env` | 新增 `ANTHROPIC_API_KEY=sk-ant-...`（人工填入） |
| `.env.example` | 新增 `ANTHROPIC_API_KEY=your_anthropic_api_key_here` |
| `server/services/ai.ts` | 五分類 Claude prompt，fallback → `OTHER` |
| `server/services/scoringAlgorithm.ts` | 完整重寫為逆序對演算法 |
| `server/routes/meals.ts` | rate limit middleware；FoodItem 寫入改為佔位 0 |
| `src/types/index.ts` | 新增 `OTHER`；`ISlotBreakdown` → `IFoodBreakdown`；更新 `IScoringResult` |
| `src/services/scoringAlgorithm.ts` | 完整重寫（與後端同步） |
| `src/views/HomeView.vue` | breakdown 顯示 OTHER 項目標示「不計分」|

---

## 5. Tasks

- [ ] Task 1：`npm install @anthropic-ai/sdk express-rate-limit`
- [ ] Task 2：`prisma/schema.prisma` 新增 `OTHER`，執行 migration
- [ ] Task 3：`.env.example` 新增 `ANTHROPIC_API_KEY` 欄位
- [ ] Task 4：改寫 `server/services/ai.ts`（五分類 Claude prompt，fallback → OTHER）
- [ ] Task 5：重寫 `server/services/scoringAlgorithm.ts`（逆序對演算法）
- [ ] Task 6：重寫 `src/services/scoringAlgorithm.ts`（前端同步）
- [ ] Task 7：更新 `src/types/index.ts`（OTHER + 新 Interface）
- [ ] Task 8：更新 `server/routes/meals.ts`（rate limit + FoodItem 佔位寫入）
- [ ] Task 9：更新 `src/views/HomeView.vue`（OTHER 標示「不計分」）
- [ ] Task 10：手動將 `ANTHROPIC_API_KEY` 填入 `.env`（人工操作）
- [ ] Task 11：重啟後端，端對端驗收

---

## 6. 驗收條件

- [ ] 「菠菜」第一次 → API 呼叫，第二次 → DB 快取（無 API 呼叫）
- [ ] 「豆乾」→ `PROTEIN`；「糙米」→ `COMPLEX_CARB`；「烏龍麵」→ `SIMPLE_CARB`；「酪梨」→ `OTHER`
- [ ] FIBER→PROTEIN→SIMPLE_CARB → score = 100（0 逆序對）
- [ ] SIMPLE_CARB→PROTEIN→FIBER → score = 0（3 逆序對 / max 3）
- [ ] FIBER→OTHER→SIMPLE_CARB → score = 100（OTHER 排除，FIBER(0)<SIMPLE_CARB(3) 無逆序）
- [ ] OTHER→OTHER→OTHER → score = 100（scorable = 0，無法評估）
- [ ] 前端 breakdown 中 OTHER 項目有「不計分」標示
- [ ] API Key 不存在於任何前端產物
- [ ] 同一 IP 連續送出 11 次 POST /api/meals → 第 11 次收到 429 與錯誤訊息「請求過於頻繁，請稍後再試」
