#!/usr/bin/env node
/**
 * check:docs — 문서에 박힌 개수 ⇄ 실제 세기 대조 (`docs/DOC_DISCIPLINE.md` §4).
 *
 * 🔴 세는 법을 적어 두는 것만으로는 안 잡힌다. 농구명가가 규칙을 다 지켜 세는 법을 적어 뒀는데
 *    **아무도 그 명령을 돌리지 않았고**, 기계 대조를 붙인 첫날 세 곳이 이미 틀려 있었다.
 *    (그리고 이 프로젝트도 2026-09-08 에 "11테이블"이 실제 12인 채로 커밋돼 있었다.)
 *
 * 🚫 실측치(응답 시간·원가 같은 "다시 재야 아는 값")는 대상이 아니다 — 거짓 확신이 된다.
 *    대상은 **세면 나오는 수**뿐이다.
 *
 * 🔴 앵커가 사라져도 FAIL 해야 한다. 문구를 바꿔 가드가 조용히 통과하는 것이 가장 나쁘다.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

/** 문서에서 "**N건**" 류를 뽑는다. 앵커가 없으면 null → FAIL */
function stated(text, pattern) {
  const m = text.match(pattern);
  return m ? Number(m[1]) : null;
}

const claude = read('CLAUDE.md');
const readme = read('docs/README.md');
const database = read('docs/DATABASE.md');

/** DATABASE §2 안의 `### ` 제목 수 = 테이블 수 */
function countTables() {
  const sec = database.split(/^## 2\. 스키마/m)[1]?.split(/^## 3\./m)[0] ?? '';
  return (sec.match(/^### /gm) ?? []).length;
}

/** `npm run verify` 가 실제로 몇 개를 돌리나 */
function verifyChainLength() {
  return JSON.parse(read('package.json')).scripts.verify.split('&&').length;
}

const checks = [
  {
    what: '확정 결정',
    stated: stated(readme, /결정 로그 \*\*(\d+)건\*\*/),
    actual: (claude.match(/^\*\*#/gm) ?? []).length,
  },
  {
    what: '미결정',
    stated: stated(readme, /미결정 \*\*(\d+)건\*\*/),
    actual: (claude.match(/^\| [A-Z] \|/gm) ?? []).length,
  },
  {
    what: 'docs 파일',
    stated: stated(readme, /\*\*(\d+)개\*\* \(세는 법: `ls docs/),
    actual: readdirSync(join(ROOT, 'docs')).filter((f) => f.endsWith('.md')).length,
  },
  {
    what: 'DB 테이블 (DATABASE §0)',
    stated: stated(database, /\*\*(\d+)테이블\*\*/),
    actual: countTables(),
  },
  {
    what: 'DB 테이블 (README 색인)',
    stated: stated(readme, /expo-sqlite \*\*(\d+)테이블\*\*/),
    actual: countTables(),
  },
  // 🔴 아래 셋은 2026-09-11 재적재에서 **전부 틀린 채로** 발견돼 추가됐다.
  //    그때까지 이 가드는 README 앵커만 봤고, 같은 수가 CLAUDE §16 에도 적혀 있는 것을 몰랐다.
  //    ★ 한 사실이 두 곳에 적혀 있으면 대조 대상은 **둘 다**여야 한다. 한쪽만 재면 다른 쪽이 조용히 늙는다.
  {
    what: '확정 결정 (CLAUDE §16 요약)',
    stated: stated(claude, /확정 결정 \*\*(\d+)건\*\*/),
    actual: (claude.match(/^\*\*#/gm) ?? []).length,
  },
  {
    what: '미결정 (CLAUDE §16 요약)',
    stated: stated(claude, /미결정 \*\*(\d+)건\*\*/),
    actual: (claude.match(/^\| [A-Z] \|/gm) ?? []).length,
  },
  {
    // 🔴 가드를 넷 더 만들고도 이 줄이 `열둘` 로 남아 있었다. 가드 개수는 **세면 나오는 수**다.
    what: 'verify 체인 (README §3)',
    stated: stated(readme, /아래 \*\*(\d+)개\*\*를 순서대로 돌린다/),
    actual: verifyChainLength(),
  },
];

// ── 🔴 양성 대조 ───────────────────────────────────────────────────────
if (stated('결정 로그 **7건**', /결정 로그 \*\*(\d+)건\*\*/) !== 7) {
  console.error('SELF-TEST FAIL: stated() 가 숫자를 못 뽑는다');
  process.exit(2);
}
if (stated('앵커 없음', /결정 로그 \*\*(\d+)건\*\*/) !== null) {
  console.error('SELF-TEST FAIL: 앵커가 없는데 null 이 아니다');
  process.exit(2);
}
if (countTables() === 0) {
  console.error('SELF-TEST FAIL: 테이블을 0개로 센다 — 절 분리가 깨졌다');
  process.exit(2);
}
if (verifyChainLength() < 2) {
  console.error('SELF-TEST FAIL: verify 체인을 1개로 센다 — && 분리가 깨졌다');
  process.exit(2);
}
// ──────────────────────────────────────────────────────────────────────

const bad = [];
for (const c of checks) {
  if (c.stated === null) {
    bad.push(`${c.what}: 🔴 문서에서 앵커를 못 찾았다 (문구가 바뀌었나?) · 실제 ${c.actual}`);
  } else if (c.stated !== c.actual) {
    bad.push(`${c.what}: 문서 ${c.stated} ≠ 실제 ${c.actual}`);
  }
}

if (bad.length) {
  console.error(`check:docs FAIL (${bad.length})`);
  for (const m of bad) console.error('  ' + m);
  process.exit(1);
}
console.log(`check:docs OK — ${checks.length}개 대조 일치 · SELF-TEST 통과`);
