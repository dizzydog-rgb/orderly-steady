# 2026-06-09 修正註冊驗證錯誤訊息 + 圖表 RWD 橫向滾動軸

## 1. User Story

作為一個使用者，當我在註冊頁面輸入格式不正確的 email 或過短的密碼時，我希望能看到具體的欄位錯誤提示（如「email 格式不正確」或「密碼至少 8 個字元」），而非模糊的「請求格式錯誤」，以便快速知道哪個欄位需要修正。

同時，在手機等小畫面裝置上，分數趨勢圖表不應產生 X 方向滾動軸，確保版面整潔可用。

**核心變更**：
1. 前端 auth store 改讀後端回應的 `details[0].message` 取代通用 `error` 欄位
2. 密碼輸入框 placeholder 從「至少 6 個字元」修正為「至少 8 個字元」
3. `ScoreTrendChart` 圖表容器加入 `max-width: 100%; overflow: hidden` 防止小畫面 X 軸溢出

## 2. 測試流程驗證 (Test Flow)

1. **準備環境**: 執行 `npm run dev` + `npm run dev:server`，確認前後端均正常啟動
2. **操作路徑**:
   - 前往 `/login`，切換至「註冊」分頁
   - 輸入格式錯誤的 email（如 `abc`）並送出
   - 重新輸入合法 email，但密碼僅 4 字元（如 `1234`）並送出
   - 使用瀏覽器 DevTools 切換至手機寬度（375px / 320px），確認歷史紀錄頁圖表顯示
3. **預期結果**:
   - email 格式錯誤 → 紅色錯誤訊息顯示「email 格式不正確」
   - 密碼過短 → 紅色錯誤訊息顯示「密碼至少 8 個字元」
   - 密碼 placeholder 顯示「至少 8 個字元」
   - 手機寬度下，圖表正常縮放，無 X 方向滾動軸
4. **最終確認**: 所有錯誤訊息語義明確；手機模式頁面無水平溢出

## 3. Spec 與架構設計

### 3.1 技術細節 / 邏輯設計

- **後端錯誤格式**：`validate.ts` middleware 驗證失敗時回傳 `{ error: "請求格式錯誤", details: [{field, message}] }`；`details[0].message` 已為精確欄位訊息
- **前端錯誤讀取**：`auth.ts register()` 改讀 `err.details?.[0]?.message`，fallback 到 `err.error` 再到「註冊失敗」
- **Chart.js RWD**：`ScoreTrendChart` 已設 `responsive: true, maintainAspectRatio: false`，加入 `max-width: 100%; overflow: hidden` 後 canvas 自動跟隨容器寬度縮放

### 3.2 路由與 API 端點

- **API 端點**：無新增，修改現有 `POST /api/auth/register` 的前端讀取邏輯
- **頁面路由**：`/login`（LoginView.vue）

### 3.3 資料庫變動

- 無

## 4. 環境與設定 (.env)

- 無新增；確認 `PORT=3100` 與 `JWT_SECRET` 已設定

## 5. Tasks

- [x] 1. 修改 `src/stores/auth.ts` — `register()` 改讀 `err.details?.[0]?.message`
- [x] 2. 修改 `src/views/LoginView.vue` — 密碼 placeholder 改為「至少 8 個字元」
- [x] 3. 修改 `src/components/ScoreTrendChart.vue` — 圖表容器加入 `max-width: 100%; overflow: hidden`
- [x] 4. 手動驗證：測試錯誤訊息顯示 + 手機 RWD 圖表無橫向滾動

## 6. 驗收結果

- 註冊輸入錯誤時，UI 顯示「email 格式不正確」或「密碼至少 8 個字元」，不再顯示「請求格式錯誤」
- 密碼欄位 placeholder 正確顯示「至少 8 個字元」，與後端規則一致
- 在 375px / 320px 手機寬度下，分數趨勢圖表無 X 方向滾動軸，縮放正常
- 確認 `docs/FEATURES.md` 無需更新（UI 行為修正，非新功能）
