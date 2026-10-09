# Testing Guide

本文件定義專案的測試策略、工具與規範。

## 1. 測試架構

### 前端測試
- **路徑**：`src/services/__tests__/scoringAlgorithm.spec.ts`
- **涵蓋範圍**：評分演算法三個分支（m=0 / m=1 / m≥2）、各食物組合的總分計算、tips 文字觸發條件
- **測試數量**：22 個 test cases

### 後端測試
- **路徑**：`server/__tests__/`（v0.9.2 新增）
- **測試數量**：24 個 test cases
- 測試覆蓋三層：
  - `middleware/authMiddleware.spec.ts`：無 header / 格式錯誤 / 有效 token / 過期 token 四個分支
  - `middleware/validate.spec.ts`：RegisterSchema / CreateMealSchema 合法與非法邊界，確認 `details[].field` 準確回報
  - `services/scoringAlgorithm.spec.ts`（後端版）：m=0/1/≥2 三分支 + tips 文字觸發條件
  - `routes/auth.spec.ts`：以 supertest + `vi.mock` Prisma 測試 register（201/400/409）與 login（200/400/401）

### E2E 測試（Playwright）
- **路徑**：`e2e/settings.spec.ts`
- **測試數量**：6 個 test cases（帳號設定頁）
- 覆蓋：Email 唯讀（頁面無可編輯 email input）、名稱更新後重整仍保留、名稱清空被前端擋下且不送出請求、目前密碼錯誤顯示 400 訊息且不被強制登出、兩次新密碼不一致被前端擋下、密碼變更成功後導向 `/login` 且舊密碼失效／新密碼可登入

**合計：Vitest 63 個測試 + Playwright 6 個 E2E 測試，全部通過。**

---

## 2. 執行指令

```bash
# 執行所有測試 (Vitest)
npm run test

# 產生覆蓋率報告（text + HTML，@vitest/coverage-v8）
npm run test:coverage

# 執行 E2E 測試（需先啟動 MySQL、後端、前端；後端建議帶 RATE_LIMIT_DISABLED=true）
npm run test:e2e

# 手動重置 E2E 測試帳號
npm run seed:e2e

# 執行單一測試檔
npx vitest run src/services/__tests__/scoringAlgorithm.spec.ts
npx vitest run server/__tests__/services/scoringAlgorithm.spec.ts
```

---

## 3. CI 整合

**GitHub Actions**（`.github/workflows/ci.yml`）：
- 觸發條件：push / PR → master
- 執行步驟：`npm ci` → `npm test` → `npm run build`
- CI job 名稱：`Test & Build`（可設為 PR required status check）

---

## 4. 撰寫規範

```typescript
describe('calculateMealScore', () => {
  it('最佳順序 F→P→CC 應得 100 分', () => {
    const result = calculateMealScore([FoodType.FIBER, FoodType.PROTEIN, FoodType.COMPLEX_CARB]);
    expect(result.totalScore).toBe(100);
  });
});
```

---

## 5. 主要測試情境

### 前端 scoringAlgorithm
- [x] m=0：全 OTHER，totalScore 為 null
- [x] m=1：SIMPLE_CARB=20、COMPLEX_CARB=40、FIBER/PROTEIN=60
- [x] m≥2：最佳路徑 F→P→CC = 100 分
- [x] m≥2：SIMPLE_CARB 出現在 index=0 或 index=1 的懲罰（各 -10 分）
- [x] tips：首位非 FIBER 時建議調整順序；SIMPLE_CARB 首位的強烈警示

### 後端 middleware / routes
- [x] authMiddleware：無 Authorization header → 401；header 格式錯 → 401；有效 token → 通過；過期 token → 401
- [x] validate：合法 body 通過，非法 body 回傳 400 + `{ error, details }` 結構
- [x] POST /api/auth/register：新用戶 201；body 格式錯 400；email 已存在且密碼已設 409
- [x] POST /api/auth/login：正確憑證 200；body 格式錯 400；密碼錯誤 401
