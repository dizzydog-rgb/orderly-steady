# Development Guide

本文件定義「Orderly & Steady」的開發規範、命名約定與開發流程。

## 1. 快速啟動流程

請確保本地環境已安裝 Node.js 20+ 與 Docker。

1. **啟動資料庫**:
   ```bash
   docker-compose up -d
   ```
2. **初始化資料庫 (Prisma)**:
   ```bash
   npx prisma db push
   ```
3. **啟動後端服務**:
   ```bash
   npm run dev:server
   ```
4. **啟動前端開發環境**:
   ```bash
   npm run dev
   ```

## 2. 命名規範

### 2.1 檔案命名
- **組件檔案**: 使用 PascalCase (例如 `MealCard.vue`)。
- **邏輯/工具類/Composable**: 使用 camelCase (例如 `useGlucoseScore.ts`, `scoringAlgorithm.ts`)。

### 2.2 程式碼規範
- **變數與函式**: 使用 camelCase。
- **介面與型別**: 使用 PascalCase。
- **GSAP 動畫**: 必須在 `onMounted` 週期觸發，並使用 `gsap.context()` 進行清理。

## 3. 技術棧
- **Frontend**: Vue 3 (Composition API), Vite, GSAP
- **Backend**: Node.js (Express), Prisma, MySQL
- **Tooling**: Docker, Vitest

## 4. 環境變數
請建立 `.env` 檔案並參考以下配置：
```env
DATABASE_URL="mysql://root:password@localhost:3306/glucoseflow"
PORT=3000
```
