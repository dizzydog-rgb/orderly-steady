# Plan: 2026-04-26 - 環境初始化與基礎 UI 實作

## User Story
作為一名使用者，我希望能夠在網頁上選擇我的進食順序（蔬菜、蛋白質、澱粉等），並即時看到我的控糖分數，以便我調整飲食習慣。

## Spec
1.  **環境開發**: 安裝 `vitest` 與相關測試工具。
2.  **核心邏輯**: 實作 `scoringAlgorithm.ts`，支援基礎分與修正係數邏輯。
3.  **前端介面**:
    *   提供四個按鈕：膳食纖維 (F)、蛋白質 (P)、複合碳水 (CC)、精緻碳水 (SC)。
    *   顯示目前已選擇的序列。
    *   即時顯示計算出的總分。
    *   提供「清除」按鈕重設序列。

## Tasks

### Phase 1: 環境與工具安裝
- [x] 安裝 `vitest`, `@vue/test-utils`, `happy-dom`。
- [x] 設定 `vite.config.ts` 以支援 vitest。

### Phase 2: 核心演算法實作
- [x] 建立 `src/types/index.ts` 定義食物類別與介面。
- [x] 實作 `src/services/scoringAlgorithm.ts`。
- [x] (Optional) 建立簡單的測試驗證邏輯。

### Phase 3: 前端畫面實作
- [x] 修改 `src/App.vue` 建立基礎操作介面。
- [x] 串接 `scoringAlgorithm.ts` 實現即時評分。
- [x] 簡易視覺回饋（根據分數變色）。
