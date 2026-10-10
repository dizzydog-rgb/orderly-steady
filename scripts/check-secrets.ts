// 機密掃描 CLI：發現機密時以 exit code 1 結束，中止 commit／push／CI。
//
//   node scripts/check-secrets.ts          掃描已 staged 的新增內容（pre-commit）
//   node scripts/check-secrets.ts --push   逐一掃描即將推送的每個 commit（pre-push，由 stdin 讀取 ref）
//   node scripts/check-secrets.ts --all    掃描所有被追蹤的檔案（CI／手動）
//
// 不依賴 node_modules，hook 在 npm install 之前也能運作。啟用方式：npm run hooks:install

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { ALLOW_MARKER, findSecrets, isForbiddenEnvFile, parseDiff } from './secretScan.ts';

interface IReport {
  location: string;
  rule: string;
  excerpt: string;
}

const ZERO_SHA = /^0+$/;
const DIFF_OPTIONS = ['--no-color', '--no-ext-diff', '-U0'];

function git(args: string[]): string {
  // core.quotePath=false：中文路徑以原樣輸出，不被跳脫成 "\346\241..."
  return execFileSync('git', ['-c', 'core.quotePath=false', ...args], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function scanDiff(diff: string): IReport[] {
  const { files, addedLines } = parseDiff(diff);
  const prefix = (commit: string | null) => (commit ? `${commit.slice(0, 7)} ` : '');

  const reports: IReport[] = files
    .filter(({ file }) => isForbiddenEnvFile(file))
    .map(({ commit, file }) => ({
      location: `${prefix(commit)}${file}`,
      rule: 'env-file',
      excerpt: '含機密的環境檔不可進版本庫',
    }));

  for (const { commit, file, line, text } of addedLines) {
    for (const finding of findSecrets(text)) {
      reports.push({
        location: `${prefix(commit)}${file}:${line}`,
        rule: finding.rule,
        excerpt: finding.excerpt,
      });
    }
  }
  return reports;
}

function scanStaged(): IReport[] {
  return scanDiff(git(['diff', '--cached', '--diff-filter=ACMR', ...DIFF_OPTIONS]));
}

// 只比對推送前後的頭尾差異會漏掉「加入後又刪除」的機密，但它仍會隨歷史上傳，
// 因此逐一檢查每個尚未在遠端的 commit
function scanOutgoing(stdin: string): IReport[] {
  const reports: IReport[] = [];

  for (const refLine of stdin.split('\n')) {
    const [, localSha, , remoteSha] = refLine.trim().split(/\s+/);
    // localSha 全為 0 代表刪除遠端分支，沒有內容要上傳
    if (!localSha || !remoteSha || ZERO_SHA.test(localSha)) continue;

    const notOnAnyRemote = [localSha, '--not', '--remotes'];
    const range = ZERO_SHA.test(remoteSha) ? notOnAnyRemote : [`${remoteSha}..${localSha}`];
    const logArgs = ['log', '-p', '-m', '--format=commit %H', ...DIFF_OPTIONS];

    let diff: string;
    try {
      diff = git([...logArgs, ...range]);
    } catch {
      // 遠端的 commit 本機沒有（例如強制推送）時範圍無法解析，改掃所有尚未在遠端的 commit
      diff = git([...logArgs, ...notOnAnyRemote]);
    }
    reports.push(...scanDiff(diff));
  }
  return reports;
}

function scanTrackedFiles(): IReport[] {
  const reports: IReport[] = [];
  const files = git(['ls-files', '-z']).split('\0').filter(Boolean);

  for (const file of files) {
    if (isForbiddenEnvFile(file)) {
      reports.push({ location: file, rule: 'env-file', excerpt: '含機密的環境檔不可進版本庫' });
    }
    // 已追蹤但在工作目錄中被刪除的檔案
    if (!existsSync(file)) continue;

    const content = readFileSync(file);
    // 二進位檔（圖片、字型）不掃描
    if (content.subarray(0, 8000).includes(0)) continue;

    for (const finding of findSecrets(content.toString('utf8'))) {
      reports.push({
        location: `${file}:${finding.line}`,
        rule: finding.rule,
        excerpt: finding.excerpt,
      });
    }
  }
  return reports;
}

// git 會把要推送的 ref 逐行寫進 pre-push 的 stdin；沒有東西要推送時 stdin 可能是空的
function readStdin(): string {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function main(): void {
  const mode = process.argv[2];

  let reports: IReport[];
  if (mode === undefined) reports = scanStaged();
  else if (mode === '--all') reports = scanTrackedFiles();
  else if (mode === '--push') reports = scanOutgoing(readStdin());
  else {
    // 不認得的參數一律中止，而不是退回成掃描 staged 內容：
    // 例如 hook 檔被轉成 CRLF 時參數會變成 "--push\r"，靜默放行等於 pre-push 沒在檢查
    console.error(`check-secrets: 不認得的參數 ${JSON.stringify(mode)}（可用：--push、--all）`);
    process.exit(2);
  }

  // 同一行可能因 merge commit 的多個 parent 被回報多次
  const unique = [...new Map(reports.map((r) => [`${r.location}|${r.rule}|${r.excerpt}`, r])).values()];
  if (unique.length === 0) return;

  console.error(`\n發現 ${unique.length} 筆疑似機密，已中止：\n`);
  for (const { location, rule, excerpt } of unique) {
    console.error(`  ${location}  [${rule}]  ${excerpt}`);
  }
  console.error(
    [
      '',
      '處理方式：',
      '  - 把機密移到 .env 或 .env.<名稱>.local（已被 .gitignore 忽略），指令以 tsx --env-file= 載入。',
      '  - 機密若已存在於某個 commit，需改寫該 commit 將它移除，並重設該組密碼／金鑰。',
      `  - 確定是誤判時，在該行加上 ${ALLOW_MARKER} 註記。`,
      '',
    ].join('\n'),
  );
  process.exit(1);
}

main();
