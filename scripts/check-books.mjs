#!/usr/bin/env node
/**
 * check:books — 책 목록 정렬을 **실물 SQLite 로** 잰다(`docs/KNOWLEDGE_SYSTEM.md` §4.0).
 *
 * 🔴 왜 가드로 두나: **책이 세 권일 때는 어느 순서든 그럴듯하다.** 아무도 못 본다.
 *    스무 권이 되고 나서야 "왜 지금 읽는 책이 아래에 있지"가 되는데, 그때는 원인을 못 찾는다.
 *
 * 🔴 SELF-TEST 가 먼저다(exit 2). 검사 실패는 exit 1.
 */
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

import { runMigrations } from '../db/migrate.ts';
import { buildInsert } from '../db/sql.ts';
import { listBooksQuery } from '../features/books/sql.ts';

// ── 🔴 SELF-TEST ─────────────────────────────────────────────────────
function selfTest() {
  const fail = (m) => {
    console.error(`SELF-TEST FAIL: ${m}`);
    process.exit(2);
  };

  const sql = listBooksQuery();
  // 🔴 양성 대조 — 질의가 **정렬과 tombstone 을 실제로 담고 있는가**.
  //    빈 문자열이나 `SELECT * FROM books` 를 돌려주는 함수도 아래 검사 절반을 통과할 수 있다
  if (!sql.text.includes('ORDER BY')) fail('정렬이 질의에 없다');
  if (!sql.text.includes('MAX(k.created_at)')) fail('마지막 사용 시각을 안 본다');
  if (!sql.text.includes('k.deleted_at IS NULL')) fail('지운 문장을 걸러내지 않는다');
  if (!sql.text.includes('b.deleted_at IS NULL')) fail('지운 책을 걸러내지 않는다');
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

function addRow(driver, table, values, now) {
  const id = randomUUID();
  const sql = buildInsert(table, values, { id, now });
  driver.run(sql.text, sql.params);
  return id;
}

const iso = (day, hour = 12) =>
  `2026-09-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00.000Z`;

function newBook(driver, title, createdDay) {
  return addRow(
    driver,
    'books',
    {
      title,
      author: null,
      cover_uri: null,
      status: 'reading',
      started_at: null,
      finished_at: null,
      total_pages: null,
      read_pages: null,
      cover_color: null,
    },
    iso(createdDay),
  );
}

function saveInto(driver, bookId, day, hour = 12) {
  return addRow(
    driver,
    'knowledge',
    { book_id: bookId, content: `${bookId} 의 문장`, page: null, source_type: 'manual', lang: null },
    iso(day, hour),
  );
}

function titles(db) {
  const sql = listBooksQuery();
  return db
    .prepare(sql.text)
    .all(...sql.params)
    .map((r) => r.title);
}

// ── 본검사 ───────────────────────────────────────────────────────────
selfTest();

const { db, driver } = freshDb();
const bad = [];
const check = (cond, msg) => {
  if (!cond) bad.push(msg);
};

// 🔴 등록 순서와 사용 순서를 **일부러 반대로** 놓는다.
//    같으면 `created_at DESC` 인 옛 규칙도 통과해서 이 검사가 아무것도 안 지킨다.
const oldest = newBook(driver, '가장 먼저 등록한 책', 1);
const middle = newBook(driver, '중간에 등록한 책', 5);
const newest = newBook(driver, '가장 나중에 등록한 책', 9);

saveInto(driver, oldest, 20); // 가장 최근에 쓴 책
saveInto(driver, middle, 10);
// `newest` 에는 문장을 안 넣는다 → 등록 시각(9일)이 정렬 키가 된다

// ── ① 최근에 쓴 책이 위로 ──
check(
  titles(db).join(' | ') === '가장 먼저 등록한 책 | 중간에 등록한 책 | 가장 나중에 등록한 책',
  `① 🔴 정렬이 최근 사용순이 아니다: ${titles(db).join(' | ')}`,
);

// ── ② 새 문장을 넣으면 그 책이 맨 위로 온다 ──
saveInto(driver, newest, 25);
check(
  titles(db)[0] === '가장 나중에 등록한 책',
  `② 문장을 저장했는데 그 책이 위로 안 온다: ${titles(db)[0]}`,
);

// ── 🔴 ③ 지운 문장은 안 센다 ──
const ghost = newBook(driver, '지운 문장만 있는 책', 2);
const gone = saveInto(driver, ghost, 28); // 가장 최근이지만 지울 것이다
check(titles(db)[0] === '지운 문장만 있는 책', '③ 대조군이 안 맞는다. 지우기 전에는 맨 위여야 한다');
driver.run('UPDATE knowledge SET deleted_at = ? WHERE id = ?', [iso(28, 13), gone]);
check(
  titles(db)[0] !== '지운 문장만 있는 책',
  '③ 🔴 지운 문장 때문에 책이 맨 위에 남았다. 그건 틀린 화면이다',
);
// 등록 시각(2일)으로 떨어졌으므로 맨 아래여야 한다
check(
  titles(db).at(-1) === '지운 문장만 있는 책',
  `③ 지운 뒤 등록 시각으로 안 떨어졌다: ${titles(db).join(' | ')}`,
);

// ── ④ 지운 책은 목록에 없다 ──
const removed = newBook(driver, '지운 책', 3);
saveInto(driver, removed, 30);
check(titles(db).includes('지운 책'), '④ 대조군이 안 맞는다');
driver.run('UPDATE books SET deleted_at = ? WHERE id = ?', [iso(30, 13), removed]);
check(!titles(db).includes('지운 책'), '④ 🔴 지운 책이 목록에 나온다');

// ── ⑤ 시각이 같으면 제목 순으로 흔들리지 않는다 ──
const { db: db2, driver: d2 } = freshDb();
newBook(d2, '나', 7);
newBook(d2, '가', 7);
newBook(d2, '다', 7);
const twice = [titles(db2).join(), titles(db2).join()];
check(twice[0] === twice[1], '⑤ 같은 입력에 순서가 두 번 다르게 나온다');
check(twice[0] === '가,나,다', `⑤ 시각이 같을 때 제목 순이 아니다: ${twice[0]}`);

// ── ⑥ 책이 하나도 없으면 빈 목록 ──
const { db: db3 } = freshDb();
check(titles(db3).length === 0, '⑥ 빈 DB 에서 책이 나온다');

if (bad.length > 0) {
  console.error(`\ncheck:books 실패 ${bad.length}건:\n`);
  for (const m of bad) console.error(`  ✗ ${m}`);
  console.error('');
  process.exit(1);
}
console.log(
  `\ncheck:books OK — 🔴 최근 사용순(등록 순서와 반대로 놓고 잼) · 저장하면 위로 ·` +
    `\n  🔴 지운 문장은 안 센다 · 지운 책은 안 나온다 · 동점이면 제목순(안 흔들린다) · 빈 DB` +
    `\n  SELF-TEST 통과(질의가 정렬과 tombstone 을 담고 있는가)\n`,
);
