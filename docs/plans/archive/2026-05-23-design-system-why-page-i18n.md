# 2026-05-23 設計系統定調、為什麼控糖頁面、CN/EN 切換

## 1. User Story

作為訪客，我希望網站有一致的品牌配色與字體，讓視覺語言清晰可辨；並能在 Header 看到「為什麼要控糖」連結，進入單篇文章頁閱讀網站宗旨，頁面內可切換中英文版本。

**核心變更**：
- 全站套用 Google Fonts（Sigmar / Nunito / Noto Sans TC）與新配色系統（主色 Teal #66BAB7、次色 Blue #758EC5）
- 新增 `/why` 公開路由，連結至「為什麼要控糖」文章頁（placeholder 內容）
- NavBar 新增文字連結；文章頁內嵌 CN/EN 語言切換控件（與 ThemeSwitcher 相同膠囊樣式）

---

## 2. 測試流程驗證 (Test Flow)

1. **字體**：重整任意頁面，NavBar logo「Orderly & Steady」使用 Sigmar，內文使用 Nunito（英文）/ Noto Sans TC（中文）
2. **配色**：
   - 互動元素（按鈕焦點、active tab、back-link）顯示 Teal `#66BAB7` 而非舊紫色 `#4ade80`
   - Light / Dark 兩種主題配色均正確顯示
3. **為什麼控糖頁面**：
   - NavBar 顯示「為什麼控糖？」文字連結
   - 點擊連結進入 `/why`，未登入也可瀏覽（公開路由）
   - 頁面顯示文章內容
4. **CN/EN 切換**：
   - 文章頁內嵌 CN/EN 膠囊控件，預設顯示中文
   - 點擊 EN，文章內容切換為英文版
   - 重整後維持上次選擇（localStorage 持久化）
   - 切換動畫與 ThemeSwitcher 一致（滑動指示器）

---

## 3. Spec 與架構設計

### 3.1 技術細節 / 邏輯設計

#### 字體系統（Google Fonts）

**`index.html`** head 新增：
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@100..900&family=Nunito:ital,wght@0,200..1000;1,200..1000&family=Sigmar&display=swap" rel="stylesheet">
```

**`src/style.css`** 字體變數更新：
```css
--heading: 'Sigmar', system-ui;           /* 英文大標（Orderly & Steady） */
--sans: 'Nunito', 'Noto Sans TC', system-ui;  /* 英文內文 + 中文 */
```
`Sigmar` 字重僅有 Regular，套用於 `.navbar` logo 或 `h1` 的品牌文字；`Nunito` 優先給英文，中文字元 fallback 至 `Noto Sans TC`。

#### 配色系統

**新增 CSS 變數**（`src/style.css` `:root` 區塊）：
```css
/* Primary — Teal */
--primary-1: #CDF2F0;
--primary-3: #66BAB7;   /* 主色 */
--primary-5: #268380;

/* Secondary — Blue */
--secondary-1: #D3DDF4;
--secondary-3: #758EC5;  /* 次色 */
--secondary-5: #355291;

/* Functional（評分色系） */
--score-high:     #4ade80;  /* ≥80 */
--score-medium:   #facc15;  /* 60–79 */
--score-low:      #fb923c;  /* 40–59 */
--score-critical: #f87171;  /* <40 */
--color-danger:   #f87171;  /* 錯誤 / 登出 */
```

**更新現有變數**（replace 舊紫色 accent）：
```css
--accent:        var(--primary-3);                 /* #66BAB7 */
--accent-bg:     rgba(102, 186, 183, 0.12);
--accent-border: rgba(102, 186, 183, 0.5);
```

`dark` 區塊 accent 同步更新，保持相同 teal hue 但更亮：可沿用 `--primary-3`（teal 在深色背景上已足夠對比）。

> **不處理範圍**：各 View 中寫死的評分色（#4ade80 等）待下次專項重構再統一替換為 CSS 變數，本次只定義變數不做全域替換，避免範疇蔓延。

#### 語言切換

**新建 `src/composables/useLang.ts`**（module-level singleton，與 `useTheme` 相同模式）：
```typescript
type Lang = 'cn' | 'en';
// 初始值：localStorage.getItem('lang') ?? 'cn'
// watchEffect：寫入 localStorage
// 匯出：lang: Ref<Lang>、setLang(l: Lang)
```

**新建 `src/components/LangSwitcher.vue`**：
- 與 `ThemeSwitcher.vue` 完全相同的膠囊 + 滑動指示器樣式
- 兩個選項：`CN`、`EN`（純文字，不用 icon）
- 共用 `--switcher-*` CSS 變數，無需重複定義
- ARIA：`role="radiogroup"`，各按鈕 `role="radio" :aria-checked`

**新建 `src/views/WhyView.vue`**：
- 使用 `useLang` 取得 `lang`，computed 回傳對應語言的文章物件
- 頂部顯示 `<LangSwitcher />`
- 文章標題、段落根據 `lang` 顯示 cn 或 en 版本
- Placeholder 內容（cn + en 各一份），使用者之後替換

文章 Placeholder 主題：飲食順序（膳食纖維 → 蛋白質 → 碳水）如何降低血糖波動，以及本系統如何協助記錄與評分。

#### NavBar 連結

**`src/components/NavBar.vue`** — 在 logo 右側（或右方 nav-actions 左側）新增文字連結：
```html
<router-link to="/why" class="nav-link">為什麼控糖？</router-link>
```
樣式：`color: var(--text-h)`，hover `color: var(--primary-3)`，`text-decoration: none`，`font-size: 0.9rem`。

### 3.2 路由與 API 端點

- **`GET /why`**（前端路由）：新增公開路由，無需登入，`meta: { public: true }`

### 3.3 資料庫變動

無。

---

## 4. 環境與設定 (.env)

無新增環境變數。

---

## 5. Tasks

**字體與配色系統**
- [x] 1. `index.html`：新增 Google Fonts preconnect + stylesheet link tags
- [x] 2. `src/style.css`：更新 `--heading`、`--sans` 字體變數；新增 Primary / Secondary / 評分色系 CSS 變數；更新 `--accent` 系列為 Teal

**「為什麼控糖」頁面**
- [x] 3. `src/router/index.ts`：新增 `/why` 公開路由（`meta: { public: true }`，無需登入）
- [x] 4. 新建 `src/views/WhyView.vue`：文章頁，含 LangSwitcher、CN/EN 雙語 placeholder 內容、對應樣式
- [x] 5. `src/components/NavBar.vue`：logo 與 nav-actions 之間新增「為什麼控糖？」文字連結

**CN/EN 語言切換**
- [x] 6. 新建 `src/composables/useLang.ts`：module-level singleton，`lang: Ref<'cn'|'en'>`，localStorage 持久化
- [x] 7. 新建 `src/components/LangSwitcher.vue`：CN/EN 膠囊控件，沿用 `--switcher-*` 變數，ARIA 屬性

---

## 6. 驗收結果

- [x] 大標「Orderly & Steady」顯示 Sigmar 字體
- [x] 內文英文使用 Nunito、中文使用 Noto Sans TC
- [x] 互動元素（tab active、焦點邊框、連結）顯示 Teal `#66BAB7`
- [x] Light / Dark 主題下配色均正確
- [x] `/why` 未登入可訪問，NavBar 顯示「為什麼控糖？」連結
- [x] 文章頁顯示 CN/EN 切換控件，切換後內容語言正確
- [x] 重整後語言選擇持久（localStorage）
- [x] `npm run build` 無型別錯誤
