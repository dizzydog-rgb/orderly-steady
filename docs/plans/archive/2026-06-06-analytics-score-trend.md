# 2026-06-06 歷史趨勢視覺化 — Score Trend Chart

## 1. User Story

作為已登入的使用者，我希望在首頁的「過往進食紀錄」區塊上方，能看到一張折線圖呈現近期每餐的得分趨勢，以便直觀掌握自己的控糖習慣是否在進步；並可透過時間範圍按鈕切換觀察粒度（預設 7 天）。

**核心變更**：
- 安裝 `vue-chartjs` + `chart.js`，新增 `ScoreTrendChart.vue` 折線圖元件
- 圖表上方五個時間範圍按鈕（7天 / 14天 / 30天 / 90天 / 180天），預設 7 天；切換時折線有過場動畫
- 將 `useHistory` 模組級 composable 遷移為 Pinia store（`src/stores/history.ts`），實作 `hasFetched` 快取防止重複請求
- 後端 `GET /api/meals/:userId` 補上 `authMiddleware` 並驗證 userId 所有權
- 登出時重置 history store（清除快取）

---

## 2. 測試流程驗證 (Test Flow)

1. **初次載入**：登入後進入首頁，`history store` 尚無快取 → 發出一次 `GET /api/meals/:userId` → 圖表區域顯示 skeleton loading → 資料到位後折線圖淡入出現，預設顯示 7 天範圍
2. **切換時間範圍**：點擊「30天」按鈕 → 折線淡出（0.15s）→ 圖表資料更新（Chart.js 內建線條繪製動畫）→ 折線淡入（0.3s）；按鈕 active 樣式切換
3. **切換至無資料的範圍**：點擊「180天」但該區間無紀錄 → 圖表區顯示「此時間範圍內無紀錄」提示，不渲染折線
4. **切換頁面再回來**：HomeView 離開後再進入 → `hasFetched === true` → 不發 API 請求，圖表直接呈現快取資料（維持上次選擇的時間範圍）
5. **提交新餐點**：`handleSubmit` 成功後 `prependRecord` → 若新記錄在目前時間範圍內，圖表最右側即時新增資料點
6. **資料不足（篩選後 < 2 筆）**：目前範圍內僅 1 筆 → 顯示提示文字，不渲染圖表
7. **API 失敗**：斷網或 401 → 圖表區顯示 error 狀態（與現有 history error 共用樣式）
8. **登出**：呼叫 `logout()` 後 history store reset → 再次登入後重新拉資料

---

## 3. Spec 與架構設計

### 3.1 Pinia Store：`src/stores/history.ts`

取代現有 `src/composables/useHistory.ts`（刪除後者）。

```typescript
export const useHistoryStore = defineStore('history', {
  state: () => ({
    records: [] as IMealRecord[],
    isLoading: false,
    error: null as string | null,
    hasFetched: false,
  }),
  actions: {
    async fetchHistory() {
      if (this.hasFetched) return;          // 快取命中，跳過
      const authStore = useAuthStore();
      if (!authStore.user) return;
      this.isLoading = true;
      this.error = null;
      try {
        const res = await fetchWithAuth(`/api/meals/${authStore.user.id}`);
        if (res.ok) {
          const data = await res.json();
          this.records = data.records ?? [];
          this.hasFetched = true;
        } else {
          this.error = '載入紀錄失敗，請稍後再試';
        }
      } catch {
        this.error = '網路錯誤，請確認連線後重試';
      } finally {
        this.isLoading = false;
      }
    },
    prependRecord(record: IMealRecord) {
      this.records.unshift(record);
    },
    reset() {
      this.$reset();                        // hasFetched 歸零，下次登入重拉
    },
  },
});
```

`src/stores/auth.ts` 的 `logout()` action 最後呼叫 `useHistoryStore().reset()`。

### 3.2 ScoreTrendChart 元件：`src/components/ScoreTrendChart.vue`

#### Props

```typescript
defineProps<{ records: IMealRecord[] }>();
```

#### 時間範圍選單

```typescript
const RANGE_OPTIONS = [
  { label: '7天',   days: 7   },
  { label: '14天',  days: 14  },
  { label: '30天',  days: 30  },
  { label: '3個月', days: 90  },
  { label: '半年',  days: 180 },
] as const;

const selectedDays = ref(7);  // 預設 7 天
```

#### 資料過濾（computed）

```typescript
const filteredRecords = computed(() => {
  const cutoff = Date.now() - selectedDays.value * 86_400_000;
  return [...props.records]
    .filter(r => r.totalScore !== null && new Date(r.recordedAt).getTime() >= cutoff)
    .reverse();   // 最舊 → 最新（左→右）
});
```

