# API 文件

## 概覽

| 項目 | 值 |
|------|---|
| 正式環境 Base URL | `https://orderly-steady.com/api` |
| 開發環境 Base URL | `http://localhost:3100/api` |
| 資料格式 | JSON（請求與回應均為 `application/json`） |
| 時間格式 | ISO 8601（`2025-01-15T08:30:00.000Z`） |

---

## 認證機制

本 API 採用 **JWT 雙令牌**架構：

| 令牌 | 存放位置 | 有效期 | 用途 |
|------|---------|--------|------|
| Access Token | 前端記憶體（Pinia） | 15 分鐘 | 請求時放於 `Authorization` header |
| Refresh Token | httpOnly Cookie（path: `/api/auth`） | 7 天 | 自動換發新 Access Token |

**受保護端點**需在 Header 加入：

```
Authorization: Bearer <accessToken>
```

**Refresh Token Cookie** 屬性：`httpOnly`、`secure`、`sameSite=none`，僅限 `/api/auth` 路徑自動附帶。

> 取得 Access Token 的流程：呼叫 `POST /api/auth/login` → 從回應取得 `accessToken` → 每次請求帶入 `Authorization: Bearer <accessToken>`；token 過期時呼叫 `POST /api/auth/refresh` 取得新 token（Cookie 自動附帶）。

---

## 錯誤格式

所有錯誤回應均為 JSON，包含 `error` 欄位：

```json
{ "error": "錯誤描述文字" }
```

| HTTP 狀態碼 | 常見原因 |
|------------|--------|
| 400 | 請求格式錯誤、缺少必要欄位 |
| 401 | 未登入、Token 無效或過期 |
| 403 | 無權存取此資源（如存取他人資料） |
| 404 | 資源不存在 |
| 409 | 資源衝突（如 email 已被註冊） |
| 429 | 請求頻率超過限制 |
| 500 | 伺服器內部錯誤 |

---

## Auth 端點

### POST /api/auth/register

建立帳號。若該 email 已存在且尚未設定密碼（由 `POST /api/meals` 自動建立的帳號），則補全密碼完成註冊。

**認證需求**：無

**Request Body**

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| email | string | 是 | 有效 email 格式 |
| password | string | 是 | 至少 8 個字元 |
| name | string | 否 | 最多 50 個字元 |

```json
{
  "email": "user@example.com",
  "password": "mypassword123",
  "name": "小明"
}
```

**成功回應** `201 Created`

```json
{
  "message": "註冊成功",
  "user": {
    "id": "clxyz123abc",
    "email": "user@example.com",
    "name": "小明"
  }
}
```

**錯誤回應**

| 狀態碼 | 說明 |
|--------|------|
| 400 | email 格式錯誤、密碼少於 8 字元、名稱超過 50 字 |
| 409 | 該 email 已被完整註冊（`password` 已設定） |

---

### POST /api/auth/login

登入並取得 Access Token。成功後同時在 Cookie 設定 Refresh Token。

**認證需求**：無

**Request Body**

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| email | string | 是 | 有效 email 格式 |
| password | string | 是 | 帳號密碼 |

```json
{
  "email": "user@example.com",
  "password": "mypassword123"
}
```

