# 2026-05-24 全站 CSS 變數統一 + RWD 響應式設計

## 1. User Story

作為使用者，我希望網站在手機和平板上也能正常瀏覽；作為開發者，我希望各頁面的色彩都引用全域 CSS 變數，而非散落的硬碼色票，讓日後維護主題或更換品牌色時只改一處即可生效。

**核心變更**：

- 將各 View / Component 中的硬碼色彩替換為 `style.css` 已定義的 CSS 變數
- 在 `style.css` `:root` 新增字體尺寸變數（`--f56` ～ `--f14`），並於三個斷點更新縮小值
- 為 `HomeView`、`LoginView`、`MemberView`、`WhyView`、`NavBar` 加入 RWD media query，主斷點 1024px / 768px / 480px

---

## 2. 測試流程驗證 (Test Flow)

1. **CSS 變數**：切換 Light / Dark 主題，各頁面色彩均正確跟隨切換，無任何元素停留在硬碼色彩
2. **RWD — NavBar**：視窗縮至 ≤768px，「為什麼控糖？」文字縮短或隱藏，logo 與圖示維持可點擊
3. **RWD — HomeView**：視窗縮至手機寬度（375px），輸入區塊與結果卡片上下排列，不橫向溢出
4. **RWD — LoginView**：手機上登入卡片佔滿寬度，padding 縮小，無橫向 scroll
5. **RWD — MemberView**：手機上歷史紀錄列表可正常捲動，無截斷
6. **RWD — WhyView**：手機上文章文字寬度正常，LangSwitcher 不溢出

---

## 3. 技術設計

### 3.1 斷點規範

| 名稱 | 寬度 | 說明 |
|------|------|------|
| tablet | `≤1024px` | `style.css` 已有 `h1/h2` 斷點，沿用並擴展至各 View |
| mobile | `≤768px` | 主要手機斷點，布局轉換為垂直堆疊 |
| mobile-sm | `≤480px` | 小螢幕手機，間距與字體進一步縮小 |

> 不引入額外 breakpoint 變數，直接寫 `@media (max-width: Npx)` 維持一致性。

### 3.2 CSS 變數替換對應表

| 硬碼色彩 | 替換為 | 用途說明 |
|---------|--------|---------|
| `#4ade80`（品牌互動，如 title / active tab / focus border / 主按鈕背景） | `var(--accent)` | 主色，已切換為 Teal `#66BAB7` |
| `#4ade80`（評分顯示 ≥80） | `var(--score-high)` | 保留綠色語意 |
| `#facc15` | `var(--score-medium)` | |
| `#fb923c` | `var(--score-low)` | |
| `#f87171` | `var(--color-danger)` 或 `var(--score-critical)` | 錯誤 / ≤40 評分 |
| `#888`, `#aaa`, `#666` | `var(--font-color)` | 次要文字 |
| `#0a0a0a`（深色文字，按鈕上） | `var(--font-color-h)` | |
| `#1a1a1a`, `#242424`（卡片背景） | `var(--social-bg)` | 已有 fallback |
| `#333`, `#444`（邊框） | `var(--border-color)` | 已有 fallback |

> JS 中 `getScoreColor()` 回傳 hex 字串（用於 inline style）：改為回傳 CSS 變數字串，如 `var(--score-high)`，inline style 可直接使用。

### 3.4 字體尺寸變數系統

在 `src/style.css` `:root` 新增以下字體尺寸變數，並在三個斷點覆寫：

