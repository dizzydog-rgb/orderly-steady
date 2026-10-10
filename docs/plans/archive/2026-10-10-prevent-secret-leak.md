# [2026-10-10] 防止機密（遠端資料庫連線字串）被上傳到 GitHub

## 1. User Story

作為這個專案的開發者，我希望遠端 MySQL（Railway）的連線字串與其他機密永遠不會被 commit 或 push 到 GitHub，而且這件事由工具自動把關，不必靠我每次記得檢查。

**背景與調查結果（2026-10-10，唯讀檢查）**：

- `.claude/settings.json`（**有被 git 追蹤**）的未提交修改中，有一條權限規則是完整指令 `DATABASE_URL="mysql://root:<密碼>@…rlwy.net:…/railway" npx tsx prisma/seedDemo.ts`，含 root 密碼。
- 這組字串**從未進過任何 commit**：`git log --all -S"rlwy.net"` 在所有本機分支、遠端追蹤分支與 stash 上皆無結果；工作目錄中也只有這一個檔案含有它。
- `.env` 已被忽略且從未被 commit。`.env.production` 有被追蹤，但只含 `VITE_API_URL`（會打包進前端，非機密）。
- 被追蹤檔案中現有的 10 處帶帳密連線字串全部指向 `localhost`（範例、CI、Dockerfile 的假值）。
- 專案沒有任何 git hook，CI 也沒有機密掃描。
- **根本原因**：把密碼寫在指令列（`DATABASE_URL="…" <指令>`）。該指令被加入允許清單時，全文連同密碼被存進設定檔。
- 這組密碼已在本次 Claude Code 對話的工具輸出中完整出現過（對話紀錄存於本機，也已傳送至模型 API），不能再視為未外流。

**已與使用者確認的決策**：

| 項目 | 決定 |
|------|------|
| 防護範圍 | 完整防護：清除 + 改流程 + pre-commit／pre-push 掃描 + CI 掃描 + CLAUDE.md 規則 |
| `.claude/settings.json` 其他 9 條未提交規則 | 只刪含密碼的那一行，其餘維持未提交狀態，由使用者自行處理 |

**核心變更**：

- 從 `.claude/settings.json` 移除含密碼的規則。
- 遠端連線字串改放在被忽略的 `.env.railway.local`，以 `tsx --env-file=` 載入，指令列不再出現密碼。
- 新增不需額外套件的機密掃描腳本，掛在 **pre-commit**（擋 commit）與 **pre-push**（擋上傳，逐一檢查所有即將推送的 commit）兩個 hook，CI 也跑同一個掃描作為最後防線。
- 在 `CLAUDE.md` 加上「機密不得出現在指令列或被追蹤的檔案」規則，避免之後的 AI 工作階段再產生內嵌密碼的指令。

## 2. 測試流程驗證 (Test Flow)

1. **準備環境**：Node ≥ 23.6（本機為 v24.14.1，可直接執行 `.ts`）；執行一次 `npm run hooks:install` 啟用 hook。
2. **單元測試**（`scripts/__tests__/check-secrets.spec.ts`，Vitest；假機密一律以字串串接組成，避免測試檔自己被掃到）：
   - 攔截：非 localhost 且帶帳密的連線字串。
   - 攔截：**本次事件的實際形狀**——包在 JSON 權限規則裡、引號被跳脫的 `Bash(DATABASE_URL=\"mysql://…\" npx tsx …)`。
   - 攔截：`sk-ant-` 開頭的 Anthropic 金鑰、`-----BEGIN … PRIVATE KEY-----`。
   - 放行：`localhost`／`127.0.0.1` 的連線字串；密碼為佔位符（`${VAR}`、`<password>`、`***`、`...`）。
   - 放行：行內含 `secret-scan:allow` 標記。
   - 檔名防護：新增 `.env`、`.env.railway` 會被擋；`.env.example`、`.env.production` 放行。
   - 輸出遮蔽：回報內容中不得出現密碼本身（CI log 可能是公開的）。
