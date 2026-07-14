# 2026-06-21 歷史紀錄查詢優化：分頁 + 移除冗餘查詢 + FoodItem 複合索引

## 1. User Story

作為一個長期使用者，我希望歷史紀錄頁面在我累積大量資料後仍然能快速載入，不會因為資料量增長而變慢或造成後端記憶體壓力。

**核心變更**：
1. `GET /api/meals/:userId` 加入分頁（cursor-based），避免一次回傳所有紀錄
2. 移除 GET handler 內多餘的 `prisma.user.findUnique`（authMiddleware 已驗證）
3. FoodItem 新增複合索引 `(mealRecordId, sequenceIndex)`，消除 ORDER BY filesort

---

## 2. 測試流程驗證 (Test Flow)

### 問題一：分頁
1. **準備環境**：後端伺服器啟動，DB 有多筆測試資料
2. **操作路徑**：
   - 不帶 cursor 呼叫 `GET /api/meals/:userId` → 取得第一頁（最新 20 筆）
   - 用回傳的 `nextCursor` 再呼叫一次 → 取得第二頁
   - 直到 `nextCursor` 為 null 代表已到最後一頁
3. **預期結果**：每頁最多 20 筆，回傳結構含 `records` 與 `nextCursor`
4. **最終確認**：前端歷史紀錄頁面能正確顯示第一頁，捲動或點擊「載入更多」能繼續取得資料

### 問題二：移除冗餘查詢
1. 確認移除 `findUnique` 後，403 / 404 行為與原本一致
2. 使用不存在的 userId 呼叫 → 應回傳 403（authMiddleware 層就擋掉，不會到 findUnique）

### 問題三：複合索引
1. 執行 migration 後，用 `EXPLAIN SELECT` 確認 FoodItem 查詢不再出現 `Using filesort`

---

## 3. Spec 與架構設計

### 3.1 技術細節 / 邏輯設計

**分頁策略：Cursor-based（非 offset）**

選擇 cursor-based 而非 offset 的原因：
- Offset 在大資料量時需要 skip N 筆，資料庫仍須掃描前 N 筆，越翻越慢
- Cursor 以 `recordedAt + id` 作為定位點，每次都是從特定位置往後讀，複雜度穩定在 O(log N)

Cursor 設計：
- 回傳 `nextCursor`，值為最後一筆的 `recordedAt` ISO 字串（若有同秒紀錄，加 `id` 作為 tiebreaker）
- 下次請求帶 `?cursor=<nextCursor>`，後端解析後加入 `where` 條件

每頁筆數：預設 `PAGE_SIZE = 20`

**移除冗餘 findUnique**

原本用途是確認 user 存在，但：
- `authMiddleware` 已驗證 JWT，token 有效代表 user 在 DB 中存在（token 是 DB 寫入時簽發的）
- 第 89 行的 `req.user!.userId !== userId` 比對已防止越權存取
- 直接移除，節省一次 DB round-trip

**FoodItem 複合索引**

將現有 `@@index([mealRecordId])` 升級為 `@@index([mealRecordId, sequenceIndex])`：
- 最左前綴原則：仍涵蓋 `WHERE mealRecordId = ?` 的查詢
- `ORDER BY sequenceIndex` 不再需要 filesort

### 3.2 路由與 API 端點

**變更端點**：

`GET /api/meals/:userId?cursor=<ISO_STRING>&limit=<NUMBER>`

| 參數 | 型別 | 說明 |
|------|------|------|
| `cursor` | string（選填） | 上一頁最後一筆的 recordedAt ISO 字串；不帶則從最新開始 |
| `limit` | number（選填） | 每頁筆數，預設 20，最大 100 |

回傳格式：
```json
{
  "records": [...],
  "nextCursor": "2026-06-10T12:34:56.000Z" // null 代表已是最後一頁
}
```

**前端 historyStore 調整**：
- 新增 `nextCursor` 狀態
- 支援「載入更多」時帶 cursor 追加資料，不覆蓋現有紀錄

### 3.3 資料庫變動

- `FoodItem`：`@@index([mealRecordId])` → `@@index([mealRecordId, sequenceIndex])`
- 需執行 `prisma migrate dev`

---

## 4. 環境與設定 (.env)

無新增環境變數。

---

## 5. Tasks

- [ ] 1. 修改 `prisma/schema.prisma`：FoodItem 索引升級為 `(mealRecordId, sequenceIndex)`
- [ ] 2. 執行 `prisma migrate dev --name upgrade-fooditem-composite-index`
- [ ] 3. 更新 `server/routes/meals.ts`：移除冗餘 `findUnique`，加入 cursor-based 分頁邏輯
- [ ] 4. 更新 `src/stores/history.ts`：新增 `nextCursor` 狀態與「載入更多」動作
- [ ] 5. 更新前端歷史紀錄頁面：加入「載入更多」UI（首次載入自動觸發，後續手動或捲動觸發）
- [ ] 6. 更新 `src/types/index.ts`：補充分頁回傳型別
- [ ] 7. 執行 `npm run test` 確認現有測試通過，補充分頁相關測試
- [ ] 8. 更新 `CLAUDE.md`：紀錄分頁機制與索引變更

---

## 6. 驗收結果

- [ ] 歷史紀錄 API 每次只回傳指定筆數，`nextCursor` 正確指向下一頁
- [ ] 前端能連續載入多頁資料且不重複
- [ ] FoodItem 查詢 EXPLAIN 不再出現 `Using filesort`
- [ ] 所有測試通過
- [ ] CLAUDE.md 已同步更新