```css
:root {
  --f56: 56px;   /* h1、大標題 */
  --f32: 32px;   /* 卡片大標、登入頁 title */
  --f24: 24px;   /* h2、次標題 */
  --f20: 20px;   /* 區塊小標、分數標籤 */
  --f18: 18px;   /* 內文基準 */
  --f16: 16px;   /* 次要說明文字 */
  --f14: 14px;   /* 小標籤、meta 文字 */
}

@media (max-width: 1024px) {
  :root {
    --f56: 36px;
    --f32: 26px;
    --f24: 20px;
    --f20: 18px;
    --f18: 16px;
    --f16: 15px;
    --f14: 13px;
  }
}

@media (max-width: 768px) {
  :root {
    --f56: 28px;
    --f32: 22px;
    --f24: 18px;
    --f20: 17px;
    --f18: 15px;
    --f16: 14px;
    --f14: 13px;
  }
}

@media (max-width: 480px) {
  :root {
    --f56: 24px;
    --f32: 20px;
    --f24: 17px;
    --f20: 16px;
    --f18: 14px;
    --f16: 13px;
    --f14: 12px;
  }
}
```

**各 View 字體尺寸替換對應表**

| 硬碼尺寸 | 替換為 | 出現位置 |
|---------|--------|---------|
| `1.8rem` / `32px` | `var(--f32)` | LoginView title |
| `1.5rem` / `28px` | `var(--f32)` | HomeView score 數字 |
| `1rem` / `18px` | `var(--f18)` | 按鈕、輸入框內文 |
| `0.95rem` / `0.9rem` | `var(--f16)` | 次要說明、tab 文字 |
| `0.88rem` / `0.85rem` | `var(--f16)` | record foods、error 文字 |
| `0.82rem` / `0.8rem` | `var(--f14)` | slot label、小標籤 |

> `style.css` 中 `h1`（56px）和 `h2`（24px）已有 1024px 斷點，改為引用 `var(--f56)` / `var(--f24)`，既有 `@media` 可移除（由 `:root` 斷點統一管理）。

### 3.5 各檔案 RWD 計畫

#### `NavBar.vue`
- `≤1024px`：`.navbar` padding 縮至 `12px 20px`
- `≤768px`：`.nav-link` 文字縮短為「為何控糖」；logo 高度縮至 28px
- `≤480px`：隱藏 `.nav-actions` 原有連結，顯示漢堡按鈕（☰ / ✕ 切換）；點擊後展開下拉選單，以文字列出三個頁面連結：
  - **首頁**（`/`）
  - **為什麼控糖？**（`/why`）
  - **我的會員**（`/member`，僅登入時顯示）
  - 下拉選單背景使用 `var(--bg-color)`，邊框 `var(--border-color)`，點擊任一連結後自動收合
  - 漢堡按鈕狀態以 `ref<boolean>` 控制，不依賴 CSS checkbox hack

#### `LoginView.vue`
- `≤1024px`：無需調整（max-width 380px 自然置中）
- `≤768px`：`.login-card` max-width 改為 100%，padding 縮至 `28px 20px`，border-radius 縮至 `12px`
- `≤480px`：padding 縮至 `24px 16px`；input font-size 改為 `var(--f16)`
- **字體替換**：title `1.8rem` → `var(--f32)`；input `0.95rem` → `var(--f16)`；label `0.85rem` → `var(--f14)`；error `0.85rem` → `var(--f14)`；submit-btn `1rem` → `var(--f18)`

#### `HomeView.vue`
- `≤1024px`：`.meal-form` padding 縮至 `24px 20px`；gap 從 32px 降至 24px
- `≤768px`：`.meal-form` / `.result-card` 寬度改為 100%；輸入列（food input + type select + submit button）改為垂直堆疊；`.score-display` padding 縮小
- `≤480px`：整體 padding 縮至 `16px`；`.slot-label` 寬度縮至 `36px`
- **字體替換**：score 數字 `1.5rem` → `var(--f32)`；按鈕 `1rem` → `var(--f18)`；input `0.95rem` → `var(--f16)`；slot/type label `0.8rem` → `var(--f14)`；tips `0.88rem` → `var(--f16)`；record date/foods `0.82rem`/`0.88rem` → `var(--f14)` / `var(--f16)`

