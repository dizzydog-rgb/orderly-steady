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

## Meals 端點

### POST /api/meals

送出一次進食紀錄。系統透過 AI 自動分類食物種類，計算血糖穩定得分後寫入資料庫。

**認證需求**：無（以 `email` 識別使用者；若 email 不存在會自動建立未完整註冊的帳號）

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
| 400 | email 格式錯誤、foods 陣列為空、超過 3 項、食物名稱為空或超過 100 字 |
| 429 | 超過速率限制（10 次/分鐘） |
| 500 | AI 分類服務或資料庫錯誤 |

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

## Food Dictionary 端點

這兩個端點用於管理 AI 食物分類快取（`FoodDictionary` 資料表）。當 AI 分類出現錯誤結果時可用於清除快取，下次請求將重新呼叫 AI。

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
