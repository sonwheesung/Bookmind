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

import {
  BOOK_ORDERS,
  canAffixPageUnit,
  displayPage,
  groupByBook,
  KNOWLEDGE_SORTS,
  parseBookOrder,
  parseKnowledgeSort,
  splitTagInput,
} from '../features/knowledge/compute.ts';

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
// 🔴 빈 값이 null 이어야 홈의 출처 줄에서 걸러진다(`app/(tabs)/index.tsx` 가 null 을 버린다)

// ── 🔴 ④ 화면이 판정을 거치나 ──
//
// 🔴 순수 함수를 만들어 두고 화면이 안 쓰면 아무것도 안 지킨 것이다. 소스에서 통로를 잰다.
const home = read('app/(tabs)/index.tsx');
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

// ── ⑥ 문장 목록 책별 묶음 · 정렬 값 (`docs/KNOWLEDGE_SYSTEM.md` §3.2) ──
{
  const k = (id, bookId, bookTitle, at) => ({ id, book_id: bookId, bookTitle, created_at: at });
  const ids = (g) => (g === undefined ? '' : g.items.map((x) => x.id).join(','));
  // 🔴 입력을 **오래된 순**으로 준다. 이미 최신순이면 구획 안 정렬을 지워도 초록이다
  const rows = [
    k('a1', 'A', '명상록', '2026-09-01T00:00:00Z'),
    k('n1', null, null, '2026-09-02T00:00:00Z'),
    k('b1', 'B', '논어', '2026-09-03T00:00:00Z'),
    k('a2', 'A', '명상록', '2026-09-04T00:00:00Z'),
    k('n2', null, null, '2026-09-05T00:00:00Z'),
    // 책이 지워져 제목을 못 찾는 문장. 🔴 가장 최근이다(책 없음이 맨 아래인지 재려면 그래야 한다)
    k('x1', 'GONE', null, '2026-09-06T00:00:00Z'),
  ];
  const snapshot = JSON.stringify(rows);
  const groups = groupByBook(rows);
  check(groups.length === 3, `⑥ 구획이 ${groups.length}개다(명상록 · 논어 · 책 없음)`);
  check(
    groups[0]?.bookId === 'A' && groups[1]?.bookId === 'B',
    `⑥ 구획 순서가 마지막 저장 시각 순이 아니다: ${groups.map((g) => g.bookId).join(',')}`,
  );
  check(groups[0]?.title === '명상록', `⑥ 구획 제목이 책 제목이 아니다: ${groups[0]?.title}`);
  check(ids(groups[0]) === 'a2,a1', `⑥ 🔴 구획 안이 최신순이 아니다: ${ids(groups[0])}`);
  const last = groups[groups.length - 1];
  check(
    last?.bookId === null && last?.title === null,
    '⑥ 🔴 `책 없음` 이 맨 아래가 아니다. 책 없는 문장이 가장 최근이어도 아래다',
  );
  check(ids(last) === 'x1,n2,n1', `⑥ 🔴 제목을 못 찾는 책의 문장이 책 없음으로 안 간다: ${ids(last)}`);
  check(
    groups.reduce((n, g) => n + g.items.length, 0) === rows.length,
    '⑥ 🔴 묶다가 문장이 사라지거나 늘었다',
  );
  check(JSON.stringify(rows) === snapshot, '⑥ 🔴 groupByBook 이 입력 배열을 바꿨다');
  check(groupByBook([]).length === 0, '⑥ 문장이 0 인데 구획이 생긴다');
  const onlyLoose = groupByBook([k('n', null, null, '2026-09-01T00:00:00Z')]);
  check(onlyLoose.length === 1 && onlyLoose[0]?.bookId === null, '⑥ 책 없는 문장만 있을 때 구획이 하나가 아니다');
  const onlyBook = groupByBook([k('a', 'A', '명상록', '2026-09-01T00:00:00Z')]);
  check(onlyBook.length === 1 && onlyBook[0]?.bookId === 'A', '⑥ 🔴 책 없음이 없는데 빈 책 없음 구획을 만든다');
  check(
    groupByBook([k('e', 'E', '  ', '2026-09-01T00:00:00Z')])[0]?.bookId === null,
    '⑥ 빈 제목으로 이름 없는 구획을 만든다',
  );

  // 기기에 저장된 정렬 값
  check(parseKnowledgeSort('book') === 'book', '⑥ 저장된 book 을 못 읽는다');
  check(parseKnowledgeSort('recent') === 'recent', '⑥ 저장된 recent 를 못 읽는다');
  for (const v of [undefined, null, '', 'BOOK', 'title', 0, 1, {}, ['book']]) {
    check(parseKnowledgeSort(v) === 'recent', `⑥ 🔴 깨진 값 ${JSON.stringify(v)} 를 recent 로 안 돌린다`);
  }
  check(KNOWLEDGE_SORTS.length === 2, `⑥ 정렬이 ${KNOWLEDGE_SORTS.length}가지다`);

  // 🔴 화면이 이 함수와 저장소를 거치나
  const tab = read('app/(tabs)/knowledge.tsx');
  check(tab.includes('groupByBook('), '⑥ 🔴 문장 탭이 groupByBook 을 안 쓴다(묶는 규칙이 화면에 따로 생긴다)');
  check(tab.includes('useKnowledgeSortStore'), '⑥ 🔴 문장 탭이 고른 정렬을 기기에 안 저장한다');
  check(
    read('features/settings/knowledge-sort.ts').includes('parseKnowledgeSort('),
    '⑥ 🔴 저장소가 복원할 때 값을 안 거른다',
  );
}

