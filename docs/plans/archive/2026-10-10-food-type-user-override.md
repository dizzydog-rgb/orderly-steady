# [2026-10-10] 食物分類個人覆寫（使用者自行修正 AI 分類）

## 1. User Story

作為一個已登入的使用者，當評分結果中某項食物的類別不符合我的認知時（例如雞胸肉被分類為精緻碳水），我希望能直接在結果列上改選類別，讓系統立即重算本餐分數並記住我的選擇，以便之後再輸入同一食物時自動套用我的分類，不必每次修正。

**核心變更**：
- 新增 `UserFoodOverride` 資料表儲存「個人覆寫」；分類查詢順序改為 **個人覆寫 → 全域 `FoodDictionary` → Claude API**。全域字典維持只由 AI 寫入，使用者之間互不影響（A 把蘋果改成複合碳水、B 改成纖維，兩者並存，沒有衝突要解決）。
- 新增 `PATCH /api/meals/:recordId/items/:sequenceIndex`：修正當餐某項食物的類別，同一個 transaction 內寫入覆寫並重算分數。
- 新增 `PUT /api/food-overrides`：處理「原本全為 OTHER、沒有寫入紀錄」的情況（先存覆寫，前端再重送原本的食物）。
- `POST /api/meals` 改為選擇性驗證：帶有效 token 時套用該使用者的覆寫。
- 前端評分結果的類別文字旁加上小的編輯圖示（僅登入者），點擊後才展開類別選單；訪客不顯示圖示，改顯示「登入後可修正分類」。

**已與使用者確認的決策**：

| 項目 | 決定 |
|------|------|
| 覆寫範圍 | 僅個人覆寫，不修改全域字典 |
| 權限 | 僅登入使用者 |
| 修正時機 | 維持一鍵送出，於評分結果上事後修正 |
| 歷史紀錄 | 只改當餐與未來，不回溯重算過去紀錄 |
| 操作介面 | 類別文字旁加編輯圖示，點擊後才出現選單（非常駐下拉選單） |

## 2. 測試流程驗證 (Test Flow)

1. **準備環境**：`docker-compose up -d` 啟動 MySQL；`npx prisma migrate dev` 套用新 migration；`RATE_LIMIT_DISABLED=true npm run dev:server`、`npm run dev` 分別啟動後端（3100）與前端（5173）。E2E 沿用既有測試帳號（`e2e/testAccount.ts`），並於 `beforeEach` 以 Prisma 預先寫入測試用 `FoodDictionary` label（例：`e2e測試主食` → SIMPLE_CARB、`e2e測試醬料` → OTHER），**避免 E2E 呼叫 Claude API**。刪除測試帳號時 `UserFoodOverride` 會因 cascade 一併清除。
2. **操作路徑與預期結果**（`e2e/food-correction.spec.ts`）：
   - 登入 → 送出 `e2e測試主食` → 結果顯示「精緻碳水」20 分，此時畫面上沒有選單 → 點擊該列的編輯圖示 → 選單出現 → 改選「蛋白質」→ 選單收合、分數變為 60，歷史清單第一筆分數同步更新。
   - 點擊編輯圖示後按 Esc 或點選單以外的區域 → 選單收合，類別與分數不變，未發出請求。
   - 選單展開前後，其他列與「建議」區塊的位置不變（比對 `boundingBox().y`），且最後一列的選單完整可見、未被裁切。
   - 再次送出 `e2e測試主食` → 直接顯示「蛋白質」60 分（覆寫生效）。
   - 送出 `e2e測試醬料`（m=0，分數顯示「—」，歷史清單無新增）→ 改選「蛋白質」→ 顯示 60 分，歷史清單新增一筆。
   - 送出後把唯一一項改選「其他」→ 分數顯示「—」，該筆自歷史清單移除。
   - 訪客（未登入）送出 → 看不到編輯圖示，顯示「登入後可修正分類」。
