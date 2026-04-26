# Testing Guide

本文件定義專案的測試策略、工具與規範。

## 1. 測試策略
我們採用測試金字塔模型，優先確保核心演算法的單元測試覆蓋率。

- **單元測試 (Unit Tests)**: 針對 `src/services/` 下的純函數（特別是評分演算法）。
- **組件測試 (Component Tests)**: 針對 `src/components/` 下的關鍵 UI 交互。
- **端到端測試 (E2E Tests)**: 針對完整的進食記錄流程。

## 2. 測試工具
- **測試框架**: Vitest (建議)
- **測試庫**: `@vue/test-utils`
- **瀏覽器模擬**: `happy-dom` 或 `jsdom`

## 3. 撰寫規範
- **檔案命名**: `[filename].spec.ts` 或 `[filename].test.ts`。
- **存放位置**: 與被測試檔案同目錄下的 `__tests__/` 資料夾。
- **結構**:
  ```typescript
  describe('Scoring Algorithm', () => {
    it('should give 100 points for perfect order', () => {
      // test logic
    });
  });
  ```

## 4. 執行測試
```bash
# 執行所有測試
npm run test

# 執行測試並監控變動
npm run test:watch
```

## 5. 常見測試情境 (Test Cases)
### 進食評分演算法
- [ ] 只有一種食物時的分數計算。
- [ ] 完全相反順序（精緻糖最先）的扣分邏輯。
- [ ] 只有纖維與碳水時的緩衝邏輯驗證。
