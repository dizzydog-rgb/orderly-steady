// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { ALLOW_MARKER, findSecrets, isForbiddenEnvFile, parseDiff } from '../secretScan.ts';

// 假機密一律以字串串接組成：這個檔案本身也會被掃描，原始碼中不能出現完整的機密樣式
const FAKE_PASSWORD = 'Fake' + 'Passw0rd' + 'XyZ';
const REMOTE_URL =
  'mysql://root:' + FAKE_PASSWORD + '@db.example.rlwy.net:37346/railway?charset=utf8mb4';
const urlWith = (password: string, host: string) => 'mysql://root:' + password + '@' + host + ':3306/app';

describe('findSecrets — 帶帳密的連線字串', () => {
  it('flags a credentialed URL pointing at a remote host', () => {
    const findings = findSecrets('DATABASE_URL="' + REMOTE_URL + '"');

    expect(findings).toEqual([
      { rule: 'credentialed-url', line: 1, excerpt: 'mysql://root:***@db.example.rlwy.net' },
    ]);
  });

  it('flags the shape of the real incident: a JSON permission rule with escaped quotes', () => {
    const rule = '      "Bash(DATABASE_URL=\\"' + REMOTE_URL + '\\" npx tsx prisma/seedDemo.ts)"';

    expect(findSecrets(rule)).toMatchObject([{ rule: 'credentialed-url' }]);
  });

  it('never includes the password itself in the excerpt', () => {
    const [finding] = findSecrets(REMOTE_URL);

    expect(finding.excerpt).not.toContain(FAKE_PASSWORD);
  });

  it('reports the line number within multi-line text', () => {
    const text = ['{', '  "ok": true,', '  "url": "' + REMOTE_URL + '"', '}'].join('\n');

    expect(findSecrets(text)).toMatchObject([{ line: 3 }]);
  });

  it.each(['localhost', '127.0.0.1', '[::1]', 'LOCALHOST'])(
    'ignores a credentialed URL on the local host %s',
    (host) => {
      expect(findSecrets(urlWith(FAKE_PASSWORD, host))).toEqual([]);
    },
  );

  it.each(['${MYSQL_ROOT_PASSWORD}', '$DB_PASSWORD', '<password>', '<新密碼>', '***', '...'])(
    'ignores the placeholder password %s',
    (password) => {
      expect(findSecrets(urlWith(password, 'db.example.rlwy.net'))).toEqual([]);
    },
  );

  it.each([
    'http://localhost:5173/@vite/client',
    'https://cdn.example.com:443/pkg@1.2.3/index.js',
    'git@github.com:someone/repo.git',
    'ssh://git@github.com:22/someone/repo.git',
    'DATABASE_URL=mysql://...',
  ])('does not mistake %s for a credentialed URL', (text) => {
    expect(findSecrets(text)).toEqual([]);
  });

  it(`skips a line carrying the ${ALLOW_MARKER} marker`, () => {
    expect(findSecrets(REMOTE_URL + ' # ' + ALLOW_MARKER)).toEqual([]);
  });
});

describe('findSecrets — 金鑰', () => {
  it('flags an Anthropic API key', () => {
    const key = 'sk-ant-' + 'api03-' + 'A1b2C3d4E5f6G7h8I9j0K1l2';

    expect(findSecrets('ANTHROPIC_API_KEY=' + key)).toEqual([
      { rule: 'anthropic-api-key', line: 1, excerpt: 'sk-ant-***' },
    ]);
  });

  it('ignores the documented placeholder for the API key', () => {
    expect(findSecrets('ANTHROPIC_API_KEY=<key>')).toEqual([]);
  });

  it.each(['RSA ', 'EC ', 'OPENSSH ', ''])('flags a %sprivate key header', (kind) => {
    const header = '-----BEGIN ' + kind + 'PRIVATE KEY-----';

    expect(findSecrets(header)).toMatchObject([{ rule: 'private-key' }]);
  });

  it('ignores a public key header', () => {
    expect(findSecrets('-----BEGIN ' + 'PUBLIC KEY-----')).toEqual([]);
  });
});

describe('isForbiddenEnvFile', () => {
  it.each(['.env', '.env.railway', '.env.local', '.env.railway.local', 'server/.env'])(
    'blocks %s',
    (file) => {
      expect(isForbiddenEnvFile(file)).toBe(true);
    },
  );

  it.each(['.env.example', '.env.production', 'src/env.ts', '.envrc', 'docs/env.md'])(
    'allows %s',
    (file) => {
      expect(isForbiddenEnvFile(file)).toBe(false);
    },
  );
});

describe('parseDiff', () => {
  it('extracts added lines with their file and new line number', () => {
    const diff = [
      'diff --git a/a.txt b/a.txt',
      'index 1111111..2222222 100644',
      '--- a/a.txt',
      '+++ b/a.txt',
      '@@ -3,0 +4,2 @@ context',
      '+first',
      '+second',
      '@@ -10 +12 @@',
      '-old',
      '+new',
    ].join('\n');

    expect(parseDiff(diff)).toEqual({
      files: [{ commit: null, file: 'a.txt' }],
      addedLines: [
        { commit: null, file: 'a.txt', line: 4, text: 'first' },
        { commit: null, file: 'a.txt', line: 5, text: 'second' },
        { commit: null, file: 'a.txt', line: 12, text: 'new' },
      ],
    });
  });

  it('ignores deleted files', () => {
    const diff = [
      'diff --git a/gone.txt b/gone.txt',
      'deleted file mode 100644',
      '--- a/gone.txt',
      '+++ /dev/null',
      '@@ -1 +0,0 @@',
      '-bye',
    ].join('\n');

    expect(parseDiff(diff)).toEqual({ files: [], addedLines: [] });
  });

  it('treats an added line that looks like a file header as content', () => {
    const diff = [
      'diff --git a/a.txt b/a.txt',
      '--- a/a.txt',
      '+++ b/a.txt',
      '@@ -0,0 +1,2 @@',
      '+++ b/not-a-header.txt',
      '+after',
    ].join('\n');

    expect(parseDiff(diff).addedLines).toEqual([
      { commit: null, file: 'a.txt', line: 1, text: '++ b/not-a-header.txt' },
      { commit: null, file: 'a.txt', line: 2, text: 'after' },
    ]);
  });

  it('attributes lines to their commit, so a secret added then removed is still seen', () => {
    const log = [
      'commit ' + 'b'.repeat(40),
      '',
      'diff --git a/config.txt b/config.txt',
      '--- a/config.txt',
      '+++ b/config.txt',
      '@@ -1 +0,0 @@',
      '-' + REMOTE_URL,
      'commit ' + 'a'.repeat(40),
      '',
      'diff --git a/config.txt b/config.txt',
      'new file mode 100644',
      '--- /dev/null',
      '+++ b/config.txt',
      '@@ -0,0 +1 @@',
      '+' + REMOTE_URL,
    ].join('\n');

    const { addedLines } = parseDiff(log);

    expect(addedLines).toEqual([
      { commit: 'a'.repeat(40), file: 'config.txt', line: 1, text: REMOTE_URL },
    ]);
    expect(findSecrets(addedLines[0].text)).toMatchObject([{ rule: 'credentialed-url' }]);
  });

  it('handles CRLF line endings in the diff output', () => {
    const diff = ['--- a/a.txt', '+++ b/a.txt', '@@ -0,0 +1 @@', '+line'].join('\r\n');

    expect(parseDiff(diff).addedLines).toEqual([
      { commit: null, file: 'a.txt', line: 1, text: 'line' },
    ]);
  });
});
