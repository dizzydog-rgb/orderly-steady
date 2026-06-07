# 2026-06-07 Auth 安全強化：RefreshToken 獨立資料表 & password null 死路修正

## 1. User Story

作為使用者，我希望能夠同時在手機和電腦上保持登入狀態，不會因為在另一台裝置登入而被強制登出。

另外，若我曾透過記錄飲食（不需登入）建立了帳號，我之後仍然能夠正常完成帳號註冊並登入。

**核心變更**：
1. 將 `User.refreshToken` 欄位拆分為獨立的 `RefreshToken` 資料表，支援多裝置同時登入。
2. 修正 `POST /api/auth/register`：當 email 已存在但 `password` 為 null（由 meals endpoint 自動建立的帳號）時，允許設定密碼完成註冊，而非直接回傳 409。

---

## 2. 測試流程驗證 (Test Flow)

### 問題一：多裝置登入
1. **準備環境**：啟動後端伺服器與 MySQL
2. **操作路徑**：
   - 裝置 A 以同一組帳密登入，取得 refreshToken A
   - 裝置 B 以同一組帳密登入，取得 refreshToken B
   - 裝置 A 呼叫 `POST /api/auth/refresh`（cookie 帶 refreshToken A）
3. **預期結果**：裝置 A 能成功換發新 accessToken，不受裝置 B 登入影響
4. **最終確認**：兩台裝置皆可獨立 refresh，互不干擾；登出其中一台只撤銷該台的 token

### 問題三：password null 死路
1. **準備環境**：啟動後端
2. **操作路徑**：
   - 以新 email 呼叫 `POST /api/meals`（自動建立 password=null 的帳號）
   - 以同一 email 呼叫 `POST /api/auth/register`（帶 password）
3. **預期結果**：成功完成註冊（HTTP 201），不回傳 409
4. **最終確認**：隨後能以該 email + password 正常登入

---

## 3. Spec 與架構設計

### 3.1 技術細節 / 邏輯設計

- **RefreshToken 資料表**：每次登入新增一筆，每次 refresh 採旋轉策略（刪舊建新），logout 只刪該裝置的 token；以 `token` 欄位建立 `@unique` 索引供快速查找，以 `userId` 建立 `@@index` 供登出全裝置用
- **Token 過期欄位 `expiresAt`**：寫入時計算 `now + 7d`；refresh 前先比對 `expiresAt < now` 提前拒絕（雙重防護，JWT 本身也會過期）
- **Register 修正邏輯**：
  - 查到 email 已存在 → 檢查 `user.password`
  - `password !== null` → 409（帳號已完整註冊）
  - `password === null` → 以 bcrypt hash 更新 password，回傳 201（完成帳號啟用）

### 3.2 路由與 API 端點

| 方法 | 路徑 | 變更說明 |
|------|------|----------|
| POST | `/api/auth/register` | 新增 password=null 的補全邏輯 |
| POST | `/api/auth/login` | 改為寫入 RefreshToken 資料表 |
| POST | `/api/auth/refresh` | 改為查詢 RefreshToken 資料表，旋轉 token |
| POST | `/api/auth/logout` | 刪除該裝置對應的 RefreshToken 紀錄 |

### 3.3 資料庫變動

**新增 model**：
```prisma
model RefreshToken {
  id        String   @id @default(uuid())
  token     String   @unique @db.Text
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([userId])
}
```

**修改 User model**：
- 移除 `refreshToken String? @db.Text`
- 新增 `refreshTokens RefreshToken[]`

**Migration**：需執行 `prisma migrate dev`，舊有 `User.refreshToken` 欄位資料將被捨棄（所有現存登入 session 將失效，需重新登入）。

---

## 4. 環境與設定 (.env)

無新增環境變數，現有設定不變。

---

## 5. Tasks

- [x] 1. 修改 `prisma/schema.prisma`：新增 `RefreshToken` model，從 `User` 移除 `refreshToken` 欄位
- [x] 2. 執行 `npx prisma migrate dev --name add-refresh-token-table` 產生 migration
- [x] 3. 更新 `server/routes/auth.ts`：login / refresh / logout 改用 `RefreshToken` 資料表
- [x] 4. 更新 `server/routes/auth.ts` register 端點：處理 password=null 帳號的補全邏輯
- [x] 5. 更新 `server/__tests__/routes/auth.spec.ts`：補充多裝置登入與 password=null 補全的測試案例
- [x] 6. 執行 `npm run test` 確認所有測試通過（49/49）
- [x] 7. 更新 `CLAUDE.md` Auth 架構說明（RefreshToken 資料表、register 補全邏輯）

---

## 6. 驗收結果

- [x] 多裝置登入互不干擾，各裝置可獨立 refresh 與 logout
- [x] meals endpoint 自動建立的帳號可透過 register 完成密碼設定
- [x] 現有所有 auth 相關測試通過，新測試案例一併通過（49/49）
- [x] CLAUDE.md 文件已同步更新
