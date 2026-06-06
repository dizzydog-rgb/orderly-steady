# Development Guide

本文件定義「Orderly & Steady」的開發規範、命名約定與開發流程。

## 1. 快速啟動流程

前置需求：Node.js 18+、Docker Desktop

```bash
# 1. 安裝依賴
npm install

# 2. 建立 .env（參考第 4 節）

# 3. 啟動 MySQL 容器
docker-compose up -d

# 4. 執行資料庫 migration
npx prisma migrate dev

# 5. 寫入食物預設資料（選填）
npm run seed

# 6. 啟動後端（port 3100）
npm run dev:server

# 7. 啟動前端（port 5173）
npm run dev
```

前後端為獨立程序，完整開發須同時啟動步驟 6 與 7。

## 2. 常用指令

```bash
npm run dev                    # 前端 Vite dev server
npm run dev:server             # 後端 tsx watch（熱重載）
npm run build                  # 型別檢查 + 前端打包
npm run test                   # Vitest 全部單元測試
npx vitest run src/services/__tests__/scoringAlgorithm.spec.ts  # 單一測試檔
npx prisma studio              # 瀏覽器 DB GUI
```

## 3. 命名規範

### 3.1 檔案命名

- **Vue 元件**：PascalCase（`NavBar.vue`、`ScoreTrendChart.vue`）
- **Composable / Service / Util**：camelCase（`useGlucoseScore.ts`、`scoringAlgorithm.ts`、`fetchWithAuth.ts`）
- **Pinia Store**：camelCase（`auth.ts`、`history.ts`），使用 `use*Store` 命名 setup function

### 3.2 程式碼規範

- **變數與函式**：camelCase
- **介面**：PascalCase，加 `I` 前綴（`IMealRecord`、`IScoringResult`）
- **常數物件**：PascalCase（`FoodType`）
- 嚴格禁止 `any`；所有 API 回傳與元件 Props 必須定義 Interface（`src/types/index.ts`）
- **GSAP 動畫**：僅在 `onMounted` 觸發，使用 `gsap.context()` 管理，`onUnmounted` 時 `ctx.revert()`

## 4. 環境變數

建立專案根目錄的 `.env` 檔，參考 `.env.example`：

```env
DATABASE_URL="mysql://root:your_password@localhost:3306/glucose_db?charset=utf8mb4"
PORT=3100
JWT_SECRET=<64 字元隨機字串>
JWT_REFRESH_SECRET=<另一組 64 字元隨機字串>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
COOKIE_SECURE=false          # production 改 true
FRONTEND_URL=http://localhost:5173
ANTHROPIC_API_KEY=<Anthropic API 金鑰>
```

> `DATABASE_URL` 須含 `?charset=utf8mb4`，確保中文食物名稱正確寫入 DB。
> 後端預設 port 為 3000，須在 `.env` 設定 `PORT=3100` 以符合 Vite proxy 設定。

## 5. 開發流程

每次進行功能修改或新增前，先依照 `docs/plans/2026-04-26-ecpay-full-integration(as structure model).md` 的格式，在 `docs/plans/` 建立一份今日計畫（`YYYY-MM-DD-<feature-name>.md`），與使用者確認計畫內容後才開始撰寫程式碼；功能完成後移至 `docs/plans/archive/`。

## 6. 關鍵開發規則

- **評分演算法同步**：修改 `src/services/scoringAlgorithm.ts` 時，`server/services/scoringAlgorithm.ts` 必須同步更新，反之亦然
- **API 請求**：所有需登入的前端 API 請求一律透過 `fetchWithAuth`（`src/utils/fetchWithAuth.ts`），不直接使用 `fetch`
- **DB 索引**：新增高頻查詢模式時，須在 Prisma schema 補上對應 `@@index`
- **Loading State**：呼叫 AI API 或高頻搜尋時一律實作 Loading State + Debounce
- **Pinia 快取**：前端已拉取的歷史紀錄由 `historyStore` 快取（`hasFetched` 旗標），不重複發起請求