#### 切換時間範圍的過場動畫

`isTransitioning` ref 控制 canvas wrapper 的 opacity。

```typescript
async function selectRange(days: number) {
  if (days === selectedDays.value) return;
  isTransitioning.value = true;
  await gsap.to(chartWrapper, { opacity: 0, duration: 0.15, ease: 'power1.in' });
  selectedDays.value = days;           // 觸發 filteredRecords 更新 → Chart.js 動畫
  await nextTick();
  await gsap.to(chartWrapper, { opacity: 1, duration: 0.3, ease: 'power1.out' });
  isTransitioning.value = false;
}
```

Chart.js 收到新資料後會執行內建的線條繪製動畫（`animation.duration: 400`），與 GSAP 淡入同時進行，形成「淡出舊線→淡入新線同步繪製」的視覺效果。

#### Chart.js 設定

- 使用 `vue-chartjs` 的 `<Line>` 元件
- 僅 register：`LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler`
- X 軸：`recordedAt` 格式化為 `MM/DD HH:mm`
- Y 軸：固定範圍 0–100，stepSize 20
- 折線顏色：`var(--accent)`
- 資料點顏色：依分數區間 → `var(--score-high / --score-medium / --score-low / --score-critical)`
- Area fill：`fill: 'origin'`，透明度 15%
- Chart.js `animation.duration: 400`（配合 GSAP 淡入）

#### 狀態處理

| 狀態 | 條件 | 顯示內容 |
|------|------|---------|
| 資料足夠 | `filteredRecords.length >= 2` | `<Line>` 折線圖 |
| 資料不足 | `filteredRecords.length < 2 && filteredRecords.length > 0` | 「此範圍僅 1 筆，再新增 1 筆可顯示趨勢」 |
| 無資料 | `filteredRecords.length === 0` | 「此時間範圍內無紀錄」 |

#### 入場動畫

元件 `onMounted` 用 `gsap.context()` 執行 `opacity: 0 → 1, y: 12 → 0, duration: 0.5`。

#### 時間範圍按鈕 UI（元件內部）

```html
<div class="range-selector">
  <button
    v-for="opt in RANGE_OPTIONS"
    :key="opt.days"
    :class="{ active: selectedDays === opt.days }"
    @click="selectRange(opt.days)"
  >{{ opt.label }}</button>
</div>
```

`active` 按鈕套用 `background: var(--accent); color: var(--font-color-h)`，其餘為 ghost style。切換時 CSS `transition: background 0.2s`。

### 3.3 HomeView 整合

在現有 `.history-section` 的 `<h3>過往進食紀錄</h3>` 下方、`<div v-if="isLoading">` 之前，新增圖表區塊：

```html
<!-- loading 時：skeleton 佔位（height: 220px）-->
<div v-if="isLoading" class="chart-skeleton skeleton"></div>

<!-- 資料足夠時（全部紀錄 ≥ 2）：圖表（含時間範圍按鈕）-->
<ScoreTrendChart
  v-else-if="!error && records.length >= 2"
  :records="records"
/>

<!-- 僅 1 筆：提示 -->
<p v-else-if="!error && records.length === 1" class="chart-hint">
  紀錄累積中，再多記錄 1 餐即可顯示趨勢圖
</p>
```

使用 `useHistoryStore()` 取代現有 `useHistory()` composable 呼叫。

### 3.4 後端：API 安全補強

`server/routes/meals.ts` 的 `GET /:userId`：

```typescript
router.get("/:userId", authMiddleware, async (req, res) => {
  if (req.user!.userId !== req.params.userId) {
    return res.status(403).json({ error: "無權存取此資源" });
  }
  // 其餘邏輯不變
});
```

### 3.5 路由與 API 端點

- **後端**：`GET /api/meals/:userId`（新增 authMiddleware + userId 所有權驗證）
- **前端路由**：無新增，整合於現有 `HomeView` (`/`)

### 3.6 資料庫變動

無 Schema 變更，無 Migration。

---

## 4. 環境與設定 (.env)

無新增環境變數。

---

## 5. Tasks

