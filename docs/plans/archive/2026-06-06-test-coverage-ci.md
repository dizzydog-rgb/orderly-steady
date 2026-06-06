# 2026-06-06 完整測試覆蓋 + GitHub Actions CI

## 1. User Story

作為開發者，我希望核心後端邏輯有 Vitest 單元測試覆蓋，並透過 GitHub Actions 在每次 push 自動執行，以便：
- 計分演算法的三分支決策樹行為有明確規格文件
- authMiddleware 與 validate middleware 的錯誤路徑有回歸保護
- Controller 的關鍵 HTTP 狀態碼（409 / 401 / 403 / 404）不會因重構而靜默消失
- PR 未通過 CI 測試不得合併

**核心變更**：新增後端測試檔案（middleware × 2、routes/auth × 1）、後端 scoring algorithm 測試、更新 Vitest 設定支援 Node 環境、加入 @vitest/coverage-v8、新增 `.github/workflows/ci.yml`。無前端改動。

## 2. 測試流程驗證 (Test Flow)

1. **準備環境**: 安裝新增 devDependencies（`supertest`、`@types/supertest`、`@vitest/coverage-v8`）
2. **操作路徑**: 在本機執行 `npm test`，確認全部測試通過；執行 `npm run test:coverage` 確認覆蓋率報告產生
3. **預期結果**: 所有 spec 檔案 PASS，terminal 顯示綠色通過；coverage 報告於 `coverage/` 目錄產生
4. **最終確認**: push 至 GitHub，Actions tab 顯示 CI workflow 執行成功；建立測試 PR 並刻意讓測試失敗，確認 PR merge button 被鎖定

## 3. Spec 與架構設計

### 3.1 技術細節 / 邏輯設計

- **測試環境分離**: 前端測試維持 `happy-dom`；後端 spec 檔頂端加 `// @vitest-environment node`
- **Prisma Mock 策略**: 使用 `vi.mock('../db')` 搭配 `vi.mocked()` mock Prisma，使 Controller 測試不依賴真實 DB
- **Express App 測試**: route 測試用 `supertest(app)` 直接打 HTTP，不啟動 real server
- **JWT mock**: `vi.mock('../services/authService')` 控制 `verifyAccessToken` 回傳值，模擬有效/過期兩種狀態

**新增測試檔案**：
```
server/__tests__/
├── middleware/
│   ├── authMiddleware.spec.ts   (4 cases)
│   └── validate.spec.ts         (5 cases)
├── services/
│   └── scoringAlgorithm.spec.ts (8 cases，後端版本)
└── routes/
    └── auth.spec.ts             (8 cases，supertest + vi.mock prisma)
```

**測試案例規劃**：

*authMiddleware（4 cases）*
- 無 Authorization header → 401 `"未提供 Token"`
- header 不以 `Bearer ` 開頭 → 401
- 有效 token → `next()` 被呼叫，`req.user` 被填入
- 過期/無效 token（`verifyAccessToken` 拋出）→ 401 `"Token 無效或已過期"`

*validate middleware（5 cases）*
- 合法 body 通過 RegisterSchema → `next()` 被呼叫，`req.body` 為 cleaned data
- email 格式錯誤 → 400 + `details[0].field === 'email'`
- password 少於 8 碼 → 400 + `details[0].field === 'password'`
- foods 空陣列 → 400 + `details[0].field === 'foods'`
- foods 超過 3 項 → 400

*後端 scoringAlgorithm（8 cases）*
- m=0（全 OTHER）→ `totalScore: null`
- m=1 SIMPLE_CARB → `totalScore: 20`
- m=1 COMPLEX_CARB → `totalScore: 40`
- m=1 FIBER/PROTEIN → `totalScore: 60`
- m=2 [FIBER, PROTEIN]（無懲罰）→ `totalScore: 100`
- m=2 [SIMPLE_CARB, PROTEIN]（index=0 懲罰）→ 分數 ≤ 50
- m=3 [FIBER, PROTEIN, COMPLEX_CARB]（理想順序）→ `totalScore: 100`
- tips：SIMPLE_CARB 首位觸發空腹精緻碳水警告

*auth routes（8 cases，supertest + vi.mock prisma）*
- `POST /api/auth/register` 合法請求 → 201 + `{ user }`
- `POST /api/auth/register` email 已存在 → 409
- `POST /api/auth/register` email 格式錯誤 → 400
- `POST /api/auth/register` password < 8 碼 → 400
- `POST /api/auth/login` 有效帳密 → 200 + `{ accessToken }`
- `POST /api/auth/login` 帳號不存在 → 401
- `POST /api/auth/login` 密碼錯誤 → 401
- `POST /api/auth/login` email 格式錯誤 → 400

### 3.2 路由與 API 端點

- **API 端點**:
  - `POST /api/auth/register` (201 / 400 / 409)
  - `POST /api/auth/login` (200 / 400 / 401)

### 3.3 資料庫變動

無。

## 4. 環境與設定 (.env)

- `JWT_SECRET=test-secret`（測試環境 hardcode，CI 同）
- 新增 scripts：`"test:coverage": "vitest run --coverage"`

新增 devDependencies：`supertest`、`@types/supertest`、`@vitest/coverage-v8`

## 5. Tasks

- [x] 1. 安裝 devDependencies：`supertest`、`@types/supertest`、`@vitest/coverage-v8`
- [x] 2. `vite.config.ts` 新增 coverage 設定（provider: `v8`，reporter: `['text', 'html']`）
- [x] 3. 新增 `server/__tests__/middleware/authMiddleware.spec.ts`（4 cases）
- [x] 4. 新增 `server/__tests__/middleware/validate.spec.ts`（5 cases）
- [x] 5. 新增 `server/__tests__/services/scoringAlgorithm.spec.ts`（8 cases，後端版本）
- [x] 6. 新增 `server/__tests__/routes/auth.spec.ts`（8 cases，supertest + vi.mock prisma）
- [x] 7. 新增 `.github/workflows/ci.yml`
- [x] 8. `npm test` 確認全部通過（47/47）

## 6. 驗收結果

- `npm test` 47/47 通過（既有 23 + 新增 24 cases）✅
- `npm run build` 零 TypeScript error ✅
- GitHub Actions CI `.github/workflows/ci.yml` 已建立
- **附帶修正**：`server/middleware/validate.ts` 的 `result.error.errors` → `result.error.issues`（Zod v4 breaking change）
