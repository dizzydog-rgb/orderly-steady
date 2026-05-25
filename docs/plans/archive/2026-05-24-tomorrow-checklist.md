# 2026-05-24 換機開發清單

## 背景

今日完成 all_pair 評分演算法重構（詳見 `2026-05-24-all-pair-scoring-algorithm.md`），
所有變更已在本機套用但尚未提交 + 推送。

---

## 步驟一：本機（舊電腦，今天做完）

- [x] `git add -A && git commit -m "feat: all_pair 加權矩陣評分演算法重構"`
- [x] `git push origin master`

---

## 步驟二：新電腦環境準備

- [x] `git clone <repo-url>` 或 `git pull origin master`
- [x] `npm install`
- [x] 建立 `.env`，填入 `DATABASE_URL=mysql://root:<password>@localhost:3306/glucose_db`
- [x] `docker-compose up -d`（啟動 MySQL 容器）
- [x] `npx prisma migrate deploy`（套用 `remove_fooditem_scores` migration）

---

## 步驟三：驗證環境

- [x] `npm run test`（預期 20/20 通過）
- [x] `npm run build`（預期無型別錯誤）

---

## 注意事項

**步驟一是關鍵前提**：若沒有在舊電腦 commit + push，新電腦 git pull 不會取得任何變更。
