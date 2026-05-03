# Testing Guide

本文件定義專案的測試策略、工具與規範。

## 1. 測試策略
我們優先確保核心演算法與健康建議邏輯的單元測試覆蓋率。

- **單元測試 (Unit Tests)**: 針對 `src/services/scoringAlgorithm.ts`。
  - 驗證各食物組合的總分計算。
  - 驗證 `tips` 陣列在不同情境下的產出內容。

## 2. 執行測試
```bash
# 執行所有測試 (Vitest)
npm run test
```

## 3. 撰寫規範
- **結構**:
  ```typescript
  describe('Scoring Algorithm', () => {
    it('應正確產生健康建議 (Tips)', () => {
      const sequence = [FoodType.COMPLEX_CARB];
      const result = calculateMealScore(sequence);
      expect(result.tips).toContain('建議加入植物纖維...');
    });
  });
  ```

## 4. 常見測試情境 (Test Cases)
- [x] 正確順序 (F -> P -> CC) 的高分驗證。
- [x] 錯誤順序 (CC -> F) 的扣分與 Tips 驗證。
- [x] 空序列的邊界處理。
- [x] 精緻糖 (SC) 的特殊警示 Tips。
