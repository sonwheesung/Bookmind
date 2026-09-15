#!/usr/bin/env node
/**
 * check:public — 공개되면 안 되는 것이 커밋 · push 되지 않게 막는다(`CLAUDE.md` §13).
 *
 * 🔴 왜 생겼나: 2026-09-15 사용자 지시 *"보여주면 안되는건 커밋이나 푸시 안되게 처리해야해"*.
 *    **저장소를 공개로 본다.** 첫 점검에서 추적 파일에 개인 메일 · 수정사항 시트 주소 · ChatGPT 방 주소 ·
 *    내부 테스트 참여 링크가 들어 있었다. `.gitignore` 는 **파일 이름**만 막고 **글 속 값**은 못 막는다.
 *
 * 도는 곳 셋:
 *   · `npm run verify`            추적 파일 전체 + git 훅이 켜져 있나
 *   · `.githooks/pre-commit`      `--staged` · 이번 커밋에 올라가는 내용만
 *   · `.githooks/pre-push`        추적 파일 전체
 *
 * 값은 로컬 `.private/LINKS.md`(커밋 금지)에 두고 문서는 그 파일을 가리키기만 한다.
 * ⚠ 걸린 값은 **가려서** 출력한다. 훅 출력이 터미널 기록에 남기 때문이다.
 *
 * 🔴 SELF-TEST 가 먼저다(exit 2). 검사 실패는 exit 1.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** 🔴 이 파일 자신이 규칙에 걸리지 않게 대조 문장은 조각을 이어 붙여 만든다 */
const j = (...parts) => parts.join('');