3. **單元測試（Vitest，supertest + mock Prisma，沿用 `server/__tests__/routes/auth.spec.ts` 模式）**：新增 `server/__tests__/routes/meals.spec.ts`
   - PATCH：無 token 401／紀錄非本人 403／紀錄或 sequenceIndex 不存在 404／type 非法 400／成功時更新 FoodItem、upsert 覆寫、回傳重算結果／改完全為 OTHER 時刪除紀錄並回傳 `record: null`。
   - POST：帶有效 token 時覆寫優先於 FoodDictionary 且不呼叫 AI／不帶 token 時不套用覆寫／帶無效 token 回 401。
   - `PUT /api/food-overrides`：401／400／成功 upsert。
   - `server/__tests__/middleware/validate.spec.ts` 補兩個新 schema 的合法與非法邊界。
4. **最終確認**：`npm run test`、`npm run build`、`npm run test:e2e` 全數通過；DB 中 `UserFoodOverride` 有對應資料列，`FoodDictionary` 內容未被使用者操作改動。

## 3. Spec 與架構設計

### 3.1 技術細節 / 邏輯設計

- **分類查詢（`server/services/ai.ts`）**：
  - 新增 `normalizeLabel(label)`：`label.normalize('NFKC').trim()`，統一全形／半形（大小寫由 MySQL 的 ci collation 處理）。
  - `getFoodType(label, userId?)`：正規化 → 若有 `userId` 先查 `userFoodOverride`（`userId_label` 唯一鍵）→ `FoodDictionary` → Claude。
  - 新增 `upsertFoodOverride(userId, label, type, tx?)`，供 PATCH 與 PUT 兩個端點共用。
- **選擇性驗證（`server/middleware/authMiddleware.ts`）**：新增 `optionalAuthMiddleware`——沒有 Authorization header 視為訪客放行；有 header 但無效則回 401（與 `authMiddleware` 相同）。
  - 原因：access token 僅 15 分鐘，若過期時靜默放行，登入者的覆寫會不生效且無從察覺；回 401 才能讓 `fetchWithAuth` 自動 refresh 後重試。
  - **行為變更**：`POST /api/meals` 原本一律放行，之後帶無效 token 會收到 401；訪客（不帶 token）不受影響。
- **覆寫套用條件**：只有 `req.user.userId === user.id`（由 email upsert 出來的使用者）時才把 `userId` 傳給 `getFoodType`。訪客只憑 email 不會套用任何人的覆寫。
- **共用計分函式（`server/routes/meals.ts`）**：把「類別序列 → `calculateMealScore` → 補 breakdown label」抽成小函式，POST 與 PATCH 共用。**評分演算法本身不變更**，無前後端同步問題。
- **PATCH 流程**（`prisma.$transaction` 內）：
  1. 取紀錄含 foodItems；不存在 404、`userId` 不符 403、該 index 無項目 404
  2. 更新該 `FoodItem.type`
  3. `upsertFoodOverride(userId, item.label, type)`
  4. 以新序列重算
  5. `totalScore === null`（全為 OTHER）→ 刪除紀錄（`MealRecord.totalScore` 為非 null `Int`，與 POST 的 m=0 不寫入行為一致）；否則更新 `totalScore`、`tips`
