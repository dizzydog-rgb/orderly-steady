# 2026-06-06 Zod Input Validation

## 1. User Story

作為後端開發者，我希望所有 API 入口的 request body 在進入 Controller 前已通過 Zod schema 驗證，以便：
- 非預期型別、格式錯誤或惡意負載在 middleware 層被攔截，不進入業務邏輯
- `req.body` 在 handler 內具備完整 TypeScript 型別推導，不再是 `any`
- Schema 本身即為 API 合約文件，新成員無需額外閱讀才能理解欄位規格

**核心變更**：新增 `validate()` middleware factory + 2 個 schema 檔案；在 `auth` 與 `meals` 路由套用；移除原有的手動 truthy 檢查。無 DB migration，無前端改動。

## 2. 測試流程驗證 (Test Flow)

1. **準備環境**: 啟動後端 `npm run dev:server`（port 3100）
2. **操作路徑**: 以 curl / Postman 分別傳送格式錯誤請求（email 格式錯誤、password 少於 8 碼、foods 空陣列或超過 3 項）與正常合法請求
3. **預期結果**: 格式錯誤 → HTTP 400 + `{ error: "請求格式錯誤", details: [{ field, message }] }`；合法請求 → 原有 200/201 回應，行為不變
4. **最終確認**: `npm run build` 通過型別檢查，零 TypeScript error

## 3. Spec 與架構設計

### 3.1 技術細節 / 邏輯設計
- **`validate()` middleware**: 接收 Zod schema，呼叫 `schema.safeParse(req.body)`；失敗則回傳 400 並中止；成功則以 `result.data`（已去除多餘欄位）覆寫 `req.body`，再呼叫 `next()`
- **RegisterSchema**: `email` → `z.string().email()`、`password` → `z.string().min(8)`、`name` → `z.string().max(50).optional()`
- **LoginSchema**: `email` → `z.string().email()`、`password` → `z.string().min(1)`
- **CreateMealSchema**: `email` → `z.string().email()`、`foods` → `z.array(z.string().min(1).max(100)).min(1).max(3)`
- **型別推導**: 每個 schema 以 `z.infer<typeof Schema>` export 對應 Input 型別，供 handler 直接使用

### 3.2 路由與 API 端點
- **API 端點**:
  - `POST /api/auth/register` (套用 RegisterSchema)
  - `POST /api/auth/login` (套用 LoginSchema)
  - `POST /api/meals` (套用 CreateMealSchema，位於 mealLimiter 之後)

### 3.3 資料庫變動
- 無 Schema 變更，無 Migration 需求

## 4. 環境與設定 (.env)
- 無新增環境變數

## 5. Tasks
- [x] 1. `npm install zod`（新增 production dependency）
- [x] 2. 新增 `server/middleware/validate.ts`（validate middleware factory）
- [x] 3. 新增 `server/schemas/auth.schemas.ts`（RegisterSchema、LoginSchema + 型別匯出）
- [x] 4. 新增 `server/schemas/meals.schemas.ts`（CreateMealSchema + 型別匯出）
- [x] 5. 修改 `server/routes/auth.ts`：套用 validate middleware，移除手動 truthy 檢查
- [x] 6. 修改 `server/routes/meals.ts`：套用 validate middleware，移除手動陣列長度檢查
- [x] 7. `npm run build` 驗證型別無誤

## 6. 驗收結果
- 所有格式錯誤請求回傳 HTTP 400 + 結構化 `details` 陣列
- 合法請求行為與原有相同（無 regression）
- `npm run build` 零 TypeScript error ✅
- 新增檔案：`server/middleware/validate.ts`、`server/schemas/auth.schemas.ts`、`server/schemas/meals.schemas.ts`
