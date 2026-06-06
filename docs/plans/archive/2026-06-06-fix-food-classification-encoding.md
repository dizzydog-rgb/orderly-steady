# 2026-06-06 修復食物分類亂碼與錯誤快取問題

## 1. User Story

作為使用者，我希望輸入「烏龍麵」、「糙米」、「雞腿」等中文食物名稱時，系統能正確辨識其食物類別（SIMPLE_CARB / COMPLEX_CARB / PROTEIN），而不是全部錯判為 OTHER 或 SIMPLE_CARB，以便評分結果反映真實的進食狀況。

**核心變更**：
1. 修正 `DATABASE_URL` 字元集（加入 `?charset=utf8mb4`），防止中文 label 以 latin1 亂碼儲存
2. 清除 `FoodDictionary` 全部污染快取（舊 mock 分類器時代的錯誤記錄）
3. 優化 `server/services/ai.ts` Claude 分類 prompt，補充中文麵食、飯類邊界案例

---

## 2. 根本原因分析（Root Cause Analysis）

### 原因一：FoodDictionary 存有舊 mock 錯誤快取（主因）

系統從 `mockAIClassify`（關鍵字規則）遷移至 Claude API 後，`FoodDictionary` 表內仍保留舊分類器時代的記錄。由於 `getFoodType` 優先以 `findUnique` 命中快取，Claude 根本不會被呼叫：

```
雞腿 → findUnique → hit（舊 mock 誤判為 SIMPLE_CARB）→ 回傳 SIMPLE_CARB ✗
糙米 → findUnique → hit（舊 mock 誤判為 SIMPLE_CARB）→ 回傳 SIMPLE_CARB ✗
```

### 原因二：MySQL 字元集未設定 utf8mb4（放大問題）

若 `DATABASE_URL` 不含 `?charset=utf8mb4`，MySQL 可能以 latin1 處理連線，中文字元（3+ bytes UTF-8）在 latin1 儲存時發生截斷或亂碼。多個不同的中文食物名稱可能對應相同的亂碼 bytes，造成 **cache collision**：

```
"糙米" → 亂碼 "??"
"雞腿" → 亂碼 "??"（相同）
→ findUnique("雞腿") → 命中 "??" 的錯誤 SIMPLE_CARB 記錄
```

### 原因三：Prompt 範例不足（次要）

`SIMPLE_CARB` 描述為「白麵」，但未列出「烏龍麵」、「拉麵」等具體麵食，Claude 面對邊界食物時可能傾向回傳 `OTHER`。

---

## 3. Spec 與架構設計

### 3.1 技術細節 / 邏輯設計

**修正一：DATABASE_URL charset**

在 `.env` 的 `DATABASE_URL` 末端加入 `?charset=utf8mb4`：

```
DATABASE_URL="mysql://user:pass@localhost:3306/orderly_steady?charset=utf8mb4"
```

Prisma MySQL driver 讀取此參數後，會以 `utf8mb4` 作為連線字元集，確保中文 label 完整儲存與比對。無需修改 Prisma schema 或執行 migration（連線層修正，不影響 table/column DDL）。

**修正二：清除 FoodDictionary 污染資料**

新增管理用 script `server/scripts/clearFoodDictionary.ts`，使用 Prisma client 執行：

```typescript
await prisma.foodDictionary.deleteMany({});
```

不直接用 SQL truncate，以確保 Prisma 連線字元集修正後才執行。執行後舊錯誤快取清除，下次使用者輸入任何食物時將重新呼叫 Claude API 並以正確 utf8mb4 儲存新快取。

**修正三：優化 Claude 分類 Prompt**

修改 `server/services/ai.ts` 的 `system` prompt，補充麵食、飯類、肉類的中文具體範例：

```
FIBER（蔬菜、菇類、海藻、豆芽菜等高膳食纖維）
PROTEIN（雞胸、雞腿、鴨肉、豬肉、牛肉、羊肉、魚、蝦、蛋、豆腐、起司、鮪魚等高蛋白）
COMPLEX_CARB（糙米、燕麥、全麥麵包、地瓜、玉米、南瓜、全麥義大利麵等複合碳水）
SIMPLE_CARB（白飯、白麵、烏龍麵、拉麵、白吐司、麵包、水果、甜點、含糖飲料、白粥等精緻糖）
OTHER（酪梨、堅果、橄欖油、醬料、複合料理等無法明確歸類的食物）
```

