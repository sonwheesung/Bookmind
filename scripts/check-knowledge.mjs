#!/usr/bin/env node
/**
 * check:knowledge — 지식 카드 표시 규칙(`docs/KNOWLEDGE_SYSTEM.md` §3).
 *
 * 🔴 **왜 생겼나**: 2026-09-11 실기기에서 홈에 `42p쪽` 이 떴다. `DATABASE.md` §2 가
 *    `page` 를 **자유 텍스트**로 정해 뒀는데(`"123p"` · `"3장"`) 화면이 접사를 **무조건** 붙이고 있었다.
 *    `tsc`·`lint`·가드 열넷이 전부 초록이었다. **화면은 멀쩡한데 글자만 틀린** 그 자리다.
 *
 * ⚠ 이 가드는 문구를 판정하지 않는다(그건 `DESIGN_REVIEW.md` 창구다).
 *    판정하는 것은 **언제 접사를 씌우는가** 하나다.
 *
 * 🔴 SELF-TEST 가 먼저다(exit 2). 검사 실패는 exit 1.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { canAffixPageUnit, displayPage, splitTagInput } from '../features/knowledge/compute.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

// ko 는 뒤에, en 은 앞에 붙는다. **자리를 우리가 정하지 않는다**는 것이 설계다
const ko = (p) => `${p}쪽`;
const en = (p) => `p.${p}`;

// ── 🔴 SELF-TEST ─────────────────────────────────────────────────────
function selfTest() {
  const fail = (m) => {
    console.error(`SELF-TEST FAIL: ${m}`);
    process.exit(2);
  };
  // 🔴 양성 대조 — 판정이 **갈라지는가**. 늘 true 나 늘 false 를 돌려주는 함수를 배제한다
  if (canAffixPageUnit('42') !== true) fail('숫자에 접사를 못 씌운다');
  if (canAffixPageUnit('3장') !== false) fail('숫자가 아닌데 접사를 씌운다');
  // 🔴 접사 함수가 실제로 무언가를 바꾸는가(아무것도 안 하는 affix 면 축 ②가 뜻이 없다)
  if (ko('42') === '42') fail('ko 접사가 값을 안 바꾼다');
  if (en('42') === '42') fail('en 접사가 값을 안 바꾼다');
}

selfTest();

const bad = [];
const check = (cond, msg) => {
  if (!cond) bad.push(msg);
};

// ── ① 숫자에는 씌운다 ──
check(displayPage('42', ko) === '42쪽', `① ko 숫자: ${displayPage('42', ko)}`);
check(displayPage('42', en) === 'p.42', `① en 숫자: ${displayPage('42', en)}`);
check(displayPage('007', ko) === '007쪽', `① 앞자리 0 이 있는 숫자: ${displayPage('007', ko)}`);
check(displayPage(' 42 ', ko) === '42쪽', `① 앞뒤 공백을 안 다듬는다: ${displayPage(' 42 ', ko)}`);

// ── 🔴 ② 숫자가 아니면 그대로 둔다 ──
// 실기기에서 실제로 나온 것이 첫 줄이다
check(displayPage('42p', ko) === '42p', `② 🔴 ${displayPage('42p', ko)} — 실기기에서 나온 그 글자다`);
check(displayPage('42p', en) === '42p', `② 🔴 en: ${displayPage('42p', en)}`);
check(displayPage('3장', ko) === '3장', `② 🔴 ${displayPage('3장', ko)}`);
check(displayPage('3장', en) === '3장', `② 🔴 en: ${displayPage('3장', en)}`);
check(displayPage('第 1 章', ko) === '第 1 章', `② 한자 장 표기: ${displayPage('第 1 章', ko)}`);
check(displayPage('12-14', ko) === '12-14', `② 쪽 범위: ${displayPage('12-14', ko)}`);
check(displayPage('xii', en) === 'xii', `② 로마 숫자: ${displayPage('xii', en)}`);

// ── ③ 없는 것과 빈 것 ──
check(displayPage(null, ko) === null, '③ null 이 null 이 아니다');
check(displayPage('', ko) === null, '③ 빈 문자열이 null 이 아니다');
check(displayPage('   ', ko) === null, '③ 공백만 있는 값이 null 이 아니다');
// 🔴 빈 값이 null 이어야 홈의 출처 줄에서 걸러진다(`app/index.tsx` 가 null 을 버린다)

// ── 🔴 ④ 화면이 판정을 거치나 ──
//
// 🔴 순수 함수를 만들어 두고 화면이 안 쓰면 아무것도 안 지킨 것이다. 소스에서 통로를 잰다.
const home = read('app/index.tsx');
check(home.includes('displayPage('), '④ 🔴 홈이 `displayPage` 를 안 쓴다');
check(
  !/t\('knowledge\.pageShort',\s*\{\s*page:\s*k\.page\s*\}\)/.test(home),
  '④ 🔴 홈이 아직 원문 `page` 에 접사를 바로 붙인다(그게 `42p쪽` 을 만든 코드다)',
);
// 🔴 양성 대조: 그 정규식이 실제로 무언가를 잡는가
check(
  /t\('knowledge\.pageShort',\s*\{\s*page:\s*k\.page\s*\}\)/.test(
    "t('knowledge.pageShort', { page: k.page })",
  ),
  '④ 🔴 옛 코드를 찾는 정규식이 아무것도 안 잡는다',
);

// ── ⑤ 태그 입력 나누기 (`docs/UI_GUIDE.md` §3) ──
{
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  check(
    same(splitTagInput('철학, 습관'), ['철학', '습관']),
    `⑤ 기본: ${JSON.stringify(splitTagInput('철학, 습관'))}`,
  );
  check(same(splitTagInput(''), []), '⑤ 빈 입력이 빈 목록이 아니다');
  check(same(splitTagInput(' , ,, '), []), '⑤ 🔴 쉼표와 공백만 있는데 이름이 생긴다(빈 태그)');
  check(same(splitTagInput('a,,b'), ['a', 'b']), '⑤ 연속 쉼표에서 빈 이름이 생긴다');
  check(same(splitTagInput('  한 단어 태그  '), ['한 단어 태그']), '⑤ 이름 안의 공백을 건드린다');
  check(same(splitTagInput('a, a'), ['a', 'a']), '⑤ 중복을 여기서 거른다(두 화면에 있던 동작이 아니다)');
  check(same(splitTagInput('solo'), ['solo']), '⑤ 쉼표 없는 한 단어를 못 받는다');
  // 🔴 두 화면이 **같은 함수**를 거치나
  for (const f of ['app/knowledge/new.tsx', 'app/knowledge/[id].tsx']) {
    check(read(f).includes('splitTagInput('), `⑤ 🔴 ${f} 가 splitTagInput 을 안 쓴다(규칙이 두 벌이 된다)`);
  }
}

if (bad.length > 0) {
  console.error(`\ncheck:knowledge 실패 ${bad.length}건:\n`);
  for (const m of bad) console.error(`  ✗ ${m}`);
  console.error('');
  process.exit(1);
}
console.log(
  `\ncheck:knowledge OK — 페이지 접사 ①숫자엔 씌운다 ②🔴 \`42p\`·\`3장\`·\`12-14\` 는 그대로 ` +
    `\n  ③빈 값은 null(출처 줄에서 걸러진다) ④화면이 판정을 거친다 ⑤태그 나누기(빈 태그 0 · 두 화면 같은 함수)` +
    `\n  SELF-TEST 통과(판정이 갈라지는가 · 접사가 값을 바꾸는가)\n`,
);