3. **整個專案零誤判**：`npm run check:secrets`（掃描所有被追蹤檔案）回報 0 筆。
4. **pre-commit 實測**：在專案內建立暫存檔，內容為假的遠端連線字串 → `git add` → `git commit` 應被拒絕並顯示檔名、行號與遮蔽後的內容；之後取消暫存並刪除該檔。
5. **pre-push 實測**：以 `git commit --no-verify` 在暫時分支提交一個含假機密的 commit，再提交一個把它刪掉的 commit → 直接執行 `.githooks/pre-push`（以 stdin 餵入 ref 資訊，不實際 push）應被拒絕，確認「中途加入又刪除」的機密也攔得到；之後刪除暫時分支。
6. **確認已清除**：
   - 工作目錄（排除 `node_modules`、`.git`）搜尋 `rlwy.net`，只應出現在被忽略的 `.env.railway.local`。
   - `git log --all -S"rlwy.net"` 仍為空。
   - `git check-ignore -v .env.railway.local` 顯示被 `*.local` 規則忽略。
7. **遠端 seed 流程**（使用者建立 `.env.railway.local` 後）：以下指令只印出主機名稱、不印密碼，確認載入的是遠端設定而不是 `.env` 的本機設定：
   `npx tsx --env-file=.env.railway.local -e "console.log(new URL(process.env.DATABASE_URL).host)"`
8. **最終確認**：`npm run test`、`npm run build` 通過；上述 3–6 全部符合預期。

## 3. Spec 與架構設計

### 3.1 技術細節 / 邏輯設計

- **移除機密（最先執行）**：刪除 `.claude/settings.json` 中含 `DATABASE_URL=` 的那條規則，並修正前一行的結尾逗號。其餘 9 條規則不動。
- **掃描腳本 `scripts/check-secrets.ts`**（Node 原生執行，不依賴 `node_modules`，hook 在 `npm install` 之前也能運作）：
  - 匯出純函式 `findSecrets(text): ISecretFinding[]` 供測試；CLI 部分負責取得要掃描的內容。
  - **規則**：
    1. `credentialed-url`：`scheme://user:<password>@host` 且 host 不是 `localhost`／`127.0.0.1`／`[::1]`，密碼不是佔位符。「非本機才算機密」與既有 `e2e/testAccount.ts` 的 `assertLocalDatabase()` 是同一個判斷原則。
    2. `anthropic-api-key`：`sk-ant-` 加 20 個以上的金鑰字元。
    3. `private-key`：PEM 私鑰標頭。
    4. `env-file`：新增的檔名符合 `.env` 或 `.env.*`，且不在允許清單（`.env.example`、`.env.production`）內。
  - **三種模式**：
    - 無參數（pre-commit）：掃描 `git diff --cached -U0` 的新增行。
    - `--push`（pre-push）：從 stdin 讀取 git 傳入的 `<local ref> <local sha> <remote ref> <remote sha>`，以 `git log -p -U0 <remote sha>..<local sha>` **逐一掃描每個即將推送的 commit** 的新增行；新分支（remote sha 全為 0）改用 `<local sha> --not --remotes`。只比對頭尾差異會漏掉「加入後又刪除」的機密，但它仍會隨歷史上傳，所以必須逐 commit 檢查。
    - `--all`（CI／手動）：掃描 `git ls-files` 的所有被追蹤檔案，略過二進位檔。
  - **輸出**：`檔案:行號 [規則] 遮蔽後的內容`，密碼以 `***` 取代，絕不印出原值；有發現時 exit code 1。
  - **誤判的出口**：在該行加上 `secret-scan:allow` 註記（會留在版本庫中，可被審查）。不建議用 `--no-verify`，因為 CI 與 pre-push 仍會擋下。
- **Hook 檔案**：`.githooks/pre-commit` 與 `.githooks/pre-push`，內容各一行 `exec node scripts/check-secrets.ts [--push]`；以 `git update-index --chmod=+x` 標記為可執行。
- **啟用方式**：`npm run hooks:install`（即 `git config core.hooksPath .githooks`），每個 clone 執行一次。
  - **刻意不放在 `prepare` script**：`Dockerfile` 在只複製 `package*.json` 與 `prisma/` 的情況下執行 `npm ci`，映像檔內沒有 git 也沒有 `scripts/`，`prepare` 會讓部署建置失敗。忘記啟用的情況由 CI 掃描補上。
- **型別檢查**：`tsconfig.node.json` 的 `include` 加入 `scripts/**/*.ts`（該設定已有 `types: ["node"]` 與 `erasableSyntaxOnly`，正好符合 Node 原生執行 `.ts` 的限制）。
- **遠端 seed 流程**：
  - `package.json` 新增 `"seed:demo": "tsx prisma/seedDemo.ts"`（本機，讀 `.env`）與 `"seed:demo:remote": "tsx --env-file=.env.railway.local prisma/seedDemo.ts"`。
  - `prisma/seedDemo.ts` 不需修改：它只 `new PrismaClient()`，Prisma 自動載入 `.env` 時不會覆蓋已存在的環境變數，所以 `--env-file` 先設定的 `DATABASE_URL` 優先（與原本內嵌寫法依賴的是同一個優先順序）。
