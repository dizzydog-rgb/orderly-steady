# 2026-05-24 換機開發清單

## 背景

今日完成 all_pair 評分演算法重構（詳見 `2026-05-24-all-pair-scoring-algorithm.md`），
所有變更已在本機套用但尚未提交 + 推送。

---

## 步驟一：本機（舊電腦，今天做完）

- [ ] `git add -A && git commit -m "feat: all_pair 加權矩陣評分演算法重構"`
- [ ] `git push origin master`

---

## 步驟二：新電腦環境準備

- [ ] `git clone <repo-url>` 或 `git pull origin master`
- [ ] `npm install`
- [ ] 建立 `.env`，填入 `DATABASE_URL=mysql://root:<password>@localhost:3306/glucose_db`
- [ ] `docker-compose up -d`（啟動 MySQL 容器）
- [ ] `npx prisma migrate deploy`（套用 `remove_fooditem_scores` migration）

---

## 步驟三：驗證環境

- [ ] `npm run test`（預期 20/20 通過）
- [ ] `npm run build`（預期無型別錯誤）

---

## 步驟四：端對端驗收（Task 13）

同時啟動前後端：

```bash
npm run dev          # 前端 Vite
npm run dev:server   # 後端 Express
```

逐一測試（依 `2026-05-24-all-pair-scoring-algorithm.md` §2）：

| # | 輸入 | 預期 totalScore |
|---|------|----------------|
| 1 | 菠菜→雞蛋→精緻糖 (F→P→SC) | ≥ 85（計算值 91） |
| 2 | 珍珠奶茶→雞腿→菠菜 (SC→P→F) | ≤ 15（計算值 6） |
| 3 | 優格→珍珠奶茶→其他 (P→SC) | 80 |
| 4 | 菠菜→雞蛋 (F→P) | 100 |
| 5 | 珍珠奶茶→其他→其他 (SC 單獨) | 20 |
| 6 | 菠菜→其他→其他 (F 單獨) | 60 |
| 7 | 雞蛋→其他→其他 (P 單獨) | 60 |
| 8 | 糙米→其他→其他 (CC 單獨) | 60 |
| 9 | 其他→其他→其他 | null（顯示 —，不寫入 DB） |

---

## 注意事項

**步驟一是關鍵前提**：若沒有在舊電腦 commit + push，新電腦 git pull 不會取得任何變更。
