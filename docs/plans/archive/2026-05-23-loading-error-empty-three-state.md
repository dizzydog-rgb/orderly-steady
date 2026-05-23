# 2026-05-23 Loading / Error / Empty 三態 UI 處理 + Dark/Light/System Mode 切換

## 1. User Story

作為使用者，我希望所有非同步操作都能清楚呈現目前狀態：等待中看到骨架屏而非空白、失敗時看到錯誤提示並能重試、無資料時看到引導畫面而非空白頁面，以便理解系統狀態、降低操作不確定感。

此外，我希望在 NavBar 右側透過一個膠囊型三段式切換器選擇主題（System / Light / Dark），帶有滑動指示器動畫，偏好持久化至 `localStorage`。

**核心變更**：
- 補齊三個缺口——`useHistory` 缺少 error 狀態（API 失敗靜默無聲）、`HomeView` 歷史區塊缺少 error UI + empty 引導畫面不夠明確、`MemberView` 登出無任何 loading 反饋
- NavBar 右側（會員 icon 左側）以 `ThemeSwitcher.vue` 三段式分組控件取代原單按鈕，`useTheme` 擴充支援 `'system' | 'light' | 'dark'` 三態

## 2. 測試流程驗證 (Test Flow)

1. **準備環境**: 啟動 `npm run dev:server`、`npm run dev`，登入帳號
2. **Loading 骨架屏**: 重整頁面，歷史紀錄區塊應短暫顯示 3 個骨架列（已存在，確認未回歸）
3. **Error 狀態**:
   - 在 DevTools > Network 將網路設為 Offline
   - 重整頁面，歷史紀錄區塊應顯示錯誤提示文字與「重試」按鈕
   - 恢復網路後點擊「重試」，應正常載入紀錄
4. **Empty 引導畫面**: 使用新帳號登入（無任何紀錄），歷史區塊應顯示含提示文字的引導畫面，而非空白
5. **登出 Loading**: 點擊登出按鈕，應短暫顯示「登出中...」並禁用按鈕，完成後跳轉至登入頁
6. **主題切換（三段式分組控件）**:
   - 預設跟隨系統（localStorage 無記錄時為 `'system'`）
   - 選 System → localStorage `theme='system'`，自動跟隨目前 OS 偏好
   - 選 Light → 整頁切淺色，localStorage `theme='light'`
   - 選 Dark → 整頁切深色，localStorage `theme='dark'`
   - 切換時白色滑動指示器應平滑移至對應選項（`transition 0.3s`）
   - 重整後指示器停在上次選項（無閃爍）
   - 會員 SVG icon 在 light 顯深色、dark 顯淺色（跟隨 CSS 變數自動切換）

## 3. Spec 與架構設計

### 3.1 技術細節 / 邏輯設計

**主題切換機制（三段式分組控件）**：

`style.css` 已改為 `html[data-theme="dark"]`，Tasks 5、7 需重做以支援三態。

- **`src/composables/useTheme.ts`**（Task 5 重做）：
  - 型別改為 `type ThemeMode = 'system' | 'light' | 'dark'`
  - 初始值：`localStorage.getItem('theme') ?? 'system'`
  - `resolveTheme(mode)`：`'system'` → 讀 `matchMedia` 決定 `'light'|'dark'`；其餘直接回傳
  - `watchEffect`：呼叫 `resolveTheme` 寫入 `dataset.theme` + `localStorage`
  - `'system'` 時監聽 `matchMedia` change 事件，離開時移除 listener
  - 匯出：`themeMode: Ref<ThemeMode>`、`setTheme(mode: ThemeMode)`

- **新建 `src/components/ThemeSwitcher.vue`**（Task 8）：
  - 膠囊容器：`border-radius: 999px`、`background: var(--switcher-bg)`、`padding: 4px`、`display: flex`、`position: relative`
  - 滑動指示器（絕對定位白色卡片）：`border-radius: 10px`、`box-shadow: 0 1px 3px rgba(0,0,0,0.15)`、`transition: transform 0.3s ease-in-out`；transform 由 `activeIndex * itemWidth` 計算
  - 三個選項按鈕：System（Monitor SVG）、Light（Sun SVG）、Dark（Moon SVG）；各 `min-width: 72px`、`position: relative; z-index: 1`
  - Active：`color: #111`；Inactive：`color: #888`，hover `color: #555`
  - ARIA：容器 `role="radiogroup"`，各按鈕 `role="radio" :aria-checked="themeMode === option.value"`
  - `style.css` 新增 `--switcher-bg: #f0f0f0`（light）、`#2a2a2a`（dark）