#### `MemberView.vue`
- `≤1024px`：`.member-card` padding 縮至 `24px 20px`
- `≤768px`：max-width 改為 100%；`.record-item` gap 縮小；日期與分數改為上下排列
- `≤480px`：`.record-date` / `.record-foods` 已由 `var(--f14)` / `var(--f16)` 隨斷點自動縮小；padding 縮至 `8px 12px`
- **字體替換**：各 font-size 依 3.4 對應表替換為 CSS 變數

#### `WhyView.vue`
- `≤1024px`：`.article` padding 縮至 `24px 20px`
- `≤768px`：max-width 改為 100%；`LangSwitcher` 置中顯示；行距放寬至 `1.8`
- `≤480px`：標題與段落字體已由 `var(--f24)` / `var(--f18)` 隨斷點自動縮小，無需額外覆寫
- **字體替換**：文章標題 → `var(--f24)`；內文段落 → `var(--f18)`

---

## 4. 涉及檔案

| 檔案 | 動作 |
|------|------|
| `src/style.css` | 新增 `--f56`～`--f14` 字體尺寸變數；三斷點覆寫；`h1`/`h2` 改引用變數並移除舊 `@media` |
| `src/views/HomeView.vue` | 色彩 CSS 變數替換 + 字體尺寸變數替換 + RWD media query；JS `getScoreColor()` 回傳 CSS 變數 |
| `src/views/LoginView.vue` | 色彩 CSS 變數替換 + 字體尺寸變數替換 + RWD media query |
| `src/views/MemberView.vue` | 色彩 CSS 變數替換 + 字體尺寸變數替換 + RWD media query |
| `src/views/WhyView.vue` | 字體尺寸變數替換 + RWD media query |
| `src/components/NavBar.vue` | RWD media query（nav-link 縮排） |

---

## 5. Tasks

**字體尺寸變數系統**
- [x] Task 1：`src/style.css` — `:root` 新增 `--f56`～`--f14`；三斷點（1024/768/480px）覆寫；`h1`/`h2` 改引用變數並移除既有 `@media` 字體覆寫

**色彩 CSS 變數替換**
- [x] Task 2：`HomeView.vue` — 替換所有硬碼色彩為 CSS 變數；`getScoreColor()` 改回傳 `var(--score-*)` 字串
- [x] Task 3：`LoginView.vue` — 替換所有硬碼色彩為 CSS 變數
- [x] Task 4：`MemberView.vue` — 替換所有硬碼色彩為 CSS 變數

**字體尺寸變數替換**
- [x] Task 5：`HomeView.vue` — 依 3.4 對應表替換所有硬碼 font-size
- [x] Task 6：`LoginView.vue` — 依 3.4 對應表替換所有硬碼 font-size
- [x] Task 7：`MemberView.vue` — 依 3.4 對應表替換所有硬碼 font-size
- [x] Task 8：`WhyView.vue` — 依 3.4 對應表替換所有硬碼 font-size

**RWD**
- [x] Task 9：`NavBar.vue` — 新增 1024/768px media query；480px 以下實作漢堡選單（`ref<boolean>` 控制展開狀態，三個文字連結，點擊自動收合）
- [x] Task 10：`LoginView.vue` — 新增 768/480px media query
- [x] Task 11：`HomeView.vue` — 新增 1024/768/480px media query，輸入列改垂直堆疊
- [x] Task 12：`MemberView.vue` — 新增 1024/768/480px media query
- [x] Task 13：`WhyView.vue` — 新增 1024/768/480px media query

---

## 6. 驗收條件

- [x] Light / Dark 主題切換後，所有頁面色彩均正確跟隨，無殘留硬碼色票
- [x] 縮小 / 放大視窗，字體尺寸於三個斷點平滑縮小，無任何頁面保留硬碼 `px` / `rem` 字體
- [x] `npm run build` 無型別錯誤
- [x] 375px 寬度下各頁面無橫向 overflow
- [x] HomeView 手機版輸入區塊垂直排列，可正常操作
- [x] LoginView 手機版卡片佔滿寬度，padding 適當
