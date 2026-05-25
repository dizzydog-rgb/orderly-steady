# 2026-05-24 評分演算法重構 — all_pair 加權矩陣

## 1. User Story

作為系統設計者，我希望評分演算法能更細緻地反映飲食順序決策品質，而不只是區分「有沒有逆序」。現有逆序對計數法無法表達不同組合的嚴重程度差異（例如 SIMPLE_CARB 首位 vs COMPLEX_CARB 首位在逆序對數量上相同，但實際控糖影響差距大）。

**核心變更**：
- 移除逆序對演算法，改用 **all_pair 加權矩陣**：每對 (i, j) 查 SCORE_MATRIX 取得方向分數（0–10），相鄰 pair 加權 ×1.5，跨越 pair 加權 ×1.0
- 加入 SIMPLE_CARB 首位懲罰（-30/-10），取最大值不疊加
- `IScoringResult` 移除 `inversions`、`maxInversions` 欄位（已無意義）
- 前後端兩份演算法同步更新

---

## 2. 測試流程驗證 (Test Flow)

**m >= 2（pair 計算）**
1. 輸入「菠菜 → 雞蛋 → 精緻糖」（FIBER→PROTEIN→SIMPLE_CARB）→ 高分（≥ 85）
2. 輸入「珍珠奶茶 → 雞腿 → 菠菜」（SIMPLE_CARB→PROTEIN→FIBER）→ 低分（≥ 20，不低於單食 SC）
3. 輸入「優格 → 珍珠奶茶 → 其他」（PROTEIN→SIMPLE_CARB，scorable=2，SC index=1，扣 10）→ pair 計算結果 - 10
4. 輸入「菠菜 → 雞蛋」（FIBER→PROTEIN，pair score=10/10，無懲罰）→ 100

**m === 1（硬編碼）**
5. 輸入「珍珠奶茶 → 其他 → 其他」（scorable=[SC]）→ totalScore = 20，tips 含精緻糖警告 + 均衡建議
6. 輸入「菠菜 → 其他 → 其他」（scorable=[FIBER]）→ totalScore = 60，tips 含均衡建議
7. 輸入「雞蛋 → 其他 → 其他」（scorable=[PROTEIN]）→ totalScore = 60，tips 含均衡建議
8. 輸入「糙米 → 其他 → 其他」（scorable=[CC]）→ totalScore = 40，tips 含均衡建議

**m === 0**
9. 輸入「其他 → 其他 → 其他」（scorable=0）→ totalScore = null，tip: '未記錄任何可評分食物'

---

## 3. 技術設計

### 3.1 SCORE_MATRIX（前者食物 → 後者食物，0–10 分）

```typescript
const SCORE_MATRIX: Record<string, Record<string, number>> = {
  FIBER:        { FIBER: 5, PROTEIN: 10, COMPLEX_CARB: 10, SIMPLE_CARB: 8 },  // F→CC: 10（理想轉換）
  PROTEIN:      { FIBER: 8, PROTEIN:  5, COMPLEX_CARB: 10, SIMPLE_CARB: 8 },  // P→CC: 10（理想結尾）
  COMPLEX_CARB: { FIBER: 5, PROTEIN:  5, COMPLEX_CARB:  5, SIMPLE_CARB: 3 },
  SIMPLE_CARB:  { FIBER: 6, PROTEIN:  6, COMPLEX_CARB:  4, SIMPLE_CARB: 0 },  // SC→F/P: 6（回補），SC→CC: 4，SC→SC: 0
};
```

後端版本（`server/services/scoringAlgorithm.ts`）key 使用 Prisma enum 名稱字串；
前端版本（`src/services/scoringAlgorithm.ts`）使用 FoodType value（`'F'`, `'P'`, `'CC'`, `'SC'`）作為 key。

### 3.2 WEIGHT（pair 距離 → 加權係數）

```typescript
const WEIGHT: Record<number, number> = { 1: 1.5, 2: 1.0 };
// 距離超出 2 時 fallback: 1.0
```

### 3.3 SIMPLE_CARB_PENALTY（scorable 陣列 index → 扣分）

```typescript
const SIMPLE_CARB_PENALTY: Record<number, number> = { 0: 10, 1: 10 };
// 掃描所有 SIMPLE_CARB 位置，取最大扣分，不疊加
// SC→* 矩陣值已反映「回補」效果，penalty 統一為 10（首位或第二位）
```

### 3.4 計分決策樹（三分支）