- **m=0 情境**：原本沒有紀錄可 PATCH，前端改呼叫 `PUT /api/food-overrides` 存覆寫，再以相同食物重送 `POST /api/meals`，走既有流程建立紀錄。
- **Rate Limiting**：PATCH 與 PUT 皆 `windowMs: 60*1000, max: 20`，沿用 `server/routes/auth.ts` 的 `skip`（`NODE_ENV !== 'production' && RATE_LIMIT_DISABLED === 'true'`）。
- **Zod schema（`server/schemas/meals.schemas.ts`）**：`UpdateFoodTypeSchema = { type: z.nativeEnum(FoodType) }`、`UpsertFoodOverrideSchema = { label: z.string().trim().min(1).max(100), type }`。
- **前端**：
  - `src/types/index.ts`：新增 `BackendFoodType` 聯集、`IFoodTypeCorrectionResponse { record: IMealRecord | null; analysis: IScoringResult }`。
  - 新增 `src/components/FoodTypeEditor.vue`：純 UI 組件，props `type`／`disabled`，emit `change(type)`。
    - 預設狀態：顯示類別文字＋一個小的鉛筆圖示按鈕（inline SVG，`aria-label="修改分類"`），版面與現在幾乎相同。
    - 點擊圖示：以**浮層下拉選單（dropdown popover）**顯示五個類別（`role="listbox"`，目前類別標示為已選）；同一時間只會有一列展開。
    - 浮層定位：組件根元素 `position: relative`，選單 `position: absolute; top: 100%; right: 0; z-index: 10`，脫離文件流，**不推擠其他列或下方的建議區塊**，直接蓋在上面；加上背景色、邊框與陰影以便與底下內容區隔。
    - `HomeView.vue` 的 `.breakdown` 目前有 `overflow: hidden`（用來裁切圓角），會把超出範圍的浮層切掉；需移除，改由第一列／最後一列各自設定圓角。
    - 選取不同類別 → emit `change` 並收合；選取相同類別、按 Esc、點擊組件以外區域 → 僅收合，不發請求。
    - `disabled`（重算中）時圖示不可點。
  - `src/views/HomeView.vue`：新增 `currentRecordId`、`lastSubmittedFoods`、`isCorrecting`；把 `handleSubmit` 的送出邏輯抽成 `submitFoods(foods)` 以便重送；新增 `handleTypeChange(slot, type)`——有 `currentRecordId` 走 PATCH，否則走 PUT + 重送。以 `editingSlot` 控制目前展開的是哪一列。過程中停用所有編輯圖示並顯示「重新計算中…」（Loading State），失敗時還原選項並顯示錯誤，成功後更新 `scoreResult` 並呼叫既有 `animateScore`。
  - `src/stores/history.ts`：新增 `updateRecord(record)`、`removeRecord(id)`，維持樂觀更新、不重新拉取。
  - 關鍵元素補 `data-testid`：`food-type-edit-{slot}`（圖示按鈕）、`food-type-option-{slot}-{type}`（選單選項）、`correction-loading`、`correction-error`、`guest-correction-hint`。

### 3.2 路由與 API 端點

- **API 端點**：
  - `PATCH /api/meals/:recordId/items/:sequenceIndex`（新增；`authMiddleware` + rate limit + `validate(UpdateFoodTypeSchema)`）：修正單一食物類別，回傳 `{ record: MealRecord | null, analysis: IScoringResult }`。
  - `PUT /api/food-overrides`（新增；`authMiddleware` + rate limit + `validate(UpsertFoodOverrideSchema)`）：upsert 個人覆寫，回傳 `{ override }`。新檔 `server/routes/foodOverrides.ts`，於 `server/app.ts` 掛載。
  - `POST /api/meals`（修改）：加上 `optionalAuthMiddleware`，登入者套用個人覆寫。
- **頁面路由**：無新增，功能位於既有首頁（`HomeView.vue`）評分結果區塊。

### 3.3 資料庫變動

新增 `UserFoodOverride`，`User` 加上 `foodOverrides UserFoodOverride[]` 關聯；以 `npx prisma migrate dev --name add_user_food_override` 產生 migration。

```prisma
model UserFoodOverride {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  label     String   @db.VarChar(100)
  type      FoodType
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, label]) // 同時作為高頻查詢 (userId, label) 的索引
}
```

`FoodDictionary`、`MealRecord`、`FoodItem` 結構不變。

## 4. 環境與設定 (.env)

- 無新增變數。
- `RATE_LIMIT_DISABLED=true`：僅跑 E2E 時加在啟動後端的指令前（既有機制，新端點沿用）。

## 5. Tasks

