# 2026-05-16 前端 Vue Router 三頁面重設計 + 會員系統整合

## 1. User Story

作為一個已登入的使用者，我希望能在主頁面依序輸入三格食物名稱並提交評分，在會員頁面查看個人資料與登出；未登入時自動跳轉至登入頁面，JWT Token 過期後由系統自動換發，使用體驗不中斷。

**核心變更**：導入 Vue Router，建立三個頁面（Login / Home / Member），未登入自動導向 /login，JWT 採用「401 時才換發」的懶刷新策略。

---

## 2. 頁面架構

| 路由 | 元件 | 保護 | 說明 |
|---|---|---|---|
| `/login` | `LoginView.vue` | 公開（已登入自動跳 `/`） | 登入 + 註冊 tab |
| `/` | `HomeView.vue` | ✅ 需要登入 | 三格輸入 + 評分 + 歷史 |
| `/member` | `MemberView.vue` | ✅ 需要登入 | 個人資料、登出 |

---

## 3. Token 管理策略

- **accessToken**：module-level `ref`（記憶體），不寫 localStorage
- **refreshToken**：寫入 `localStorage('refreshToken')`
- **懶刷新**：不主動計算 token 過期時間；每次 API 回傳 401 才呼叫 `/api/auth/refresh`，成功後重試原請求一次；若 refresh 也失敗，清除狀態並跳到 `/login`
- **頁面載入**：router guard 檢查 accessToken 是否存在；若無，嘗試用 localStorage refreshToken 換發一次（唯一的主動刷新時機）

---

## 4. 新增 / 修改檔案清單

- `src/router/index.ts`（新增）— 路由定義 + beforeEach guard
- `src/composables/useAuth.ts`（新增）— module singleton，管理 user / accessToken / token 換發
- `src/utils/fetchWithAuth.ts`（新增）— API 請求統一入口，401 自動換發
- `src/composables/useHistory.ts`（新增）— 歷史紀錄 module singleton
- `src/components/NavBar.vue`（新增）— Logo + 使用者 icon
- `src/views/LoginView.vue`（新增）— 登入 / 註冊 tab
- `src/views/HomeView.vue`（新增）— 三格輸入 + 評分 + 歷史
- `src/views/MemberView.vue`（新增）— 個人資料 + 登出
- `src/App.vue`（修改）— 簡化為 NavBar + RouterView
- `src/main.ts`（修改）— 掛載 router
- `src/types/index.ts`（修改）— 新增 IUser、IMealRecord、IFoodItemRecord
- `vite.config.ts`（修改）— 新增 /api proxy

---

## 5. Tasks

- [x] 1. 建立 `docs/plans/2026-05-16-frontend-ui-redesign.md`（本文件）
- [x] 2. 安裝 `vue-router`
- [x] 3. 更新 `vite.config.ts`（新增 /api proxy）
- [x] 4. 更新 `src/types/index.ts`（新增 IUser、IMealRecord、IFoodItemRecord）
- [x] 5. 建立 `src/composables/useAuth.ts`
- [x] 6. 建立 `src/utils/fetchWithAuth.ts`
- [x] 7. 建立 `src/composables/useHistory.ts`
- [x] 8. 建立 `src/router/index.ts`（含 navigation guard）
- [x] 9. 建立 `src/components/NavBar.vue`
- [x] 10. 建立 `src/views/LoginView.vue`
- [x] 11. 建立 `src/views/HomeView.vue`（含 GSAP 動畫）
- [x] 12. 建立 `src/views/MemberView.vue`
- [x] 13. 修改 `src/App.vue`（簡化為 NavBar + RouterView）
- [x] 14. 修改 `src/main.ts`（掛載 router）
- [x] 15. `npm run build` 確認無型別錯誤
- [x] 16. 啟動 dev server，手動測試完整流程

---

## 6. 驗收結果

- [x] 未登入訪問 `/` → 自動跳轉 `/login`
- [x] 已登入訪問 `/login` → 自動跳轉 `/`
- [x] 登入成功 → 跳至 `/`，NavBar 顯示 👤 icon
- [x] 點擊 👤 → 跳至 `/member`，顯示使用者資訊與登出按鈕
- [x] 登出 → 跳回 `/login`，localStorage refreshToken 清除
- [x] 第一口有輸入 → 第二口解鎖；第二口有輸入 → 第三口解鎖
- [x] 送出 → 顯示分數 + GSAP 動畫 + 歷史清單更新（修正 data.analysis key + records 解析）
- [x] 重整頁面 → router guard 用 refreshToken 自動恢復登入