重點補充：
- `PROTEIN`：明確列出「雞腿」、「雞胸」等常見肉品，避免「腿」字被忽略
- `SIMPLE_CARB`：加入「烏龍麵」、「拉麵」、「白吐司」，明確麵食歸類
- `COMPLEX_CARB`：保留「糙米」，已正確但不影響

### 3.2 路由與 API 端點

新增快取管理端點（供開發者排查用，加 `authMiddleware` 保護）：

- `DELETE /api/food-dictionary` — 清除全部 FoodDictionary 快取
- `DELETE /api/food-dictionary/:label` — 清除特定食物名稱的快取

### 3.3 資料庫變動

- **無 Migration**：`DATABASE_URL` 改用 utf8mb4 連線是驅動層修正，不新增/刪除欄位
- **資料清除**：透過 script 清空 `FoodDictionary` 表

---

## 4. 環境與設定 (.env)

- `DATABASE_URL`：加入 `?charset=utf8mb4`（例：`mysql://root:pass@localhost:3306/orderly_steady?charset=utf8mb4`）
- `ANTHROPIC_API_KEY`：確認已設定，Claude API 將重新被呼叫（清除快取後）

---

## 5. Tasks

- [x] 1. 更新 `.env` 的 `DATABASE_URL`，末端加入 `?charset=utf8mb4`
- [x] 2. 修改 `server/services/ai.ts` system prompt：補充雞腿/雞胸、烏龍麵/拉麵等具體中文範例；另補充雞翅/火龍果等邊界案例，並改用 regex 解析回傳值防止完全匹配失敗
- [x] 3. 新增 `server/scripts/clearFoodDictionary.ts` script，執行 `prisma.foodDictionary.deleteMany({})` 並輸出清除數量
- [x] 4. 執行 script 清除 FoodDictionary 全部記錄（清除 71 筆舊 mock 快取）
- [x] 5. 新增 `server/routes/foodDictionary.ts`：`DELETE /api/food-dictionary`（全清）、`DELETE /api/food-dictionary/:label`（單筆），均加 `authMiddleware`
- [x] 6. 在 `server/index.ts` 掛載新路由 `app.use("/api/food-dictionary", foodDictionaryRoutes)`
- [x] 7. 驗證三個測試案例（見 §2 測試流程）

---

## 6. 測試流程驗證 (Test Flow)

1. **環境準備**：確認 `.env` 已更新 `DATABASE_URL`，重啟 `npm run dev:server`
2. **清除舊快取**：執行 `npx tsx server/scripts/clearFoodDictionary.ts`，確認輸出「已清除 N 筆」
3. **驗證三個問題食物**：
   - POST `/api/meals` body: `{ "email": "test@test.com", "foods": ["雞腿"] }` → 預期 `type: "PROTEIN"`
   - POST `/api/meals` body: `{ "email": "test@test.com", "foods": ["糙米"] }` → 預期 `type: "COMPLEX_CARB"`
   - POST `/api/meals` body: `{ "email": "test@test.com", "foods": ["烏龍麵"] }` → 預期 `type: "SIMPLE_CARB"`
4. **驗證快取正確寫入**：直接查詢 DB（`SELECT * FROM FoodDictionary`），確認三筆 label 為可讀中文（非亂碼），type 正確
5. **二次呼叫快取命中**：再次送出相同食物 → server log 顯示 `[AI] Cache hit`，分類結果相同

---

## 7. 驗收結果

- [x] 三個問題食物分類全部正確（雞腿→PROTEIN、糙米→COMPLEX_CARB、烏龍麵→SIMPLE_CARB；另驗證雞翅→PROTEIN、火龍果→SIMPLE_CARB）
- [x] DB 中 label 欄位為正常中文（非亂碼）
- [x] 重複輸入同一食物時，server log 顯示 Cache hit，不重複呼叫 Claude API
- [x] `CLAUDE.md` AI 分類說明已同步更新（串接 Claude Haiku API、charset 要求、管理端點）；`docs/FEATURES.md` 無需變更