export const RULES = [
  {
    id: '①',
    what: '비밀 키 · 토큰 · 개인 키',
    re: /AIza[0-9A-Za-z_-]{30,}|sk-ant-[0-9A-Za-z_-]{16,}|ghp_[0-9A-Za-z]{30,}|github_pat_[0-9A-Za-z_]{20,}|xox[abprs]-[0-9A-Za-z-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    probes: [
      j('AIza', 'SyA1234567890abcdefghijklmnopqrstu'),
      j('sk-ant-', 'api03-abcdefghijklmnop'),
      j('ghp_', 'abcdefghijklmnopqrstuvwxyz0123456789'),
      j('github_pat_', '11ABCDEFG0123456789abcd'),
      j('-----BEGIN ', 'PRIVATE KEY-----'),
    ],
    allow: [],
  },
  {
    id: '②',
    what: '서비스 계정 주소',
    re: /[a-z0-9-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com/i,
    probes: [j('play', '@proj-123.iam.', 'gserviceaccount.com')],
    allow: [],
  },
  {
    id: '③',
    what: '개인 메일 주소',
    re: /[A-Za-z0-9._%+-]+@(gmail|naver|daum|hanmail|kakao|nate|outlook|hotmail|icloud|yahoo)\.(com|net|co\.kr)/i,
    probes: [j('someone', '@', 'gmail.com'), j('user.name', '@', 'naver.com')],
    allow: [],
  },
  {
    id: '④',
    what: '내부 링크(수정사항 시트 · ChatGPT 방 · 내부 테스트 참여)',
    re: /docs\.google\.com\/(spreadsheets|document|forms)\/d\/[0-9A-Za-z_-]{20,}|chatgpt\.com\/c\/[0-9a-f-]{20,}|play\.google\.com\/apps\/internaltest\/\d+/i,
    // 🔴 갈래마다 대조 문장을 둔다. 하나만 두면 다른 갈래를 지워도 초록이다(2026-09-15 변이 주입에서 ChatGPT 갈래가 침묵했다)
    probes: [
      j('https://docs.google.com/', 'spreadsheets/d/', '1abcdefghijklmnopqrstuvwxyz'),
      j('https://chatgpt.com/', 'c/', '0000aaaa-bbbb-cccc-dddd-eeeeffff0000'),
      j('https://play.google.com/apps/', 'internaltest/', '0000000000000000000'),
    ],
    allow: [],
  },
  {
    id: '⑤',
    what: '휴대폰 번호',
    re: /(?<!\d)01[016789][- .]?\d{3,4}[- .]?\d{4}(?!\d)/,
    probes: [j('010-', '1234-', '5678'), j('010', '12345678')],
    allow: [],
  },
  {
    id: '⑥',
    what: '주민등록번호',
    re: /(?<!\d)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[- ]?[1-4]\d{6}(?!\d)/,
    probes: [j('900101-', '1234567')],
    allow: [],
  },
  {
    id: '⑦',
    what: '사업자등록번호(처리방침에만 둔다)',
    re: /(?<!\d)\d{3}-\d{2}-\d{5}(?!\d)/,
    probes: [j('123-', '45-', '67890')],
    // 🟢 처리방침은 법정 기재사항이라 **공개가 목적이다**(legal/PRIVACY.*). 그 문서와 그 문서를 재는 가드만 허용한다
    allow: ['docs/legal/', 'scripts/check-privacy.mjs'],
  },
];

export const PATH_RULES = [
  { what: '환경 변수 파일', re: /(^|\/)\.env($|\.(?!example$))/ },
  { what: '키스토어 · 인증서', re: /\.(jks|keystore|p12|p8|pem)$/i },
  { what: '서비스 계정 · Firebase 설정', re: /service-account.*\.json$|google-services\.json$|GoogleService-Info\.plist$/i },
  { what: '사업자 정보 원본', re: /(^|\/)BUSINESS_INFO\.md$/i },
  { what: '로컬 비공개 폴더', re: /(^|\/)(\.private|secrets|credentials)\// },
];

/** 내용을 안 보는 파일. 🔴 이름 규칙(⑧)은 이 파일들에도 적용한다 */
const SKIP_CONTENT = [/^package-lock\.json$/, /\.(png|jpe?g|webp|gif|ico|ttf|otf|aab|apk|zip)$/i];

/** 걸린 값을 가린다. 앞 4자와 끝 2자만 남긴다 */
export function mask(s) {
  return s.length <= 8 ? '***' : `${s.slice(0, 4)}…${s.slice(-2)}`;
}

export function scanText(path, text) {
  const hits = [];
  const lines = text.split(/\r?\n/);
  for (const r of RULES) {
    if (r.allow.some((a) => path.startsWith(a))) continue;
    lines.forEach((line, i) => {
      const m = line.match(r.re);
      if (m) hits.push(`${r.id} ${r.what}: ${path}:${i + 1}  ${mask(m[0])}`);
    });
  }
  return hits;
}

export function scanPath(path) {
  return PATH_RULES.filter((r) => r.re.test(path)).map((r) => `⑧ 커밋하면 안 되는 파일(${r.what}): ${path}`);
}

/** git 훅이 켜져 있나. 꺼져 있으면 커밋 · push 에서 아무것도 안 막는다 */
export function judgeHooks(hooksPath) {
  return hooksPath === '.githooks' ? [] : [`⑨ git 훅이 꺼져 있다(core.hooksPath=${JSON.stringify(hooksPath)}). npm run hooks:install`];
}

// ── 🔴 SELF-TEST ─────────────────────────────────────────────────────
function selfTest() {
  const fail = (m) => {
    console.error(`SELF-TEST FAIL: ${m}`);
    process.exit(2);
  };
  for (const r of RULES) {
    for (const probe of r.probes) {
      if (!r.re.test(probe)) fail(`${r.id} 정규식이 대조 문장을 못 잡는다(${mask(probe)})`);
      if (scanText('docs/x.md', `앞 ${probe} 뒤`).length !== 1) fail(`${r.id} 문서 속 값을 못 잡는다(${mask(probe)})`);
    }
  }
  // 반례 — 공개가 목적인 값 · 날짜 · 버전을 잡으면 가드가 오탐 덩어리가 되어 꺼진다
  const clean = [
    j('support', '@vivace-games.com'),
    j('noreply', '@anthropic.com'),
    '2026-09-15 · 0.1.8 · versionCode 8 · 12:34:56',
    'https://play.google.com/store/apps/details?id=com.vivacegames.reread',
    'https://u.expo.dev/8785afeb-e523-40c5-9b42-20593214aba6',
    '.env.example',
  ];
  for (const c of clean) if (scanText('docs/x.md', c).length !== 0) fail(`멀쩡한 값을 잡는다: ${c}`);
  // 🔴 허용 목록은 **그 경로에서만** 먹는다
  const biz = RULES.find((r) => r.id === '⑦');
  if (scanText('docs/legal/PRIVACY.ko.md', biz.probes[0]).length !== 0) fail('처리방침의 사업자번호를 막는다');
  if (scanText('docs/STORE_LISTING.md', biz.probes[0]).length !== 1) fail('🔴 처리방침 밖의 사업자번호를 못 잡는다');
  // 🔴 출력에 원래 값이 남지 않는다
  const out = scanText('docs/x.md', RULES[2].probes[0]).join('');
  if (out.includes(RULES[2].probes[0])) fail('🔴 걸린 값을 가리지 않고 출력한다');
  // 파일 이름
  for (const p of ['.env', '.env.production', 'secrets/reread-upload.jks', 'a/service-account-play.json', '.private/LINKS.md', 'x/BUSINESS_INFO.md']) {
    if (scanPath(p).length === 0) fail(`비밀 파일 이름을 못 잡는다: ${p}`);
  }
  for (const p of ['.env.example', 'docs/README.md', 'app.json', 'scripts/check-privacy.mjs']) {
    if (scanPath(p).length !== 0) fail(`멀쩡한 파일 이름을 잡는다: ${p}`);
  }
  if (judgeHooks('.githooks').length !== 0) fail('켜진 훅을 꺼졌다고 한다');
  if (judgeHooks('').length === 0 || judgeHooks('.git/hooks').length === 0) fail('🔴 꺼진 훅을 못 잡는다');
}

// ── 본검사 ───────────────────────────────────────────────────────────
selfTest();

const git = (args, encoding = 'utf8') =>
  execFileSync('git', args, { cwd: ROOT, encoding, maxBuffer: 512 * 1024 * 1024 });
const staged = process.argv.includes('--staged');
const bad = [];

const paths = (staged ? git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']) : git(['ls-files', '-z']))
  .split('\0')
  .filter(Boolean);

for (const p of paths) {
  bad.push(...scanPath(p));
  if (SKIP_CONTENT.some((re) => re.test(p))) continue;
  let buf;
  try {
    // 🔴 staged 는 **올라갈 내용**(색인)을 읽는다. 작업 폴더 파일은 그와 다를 수 있다
    buf = staged ? git(['show', `:${p}`], 'buffer') : readFileSync(join(ROOT, p));
  } catch {
    continue; // 추적 목록에 있는데 지워진 파일
  }
  if (buf.subarray(0, 8000).includes(0)) continue; // 바이너리
  bad.push(...scanText(p, buf.toString('utf8')));
}

if (!staged) {
  let hooksPath = '';
  try {
    hooksPath = git(['config', '--get', 'core.hooksPath']).trim();
  } catch {
    hooksPath = '';
  }
  bad.push(...judgeHooks(hooksPath));
}

if (bad.length > 0) {
  console.error(`\ncheck:public 실패 ${bad.length}건${staged ? '(이번 커밋 내용)' : ''}:\n`);
  for (const m of bad) console.error(`  ✗ ${m}`);
  console.error('\n  값은 로컬 .private/LINKS.md(커밋 금지)로 옮기고 문서에는 그 파일을 가리키기만 한다(CLAUDE.md §13).\n');
  process.exit(1);
}
console.log(
  `\ncheck:public OK — ${staged ? '이번 커밋' : '추적 파일'} ${paths.length}개 · 비밀 키 · 서비스 계정 · 개인 메일 · 내부 링크 · 전화 · 주민번호 · 사업자번호(처리방침 밖) · 비밀 파일 이름 0건` +
    `${staged ? '' : ' · git 훅 켜짐'}\n  SELF-TEST 통과(반례 · 허용 경로 · 값 가리기 · 파일 이름 · 훅)\n`,
);