- [x] 0. 建立本計畫文件 `docs/plans/2026-10-10-food-type-user-override.md`。
- [x] 1. `prisma/schema.prisma`：新增 `UserFoodOverride` 與 `User.foodOverrides`，產生並套用 migration。
- [x] 2. `server/services/ai.ts`：`normalizeLabel`、`getFoodType(label, userId?)`、`upsertFoodOverride`。
- [x] 3. `server/middleware/authMiddleware.ts`：新增 `optionalAuthMiddleware`。
- [x] 4. `server/schemas/meals.schemas.ts`：新增 `UpdateFoodTypeSchema`、`UpsertFoodOverrideSchema`。
- [x] 5. `server/routes/meals.ts`：抽出共用計分函式；POST 套用覆寫；新增 PATCH 端點與 rate limiter。
- [x] 6. `server/routes/foodOverrides.ts` + `server/app.ts`：新增並掛載 `PUT /api/food-overrides`。
- [x] 7. Vitest：`server/__tests__/routes/meals.spec.ts`、補 `validate.spec.ts`。
- [x] 8. `src/types/index.ts`：新增型別；`src/stores/history.ts`：新增 `updateRecord`、`removeRecord`。
- [x] 9. 新增 `src/components/FoodTypeEditor.vue`（類別文字＋編輯圖示＋點擊展開的選單）。
- [x] 10. `src/views/HomeView.vue`：`submitFoods` 重構、`handleTypeChange`、Loading／錯誤狀態、訪客提示、`data-testid`。
- [x] 11. E2E：`e2e/testAccount.ts` 增加測試用 `FoodDictionary` 預置；撰寫 `e2e/food-correction.spec.ts`。
- [x] 12. 執行 `npm run test`、`npm run build`、`npm run test:e2e`。
- [x] 13. 文件同步：`CLAUDE.md`（AI 分類與快取、資料模型、端點）、`docs/API.md`、`docs/FEATURES.md`、`docs/ARCHITECTURE.md`、`docs/TESTING.md`、`docs/CHANGELOG.md`。
- [x] 14. 完成後將計畫移至 `docs/plans/archive/`。

## 6. 驗收結果

**測試結果**

- `npm run test`（Vitest）：**84 passed**（原 63，新增 21：`routes/meals.spec.ts` 17 項、`validate.spec.ts` 4 項）。
- `npm run build`（`vue-tsc -b` + `vite build`）：通過，含 `e2e/**/*.ts` 的型別檢查。
- `npx tsc --project tsconfig.server.json --noEmit`：通過。
- Playwright E2E：**13 passed**（`food-correction.spec.ts` 7 項 + 既有 `settings.spec.ts` 6 項），連續執行兩輪皆全數通過。
  - 這兩輪是對**另外啟動的暫時實例**執行（後端 3101 帶 `RATE_LIMIT_DISABLED=true`、前端 5174），因為當時開發用的後端（3100）沒有帶旁路，反覆驗證後已用完 `POST /api/meals` 的 10 req/min 與密碼端點的 5 req/15min。對 3100／5173 的單輪執行中，凡未受 429 影響的案例皆通過。
- 浮層測試的有效性：暫時把 `.breakdown { overflow: hidden }` 加回去後，「選單以浮層顯示」案例會失敗；還原後通過。
- 以實際瀏覽器截圖確認桌面（1280px）與手機（390px）寬度下選單皆蓋在下方元件上、未被裁切。

**資料庫**

- Migration `20261010035245_add_user_food_override` 已套用於本機資料庫。
- 執行 `prisma migrate dev` 時 `prisma generate` 回報 `EPERM`（引擎 DLL 被執行中的 `dev:server` 佔用，無法覆寫）；JS／型別已正常產生，引擎版本未變，不影響執行。日後若升級 Prisma 版本，需先停掉 dev server 再 generate。

**文件同步狀態**

- `CLAUDE.md`：新增「個人分類覆寫」段落、`optionalAuthMiddleware` 說明、資料模型、歷史紀錄 Store、E2E 注意事項。
- `docs/API.md`：新增 `PATCH /api/meals/:recordId/items/:sequenceIndex`、`PUT /api/food-overrides`；更新 `POST /api/meals` 的認證與錯誤碼。
- `docs/FEATURES.md`：新增「5.1 修正食物分類（個人覆寫）」。
- `docs/ARCHITECTURE.md`：目錄結構、資料模型、AI 分類流程（含 6.1 個人分類覆寫）、前端資料流。
- `docs/TESTING.md`：測試數量與新增情境。
- `docs/CHANGELOG.md`：新增 `[0.9.5] - 2026-10-10`。

## 7. 實作與計畫的差異

