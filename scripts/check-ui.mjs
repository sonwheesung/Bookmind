#!/usr/bin/env node
/**
 * check:ui — 화면이 공통 부품을 우회했나 (`docs/UI_GUIDE.md` §6).
 *
 * 🔴 **왜 생겼나**: 2026-09-13 점검에서 `Chip.tsx` 주석은 "읽기 상태가 이걸 쓴다" 고 적는데
 *    두 책 화면이 칩을 손으로 다시 그리고 있었다. 모양이 똑같아 화면으로는 안 보이고,
 *    `tsc`·`lint`·가드 열여섯은 **같은 모양이 몇 벌인가**를 원리적으로 안 잰다.
 *
 * ⚠ 이 가드는 부품이 **있는지**가 아니라 화면에 부품을 **우회한 흔적**이 남았는지를 잰다.
 *
 * 🔴 SELF-TEST 가 먼저다(exit 2). 검사 실패는 exit 1.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isoWeekday, WEEKDAY_KEYS } from '../lib/day.ts';
import { joinMeta } from '../lib/format.ts';
import { toggled } from '../lib/set.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function sourceFiles(dir) {
  const out = [];
  const walk = (abs) => {
    for (const e of readdirSync(abs, { withFileTypes: true })) {
      const p = join(abs, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
    }
  };
  walk(join(ROOT, dir));
  return out;
}

/**
 * 주석을 지운다. 🔴 두 단계(블록 → 한 줄)이고 SELF-TEST 가 **둘 다** 잰다.
 * ⚠ 한 줄 주석은 `:` 바로 뒤의 `//` 를 건드리지 않는다(`https://`). 코드까지 지우면 위반을 놓친다.
 */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const RULES = [
  {
    id: '①',
    what: '`typography.` 직접 조립 → `AppText`',
    dirs: ['app'],
    re: /\btypography\./,
    probe: 'style={[typography.body, { color }]}',
  },
  {
    id: '②',
    what: "색 코드 `'#…'` → 토큰",
    dirs: ['app', 'components', 'hooks'],
    re: /['"`]#[0-9A-Fa-f]{3,8}['"`]/,
    probe: "{ color: '#1C1A17' }",
  },
  {
    id: '③',
    what: '`hairlineWidth` → `Divider`',
    dirs: ['app'],
    re: /\bhairlineWidth\b/,
    probe: 'height: StyleSheet.hairlineWidth',
  },
  {
    id: '④',
    what: "`'destructive'` → `confirmDestructive`",
    dirs: ['app'],
    re: /['"]destructive['"]/,
    probe: "{ text: x, style: 'destructive' }",
  },
  {
    id: '⑤',
    what: '`toLocaleDateString(` → `formatDate`',
    dirs: ['app', 'components'],
    re: /\.toLocaleDateString\(/,
    probe: 'new Date(x).toLocaleDateString(lang)',
  },
  {
    id: '⑥',
    what: "`.split(',')` → `splitTagInput`",
    dirs: ['app'],
    re: /\.split\(\s*['"],['"]\s*\)/,
    probe: "tags.split(',')",
  },
];

/** UI_GUIDE §2 표에서 부품 이름과 적힌 개수를 뽑는다 */
function catalog(md) {
  const text = md.replace(/\r\n/g, '\n');
  const start = text.indexOf('## 2. 공통 부품');
  const end = text.indexOf('## 3.', start + 1);
  if (start < 0 || end < 0) return null;
  const section = text.slice(start, end);
  const names = [...section.matchAll(/^\| `([A-Za-z]+)` \|/gm)].map((m) => m[1]);
  const stated = section.match(/\*\*(\d+)개\*\*/);
  return { names, stated: stated === null ? null : Number(stated[1]) };
}

// ── 🔴 SELF-TEST ─────────────────────────────────────────────────────
function selfTest() {
  const fail = (m) => {
    console.error(`SELF-TEST FAIL: ${m}`);
    process.exit(2);
  };
  for (const r of RULES) {
    if (!r.re.test(r.probe)) fail(`${r.id} 정규식이 대조 문장을 못 잡는다: ${r.probe}`);
    // 주석 속 설명은 위반이 아니다
    if (r.re.test(stripComments(`/* ${r.probe} */`))) fail(`${r.id} 블록 주석 속 설명을 위반으로 센다`);
    if (r.re.test(stripComments(`// ${r.probe}`))) fail(`${r.id} 한 줄 주석 속 설명을 위반으로 센다`);
    if (r.re.test(stripComments(`{/* ${r.probe} */}`))) fail(`${r.id} JSX 주석 속 설명을 위반으로 센다`);
    // 🔴 주석을 지우는 단계가 **코드까지** 지우면 위반을 놓친다
    if (!r.re.test(stripComments(`/* 설명 */ ${r.probe}`))) fail(`${r.id} 블록 주석 뒤의 코드를 지운다`);
    if (!r.re.test(stripComments(`${r.probe} // 설명`))) fail(`${r.id} 한 줄 주석 앞의 코드를 지운다`);
    if (!r.re.test(stripComments(`const u = 'https://x.dev'; ${r.probe}`))) {
      fail(`${r.id} https:// 뒤의 코드를 한 줄 주석으로 알고 지운다`);
    }
  }
  // 반례 — 부품을 쓴 코드를 위반으로 세면 안 된다
  if (RULES[0].re.test('<AppText variant="body">')) fail('① 이 AppText 를 위반으로 센다');
  if (RULES[4].re.test('formatDate(iso, deviceLocale())')) fail('⑤ 가 formatDate 를 위반으로 센다');
  if (RULES[5].re.test('splitTagInput(tags)')) fail('⑥ 이 splitTagInput 을 위반으로 센다');
  // 목록 파서가 이름과 개수를 **실제로** 뽑는가
  const probe = catalog(
    '## 2. 공통 부품\n\n**2개**\n\n| `Aaa` | x |\n| `Bbb` | y |\n\n## 3. 헬퍼\n| `Ccc` | z |',
  );
  if (probe === null || probe.names.join() !== 'Aaa,Bbb' || probe.stated !== 2) {
    fail(`부품 목록 파서가 틀렸다: ${JSON.stringify(probe)}`);
  }
}

selfTest();

const bad = [];
const check = (cond, msg) => {
  if (!cond) bad.push(msg);
};

// ── ①~⑥ 우회 흔적 ──
let scanned = 0;
for (const r of RULES) {
  for (const dir of r.dirs) {
    let files;
    try {
      files = sourceFiles(dir);
    } catch {
      continue; // hooks/ 같은 디렉터리가 없어도 된다
    }
    for (const f of files) {
      scanned += 1;
      const lines = stripComments(readFileSync(f, 'utf8')).split(/\r?\n/);
      lines.forEach((line, i) => {
        if (r.re.test(line)) bad.push(`${r.id} ${r.what}: ${relative(ROOT, f)}:${i + 1}  ${line.trim()}`);
      });
    }
  }
}
check(scanned > 0, '🔴 소스를 한 파일도 못 읽었다 — 스캐너가 죽었다');

// ── ⑦ 부품 목록 ⇄ 파일 ──
{
  const cat = catalog(readFileSync(join(ROOT, 'docs', 'UI_GUIDE.md'), 'utf8'));
  const files = sourceFiles('components')
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => basename(f, '.tsx'))
    .sort();
  if (cat === null) {
    bad.push('⑦ 🔴 UI_GUIDE §2 를 못 찾았다(제목이 바뀌었나?)');
  } else {
    const listed = [...cat.names].sort();
    for (const f of files) check(listed.includes(f), `⑦ 부품 ${f} 가 UI_GUIDE §2 표에 없다`);
    for (const n of listed) check(files.includes(n), `⑦ UI_GUIDE §2 의 ${n} 에 해당하는 파일이 없다`);
    check(cat.stated === files.length, `⑦ UI_GUIDE §2 의 개수 ${cat.stated} ≠ 실제 ${files.length}`);
  }
}

// ── ⑧ 헬퍼 경계 ──
check(
  joinMeta(['a', null, undefined, '', 'b']) === 'a · b',
  `⑧ joinMeta 빈 조각: ${joinMeta(['a', null, undefined, '', 'b'])}`,
);
check(joinMeta([]) === '', '⑧ joinMeta 빈 배열이 빈 문자열이 아니다');
check(
  joinMeta([null, '', undefined]) === '',
  '⑧ 🔴 joinMeta 가 전부 빈 조각인데 무언가를 만든다(빈 출처 줄이 생긴다)',
);
check(joinMeta(['only']) === 'only', '⑧ joinMeta 한 조각에 구분자를 붙인다');
check(joinMeta(['a', 'b', 'c']) === 'a · b · c', '⑧ joinMeta 순서나 구분자가 틀렸다');
{
  const base = new Set(['a']);
  const added = toggled(base, 'b');
  check(added.has('a') && added.has('b') && added.size === 2, '⑧ toggled 가 없는 것을 못 넣는다');
  check(base.size === 1 && !base.has('b'), '⑧ 🔴 toggled 가 입력을 바꿨다(React 가 다시 안 그린다)');
  check(toggled(base, 'a') !== base, '⑧ 🔴 toggled 가 같은 참조를 돌려준다');
  const removed = toggled(added, 'a');
  check(!removed.has('a') && removed.size === 1, '⑧ toggled 가 있는 것을 못 뺀다');
  check(toggled(new Set(), 'x').has('x'), '⑧ toggled 가 빈 집합에 못 넣는다');
}
check(WEEKDAY_KEYS.length === 7, `⑧ WEEKDAY_KEYS 가 ${WEEKDAY_KEYS.length}개다`);
// 🔴 실제 달력과 대조한다. 2026-09-14 는 월요일 · 09-10 은 목요일 · 09-13 은 일요일이다
check(WEEKDAY_KEYS[isoWeekday('2026-09-14') - 1] === 'mon', '⑧ 🔴 월요일 키가 어긋났다');
check(WEEKDAY_KEYS[isoWeekday('2026-09-10') - 1] === 'thu', '⑧ 🔴 목요일 키가 어긋났다');
check(WEEKDAY_KEYS[isoWeekday('2026-09-13') - 1] === 'sun', '⑧ 🔴 일요일 키가 어긋났다');

if (bad.length > 0) {
  console.error(`\ncheck:ui 실패 ${bad.length}건:\n`);
  for (const m of bad) console.error(`  ✗ ${m}`);
  console.error('');
  process.exit(1);
}
console.log(
  `\ncheck:ui OK — 우회 흔적 0(①typography ②색 코드 ③구분선 ④확인창 ⑤날짜 ⑥태그 나누기 · 파일 ${scanned}회 읽음)` +
    `\n  ⑦부품 목록 ⇄ UI_GUIDE §2 · ⑧헬퍼 경계(joinMeta 전부 빔 · toggled 입력 불변 · 요일 키 실제 달력 대조)` +
    `\n  SELF-TEST 통과(주석 세 종류 · https:// · 반례 · 목록 파서)\n`,
);
