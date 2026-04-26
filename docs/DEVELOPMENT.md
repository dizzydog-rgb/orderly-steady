# Development Guide

本文件定義「控糖網站」的開發規範、命名約定與開發流程。

## 1. 命名規範

### 1.1 檔案命名
- **組件檔案**: 使用 PascalCase (例如 `MealCard.vue`, `ScoreDisplay.vue`)。
- **邏輯/工具類**: 使用 camelCase (例如 `scoringAlgorithm.ts`, `useGlucoseScore.ts`)。
- **樣式檔案**: 使用 kebab-case (例如 `main-layout.css`)。

### 1.2 程式碼規範
- **變數與函式**: 使用 camelCase。
- **介面與型別**: 使用 PascalCase，並建議以 `I` 開頭或具備清晰描述 (例如 `IMealItem`, `ScoringResult`)。
- **常量**: 全大寫 snake_case (例如 `MAX_GLUCOSE_SCORE = 100`)。

## 2. 新增功能流程

開發新功能時，請遵循以下步驟：

1. **建立計畫**: 在 `docs/plans/` 建立 `YYYY-MM-DD-feature-name.md`，定義需求與實作步驟。
2. **實作核心邏輯**: 若涉及演算法，先在 `src/services/` 撰寫純函數邏輯。
3. **撰寫測試**: 在 `src/services/__tests__/` 建立對應的測試檔案，確保邏輯正確。
4. **構建 UI**: 在 `src/components/` 建立 UI 組件並串接邏輯。
5. **更新文件**: 完成後更新 `docs/FEATURES.md` 與 `docs/CHANGELOG.md`。
6. **歸檔計畫**: 將計畫檔案移至 `docs/plans/archive/`。

## 3. 技術棧
- **Framework**: Vue 3 (Composition API)
- **Language**: TypeScript
- **Build Tool**: Vite
- **Type Check**: vue-tsc
- **Formatting**: Prettier + ESLint (Standard)

## 4. 環境變數
目前無特定環境變數。未來若介接 API，請於 `.env.example` 列出必要變數。
