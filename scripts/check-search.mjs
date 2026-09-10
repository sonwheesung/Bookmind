#!/usr/bin/env node
/**
 * check:search — 검색 네 축을 **실물 SQLite 로** 잰다(`docs/KNOWLEDGE_SYSTEM.md` §6.5).
 *
 * 🔴 왜 가드로 두나: 여기서 틀리면 **오류가 안 나고 결과만 조용히 틀린다.**
 *    특히 `%` 와일드카드는 화면상 "검색이 되긴 된다"로 보여서 영원히 안 들킨다.
 *
 * 🔴 SELF-TEST 가 먼저다(exit 2). 검사 실패는 exit 1.
 */
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

import { runMigrations } from '../db/migrate.ts';
import { buildInsert } from '../db/sql.ts';
import { escapeLike, likePattern, searchQuery } from '../features/search/sql.ts';

// ── 🔴 SELF-TEST ─────────────────────────────────────────────────────
function selfTest() {
  const fail = (m) => {
    console.error(`SELF-TEST FAIL: ${m}`);
    process.exit(2);
  };

  // ① 🔴 양성 대조 — 이스케이프가 **실제로 무언가를 바꾸는가**.
  //    아무것도 안 바꾸면 아래 ③ 검사가 통과해도 아무 뜻이 없다.
  if (escapeLike('100%') === '100%') fail('escapeLike 가 % 를 안 바꾼다. 아무 일도 안 하고 있다');
  if (escapeLike('a_b') === 'a_b') fail('escapeLike 가 _ 를 안 바꾼다');
  if (escapeLike('평범한 문장') !== '평범한 문장') fail('멀쩡한 문자열을 건드린다');

  // ② 🔴 역슬래시를 먼저 바꾸는가. 순서가 틀리면 `\%` 가 `\\%`(다른 뜻)가 된다
  if (escapeLike('\\') !== '\\\\') fail('역슬래시를 이스케이프하지 않는다');
  if (escapeLike('\\%') !== '\\\\\\%') fail('역슬래시를 나중에 바꾼다. 순서가 틀렸다');

  // ③ 빈 검색어와 정상 검색어를 **가르는가**
  if (likePattern('   ') !== null) fail('빈 검색어에 null 을 안 준다');
  if (likePattern('책') === null) fail('멀쩡한 검색어에 null 을 준다');
  if (searchQuery('') !== null) fail('빈 검색어에 질의를 만든다');
  if (searchQuery('책') === null) fail('멀쩡한 검색어에 질의를 안 만든다');
}

// ── 실물 SQLite ──────────────────────────────────────────────────────
function freshDb() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  const driver = {
    exec: (q) => db.exec(q),
    get: (q, p = []) => db.prepare(q).get(...p),
    run: (q, p = []) => db.prepare(q).run(...p),
  };
  runMigrations(driver);
  return { db, driver };
}

const NOW = '2026-09-10T00:00:00.000Z';
let clock = 0;
/** created_at 을 벌려 정렬(최근 순)을 확인할 수 있게 한다 */
function stampNow() {
  clock += 1;
  return `2026-09-${String(10 + clock).padStart(2, '0')}T00:00:00.000Z`;
}

function addRow(driver, table, values, opts = {}) {
  const id = opts.id ?? randomUUID();
  const sql = buildInsert(table, values, { id, now: opts.now ?? stampNow() });
  driver.run(sql.text, sql.params);
  return id;
}

function softDelete(driver, table, id) {
  driver.run(`UPDATE ${table} SET deleted_at = ? WHERE id = ?`, [NOW, id]);
}

function run(db, term) {
  const sql = searchQuery(term);
  if (sql === null) return [];
  return db.prepare(sql.text).all(...sql.params);
}

// ── 본검사 ───────────────────────────────────────────────────────────
selfTest();

const { db, driver } = freshDb();
const bad = [];
const check = (cond, msg) => {
  if (!cond) bad.push(msg);
};

// 시드
const bookId = addRow(driver, 'books', {
  title: '아주 작은 습관의 힘',
  author: null,
  cover_uri: null,
  status: 'reading',
  started_at: null,
  finished_at: null,
  total_pages: null,
  read_pages: null,
  cover_color: null,
});
const kContent = addRow(driver, 'knowledge', {
  book_id: null,
  content: '목표보다 시스템이 중요하다',
  page: null,
  source_type: 'manual',
  lang: null,
});
const kThought = addRow(driver, 'knowledge', {
  book_id: null,
  content: '아무 상관 없는 원문',
  page: null,
  source_type: 'manual',
  lang: null,
});
addRow(driver, 'thoughts', { knowledge_id: kThought, body: '환경을 바꾸면 행동이 쉬워진다' });
const kTag = addRow(driver, 'knowledge', {
  book_id: null,
  content: '태그로만 걸릴 원문',
  page: null,
  source_type: 'manual',
  lang: null,
});
const tagId = addRow(driver, 'tags', { name: '생산성' });
addRow(driver, 'knowledge_tags', { knowledge_id: kTag, tag_id: tagId });
const kBook = addRow(driver, 'knowledge', {
  book_id: bookId,
  content: '책 제목으로만 걸릴 원문',
  page: null,
  source_type: 'manual',
  lang: null,
});
// 🔴 ③ 용 — 원문에 진짜 `%` 가 든 카드. 책 문장에 실제로 나온다(통계·경제서)
const kPercent = addRow(driver, 'knowledge', {
  book_id: null,
  content: '상위 100% 가 아니라 상위 1%',
  page: null,
  source_type: 'manual',
  lang: null,
});
// 🔴 ③ 용 — `_` 가 한 글자로 새면 여기에 맞는다('상_위' → '상단위')
addRow(driver, 'knowledge', {
  book_id: null,
  content: '상단위 표기 규칙',
  page: null,
  source_type: 'manual',
  lang: null,
});