- [x] 1. 安裝套件：`npm install vue-chartjs chart.js`
- [x] 2. 新增 `src/stores/history.ts`（Pinia store，含 `hasFetched` 快取、`reset`）
- [x] 3. 刪除 `src/composables/useHistory.ts`
- [x] 4. 更新 `src/stores/auth.ts` `logout()` — 最後呼叫 `useHistoryStore().reset()`
- [x] 5. 更新 `src/views/HomeView.vue` — 改用 `useHistoryStore()`，移除 `useHistory` import
- [x] 6. 新增 `src/components/ScoreTrendChart.vue`（時間範圍按鈕、filteredRecords computed、GSAP 切換過場 + 入場動畫、Chart.js Line）
- [x] 7. 更新 `src/views/HomeView.vue` — 整合 `<ScoreTrendChart>`，補 chart-skeleton 與 chart-hint 樣式
- [x] 8. 更新 `server/routes/meals.ts` `GET /:userId` — 加 `authMiddleware` + userId 驗證
- [x] 9. `npm run build` 無型別錯誤
- [x] 10. 端對端驗收（Test Flow 八項全過）
- [x] 11. 更新 `docs/FEATURES.md` Feature 4 狀態為 🟢 已完成

---

## 6. 驗收條件

| 情境 | 預期結果 |
|------|---------|
| 登入後首頁載入 | 圖表區顯示 skeleton → 資料到位後折線圖淡入，預設 7天按鈕 active |
| 點擊不同時間範圍按鈕 | 折線淡出 → 新資料線條繪製動畫 → 淡入；active 按鈕樣式更新 |
| 切換至有資料的範圍（≥ 2 筆） | 折線圖正確顯示，X 軸日期、Y 軸 0–100 |
| 切換至資料不足的範圍（1 筆） | 顯示「此範圍僅 1 筆」提示，不渲染折線 |
| 切換至無資料的範圍（0 筆） | 顯示「此時間範圍內無紀錄」提示 |
| 歷史總共僅 1 筆 | HomeView 顯示「再多記錄 1 餐」提示，不渲染 ScoreTrendChart |
| 切換頁面再回首頁 | DevTools Network 無新 `/api/meals` 請求 |
| 提交新餐點後 | 若在目前時間範圍內，圖表右側即時新增資料點 |
| 登出再登入 | 重新拉取資料，不使用舊快取 |
| 未授權存取他人資料 | 後端回傳 403 |
| `npm run build` | 無型別錯誤 |

---

## 7. 後續修正（2026-06-06）

### 7.1 X 軸僅顯示日期、重複日期去重

**變更檔案**：`src/components/ScoreTrendChart.vue`

- 將 `formatDate`（含時間）改為 `formatDateOnly`，只回傳 `月/日`（例如 `5/23`）
- `chartData` computed 的 labels 加入 `seen` Set 去重：同一天只有第一筆顯示日期文字，其餘回傳空字串；tick 位置不變，視覺上不重複

### 7.2 圖表顏色改為主題色（CSS 變數 runtime 解析）

**問題根因**：Chart.js 以 Canvas 2D API 繪圖，canvas context 不解析 CSS 變數字串（如 `'var(--accent)'`），導致線條顯示黑色、tick 顏色異常。

**修正方式**：新增 `getCssVar(name, fallback)` helper，用 `getComputedStyle(document.documentElement).getPropertyValue(name)` 在 runtime 讀出實際色碼，在 `<script setup>` 執行期（元件實例化後，DOM 與 CSS 均已就緒）呼叫：

| 屬性 | 修改前 | 修改後 |
|------|--------|--------|
| `borderColor` | `'var(--accent)'` | `getCssVar('--accent', '#66bab7')` |
| `backgroundColor`（fill）| `'rgba(99,102,241,0.10)'`（硬編碼 indigo）| `getCssVar('--accent-bg', 'rgba(102,186,183,0.12)')` |
| Y 軸 `ticks.color` | `'var(--font-color)'` | `getCssVar('--font-color', '#999')` |
| X 軸 `ticks.color` | `'var(--font-color)'` | `getCssVar('--font-color', '#999')` |

### 7.3 圖表上下邊距使圓點完整顯示

**問題根因**：`layout.padding` 雖有設定，但 Chart.js 預設將 dataset 繪製範圍 clip 在 chart area 邊界內，導致 Y=0 或 Y=100 的資料點圓點仍被截切。

**修正方式**：在 dataset 加入 `clip: false as const`，關閉 chart area 裁切，讓圓點可渲染至 `layout.padding` 預留的空間內。

### 7.4 純折線 + 分數區間背景色帶

**變更檔案**：`src/components/ScoreTrendChart.vue`

**移除圓點**：dataset 改為 `pointRadius: 0, pointHoverRadius: 0`，移除 `pointBackgroundColor` 與 `pointBorderColor`（不再依資料點顏色表示分數）。

**新增背景色帶**：透過 Chart.js inline plugin（`beforeDatasetsDraw` 鉤子）在 canvas 繪製五個分數區間色帶，以顏色直觀表示分數區間，取代原本的資料點著色：