```
m = scorable.length

m === 0
  └─ totalScore: null
     tips: ['未記錄任何可評分食物']

m === 1  （硬編碼常數，完全不進入 pair 計算）
  ├─ singleType === SIMPLE_CARB
  │   ├─ totalScore = 20
  │   └─ tips:
  │       '此餐以精緻糖為主，血糖波動風險高。'
  │       '請加入膳食纖維、蛋白質、複合碳水以達到飲食均衡。'
  ├─ singleType === FIBER
  │   ├─ totalScore = 60
  │   └─ tips: '請加入蛋白質、複合碳水以達到飲食均衡。'
  ├─ singleType === PROTEIN
  │   ├─ totalScore = 60
  │   └─ tips: '請加入膳食纖維、複合碳水以達到飲食均衡。'
  └─ singleType === COMPLEX_CARB
      ├─ totalScore = 40
      └─ tips: '請加入膳食纖維、蛋白質以達到飲食均衡。'

  缺少類型的排列固定依 PRIORITY 順序（FIBER→PROTEIN→COMPLEX_CARB→SIMPLE_CARB），
  不依 filter 迭代順序，確保輸出穩定。

m >= 2  （pair 加權計算）
  1. 雙重迴圈所有 (i, j)，i < j：
     distance = j - i
     weight = WEIGHT[distance] ?? 1.0
     weightedRaw += SCORE_MATRIX[scorable[i]][scorable[j]] * weight
     maxWeightedRaw += 10 * weight
  2. totalScore = round(weightedRaw / maxWeightedRaw × 100)
  3. SIMPLE_CARB 位置懲罰：
     penalty = max(SIMPLE_CARB_PENALTY[index] ?? 0) for each SC position
     totalScore = max(0, totalScore - penalty)
```

### 3.5 IScoringResult totalScore 型別

`m === 0` 時 `totalScore` 回傳 `null`，因此介面需更新：

```typescript
export interface IScoringResult {
  totalScore: number | null;
  scorableCount: number;
  breakdown: IFoodBreakdown[];
  tips: string[];
}
```

前端顯示時需 null guard（`totalScore ?? '—'`）。

### 3.6 buildTips 變更

`m >= 2` 分支呼叫 `buildTips(scorable, penalty)`，取代原本 `buildTips(scorable, inversions)`：

- `penalty === 0 && n >= 2` → 觸發完美提示（取代舊 inversions === 0）
- 其餘 tip 邏輯不變：
  - `scorable[0] !== FIBER` → 建議纖維首位
  - `scorable[0] === SIMPLE_CARB` → 空腹精緻糖警告
  - `scorable[0] === FIBER && scorable[1] !== PROTEIN` → 建議纖維後接蛋白質

`m === 1` 分支的 tips 由決策樹硬編碼，不呼叫 `buildTips`。

### 3.7 前端 FoodType key 對應說明

前端 `FoodType` const 的 key（`FIBER`, `PROTEIN`…）與 value（`'F'`, `'P'`…）不同。
SCORE_MATRIX 及 PENALTY 掃描時，需將 FoodType value 反查為 key 名稱，
或直接用 value 作為 SCORE_MATRIX key（統一用 `'F'`, `'P'`, `'CC'`, `'SC'`）。

**決定**：前端使用 FoodType value 作為 SCORE_MATRIX key（與後端 enum 名稱無關），保持一致：

```typescript
const SCORE_MATRIX: Record<string, Record<string, number>> = {
  'F':  { 'F': 5, 'P': 10, 'CC': 10, 'SC': 8 },
  'P':  { 'F': 8, 'P':  5, 'CC': 10, 'SC': 8 },
  'CC': { 'F': 5, 'P':  5, 'CC':  5, 'SC': 3 },
  'SC': { 'F': 6, 'P':  6, 'CC':  4, 'SC': 0 },
};
const SIMPLE_CARB_PENALTY: Record<number, number> = { 0: 10, 1: 10 };
```

後端維持 Prisma enum 名稱字串（`'FIBER'`, `'PROTEIN'`…）。

### 3.8 IScoringResult 介面（需更新）

`src/types/index.ts` 已移除 `inversions`、`maxInversions`，但 `totalScore` 需改為 `number | null`（m===0 回傳 null）：

```typescript
export interface IScoringResult {
  totalScore: number | null;
  scorableCount: number;
  breakdown: IFoodBreakdown[];
  tips: string[];
}
```