- **`.gitignore`**：在 `.env` 旁加一行註解說明慣例——含機密的環境檔一律以 `.local` 結尾（已由既有的 `*.local` 規則忽略）。不新增忽略規則。
- **CI**（`.github/workflows/ci.yml`）：在 `setup-node` 之後、`npm install` 之前新增步驟 `node scripts/check-secrets.ts --all`。
- **`CLAUDE.md`**：
  - 「關鍵規則」新增：機密不得出現在指令列或被追蹤的檔案；遠端資料庫操作一律用 `--env-file=.env.<名稱>.local`，禁止 `DATABASE_URL="…" <指令>` 的內嵌寫法（指令全文可能被存進 `.claude/settings.json` 的允許清單）。
  - 「常用指令」新增 `hooks:install`、`check:secrets`、`seed:demo:remote`。
- **`docs/DEVELOPMENT.md`**：新增「機密管理」小節（慣例、啟用 hook、遠端 seed 的做法、誤判時如何標記）。

### 3.2 路由與 API 端點

無。

### 3.3 資料庫變動

無。

## 4. 環境與設定 (.env)

- **`.env.railway.local`（新增，由使用者自行建立，不進版本庫）**：
  `DATABASE_URL="mysql://root:<新密碼>@<host>:<port>/railway?charset=utf8mb4"`
  我不會代為建立或寫入這個檔案，避免密碼再次經過對話。
- 既有 `.env` 不變。

## 5. Tasks

- [x] 0. 將本計畫存為 `docs/plans/2026-10-10-prevent-secret-leak.md`。
- [x] 1. **移除機密**：刪除 `.claude/settings.json` 中含密碼的規則；確認工作目錄已無 `rlwy.net`。
- [x] 2. `scripts/check-secrets.ts`：`findSecrets` 與三種模式。
- [x] 3. `scripts/__tests__/check-secrets.spec.ts`：依「2. 測試流程驗證」第 2 項撰寫。
- [x] 4. `.githooks/pre-commit`、`.githooks/pre-push`（標記為可執行）；`package.json` 新增 `hooks:install`、`check:secrets`、`seed:demo`、`seed:demo:remote`；`tsconfig.node.json` 納入 `scripts/**/*.ts`。
- [x] 5. 執行 `npm run hooks:install`；`npm run check:secrets` 確認整個專案零誤判。
- [x] 6. pre-commit 與 pre-push 實測（假機密，測完清除暫存檔與暫時分支）。
- [x] 7. `.github/workflows/ci.yml` 新增掃描步驟；`.gitignore` 加註解。
- [x] 8. `CLAUDE.md`、`docs/DEVELOPMENT.md`、`docs/CHANGELOG.md` 同步。
- [x] 9. `npm run test`、`npm run build`。
- [x] 10. 完成後將計畫移至 `docs/plans/archive/`。

**需要使用者親自處理（我無法代勞）**：

- [ ] A. **到 Railway 重新產生 MySQL root 密碼**，並確認後端服務的 `DATABASE_URL` 變數已更新。這是唯一能讓已外流字串失效的做法。
- [ ] B. 建立 `.env.railway.local`，填入新的連線字串。
- [ ] C. （選用）在 GitHub repo 的 Settings → Code security 開啟 Secret scanning 與 Push protection。它主要辨識已知格式的金鑰，一般的資料庫連線字串不一定攔得到，所以只能當作額外一層，不能取代上述 hook。
- [ ] D. 之後 Claude Code 詢問指令權限時，若指令內容含有機密，選「僅此一次」而不是「一律允許」。

## 6. 驗收結果

**機密已清除**

- `.claude/settings.json` 中含密碼的規則已移除（允許清單 15 → 14 條，其餘 9 條未提交的規則依決定原封不動）。
- 工作目錄（排除 `node_modules`、`.git`、`dist`）已搜尋不到真實的 Railway 主機名稱；`git log --all -S` 在所有 ref 上仍無結果，確認從未進入版本歷史。
- `.env.railway.local` 會被既有的 `*.local` 規則忽略（`git check-ignore` 確認）。

**測試結果**