| 區間   | 顏色 |
|--------|------|
| 80–100 | rgba(74,222,128,0.12) — 綠 |
| 60–80  | rgba(250,204,21,0.10) — 黃 |
| 40–60  | rgba(251,146,60,0.10) — 橘 |
| 20–40  | rgba(248,113,113,0.10) — 橘紅 |
| 0–20   | rgba(239,68,68,0.15) — 紅 |

Plugin 透過 `<Line :plugins="[backgroundBandsPlugin]" />` 傳入，不需全域 register。

### 7.5 X 軸固定間隔日期錨點（已被 7.6 取代）

混合「錨點 null 點 + 實際記錄空字串 label」於同一 category axis 的方案，因 Chart.js `autoSkip: true` 等寬抽樣時會跳過日期 label、顯示空白 tick，最終廢棄，由 7.6 的桶聚合方案取代。

---

## 8. 後續修正（2026-06-06，第二批）

### 8.1 X 軸日期全面重構：固定時間桶聚合

**問題根因**：7.5 的錨點方案將 N 個日期錨點（`score: null`）和 M 筆實際記錄（`label: ''`）混入同一 category axis，Chart.js 把所有 N+M 個點等寬排列，當記錄數多時日期全部擠在一起；`autoSkip: true + maxTicksLimit: 8` 進一步跳過日期 tick，顯示空白位置。

**修正方式**：完全重寫 `chartData` computed，改用**固定時間桶聚合**：

- X 軸只有 `numBuckets` 個點，每個點都是完整日期字串（無空字串 label）
- 每個桶聚合其時間區間內的所有記錄，取**平均分數**；無記錄的桶為 `null`（`spanGaps: true` 跨越空桶）
- `chartOptions` 改為 `computed` 以動態讀取 `chartData.value.labels`；`autoSkip: false` 確保所有日期顯示

**桶數量**（與 `LABEL_INTERVAL_DAYS` 對應）：

| 時間範圍 | 間隔 | 桶數 |
|---------|------|------|
| 7天   | 1天  | 7 個  |
| 14天  | 7天  | 2 個  |
| 30天  | 7天  | 4 個  |
| 90天  | 30天 | 3 個  |
| 180天 | 30天 | 6 個  |

### 8.2 最右側標籤對齊今天

**問題根因**：8.1 的桶從 `cutoff`（過去某時刻）往右產生，最後一個桶的結束點可能早於 `now`，今天的記錄出現在最後一個桶的右側且無日期標籤。

**修正方式**：改為從 `now` 往回數桶，桶的標籤改用 `bucketEnd` 的日期：

```typescript
// k=0 最舊（最左），k=numBuckets-1 最新（最右 = 今天）
const bucketEnd = now - (numBuckets - 1 - k) * intervalMs;
const bucketStart = bucketEnd - intervalMs;
label = formatDateOnly(new Date(bucketEnd).toISOString());
```

最右側桶的 `bucketEnd = now`，`formatDateOnly(now)` = 今天日期，確保最右標籤永遠是當天。`filteredRecords` 的 cutoff 同步改為 `now - numBuckets * intervalDays * 86_400_000`，與桶覆蓋範圍完全對齊。

### 8.3 3個月 / 半年無資料趨勢線修復

**問題根因**：測試資料全集中在最近幾天，在 90/180 天視圖下只有最後一個桶有分數。`pointRadius: 0` 使單一資料點不可見，畫布渲染但什麼都看不到。舊 `v-if="filteredRecords.length >= 2"` 只檢查原始記錄數，不察覺「資料都在同一桶」的情況。

**修正方式**：
- `pointRadius: 0 → 3`，`pointHoverRadius: 0 → 5`：孤立資料點可見，hover 放大
- `v-if` 改為 `filteredRecords.length > 0`：只要範圍內有任何記錄就渲染圖表，稀疏資料直接呈現在正確日期位置，空桶留白

移除之前短暫加入的 `scoredBucketCount` computed 與「資料尚集中在同一時段」提示文字，改以空白畫布自然呈現「尚無跨期資料」的事實。

### 8.4 新增「當日」選項

**變更**：`RANGE_OPTIONS` 開頭加入 `{ label: '當日', days: 0 }`，以 `days === 0` 作為當日模式的識別值。

**當日模式邏輯**（與其他範圍完全分離）：

- `filteredRecords`：cutoff 為今天午夜（`new Date().setHours(0,0,0,0)`），取當日所有記錄
- `chartData`：**不做桶聚合**，每筆記錄各自顯示；按 `recordedAt` 升序排列；X 軸標籤改用 `formatTimeOnly`（`HH:MM`）；`spanGaps: false`（每筆都是真實分數，無 null）
- 新增 `formatTimeOnly(iso)` helper：回傳 `HH:MM` 格式

```typescript
function formatTimeOnly(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
```