- **`src/components/NavBar.vue`**（Task 7 重做）：
  - 移除原 `theme-toggle` emoji button
  - 改為 `<ThemeSwitcher />`
  - 會員 `👤` emoji 替換為 inline SVG user icon（`currentColor`，繼承 `--text-h`）

**現況盤點（缺口）**：

| 操作 | Loading | Error | Empty |
|------|---------|-------|-------|
| 歷史紀錄載入 (useHistory) | ✅ | ❌ | ✅（文字過簡） |
| 評分提交 (HomeView) | ✅ | ✅ | — |
| 登入/註冊 (LoginView) | ✅ | ✅ | — |
| 登出 (MemberView) | ❌ | — | — |

**`useHistory.ts`** 新增 `fetchError` ref：
- `fetchHistory()` 開始時清空 `fetchError.value = null`
- `!res.ok` 時寫入 `fetchError.value = '載入紀錄失敗，請稍後再試'`
- `catch` 區塊寫入網路錯誤訊息
- `useHistory()` 回傳時加入 `error: fetchError`

**`HomeView.vue`** 歷史區塊四態邏輯（v-if / v-else-if 串聯）：
```
isLoading → skeleton-list
error     → error-state（含錯誤文字 + 重試按鈕呼叫 fetchHistory）
records.length === 0 → empty-guide（引導文字）
else      → record-list
```

**`MemberView.vue`** 登出 loading：
- 新增 `isLoggingOut` ref（`false`）
- `handleLogout()` 開始設 `true`，`await authStore.logout()` 完成後才跳轉（store 已確保不拋例外）

### 3.2 路由與 API 端點

無新增端點。`/api/meals/:userId` 既有，僅補齊前端錯誤處理。

### 3.3 資料庫變動

無。

## 4. 環境與設定 (.env)

無新增環境變數。

## 5. Tasks

**三態處理**
- [x] 1. `src/composables/useHistory.ts`：新增 `fetchError` ref，`fetchHistory` 補上 error 捕捉與寫入，`useHistory()` 回傳 `error: fetchError`
- [x] 2. `src/views/HomeView.vue`：從 `useHistory()` 解構 `error`，歷史區塊改為四態串聯（loading / error+重試 / empty引導 / list），新增 `.error-state`、`.empty-guide` 樣式
- [x] 3. `src/views/MemberView.vue`：新增 `isLoggingOut` ref，`handleLogout` 加 loading 控制，按鈕顯示「登出中...」並禁用

**Dark / Light / System Mode 切換**
- [x] 4. `src/style.css`：將 `@media (prefers-color-scheme: dark)` 區塊改為 `html[data-theme="dark"]`，保留 `@media` 作為無偏好記錄時的 fallback
- [x] 5. `src/composables/useTheme.ts`：**重做** — 型別改為三態 `'system'|'light'|'dark'`，新增 `resolveTheme()`、`matchMedia` listener 管理，匯出 `themeMode` 與 `setTheme`
- [x] 6. `src/App.vue`：import `useTheme` 確保最早期初始化
- [x] 7. `src/components/NavBar.vue`：**重做** — 移除 emoji 切換按鈕，改用 `<ThemeSwitcher />`，會員 `👤` 改為 inline SVG（`currentColor`）
- [x] 8. 新建 `src/components/ThemeSwitcher.vue`：膠囊型三段分組控件，滑動指示器動畫，Monitor/Sun/Moon inline SVG，ARIA 屬性

## 6. 驗收結果

- [x] 網路斷線時歷史區塊顯示錯誤提示，恢復後點重試可正常載入
- [x] 無紀錄帳號登入後顯示引導畫面而非空白
- [x] 登出按鈕有 loading 反饋
- [x] 三段式切換器滑動指示器平滑動畫，三個選項（System/Light/Dark）均正常切換
- [x] System 選項自動跟隨 OS 偏好，OS 切換時即時更新
- [x] 重整後指示器停在上次選項，頁面無閃爍
- [x] 會員 SVG icon 隨主題顯深色/淺色（`currentColor` 繼承 `--text-h`）
- [x] ARIA：`role="radiogroup"` + `aria-checked` 正確反映選中狀態
- [x] `npm run build` 無型別錯誤