**成功回應** `200 OK`

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "clxyz123abc",
    "email": "user@example.com",
    "name": "小明"
  }
}
```

同時設定 `Set-Cookie: refreshToken=<token>; HttpOnly; Secure; SameSite=None; Path=/api/auth; Max-Age=604800`

**錯誤回應**

| 狀態碼 | 說明 |
|--------|------|
| 400 | 欄位驗證失敗 |
| 401 | 帳號或密碼錯誤（帳號不存在、尚未設定密碼、密碼錯誤均回傳相同訊息） |

---

### POST /api/auth/refresh

以 Refresh Token Cookie 換發新的 Access Token 與 Refresh Token（旋轉策略，舊 Refresh Token 同時失效）。

**認證需求**：httpOnly Cookie（`refreshToken`）

**Request Body**：無

**成功回應** `200 OK`

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

同時更新 `refreshToken` Cookie。

**錯誤回應**

| 狀態碼 | 說明 |
|--------|------|
| 400 | Cookie 中無 `refreshToken` |
| 401 | Refresh Token 無效、已過期或不在資料庫中 |

---

### POST /api/auth/logout

登出並撤銷當前裝置的 Refresh Token（不影響其他裝置的登入狀態）。

**認證需求**：`Authorization: Bearer <accessToken>`

**Request Body**：無

**成功回應** `200 OK`

```json
{
  "message": "已登出"
}
```

同時清除 `refreshToken` Cookie。

---

### GET /api/auth/me

取得目前登入使用者的基本資訊。

**認證需求**：`Authorization: Bearer <accessToken>`

**成功回應** `200 OK`

```json
{
  "user": {
    "id": "clxyz123abc",
    "email": "user@example.com",
    "name": "小明"
  }
}
```

**錯誤回應**

| 狀態碼 | 說明 |
|--------|------|
| 401 | Token 無效或過期 |
| 404 | 使用者不存在（帳號已被刪除等極端情況） |

---

### PATCH /api/auth/me

變更目前登入使用者的名稱（暱稱）。Email 為帳號識別碼，不提供變更。

**認證需求**：`Authorization: Bearer <accessToken>`

**速率限制**：10 req / 5 min

**請求 Body**

```json
{ "name": "小明" }
```

| 欄位 | 型別 | 必填 | 規則 |
|------|------|------|------|
| name | string | 是 | trim 後 1–50 字；不可為空字串或純空白 |

**成功回應** `200 OK`

```json
{
  "message": "名稱已更新",
  "user": { "id": "clxyz123abc", "email": "user@example.com", "name": "小明" }
}
```

**錯誤回應**

| 狀態碼 | 說明 |
|--------|------|
| 400 | 名稱為空、純空白或超過 50 字（`details[].field = "name"`） |
| 401 | Token 無效或過期 |
| 429 | 請求過於頻繁 |

---

### PATCH /api/auth/password

變更密碼。需驗證目前密碼；成功後會撤銷該使用者**所有裝置**的 refresh token 並清除 cookie，前端須重新登入。

**認證需求**：`Authorization: Bearer <accessToken>`

**速率限制**：5 req / 15 min（與登入同等風險等級，防止以竊得的 access token 暴力猜測原密碼）

**請求 Body**

```json
{ "currentPassword": "oldpassword123", "newPassword": "newpassword456" }
```

| 欄位 | 型別 | 必填 | 規則 |
|------|------|------|------|
| currentPassword | string | 是 | 非空 |
| newPassword | string | 是 | 8–100 字，且不得與 currentPassword 相同 |

**成功回應** `200 OK`

```json
{ "message": "密碼已更新，請重新登入" }
```

同時回傳 `Set-Cookie` 清除 `refreshToken`。

**錯誤回應**

| 狀態碼 | 說明 |
|--------|------|
| 400 | 格式錯誤、新舊密碼相同、**目前密碼不正確**、或帳號尚未設定密碼（meals endpoint 自動建立） |
| 401 | Token 無效或過期（僅 authMiddleware 產生） |
| 404 | 使用者不存在 |
| 429 | 請求過於頻繁 |

> 「目前密碼不正確」刻意回 **400 而非 401**：前端 `fetchWithAuth` 會把任何 401 當成 access token 過期而觸發 refresh/強制登出，使用者只是打錯密碼不應被登出。

---

## Meals 端點

### POST /api/meals

送出一次進食紀錄。系統透過 AI 自動分類食物種類，計算血糖穩定得分後寫入資料庫。

**認證需求**：選擇性（以 `email` 識別使用者；若 email 不存在會自動建立未完整註冊的帳號）

- **不帶 `Authorization` header**：視為訪客，分類只查全域 `FoodDictionary` 與 AI。
- **帶有效 Token，且 Token 的使用者即為此 `email`**：優先套用該使用者的[個人分類覆寫](#food-overrides-端點)。
- **帶了 Token 但無效或過期**：回 `401`（不會被當成訪客），讓前端 refresh 後重試。

**分類查詢順序**：個人覆寫（僅登入者）→ 全域 `FoodDictionary` 快取 → Claude API。食物名稱會先正規化（NFKC + trim，全形／半形視為相同）再查詢。

**速率限制**：每分鐘最多 10 次請求（超過回 `429`）

**Request Body**

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| email | string | 是 | 使用者 email |
| foods | string[] | 是 | 食物名稱陣列，1–3 項，每項 1–100 字元 |

```json
{
  "email": "user@example.com",
  "foods": ["生菜沙拉", "雞胸肉", "白飯"]
}
```

**成功回應（有可評分食物）** `201 Created`

```json
{
  "message": "Meal record created successfully",
  "record": {
    "id": "clxyz456def",
    "userId": "clxyz123abc",
    "totalScore": 78,
    "tips": ["先吃蔬菜有助於減緩血糖上升"],
    "recordedAt": "2025-06-24T08:30:00.000Z",
    "createdAt": "2025-06-24T08:30:01.000Z",
    "updatedAt": "2025-06-24T08:30:01.000Z",
    "foodItems": [
      { "id": "fi001", "type": "FIBER",        "label": "生菜沙拉", "sequenceIndex": 0 },
      { "id": "fi002", "type": "PROTEIN",      "label": "雞胸肉",   "sequenceIndex": 1 },
      { "id": "fi003", "type": "COMPLEX_CARB", "label": "白飯",     "sequenceIndex": 2 }
    ]
  },
  "analysis": {
    "totalScore": 78,
    "tips": ["先吃蔬菜有助於減緩血糖上升"],
    "breakdown": [
      { "type": "FIBER",        "score": null, "label": "生菜沙拉" },
      { "type": "PROTEIN",      "score": null, "label": "雞胸肉" },
      { "type": "COMPLEX_CARB", "score": null, "label": "白飯" }
    ]
  }
}
```

**成功回應（全部食物為 OTHER，無法評分）** `200 OK`

當所有食物均被分類為 `OTHER`（無法判斷種類），`totalScore` 為 `null`，**不寫入資料庫**，僅回傳分析結果：

```json
{
  "analysis": {
    "totalScore": null,
    "tips": null,
    "breakdown": [
      { "type": "OTHER", "score": null, "label": "神秘食物" }
    ]
  }
}
```

**錯誤回應**

| 狀態碼 | 說明 |
|--------|------|
| 400 | email 格式錯誤、foods 陣列為空、超過 3 項、食物名稱為空（含正規化後為空，例如只有全形空白）或超過 100 字 |
| 401 | 帶了 `Authorization` header 但 Token 無效或過期 |
| 429 | 超過速率限制（10 次/分鐘） |
| 500 | AI 分類服務或資料庫錯誤 |

---

### PATCH /api/meals/:recordId/items/:sequenceIndex

修正某筆進食紀錄中單一食物的類別。在同一個 transaction 內完成三件事：更新該食物的類別、寫入使用者的[個人分類覆寫](#food-overrides-端點)、重算該餐分數與建議。**只能修改自己的紀錄。**

**認證需求**：`Authorization: Bearer <accessToken>`

**速率限制**：每分鐘最多 20 次請求（與 `PUT /api/food-overrides` 共用額度）

**路徑參數**

| 參數 | 說明 |
|------|------|
| recordId | 進食紀錄 ID |
| sequenceIndex | 食物的進食順序，從 0 開始（第一口為 0） |

**Request Body**

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| type | string | 是 | [FoodType 枚舉值](#foodtype-枚舉值)之一 |

```json
{ "type": "PROTEIN" }
```

**成功回應** `200 OK`

`record` 為更新後的完整紀錄（格式同 `POST /api/meals`），`analysis` 為重算後的評分結果。

```json
{
  "record": {
    "id": "clxyz456def",
    "userId": "clxyz123abc",
    "totalScore": 60,
    "tips": ["請加入膳食纖維、複合碳水以達到飲食均衡。"],
    "recordedAt": "2025-06-24T08:30:00.000Z",
    "createdAt": "2025-06-24T08:30:01.000Z",
    "updatedAt": "2025-06-24T08:31:12.000Z",
    "foodItems": [
      { "id": "fi001", "type": "PROTEIN", "label": "雞胸肉", "sequenceIndex": 0 }
    ]
  },
  "analysis": {
    "totalScore": 60,
    "scorableCount": 1,
    "tips": ["請加入膳食纖維、複合碳水以達到飲食均衡。"],
    "breakdown": [
      { "slot": 1, "label": "雞胸肉", "type": "PROTEIN", "isOther": false }
    ]
  }
}
```

**修正後全部食物皆為 OTHER** `200 OK`

無法計分時比照 `POST /api/meals` 不保留紀錄：**該筆紀錄會被刪除**，`record` 為 `null`。個人覆寫仍會寫入。

```json
{
  "record": null,
  "analysis": {
    "totalScore": null,
    "scorableCount": 0,
    "tips": ["未記錄任何可評分食物"],
    "breakdown": [
      { "slot": 1, "label": "神秘食物", "type": "OTHER", "isOther": true }
    ]
  }
}
```

**錯誤回應**

| 狀態碼 | 說明 |
|--------|------|
| 400 | `type` 不是合法的 FoodType |
| 401 | Token 無效或過期 |
| 403 | 該筆紀錄不屬於登入帳號（不會寫入任何資料） |
| 404 | 紀錄不存在，或該 `sequenceIndex` 沒有食物 |
| 429 | 超過速率限制（20 次/分鐘） |

---

### GET /api/meals/:userId

取得指定使用者的所有進食歷史紀錄，按時間由新至舊排序。**只能查詢自己的資料。**

**認證需求**：`Authorization: Bearer <accessToken>`

**路徑參數**

| 參數 | 說明 |
|------|------|
| userId | 使用者 ID（須與 Token 中的 userId 相符） |

**成功回應** `200 OK`

```json
{
  "records": [
    {
      "id": "clxyz456def",
      "userId": "clxyz123abc",
      "totalScore": 78,
      "tips": ["先吃蔬菜有助於減緩血糖上升"],
      "recordedAt": "2025-06-24T08:30:00.000Z",
      "createdAt": "2025-06-24T08:30:01.000Z",
      "updatedAt": "2025-06-24T08:30:01.000Z",
      "foodItems": [
        { "id": "fi001", "type": "FIBER",        "label": "生菜沙拉", "sequenceIndex": 0 },
        { "id": "fi002", "type": "PROTEIN",      "label": "雞胸肉",   "sequenceIndex": 1 },
        { "id": "fi003", "type": "COMPLEX_CARB", "label": "白飯",     "sequenceIndex": 2 }
      ]
    }
  ]
}
```

**錯誤回應**

| 狀態碼 | 說明 |
|--------|------|
| 401 | Token 無效或過期 |
| 403 | `userId` 與登入帳號不符 |
| 404 | 使用者不存在 |

---

## Food Overrides 端點

個人分類覆寫（`UserFoodOverride` 資料表）讓使用者自行決定某個食物的類別。覆寫**只影響該使用者自己**，優先於全域 `FoodDictionary`；不同使用者可以把同一食物設成不同類別，互不影響，全域字典也不會被使用者操作改動。

覆寫只套用在**之後**送出的餐點，不會回溯重算過去的紀錄。

### PUT /api/food-overrides

新增或更新目前使用者對某食物的分類（同一食物重複呼叫會覆蓋先前的設定）。

一般情況下修正分類應使用 `PATCH /api/meals/:recordId/items/:sequenceIndex`（會同時寫入覆寫並重算當餐）。本端點用於**當餐全為 OTHER、沒有紀錄可修改**的情況：先存覆寫，再以相同食物重送 `POST /api/meals` 建立紀錄。

**認證需求**：`Authorization: Bearer <accessToken>`

**速率限制**：每分鐘最多 20 次請求（與 `PATCH /api/meals/:recordId/items/:sequenceIndex` 共用額度）

**Request Body**

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| label | string | 是 | 食物名稱，1–100 字元；儲存前會正規化（NFKC + trim） |
| type | string | 是 | [FoodType 枚舉值](#foodtype-枚舉值)之一 |

```json
{ "label": "雞胸肉", "type": "PROTEIN" }
```

**成功回應** `200 OK`

```json
{
  "override": { "label": "雞胸肉", "type": "PROTEIN" }
}
```

**錯誤回應**

| 狀態碼 | 說明 |
|--------|------|
| 400 | `label` 為空（含正規化後為空）或超過 100 字、`type` 不是合法的 FoodType |
| 401 | Token 無效或過期 |
| 429 | 超過速率限制（20 次/分鐘） |

---

## Food Dictionary 端點

這兩個端點用於管理 AI 食物分類快取（`FoodDictionary` 資料表）。當 AI 分類出現錯誤結果時可用於清除快取，下次請求將重新呼叫 AI。

> 這是**全域**快取，影響所有使用者。使用者想修正自己看到的分類，應使用上方的個人分類覆寫。

### DELETE /api/food-dictionary

清除**所有** AI 分類快取記錄。

**認證需求**：`Authorization: Bearer <accessToken>`

**Request Body**：無

**成功回應** `200 OK`

```json
{
  "message": "已清除 42 筆快取"
}
```

---

### DELETE /api/food-dictionary/:label

清除**單筆**食物標籤的 AI 分類快取。

**認證需求**：`Authorization: Bearer <accessToken>`

**路徑參數**

| 參數 | 說明 |
|------|------|
| label | 食物名稱（需與快取中的 label 完全相符） |

**成功回應** `200 OK`

```json
{
  "message": "已清除 \"白飯\" 的快取"
}
```

**錯誤回應**

| 狀態碼 | 說明 |
|--------|------|
| 401 | Token 無效或過期 |
| 404 | 找不到該食物標籤的快取記錄 |

---

## 健康檢查

### GET /health

確認伺服器是否正常運作。

**認證需求**：無

**成功回應** `200 OK`

```json
{
  "status": "ok"
}
```

---

## 附錄

### FoodType 枚舉值

AI 分類服務將食物分類為以下五種類型：

| 值 | 說明 | 範例 |
|----|------|------|
| `FIBER` | 膳食纖維 | 生菜、花椰菜、菠菜 |
| `PROTEIN` | 蛋白質 | 雞胸肉、雞蛋、豆腐 |
| `COMPLEX_CARB` | 複合碳水 | 白飯、麵條、地瓜 |
| `SIMPLE_CARB` | 簡單碳水 | 糖果、含糖飲料、白麵包 |
| `OTHER` | 無法分類 | 水、調味料等無明顯營養成分 |

### 評分邏輯摘要

系統依食物**進食順序**計算血糖穩定得分（0–100 分）：

- **最佳順序**：FIBER → PROTEIN → COMPLEX_CARB（先吃蔬菜再吃蛋白質最後吃澱粉）
- **全部為 OTHER**：`totalScore: null`，不寫入資料庫
- **單一可評分食物**：SIMPLE_CARB → 20 分；其他 → 60 分
- **兩項以上**：雙重迴圈計算所有配對的加權分數，相鄰食物權重 ×1.5，跨越食物 ×1.0；SIMPLE_CARB 在第 0 或第 1 位置各扣 10 分