- **`normalizeLabel` 放在 `server/services/foodLabel.ts`**（原計畫寫 `ai.ts`）：Zod schema 也要用它檢查正規化後的長度，若放在 `ai.ts`，schema 會連帶載入 Prisma 與 Anthropic SDK。
- **`CreateMealSchema` 也加上正規化後的長度檢查**：NFKC 可能改變長度（全形空白變空字串、合字被展開），不檢查的話寫入 `VARCHAR(100)` 會出現 500。副作用是 `POST /api/meals` 對「只有全形空白」的食物名稱改回 400。
- **Zod 4 使用 `z.enum(FoodType)`**（原計畫寫 `z.nativeEnum`，在 Zod 4 已標示為過時）。
- **新增 `server/middleware/rateLimit.ts`**：`isRateLimitDisabled` 由 `auth.ts` 移出共用；`mealsRateLimit` 也加上旁路。原計畫只提到新端點沿用旁路，但修正分類的 E2E 一輪就送出 10 次 `POST /api/meals`，沒有旁路無法重跑。
- **PATCH 的讀取與權限檢查在 transaction 之外**，只有三個寫入在 transaction 內（原計畫寫整段都在 transaction 內）。404／403 可以直接回應，不必從 transaction callback 往外傳；寫入仍然是全有或全無。未加列鎖，同一筆紀錄的兩個並發修正理論上可能算出過期的分數，但前端在重算期間會停用所有編輯圖示。
- **`FoodTypeEditor` 自行管理展開狀態**，`HomeView` 沒有 `editingSlot`。「同一時間只開一個」由「點擊組件以外區域即收合」自然達成，不需要父層協調。
- **`FoodTypeEditor` 多了 `editable` prop**，訪客也用同一個組件顯示類別文字（不顯示圖示），因此 `HomeView` 不再需要自己的 `FOOD_TYPE_LABELS`。
- **「重新計算中…」顯示在分數卡的標題位置**（取代「本餐評分」），而非另起一行，避免文字出現／消失時推擠下方版面；重算期間同時停用送出按鈕。
- **額外的鍵盤操作**：Tab 離開選單會收合、方向鍵可在選項間移動、收合後焦點回到編輯圖示。
- **額外修正**：首頁送出失敗時讀取的是 `message` 欄位，但後端錯誤格式為 `{ error, details }`，導致 429 等錯誤只顯示籠統訊息；重構 `submitFoods` 時一併改為顯示後端訊息。
- **E2E**：
  - 版面位移改以「相對於分數卡的距離」比對，因為 `boundingBox()` 相對於視窗，Playwright 點擊前的自動捲動會被誤判為位移；也不能用 `window.scrollY`，`tsconfig.node.json` 不含 DOM 型別。
  - 「同一時間只開一個」改以第二口 → 第一口驗證：第二口的選單往下展開，會蓋住第三口的編輯圖示（浮層的預期行為），使用者需先收合才能點第三口。
  - 新增 `E2E_GUEST_EMAIL`（訪客流程）與 `removeE2EFoodDictionary()`（`globalTeardown` 清除測試食物）。

## 8. 不在本次範圍

- 覆寫管理頁面（列出／刪除自己的覆寫）。
- 統計多人一致的修正以回饋全域字典。
- `DELETE /api/food-dictionary` 目前任何登入者皆可清空全域快取，建議另案加上管理員限制。
- **既有問題：同一餐輸入兩個相同且尚未快取的食物會回 500**。`getFoodType` 以 `Promise.all` 平行分類，兩者都查不到快取、都呼叫 AI、都 `create`，第二筆撞上 `label` 唯一索引。與本次功能無關，未修改。
- **既有問題：≤480px 時明細列的「第一口」會斷成兩行**。`.slot-label` 固定 36px，加上全域 `letter-spacing` 後剛好超出。→ **已於歸檔後修正**（`width` 改為 `min-width`）。
- `CLAUDE.md` 的「開發前必須建立計畫」仍指向已更名的範本檔（現為 `docs/plans/_template.md`）。→ **已於歸檔後修正**（`docs/DEVELOPMENT.md` 的同一處引用一併更新）。