- `npm run test`（Vitest）：**126 passed**（原 84，新增 `scripts/__tests__/check-secrets.spec.ts` 42 項）。
- `npm run build`：通過，含 `scripts/**/*.ts` 的型別檢查。
- `npm run check:secrets`（所有被追蹤檔案）：0 筆。另以一次性腳本掃描所有尚未 commit 的修改與新檔案（10 個修改、5 個新檔）：0 筆。

**Hook 實測**（`core.hooksPath=.githooks`，皆使用假機密）

| 情境 | 結果 |
|------|------|
| 實際執行 `git commit`，staged 檔案含假的遠端連線字串 | 被拒絕（exit 1），顯示檔名、行號、遮蔽後的內容；HEAD 未變動 |
| staged 一個 `.env.staging` | 被拒絕（`env-file`） |
| staged 一個無害檔案 | 通過 |
| pre-push：第一個 commit 加入假機密、第二個 commit 刪除（頭尾差異為 0 個檔案），推到既有遠端分支 | 被拒絕，指出加入機密的那個 commit |
| pre-push：同上，推成全新分支 | 被拒絕 |
| pre-push：目前待推送的 `d2ecce0` | 通過 |
| pre-push：刪除遠端分支／沒有東西要推送 | 通過 |

pre-push 的測試 commit 以 git 底層指令建立，不掛在任何分支上，未切換分支也未更動工作目錄；它們是無法被參照的孤立物件，不會被推送。

**文件同步狀態**

- `CLAUDE.md`：「關鍵規則」新增機密規則；「常用指令」新增三個指令。
- `docs/DEVELOPMENT.md`：新增「4.1 機密管理」；快速啟動加入 `npm run hooks:install`；Node 前置需求更新。
- `docs/CHANGELOG.md`：新增 `[0.9.6] - 2026-10-10`。

## 7. 實作與計畫的差異

- **掃描邏輯拆成兩個檔案**：`scripts/secretScan.ts`（規則與 diff 解析，純函式）與 `scripts/check-secrets.ts`（CLI）。原計畫寫在同一個檔案並匯出 `findSecrets`，但 CLI 檔案一被 import 就會執行掃描，測試無法只取用函式。
- **新增 `.gitattributes`**（原計畫未列）：本機 `core.autocrlf=true`，checkout 時會把 hook 腳本轉成 CRLF，結尾的 `\r` 會變成 `--push\r` 而讓 pre-push 靜默退回成 staged 模式。以 `/.githooks/* text eol=lf` 強制 LF。
- **不認得的參數會直接中止（exit 2）**，而不是退回成掃描 staged 內容。這是上一項的第二道保險：即使參數被弄壞，pre-push 也是擋下而不是放行。
- **`env-file` 規則涵蓋「修改」而不只是「新增」**：只要 diff 中出現該檔名就攔下，萬一這類檔案曾被追蹤，後續修改也擋得住。
- **密碼字元排除 `/ ? #`**：這些字元在 URL 帳密區段必須編碼。排除後 `http://localhost:5173/@vite/client`、`https://host:443/pkg@1.2.3/x.js` 這類一般網址不會被誤判。
- **pre-push 使用 `git log -m`**：merge commit 也會對每個 parent 產生差異，衝突解決時才加入的內容也掃得到；重複的回報在輸出前去除。
- **驗證步驟 6 的搜尋字串改為真實主機名稱**：原計畫寫搜尋 `rlwy.net`，但測試與文件中使用了同網域的假主機名稱 `db.example.rlwy.net` 作為範例，因此改以真實主機名稱確認。
- **兩個 hook 檔案已 staged**：為了在 Windows 上記錄可執行權限（`git add --chmod=+x`），其餘變更未 staged、未 commit。
- **`docs/DEVELOPMENT.md` 的 Node 前置需求由 18+ 改為 22.18 以上**：hook 以 Node 原生執行 `.ts`，較舊版本無法執行。

## 8. 已知限制

- 掃描只認得**有固定形狀**的機密（帶帳密的 URL、Anthropic 金鑰、私鑰）。`JWT_SECRET` 這類任意字串無法靠樣式辨識，仍須靠「只放在被忽略的 `.env`」這條慣例與檔名防護。
- Hook 需要每個 clone 手動啟用一次；未啟用時只剩 CI 掃描，而 CI 是在 push 之後才執行，屬於事後警報。
- `--all` 只掃描目前的檔案內容，不掃描歷史；歷史由 pre-push 在上傳前逐 commit 檢查。
