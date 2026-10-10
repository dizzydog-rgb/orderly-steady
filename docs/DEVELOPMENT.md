# Development Guide

本文件定義「Orderly & Steady」的開發規範、命名約定與開發流程。

## 1. 快速啟動流程

前置需求：Node.js 22.18 以上（建議與 CI 相同的 24；git hook 以 Node 原生執行 TypeScript）、Docker Desktop

```bash
# 1. 安裝依賴，並啟用機密掃描的 git hook（每個 clone 執行一次，見 4.1）
npm install
npm run hooks:install

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
npm run test:coverage          # 產生覆蓋率報告（text + HTML，@vitest/coverage-v8）
npx vitest run src/services/__tests__/scoringAlgorithm.spec.ts  # 單一測試檔
npx prisma studio              # 瀏覽器 DB GUI
npm run seed:demo              # 重建示範帳號與圖表資料（本機資料庫，讀 .env）
npm run seed:demo:remote       # 同上，但對遠端資料庫執行（讀 .env.railway.local，見 4.1）
npm run hooks:install          # 啟用 pre-commit／pre-push 機密掃描
npm run check:secrets          # 手動掃描所有被追蹤的檔案
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
MYSQL_ROOT_PASSWORD=your_password   # docker-compose.yml 以此初始化 MySQL；須與 DATABASE_URL 中的密碼一致
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

### 4.1 機密管理

**原則：機密不得出現在指令列，也不得出現在被 git 追蹤的檔案。**

| 檔案 | 是否進版本庫 | 用途 |
|------|-------------|------|
| `.env` | 否（已忽略） | 本機開發的所有機密 |
| `.env.<名稱>.local` | 否（由 `*.local` 忽略） | 其他環境的機密，例如 `.env.railway.local` |
| `.env.example` | 是 | 變數清單與範例值，不含真實機密 |
| `.env.production` | 是 | 只放會打包進前端的公開設定（`VITE_*`） |

**對遠端資料庫執行指令**：把連線字串放進 `.env.railway.local`，以 `--env-file` 載入。

```env
# .env.railway.local
DATABASE_URL="mysql://root:<password>@<host>:<port>/railway?charset=utf8mb4"
```

```bash
npm run seed:demo:remote
# 其他一次性指令：
npx tsx --env-file=.env.railway.local <script>

# 執行前確認載入的是哪一台主機（只印主機名稱，不印密碼）
npx tsx --env-file=.env.railway.local -e "console.log(new URL(process.env.DATABASE_URL).host)"
```

**不要寫成 `DATABASE_URL="…" npx tsx …`**。密碼會留在 shell 歷史紀錄中；在 Claude Code 把該指令加入允許清單時，指令全文（含密碼）還會被寫進有被追蹤的 `.claude/settings.json`。

**自動掃描**（`scripts/check-secrets.ts`，規則在 `scripts/secretScan.ts`）：

| 時機 | 掃描範圍 |
|------|---------|
| `pre-commit` hook | 已 staged 的新增內容 |
| `pre-push` hook | 每一個即將推送的 commit（機密加入後又刪除也攔得到，因為它仍在歷史中） |
| CI | 所有被追蹤的檔案 |

會被攔下的內容：

- 帶帳密且主機不是 `localhost`／`127.0.0.1` 的連線字串（密碼為 `${VAR}`、`<password>`、`***` 等佔位寫法時放行）
- `sk-ant-` 開頭的 Anthropic API 金鑰
- PEM 私鑰
- 檔名為 `.env` 或 `.env.*` 的檔案（`.env.example`、`.env.production` 除外）

`JWT_SECRET` 這類沒有固定形狀的機密無法靠樣式辨識，只能靠「只放在被忽略的 env 檔」這條原則。

Hook 需要每個 clone 執行一次 `npm run hooks:install` 才會生效。確定是誤判時，在該行加上 `secret-scan:allow` 註記；不要用 `--no-verify` 跳過，pre-push 與 CI 仍會擋下。

若機密已經被 commit：先重設該組密碼或金鑰，再改寫歷史將它移除。只刪掉內容再 commit 一次是不夠的。

## 5. 開發流程

每次進行功能修改或新增前，先依照 `docs/plans/_template.md` 的格式，在 `docs/plans/` 建立一份今日計畫（`YYYY-MM-DD-<feature-name>.md`），與使用者確認計畫內容後才開始撰寫程式碼；功能完成後移至 `docs/plans/archive/`。

## 6. 關鍵開發規則

- **評分演算法同步**：修改 `src/services/scoringAlgorithm.ts` 時，`server/services/scoringAlgorithm.ts` 必須同步更新，反之亦然
- **API 請求**：所有需登入的前端 API 請求一律透過 `fetchWithAuth`（`src/utils/fetchWithAuth.ts`），不直接使用 `fetch`
- **DB 索引**：新增高頻查詢模式時，須在 Prisma schema 補上對應 `@@index`
- **Loading State**：呼叫 AI API 或高頻搜尋時一律實作 Loading State + Debounce
- **Pinia 快取**：前端已拉取的歷史紀錄由 `historyStore` 快取（`hasFetched` 旗標），不重複發起請求
