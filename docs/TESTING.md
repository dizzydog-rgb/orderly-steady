# Testing Guide

本文件定義專案的測試策略、工具與規範。

## 1. 測試策略
我們優先確保核心演算法與健康建議邏輯的單元測試覆蓋率。

- **前端單元測試**: `src/services/__tests__/scoringAlgorithm.spec.ts`
  - 驗證各食物組合的總分計算。
  - 驗證 `tips` 陣列在不同情境下的產出內容。
- **後端測試** (`server/__tests__/`):
  - `middleware/authMiddleware.spec.ts` — Bearer token 驗證四分支
  - `middleware/validate.spec.ts` — Zod schema 合法與非法邊界
  - `services/scoringAlgorithm.spec.ts` — 後端版 m=0/1/≥2 三分支 + tips
  - `routes/auth.spec.ts` — register / login 端點（supertest + vi.mock Prisma）

## 2. 執行測試
```bash
# 執行所有測試 (Vitest)
npm run test

# 產生覆蓋率報告（text + HTML）
npm run test:coverage
```

## 3. 撰寫規範
- **結構**:
  ```typescript
  describe('Scoring Algorithm', () => {
    it('COMPLEX_CARB 單項應得 40 分', () => {
      const result = calculateMealScore([FoodType.COMPLEX_CARB]);
      expect(result.totalScore).toBe(40);
      expect(result.tips[0]).toContain('膳食纖維');
    });
  });
  ```

## 4. 常見測試情境 (Test Cases)
- [x] 正確順序 (F -> P -> CC) 的高分驗證。
- [x] 錯誤順序 (CC -> F) 的扣分與 Tips 驗證。
- [x] 空序列的邊界處理。
- [x] 精緻碳水 (SC) 的特殊警示 Tips。