`server/` inline interface 同步更新。前端所有使用 `totalScore` 的地方加 null guard（`scoreResult.totalScore ?? '—'`）。

---

## 4. 涉及檔案

| 檔案 | 動作 |
|------|------|
| `server/services/scoringAlgorithm.ts` | 主要重寫：三分支決策樹、SCORE_MATRIX（enum key）、WEIGHT、PENALTY、buildTips |
| `src/services/scoringAlgorithm.ts` | 同步重寫（FoodType value key，邏輯相同） |
| `src/types/index.ts` | `totalScore: number` → `number \| null` |
| `src/composables/useGlucoseScore.ts` | EMPTY_RESULT 移除 inversions/maxInversions，totalScore 改 null；scoreColor null guard |
| `src/views/HomeView.vue` | scoreColor / animateScore null guard；m=0 時不 prepend 歷史紀錄 |
| `src/services/__tests__/scoringAlgorithm.spec.ts` | 全面更新：三分支測試案例、移除 inversions/maxInversions 斷言 |
| `prisma/schema.prisma` | 移除 FoodItem.baseScore / modifier / finalScore |
| `server/routes/meals.ts` | m=0 跳過 DB 寫入；FoodItem 不寫舊欄位 |
| `CLAUDE.md` | 更新演算法描述 |

---

## 5. Tasks

- [x] Task 1：更新 `src/types/index.ts`（totalScore: number | null）
- [x] Task 2：重寫 `server/services/scoringAlgorithm.ts`（三分支決策樹，SCORE_MATRIX enum key，buildTips penalty 參數）
- [x] Task 3：重寫 `src/services/scoringAlgorithm.ts`（三分支決策樹，SCORE_MATRIX value key，邏輯同上）
- [x] Task 4：更新 `src/composables/useGlucoseScore.ts`（EMPTY_RESULT 移除 inversions/maxInversions，totalScore: null；scoreColor null guard）
- [x] Task 5：更新 `src/views/HomeView.vue`（totalScore null guard：顯示、scoreColor、animateScore）
- [x] Task 6：重寫 `src/services/__tests__/scoringAlgorithm.spec.ts`（三分支測試案例）
- [x] Task 7：`npm run test` 全過（20/20）
- [x] Task 8：`npm run build` 無型別錯誤
- [x] Task 9：更新 `prisma/schema.prisma`（移除 FoodItem 三欄）
- [x] Task 10：更新 `server/routes/meals.ts`（m=0 跳過 DB；FoodItem 不寫舊欄位）
- [x] Task 11：更新 `CLAUDE.md` 演算法描述
- [x] Task 12：`npx prisma migrate dev`（需 DB 連線）
- [x] Task 13：端對端手動驗收（前後端同時啟動，逐案測試 Test Flow）

---

## 6. 驗收條件

**m >= 2 分支**

| 情境 | 預期 totalScore | 實際計算值 |
|------|----------------|-----------|
| FIBER→PROTEIN→COMPLEX_CARB（理想順序） | 100 | 100 |
| FIBER→PROTEIN→SIMPLE_CARB | ≥ 85 | 88 |
| SIMPLE_CARB→PROTEIN→FIBER | > 單食 SC (20) | 58 |
| PROTEIN→SIMPLE_CARB（scorable=2，SC index=1，扣 10） | pair 分數 - 10 | 80-10=70 |
| FIBER→PROTEIN（scorable=2，無懲罰） | 100 | 100 |

**m === 1 分支**

| 情境 | 預期 totalScore | 預期 tips 條數 |
|------|----------------|--------------|
| scorable=[SIMPLE_CARB] | 20 | 2 |
| scorable=[FIBER] | 60 | 1 |
| scorable=[PROTEIN] | 60 | 1 |
| scorable=[COMPLEX_CARB] | 40 | 1 |

**m === 0 分支**

| 情境 | 預期 totalScore |
|------|----------------|
| OTHER→OTHER→OTHER | null |

- [x] 單元測試全過（`npm run test`）21/21
- [x] 前端型別編譯無誤（`npm run build`）
- [x] 前後端輸入相同食物類別序列時，得到相同 totalScore（SC row 值相同確認）
- [x] `src/types/index.ts` 的 `totalScore` 為 `number | null`
- [x] 前端顯示 null 時不崩潰（null guard）
- [x] m===1 均衡建議文字缺少類型按 FIBER→PROTEIN→COMPLEX_CARB 順序排列（不建議精緻糖）
