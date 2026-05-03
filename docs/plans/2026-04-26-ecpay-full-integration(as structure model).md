# 2026-04-26 ECPay 本地金流整合與導轉流程優化

## 1. User Story
本專案為一個基於 Node.js/Express 的花店電子商務平台（Flower Shop）。作為專案開發者，我需要在本地環境完成可用的金流流程。由於本專案僅在本地端執行，無法穩定接收綠界 Server Notify（ReturnURL），因此付款結果不能以 callback 作為唯一依據，必須改由本地端主動呼叫 QueryTradeInfo API 驗證。

**核心變更**：將原有的「模擬付款成功/失敗」按鈕移除，全面升級為「點擊後導轉至綠界金流正式支付頁面」，並在付款完成後自動驗證結果，以確保訂單狀態與資料庫同步。

## 2. 測試流程驗證 (Test Flow)
1. **啟動伺服器**: `npm run dev:server` (確保 `.env` 已設定 `JWT_SECRET` 與 `ECPAY` 相關參數)。
2. **下單流程**: 登入 -> 將商品加入購物車 -> 點擊結帳 -> 填寫收件資訊並送出。
3. **金流導轉**: 
   - 訂單建立後，系統自動導向 `/orders/:id/pay`。
   - 該頁面顯示「正在導轉至綠界金流...」與 Spinner 動畫。
   - 數秒後，前端提交隱藏表單至綠界 AIO 付款頁。
4. **模擬付款**: 
   - 使用測試信用卡 `4311-9522-2222-2222`，CVV `222`，3DS `1234`。
   - 完成付款後，點擊「回到商店」，系統導回 `/ecpay/result` (ClientBackURL)。
5. **結果驗證**:
   - `/ecpay/result` 頁面顯示「正在驗證付款結果...」並自動呼叫 `verify` API。
   - 查詢完成後，自動跳轉至 `/orders/:id?payment=success`。
6. **最終確認**:
   - 訂單詳情頁顯示「付款成功」提示，訂單狀態標籤更新為「已付款」。

## 3. Spec 與架構設計

### 3.1 後端設計 (ECPay Service)
- **`ecpayUrlEncode`**: 嚴格遵循 Node.js 編碼規範（空格轉 `+`、`~` 轉 `%7E`、還原 `.NET` 字元）。
- **`generateCheckMacValue`**: SHA256 加密簽章。
- **`buildAioCheckoutData`**: 
  - `MerchantTradeDate`: 使用 UTC+8 台灣時間。
  - `TotalAmount`: 強制整數字串。
  - `TradeDesc`: 避免重複編碼。
  - `ClientBackURL`: 指向 `/ecpay/result`。
- **`queryTradeInfo`**: 呼叫綠界 V5 查詢介面。

### 3.2 新增路由與頁面
- **API 端點**:
  - `POST /api/orders/:id/ecpay/checkout-data` (取得加密參數)
  - `POST /api/orders/:id/ecpay/verify` (執行 QueryTradeInfo)
  - `POST /api/orders/ecpay/notify` (相容 ReturnURL)
- **頁面路由**:
  - `GET /orders/:id/pay` (導轉中介頁)
  - `GET /ecpay/result` (結果驗證頁)

### 3.3 資料庫變動
- `orders` 表新增 `ecpay_merchant_trade_no` 欄位以記錄綠界交易編號。

## 4. 環境與設定 (.env)
- `ECPAY_MERCHANT_ID=3002607`
- `ECPAY_HASH_KEY=pwFHCqoQZGmho4w6`
- `ECPAY_HASH_IV=EkRm7iFT261dpevs`
- `ECPAY_URL=https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5`
- `ECPAY_QUERY_URL=https://payment-stage.ecpay.com.tw/Cashier/QueryTradeInfo/V5`
- `BASE_URL=http://localhost:3000`

## 5. Tasks (已完成)
- [x] 1. 建立 `src/services/ecpayService.js` (含簽章、時區處理、主動查詢)。
- [x] 2. 實作 `orderRoutes.js` 中的金流相關 API 端點。
- [x] 3. 在 `src/database.js` 實作 `ecpay_merchant_trade_no` 欄位遷移邏輯。
- [x] 4. 新增 `payment-redirect` 與 `payment-result` 的 EJS 視圖與 JS 邏輯。
- [x] 5. 修改 `checkout.js` 結帳後的跳轉邏輯。
- [x] 6. 更新 `order-detail.js` 與 `order-detail.ejs` 移除模擬按鈕，改為導轉邏輯。
- [x] 7. 撰寫 `tests/ecpay.test.js` 進行單元與整合測試。
- [x] 8. 同步更新 `docs/FEATURES.md`, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/TESTING.md`, `docs/CHANGELOG.md`。

## 6. 驗收結果
- 已完成所有開發任務並通過 36 項自動化測試。
- 金流主流程已由「模擬按鈕」成功轉化為「綠界實體導轉 + 中介頁面自動查詢驗證」。