// ── ⑦ 책별 보기의 책 순서 (`docs/KNOWLEDGE_SYSTEM.md` §3.2.1 · 2026-09-15 관리자 수정사항 #1) ──
{
  const k = (id, bookId, bookTitle, at) => ({ id, book_id: bookId, bookTitle, created_at: at });
  const order = (gs) => gs.map((g) => g.bookId ?? 'none').join(',');
  // 🔴 세 순서가 **서로 다른 답**을 내게 짰다. 셋 중 둘이 같으면 한쪽 분기를 지워도 초록이다
  //    recent: C(09-08) · A(09-06) · B(09-05)   title: B(논어) · A(명상록) · C(월든)   count: A(3) · B(2) · C(1)
  const rows = [
    k('a1', 'A', '명상록', '2026-09-01T00:00:00Z'),
    k('b1', 'B', '논어', '2026-09-02T00:00:00Z'),
    k('a2', 'A', '명상록', '2026-09-03T00:00:00Z'),
    k('b2', 'B', '논어', '2026-09-05T00:00:00Z'),
    k('a3', 'A', '명상록', '2026-09-06T00:00:00Z'),
    // 🔴 책 없는 문장이 **가장 최근**이다. 어느 순서에서도 맨 아래인지 재려면 그래야 한다
    k('n1', null, null, '2026-09-09T00:00:00Z'),
    k('c1', 'C', '월든', '2026-09-08T00:00:00Z'),
  ];
  const snapshot = JSON.stringify(rows);
  check(order(groupByBook(rows)) === 'C,A,B,none', `⑦ 🔴 순서를 안 넘기면 최근 저장순이 아니다: ${order(groupByBook(rows))}`);
  check(order(groupByBook(rows, 'recent')) === 'C,A,B,none', `⑦ recent 순서가 틀렸다: ${order(groupByBook(rows, 'recent'))}`);
  check(order(groupByBook(rows, 'title')) === 'B,A,C,none', `⑦ 🔴 제목순이 가나다가 아니다: ${order(groupByBook(rows, 'title'))}`);
  check(order(groupByBook(rows, 'count')) === 'A,B,C,none', `⑦ 🔴 문장 많은 순이 아니다: ${order(groupByBook(rows, 'count'))}`);
  const inner = groupByBook(rows, 'title').find((g) => g.bookId === 'A');
  check(
    inner?.items.map((x) => x.id).join(',') === 'a3,a2,a1',
    `⑦ 🔴 책 순서를 바꾸자 구획 안이 최신순이 아니게 됐다: ${inner?.items.map((x) => x.id).join(',')}`,
  );
  check(JSON.stringify(rows) === snapshot, '⑦ 🔴 순서를 바꾸다 입력 배열을 바꿨다');

  // 🔴 같은 제목 · 같은 개수는 recent 순서를 지키나(안정 정렬). 입력을 **오래된 순**으로 줘야 잰다
  const tie = [
    k('p1', 'P', '같은 책', '2026-09-01T00:00:00Z'),
    k('q1', 'Q', '같은 책', '2026-09-02T00:00:00Z'),
  ];
  check(order(groupByBook(tie, 'title')) === 'Q,P', `⑦ 🔴 제목이 같을 때 최근 저장순을 안 따른다: ${order(groupByBook(tie, 'title'))}`);
  check(order(groupByBook(tie, 'count')) === 'Q,P', `⑦ 🔴 개수가 같을 때 최근 저장순을 안 따른다: ${order(groupByBook(tie, 'count'))}`);
  // 숫자가 든 제목은 숫자 크기로(1권 · 2권 · 10권)
  const vol = [
    k('v10', 'V10', '10권', '2026-09-03T00:00:00Z'),
    k('v2', 'V2', '2권', '2026-09-02T00:00:00Z'),
    k('v1', 'V1', '1권', '2026-09-01T00:00:00Z'),
  ];
  check(order(groupByBook(vol, 'title')) === 'V1,V2,V10', `⑦ 제목 속 숫자를 글자로 센다: ${order(groupByBook(vol, 'title'))}`);
  // 대소문자는 가르지 않는다 — 대소문자만 다른 제목은 **같은 제목**이라 최근 저장순을 따른다.
  // 🔴 `beta` · `Alpha` 처럼 글자가 다르면 대소문자를 가르든 말든 답이 같아 아무것도 안 잰다(2026-09-15 변이가 침묵했다).
  //    대소문자를 가르면 ICU 는 소문자를 앞에 세우므로, 최근 것을 **대문자**로 둬야 두 답이 갈린다
  const cs = [
    k('lo', 'LO', 'alpha', '2026-09-01T00:00:00Z'),
    k('up', 'UP', 'Alpha', '2026-09-02T00:00:00Z'),
  ];
  check(order(groupByBook(cs, 'title')) === 'UP,LO', `⑦ 제목순이 대소문자를 가른다: ${order(groupByBook(cs, 'title'))}`);
  check(groupByBook([], 'count').length === 0, '⑦ 문장이 0 인데 구획이 생긴다');
  const onlyLoose = groupByBook([k('n', null, null, '2026-09-01T00:00:00Z')], 'title');
  check(onlyLoose.length === 1 && onlyLoose[0]?.bookId === null, '⑦ 책 없는 문장만 있을 때 제목순이 깨진다');

  // 기기에 저장된 책 순서
  for (const v of BOOK_ORDERS) check(parseBookOrder(v) === v, `⑦ 저장된 ${v} 를 못 읽는다`);
  for (const v of [undefined, null, '', 'TITLE', 'book', 'recent ', 0, {}, ['count']]) {
    check(parseBookOrder(v) === 'recent', `⑦ 🔴 깨진 값 ${JSON.stringify(v)} 를 recent 로 안 돌린다`);
  }
  check(BOOK_ORDERS.length === 3, `⑦ 책 순서가 ${BOOK_ORDERS.length}가지다`);

  // 🔴 화면이 고른 순서를 넘기나. `groupByBook(data)` 만 남으면 고르기가 아무것도 안 바꾼다
  const tab = read('app/(tabs)/knowledge.tsx');
  check(/groupByBook\(\s*data\s*,\s*bookOrder\s*\)/.test(tab), '⑦ 🔴 문장 탭이 고른 책 순서를 groupByBook 에 안 넘긴다');
  check(!/groupByBook\(\s*data\s*,\s*bookOrder\s*\)/.test('groupByBook(data)'), '⑦ SELF-TEST: 순서를 안 넘긴 호출을 통과시킨다');
  check(tab.includes('setBookOrder('), '⑦ 🔴 문장 탭에 책 순서를 고르는 자리가 없다');
  check(
    read('features/settings/knowledge-sort.ts').includes('parseBookOrder('),
    '⑦ 🔴 저장소가 책 순서를 복원할 때 값을 안 거른다',
  );
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
    `\n  ⑥책별 묶음(🔴 책 없음 맨 아래 · 구획 안 최신순 · 제목 없는 책 · 입력 불변) · 정렬 값 복원(깨진 값 → recent)` +
    `\n  ⑦책 순서 셋(🔴 셋이 다른 답 · 책 없음 맨 아래 · 같으면 최근 저장순 · 구획 안 최신순 유지 · 1·2·10권) · 화면이 순서를 넘기나` +
    `\n  SELF-TEST 통과(판정이 갈라지는가 · 접사가 값을 바꾸는가)\n`,
);