// ── ① 네 축 ──
const ids = (rows) => rows.map((r) => r.id);
check(ids(run(db, '시스템')).includes(kContent), '① 원문으로 못 찾는다');
check(ids(run(db, '환경을')).includes(kThought), '① 내 생각으로 못 찾는다');
check(ids(run(db, '생산성')).includes(kTag), '① 태그로 못 찾는다');
check(ids(run(db, '습관의 힘')).includes(kBook), '① 책 제목으로 못 찾는다');

// 어느 축에서 맞았는지 함께 오나(§6.1)
const thoughtHit = run(db, '환경을').find((r) => r.id === kThought);
check(thoughtHit?.m_thought === 1 && thoughtHit?.m_content === 0, '① 맞은 축을 잘못 표시한다');

// ── ② tombstone ──
const kGone = addRow(driver, 'knowledge', {
  book_id: null,
  content: '지워질 원문 시스템',
  page: null,
  source_type: 'manual',
  lang: null,
});
softDelete(driver, 'knowledge', kGone);
check(!ids(run(db, '시스템')).includes(kGone), '② 지운 카드가 검색에 나온다');

const kLive = addRow(driver, 'knowledge', {
  book_id: null,
  content: '살아 있는 원문',
  page: null,
  source_type: 'manual',
  lang: null,
});
const tGone = addRow(driver, 'thoughts', { knowledge_id: kLive, body: '지워질 생각 유니크단어' });
softDelete(driver, 'thoughts', tGone);
check(!ids(run(db, '유니크단어')).includes(kLive), '② 지운 생각으로 카드가 나온다');

const tagGone = addRow(driver, 'tags', { name: '지워질태그' });
const linkGone = addRow(driver, 'knowledge_tags', { knowledge_id: kLive, tag_id: tagGone });
driver.run(`UPDATE knowledge_tags SET deleted_at = ? WHERE knowledge_id = ? AND tag_id = ?`, [
  NOW,
  kLive,
  tagGone,
]);
void linkGone;
check(!ids(run(db, '지워질태그')).includes(kLive), '② 끊은 태그 연결로 카드가 나온다');

// ── 🔴 ③ 와일드카드 이스케이프 ──
//
// 🔴 검색어를 **와일드카드 하나로** 둔다. `100%` 로 재면 이스케이프를 벗겨도 `%100%%` 라
//    결국 "100 이 든 행"만 나와서 **변이를 넣어도 초록이 유지된다.** 그 검사는 아무것도 안 지킨다.
const live = db.prepare('SELECT COUNT(*) AS n FROM knowledge WHERE deleted_at IS NULL').get().n;
check(live > 1, '③ 대조군이 부족하다. 살아 있는 카드가 둘 미만이다');

// `%` 하나로 검색 → 이스케이프가 살아 있으면 **진짜 `%` 가 든 카드만** 나온다
const pctOnly = run(db, '%');
check(
  pctOnly.length < live,
  `③ 🔴 '%' 하나가 전부를 긁어 왔다(${pctOnly.length}/${live}건). % 가 와일드카드로 샜다`,
);
check(ids(pctOnly).includes(kPercent), "③ '%' 로 진짜 % 가 든 카드를 못 찾는다");

// `_` 하나로 검색 → 새면 "아무 한 글자"라 사실상 전부가 나온다
const underOnly = run(db, '_');
check(
  underOnly.length === 0,
  `③ 🔴 '_' 가 와일드카드로 샜다(${underOnly.length}/${live}건). 밑줄이 든 카드는 하나도 없다`,
);

// 사람이 실제로 치는 형태도 함께
const pct = run(db, '100%');
check(ids(pct).includes(kPercent), '③ 100% 로 그 카드를 못 찾는다');
// `상_위` 는 새면 '상단위' 에 맞는다
check(run(db, '상_위').length === 0, "③ '상_위' 가 '상단위' 를 잡았다. _ 가 샜다");

// ── ④ 중복 ──
const kBoth = addRow(driver, 'knowledge', {
  book_id: null,
  content: '중복확인 원문',
  page: null,
  source_type: 'manual',
  lang: null,
});
const tagBoth = addRow(driver, 'tags', { name: '중복확인' });
addRow(driver, 'knowledge_tags', { knowledge_id: kBoth, tag_id: tagBoth });
const dup = run(db, '중복확인').filter((r) => r.id === kBoth);
check(dup.length === 1, `④ 두 축에 맞은 카드가 ${dup.length}번 나온다`);
check(dup[0]?.m_content === 1 && dup[0]?.m_tag === 1, '④ 두 축 모두 표시돼야 한다');

// ── ⑤ 빈 검색어 ──
check(run(db, '').length === 0, '⑤ 빈 검색어가 결과를 낸다');
check(run(db, '   ').length === 0, '⑤ 공백 검색어가 결과를 낸다');

// 정렬: 최근 저장 순
const ordered = run(db, '원문');
const sorted = [...ordered].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
check(ordered.map((r) => r.id).join() === sorted.map((r) => r.id).join(), '정렬이 최근 저장 순이 아니다');

if (bad.length > 0) {
  console.error(`\ncheck:search 실패 ${bad.length}건:\n`);
  for (const m of bad) console.error(`  ✗ ${m}`);
  console.error('');
  process.exit(1);
}
console.log(
  `\ncheck:search OK — 네 축 · tombstone 3종 · 🔴 와일드카드(% · _) · 중복 접기 · 빈 검색어 · 정렬` +
    `\n  SELF-TEST 통과(이스케이프 양성 대조 포함)\n`,
);
