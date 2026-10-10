// 機密掃描的規則與 diff 解析（純函式，無副作用）。CLI 入口在 check-secrets.ts。
// 由 Node 原生執行 .ts（僅型別抹除），不可使用 enum、namespace 等需要轉譯的語法。

export type SecretRule = 'credentialed-url' | 'anthropic-api-key' | 'private-key';

export interface ISecretFinding {
  rule: SecretRule;
  /** 在傳入文字中的行號（從 1 開始） */
  line: number;
  /** 已遮蔽機密本身，可安全印到終端機或 CI log */
  excerpt: string;
}

export interface IAddedLine {
  /** `git log -p` 輸出才有；staged diff 為 null */
  commit: string | null;
  file: string;
  line: number;
  text: string;
}

export interface IParsedDiff {
  /** diff 中出現的所有目的檔案路徑（不含被刪除的檔案） */
  files: { commit: string | null; file: string }[];
  addedLines: IAddedLine[];
}

/** 誤判時在該行加上此標記即可略過；標記會留在版本庫中，可被審查 */
export const ALLOW_MARKER = 'secret-scan:allow';

// 「非本機才算機密」：與 e2e/testAccount.ts 的 assertLocalDatabase() 同一個判斷原則
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

// scheme://user:<password>@host
// 密碼不含 / ? #：這些字元在 URL 的帳密區段必須編碼，排除後可避免把
// http://host:8080/path@x 這類一般網址誤判成帶密碼的連線字串
const CREDENTIALED_URL =
  /\b([a-z][a-z0-9+.-]*):\/\/([^\s:/@"'`\\]+):([^\s@/?#"'`\\]+)@(\[[^\]\s]+\]|[^\s/:"'`?#\\]+)/gi;

// 文件與範例中的佔位寫法：${VAR}、$VAR、<password>、***、...
const PLACEHOLDER_PASSWORD = /^(\$\{[^}]*\}|\$[A-Za-z_][A-Za-z0-9_]*|<[^>]*>|\*+|\.{3,})$/;

const ANTHROPIC_API_KEY = /sk-ant-[A-Za-z0-9_-]{20,}/;

const PRIVATE_KEY_HEADER = /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/;

// 含機密的環境檔一律不進版本庫；以下兩個是刻意追蹤的非機密檔案
const ENV_FILE = /^\.env(\..+)?$/;
const ALLOWED_ENV_FILES = new Set(['.env.example', '.env.production']);

function findInLine(text: string, line: number): ISecretFinding[] {
  if (text.includes(ALLOW_MARKER)) return [];

  const findings: ISecretFinding[] = [];

  for (const match of text.matchAll(CREDENTIALED_URL)) {
    const [, scheme, user, password, host] = match;
    if (LOCAL_HOSTS.has(host.toLowerCase())) continue;
    if (PLACEHOLDER_PASSWORD.test(password)) continue;
    findings.push({ rule: 'credentialed-url', line, excerpt: `${scheme}://${user}:***@${host}` });
  }

  if (ANTHROPIC_API_KEY.test(text)) {
    findings.push({ rule: 'anthropic-api-key', line, excerpt: 'sk-ant-***' });
  }

  const privateKey = PRIVATE_KEY_HEADER.exec(text);
  if (privateKey) {
    findings.push({ rule: 'private-key', line, excerpt: privateKey[0] });
  }

  return findings;
}

export function findSecrets(text: string): ISecretFinding[] {
  return text.split('\n').flatMap((lineText, index) => findInLine(lineText, index + 1));
}

export function isForbiddenEnvFile(filePath: string): boolean {
  const baseName = filePath.split('/').pop() ?? filePath;
  return ENV_FILE.test(baseName) && !ALLOWED_ENV_FILES.has(baseName);
}

const HUNK_HEADER = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;
const COMMIT_HEADER = /^commit ([0-9a-f]{7,64})$/;

/**
 * 解析 `git diff` 或 `git log -p --format="commit %H"` 的 unified diff，取出新增的行。
 * 以「是否在 hunk 內」判斷行的意義：hunk 內以 + 開頭的一律是新增內容，
 * 即使內容本身以 ++ 開頭（看起來像 +++ 檔頭）也不會被誤認。
 */
export function parseDiff(diff: string): IParsedDiff {
  const files: IParsedDiff['files'] = [];
  const addedLines: IAddedLine[] = [];

  let commit: string | null = null;
  let file: string | null = null;
  let inHunk = false;
  let nextLine = 0;

  for (const raw of diff.split('\n')) {
    const text = raw.endsWith('\r') ? raw.slice(0, -1) : raw;

    if (inHunk) {
      if (text.startsWith('+')) {
        if (file !== null) addedLines.push({ commit, file, line: nextLine, text: text.slice(1) });
        nextLine += 1;
        continue;
      }
      if (text.startsWith(' ')) {
        nextLine += 1;
        continue;
      }
      if (text.startsWith('-') || text.startsWith('\\')) continue;
      // 其他開頭（diff --git、commit、空行）代表這個 hunk 已結束，往下當成檔頭處理
      inHunk = false;
    }

    const hunk = HUNK_HEADER.exec(text);
    if (hunk) {
      inHunk = true;
      nextLine = Number(hunk[1]);
      continue;
    }

    const commitHeader = COMMIT_HEADER.exec(text);
    if (commitHeader) {
      commit = commitHeader[1];
      file = null;
      continue;
    }

    if (text.startsWith('diff --git ')) {
      file = null;
      continue;
    }

    if (text.startsWith('+++ ')) {
      const target = text.slice(4);
      // 被刪除的檔案目的端是 /dev/null，沒有新增內容需要檢查
      file = target.startsWith('b/') ? target.slice(2) : null;
      if (file !== null) files.push({ commit, file });
    }
  }

  return { files, addedLines };
}
