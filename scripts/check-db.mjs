#!/usr/bin/env node
/**
 * check:db — 로컬 스키마·삭제 규칙을 **실물 SQLite 에 세워서** 잰다(`docs/PLAN.md` Phase 1 완료 기준).
 *
 * 🔴 왜 되는가: `db/` 의 스키마·러너·빌더·삭제 규칙이 전부 **순수 모듈**이라
 *    expo 없이 node 의 `node:sqlite` 에 그대로 물릴 수 있다. 앱과 **같은 코드**를 돌린다 —
 *    가드가 러너를 베껴 만들면 검사하는 것은 러너가 아니라 사본이다.
 *
 * 🔴 SELF-TEST 가 먼저다(exit 2). 판정 함수가 살아 있는지 증명한 뒤에 판정한다 —
 *    형제 `check-i18n.mjs` 가 19일간 초록이었던 사고가 "변이가 안 잡힌다"가 아니라
 *    "정규식이 아무것도 수집하지 않는다"였다(`docs/I18N_SYSTEM.md` §5.1).
 *
 * 검사 실패는 exit 1, SELF-TEST 실패는 exit 2.
 */
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MIGRATIONS, TABLES, TABLE_NAMES } from '../db/schema.ts';
import { runMigrations, readSchemaVersion, CODE_SCHEMA_VERSION } from '../db/migrate.ts';
import { buildInsert, buildSelect, buildSoftDelete, buildReviveWhere, buildRevive } from '../db/sql.ts';
import { deleteKnowledgeSteps, deleteBookSteps, deletePracticeSteps } from '../db/cascade.ts';
import { parsePages, progressPercent, progressRatio } from '../features/books/progress.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const NOW = '2026-09-09T00:00:00.000Z';

// ── 드라이버: node:sqlite 를 SqlDriver 모양으로 감싼다 ────────────────
function open() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  const driver = {
    exec: (sql) => db.exec(sql),
    get: (sql, params = []) => db.prepare(sql).get(...params),
    run: (sql, params = []) => db.prepare(sql).run(...params),
  };
  return { db, driver };
}

const run = (driver, sql) => driver.run(sql.text, sql.params);
const all = (db, sql) => db.prepare(sql.text).all(...sql.params);

const tablesOf = (db) =>
  db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`)
    .all()
    .map((r) => r.name)
    .sort();

const indexesOf = (db) =>
  db
    .prepare(`SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'`)
    .all()
    .map((r) => r.name)
    .sort();

/** 문서 §2 의 `### ` 제목 = 표 이름. 코드와 문서를 직접 맞댄다 */
function tablesInDoc() {
  const text = readFileSync(join(ROOT, 'docs/DATABASE.md'), 'utf8');
  const sec = text.split(/^## 2\. 스키마/m)[1]?.split(/^## 3\./m)[0] ?? '';
  return [...sec.matchAll(/^### (\S+)/gm)].map((m) => m[1]).sort();
}

/** 소스에서 SQL 냄새를 찾는다 — 아래 두 규칙의 공용 스캐너 */
function sourceFiles(dir, out = []) {
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${name}`;
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const st = statSync(join(ROOT, rel));
    if (st.isDirectory()) sourceFiles(rel, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(rel);
  }
  return out;
}

const SOFT_TABLES = TABLE_NAMES.filter((t) => TABLES[t].soft);

/**
 * `FROM <tombstone 표>` 를 쓰면서 근처에 `deleted_at` 이 없는 자리를 찾는다.
 * ⚠ 어림 규칙이다(같은 줄 ±3줄). 목적은 완전 탐지가 아니라 **직접 SQL 로 새는 통로를 막는 것**이고,
 *    정상 경로는 `db/` 헬퍼라 여기 걸릴 일이 원래 없다.
 */
function scanRawSelects(text) {
  const lines = text.split('\n');
  const hits = [];
  const re = new RegExp(`\\bFROM\\s+(${SOFT_TABLES.join('|')})\\b`, 'i');
  for (let i = 0; i < lines.length; i++) {
    if (!re.test(lines[i])) continue;
    const window = lines.slice(Math.max(0, i - 3), i + 4).join('\n');
    if (!/deleted_at|includeDeleted/.test(window)) hits.push({ line: i + 1, text: lines[i].trim() });
  }
  return hits;
}

const scanAutoincrement = (text) => (text.match(/AUTOINCREMENT/gi) ?? []).length;

// ── 🔴 SELF-TEST — 판정 함수가 살아 있는가 (exit 2) ───────────────────
function selfTest() {
  const fail = (m) => {
    console.error(`SELF-TEST FAIL: ${m}`);
    process.exit(2);
  };

  // ① node:sqlite 가 실제로 표를 만들고 tablesOf 가 그걸 본다
  const probe = new DatabaseSync(':memory:');
  if (tablesOf(probe).length !== 0) fail('빈 DB 인데 표가 보인다');
  probe.exec('CREATE TABLE zz (a TEXT)');
  if (!tablesOf(probe).includes('zz')) fail('표를 만들었는데 tablesOf 가 못 본다');
  probe.close();

  // ② 빌더가 tombstone 필터를 실제로 붙이는가 / 안 붙는 경우도 있는가
  if (!buildSelect('knowledge').text.includes('deleted_at IS NULL')) {
    fail('buildSelect 가 deleted_at 필터를 안 붙인다');
  }
  if (buildSelect('knowledge', { includeDeleted: true }).text.includes('deleted_at IS NULL')) {
    fail('includeDeleted 인데도 필터가 붙는다 — 되살리기·복원 검증이 불가능해진다');
  }
  if (buildSelect('review_logs').text.includes('deleted_at')) {
    fail('review_logs 에 deleted_at 필터가 붙었다 — 그 표에는 그 칸이 없다');
  }

  // ③ 원시 SELECT 스캐너가 나쁜 것을 잡고 좋은 것을 안 잡는가
  if (scanRawSelects(`const q = 'SELECT * FROM knowledge ORDER BY created_at';`).length !== 1) {
    fail('필터 없는 SELECT 를 스캐너가 못 잡는다');
  }
  if (scanRawSelects(`const q = 'SELECT * FROM knowledge WHERE deleted_at IS NULL';`).length !== 0) {
    fail('필터 있는 SELECT 를 스캐너가 오탐한다');
  }

  // ④ AUTOINCREMENT 스캐너
  if (scanAutoincrement('id INTEGER PRIMARY KEY AUTOINCREMENT') !== 1) {
    fail('AUTOINCREMENT 를 스캐너가 못 잡는다');
  }
  if (scanAutoincrement('id TEXT PRIMARY KEY') !== 0) fail('AUTOINCREMENT 오탐');

  // ⑤ 러너가 새 DB 를 0 으로 읽는가 (읽기부터 틀리면 아래 멱등 검사가 무의미하다)
  const { db, driver } = open();
  driver.exec('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
  if (readSchemaVersion(driver) !== 0) fail('새 DB 의 schema_version 이 0 이 아니다');
  db.close();

  // ⑥ 물리 보존 규칙이 코드로 막혀 있는가
  let blocked = false;
  try {
    buildSoftDelete('review_logs', { id: 'x' }, NOW);
  } catch {
    blocked = true;
  }
  if (!blocked) fail('review_logs 를 지우려는데 빌더가 안 막는다');

  // ⑦ 규약 칸을 손으로 넘기면 막는가
  let managed = false;
  try {
    buildInsert('knowledge', { content: 'x', source_type: 'manual', updated_at: NOW }, { id: 'i', now: NOW });
  } catch {
    managed = true;
  }
  if (!managed) fail('updated_at 을 손으로 넘겼는데 빌더가 안 막는다');
}

// ── 검사 (exit 1) ────────────────────────────────────────────────────
const bad = [];
const check = (cond, msg) => {
  if (!cond) bad.push(msg);
};

function migrated() {
  const { db, driver } = open();
  runMigrations(driver);
  return { db, driver };
}

function checkSchema() {
  const { db, driver } = migrated();

  const actual = tablesOf(db);
  const doc = tablesInDoc();
  const code = [...TABLE_NAMES].sort();

  check(actual.length === 12, `표 12개여야 하는데 ${actual.length}개 — ${actual.join(', ')}`);
  check(
    JSON.stringify(actual) === JSON.stringify(doc),
    `DB 와 DATABASE.md §2 의 표 이름이 다르다\n      DB : ${actual.join(', ')}\n      문서: ${doc.join(', ')}`,
  );
  check(
    JSON.stringify(actual) === JSON.stringify(code),
    `DB 와 schema.ts TABLES 가 다르다\n      DB : ${actual.join(', ')}\n      코드: ${code.join(', ')}`,
  );

  // PLAN Phase 1 완료 기준의 인덱스 + §4 의 기억률 인덱스
  const idx = indexesOf(db);
  for (const want of [
    'idx_rs_due',
    'idx_k_book',
    'idx_k_created',
    'idx_pl_practice_date',
    'idx_rl_reviewed',
  ]) {
    check(idx.includes(want), `인덱스 ${want} 가 없다`);
  }

  // 규약 칸이 실제로 있는가 — schema.ts 의 TABLES 선언과 실물 대조
  for (const t of TABLE_NAMES) {
    const cols = db
      .prepare(`PRAGMA table_info(${t})`)
      .all()
      .map((c) => c.name);
    const m = TABLES[t];
    if (m.id) check(cols.includes('id'), `${t} 에 id 가 없다`);
    if (m.stamps) {
      check(cols.includes('created_at'), `${t} 에 created_at 이 없다`);
      check(cols.includes('updated_at'), `${t} 에 updated_at 이 없다`);
    }
    check(
      cols.includes('deleted_at') === m.soft,
      `${t} 의 deleted_at 유무가 TABLES 선언과 다르다 (실물 ${cols.includes('deleted_at')} ≠ 선언 ${m.soft})`,
    );
  }

  db.close();
}

/**
 * 🔴 Expand-only 의 본론 — **이미 데이터가 있는 옛 DB 가 올라가는가.**
 *    새 DB 에서 v1..vN 을 한 번에 도는 것과는 다른 축이다. 사용자의 기기에는 데이터가 들어 있고,
 *    그 위로 마이그레이션이 지나간다. 그때 행이 사라지거나 컬럼이 안 붙으면 되돌릴 방법이 없다.
 */
function checkUpgrade() {
  const { db, driver } = open();

  // v1 만 적용된 옛 DB 를 손으로 만든다(러너를 쓰면 최신까지 가 버린다)
  driver.exec('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
  const v1 = MIGRATIONS[0];
  driver.exec(v1);
  driver.run('INSERT INTO meta (key, value) VALUES (?, ?)', ['schema_version', '1']);

  const bookId = randomUUID();
  const ins = buildInsert('books', { title: '옛 DB 의 책', status: 'reading' }, { id: bookId, now: NOW });
  driver.run(ins.text, ins.params);

  const before = db
    .prepare('PRAGMA table_info(books)')
    .all()
    .map((c) => c.name);
  check(!before.includes('total_pages'), 'v1 인데 벌써 total_pages 가 있다 — 이 검사가 무의미해진다');

  runMigrations(driver); // v1 → v2

  const after = db
    .prepare('PRAGMA table_info(books)')
    .all()
    .map((c) => c.name);
  check(after.includes('total_pages'), 'v2 를 돌렸는데 total_pages 가 없다');
  check(after.includes('read_pages'), 'v2 를 돌렸는데 read_pages 가 없다');
  check(readSchemaVersion(driver) === CODE_SCHEMA_VERSION, '버전이 안 올라갔다');

  const row = db.prepare('SELECT title, total_pages FROM books WHERE id = ?').get(bookId);
  check(row?.title === '옛 DB 의 책', '🔴 마이그레이션이 기존 행을 날렸다');
  check(row?.total_pages === null, '새 컬럼의 기존 행 값이 NULL 이 아니다');

  db.close();
}

function checkIdempotent() {
  const { db, driver } = migrated();
  const before = { tables: tablesOf(db), indexes: indexesOf(db), v: readSchemaVersion(driver) };

  // 씨앗 한 줄을 넣고 두 번째 실행이 그걸 건드리는지도 본다
  run(
    driver,
    buildInsert('books', { title: '두 번 돌려도 하나', status: 'wish' }, { id: randomUUID(), now: NOW }),
  );

  runMigrations(driver); // 2회차
  const after = { tables: tablesOf(db), indexes: indexesOf(db), v: readSchemaVersion(driver) };

  check(before.v === CODE_SCHEMA_VERSION, `1회차 버전이 ${before.v} — 코드는 ${CODE_SCHEMA_VERSION}`);
  check(after.v === before.v, `2회차에 버전이 ${before.v} → ${after.v} 로 바뀌었다`);
  check(JSON.stringify(after.tables) === JSON.stringify(before.tables), '2회차에 표가 바뀌었다');
  check(JSON.stringify(after.indexes) === JSON.stringify(before.indexes), '2회차에 인덱스가 바뀌었다');
  check(
    db.prepare('SELECT COUNT(*) AS n FROM books').get().n === 1,
    '2회차 마이그레이션이 데이터를 건드렸다',
  );

  // 🔴 다운그레이드는 조용히 지나가면 안 된다
  driver.run('UPDATE meta SET value = ? WHERE key = ?', [String(CODE_SCHEMA_VERSION + 1), 'schema_version']);
  let threw = false;
  try {
    runMigrations(driver);
  } catch {
    threw = true;
  }
  check(threw, 'DB 가 코드보다 앞선 상태인데 러너가 그냥 진행한다');

  db.close();
}

/** 지식 하나 + 딸린 것 전부를 만든다 */
function seedKnowledge(driver, { bookId = null } = {}) {
  const ids = {
    knowledge: randomUUID(),
    thought: randomUUID(),
    analysis: randomUUID(),
    question: randomUUID(),
    log: randomUUID(),
    practice: randomUUID(),
  };
  const stamp = (id) => ({ id, now: NOW });

  run(
    driver,
    buildInsert(
      'knowledge',
      { book_id: bookId, content: '목표보다 시스템', source_type: 'manual' },
      stamp(ids.knowledge),
    ),
  );
  run(driver, buildInsert('thoughts', { knowledge_id: ids.knowledge, body: '내 생각' }, stamp(ids.thought)));
  run(
    driver,
    buildInsert(
      'ai_analyses',
      {
        knowledge_id: ids.knowledge,
        content_type: 'CONCEPT',
        summary: '시스템 중심 사고',
        actionability: 'high',
        lang: 'ko',
        revision: 1,
      },
      stamp(ids.analysis),
    ),
  );
  run(
    driver,
    buildInsert(
      'recall_questions',
      {
        knowledge_id: ids.knowledge,
        analysis_id: ids.analysis,
        kind: 'recall',
        question: '핵심은 무엇이었나요?',
        order_no: 1,
      },
      stamp(ids.question),
    ),
  );
  run(
    driver,
    buildInsert(
      'review_schedules',
      {
        knowledge_id: ids.knowledge,
        due_at: NOW,
        state: 'new',
        stability: 1.5,
        difficulty: 5.0,
        reps: 0,
        lapses: 0,
      },
      stamp(randomUUID()),
    ),
  );
  run(
    driver,
    buildInsert(
      'review_logs',
      { knowledge_id: ids.knowledge, rating: 'good', reviewed_at: NOW },
      stamp(ids.log),
    ),
  );
  run(
    driver,
    buildInsert(
      'practices',
      {
        knowledge_id: ids.knowledge,
        title: '자기 전 폰을 책상에',
        started_at: NOW,
        repeat_rule: 'daily',
        active: 1,
      },
      stamp(ids.practice),
    ),
  );
  return ids;
}

function checkTombstone() {
  const { db, driver } = migrated();
  const ids = seedKnowledge(driver);

  const live = (t, where, params = []) => all(db, buildSelect(t, { where, params })).length;

  check(live('knowledge', 'id = ?', [ids.knowledge]) === 1, '넣은 지식이 조회에 없다');

  for (const step of deleteKnowledgeSteps(ids.knowledge, NOW)) run(driver, step);

  // ① 지운 것은 안 보인다
  check(live('knowledge', 'id = ?', [ids.knowledge]) === 0, '🔴 지운 지식이 조회에 남아 있다');
  check(live('thoughts', 'knowledge_id = ?', [ids.knowledge]) === 0, '지운 지식의 생각이 남아 있다');
  check(live('ai_analyses', 'knowledge_id = ?', [ids.knowledge]) === 0, '지운 지식의 분석이 남아 있다');
  check(
    live('recall_questions', 'knowledge_id = ?', [ids.knowledge]) === 0,
    '지운 지식의 회상 질문이 남아 있다',
  );
  check(
    live('review_schedules', 'knowledge_id = ?', [ids.knowledge]) === 0,
    '🔴 지운 지식이 복습 큐에 남아 있다 (REVIEW_SYSTEM.md §8 의 그 버그)',
  );

  // ② tombstone 은 행으로 남아 있다 — 백업 병합의 전제(§1.1)
  check(
    all(db, buildSelect('knowledge', { where: 'id = ?', params: [ids.knowledge], includeDeleted: true }))
      .length === 1,
    'tombstone 이 물리 삭제됐다 — 복원이 지운 것을 되살리게 된다',
  );

  // ③ 남겨야 하는 것
  check(
    db.prepare('SELECT COUNT(*) AS n FROM review_logs WHERE knowledge_id = ?').get(ids.knowledge).n === 1,
    '🔴 review_logs 가 사라졌다 — 물리 보존이어야 한다(§2)',
  );
  const practice = all(db, buildSelect('practices', { where: 'id = ?', params: [ids.practice] }));
  check(practice.length === 1, '🔴 지식을 지웠다고 실천까지 사라졌다(기둥 4)');
  check(practice[0]?.knowledge_id === null, '실천의 지식 연결이 안 끊겼다 — 고아 참조가 남는다');

  db.close();
}

function checkBookDelete() {
  const { db, driver } = migrated();
  const bookId = randomUUID();
  run(
    driver,
    buildInsert('books', { title: '아주 작은 습관의 힘', status: 'reading' }, { id: bookId, now: NOW }),
  );
  const ids = seedKnowledge(driver, { bookId });

  for (const step of deleteBookSteps(bookId, NOW)) run(driver, step);

  const k = all(db, buildSelect('knowledge', { where: 'id = ?', params: [ids.knowledge] }));
  check(k.length === 1, '🔴 책을 지웠더니 지식이 사라졌다 — 캐스케이드 금지(§3)');
  check(k[0]?.book_id === null, '책을 지웠는데 book_id 가 안 끊겼다');
  check(
    all(db, buildSelect('books', { where: 'id = ?', params: [bookId] })).length === 0,
    '책이 안 지워졌다',
  );
  db.close();
}

function checkOrphanTags() {
  const { db, driver } = migrated();
  const a = seedKnowledge(driver);
  const b = seedKnowledge(driver);
  const soloTag = randomUUID();
  const sharedTag = randomUUID();
  run(driver, buildInsert('tags', { name: '습관' }, { id: soloTag, now: NOW }));
  run(driver, buildInsert('tags', { name: '시스템' }, { id: sharedTag, now: NOW }));
  const link = (k, t) =>
    run(
      driver,
      buildInsert('knowledge_tags', { knowledge_id: k, tag_id: t }, { id: randomUUID(), now: NOW }),
    );
  link(a.knowledge, soloTag);
  link(a.knowledge, sharedTag);
  link(b.knowledge, sharedTag);

  for (const step of deleteKnowledgeSteps(a.knowledge, NOW)) run(driver, step);

  check(
    all(db, buildSelect('tags', { where: 'id = ?', params: [soloTag] })).length === 0,
    '참조가 0이 된 태그가 안 지워졌다(고아 태그 정리)',
  );
  check(
    all(db, buildSelect('tags', { where: 'id = ?', params: [sharedTag] })).length === 1,
    '🔴 다른 지식이 아직 쓰는 태그를 지웠다',
  );
  db.close();
}

function checkRevive() {
  const { db, driver } = migrated();

  // ① practice_logs — 체크 → 해제 → 같은 날 다시 체크(§1.4)
  const practiceId = randomUUID();
  run(
    driver,
    buildInsert(
      'practices',
      { title: '물 마시기', started_at: NOW, repeat_rule: 'daily', active: 1 },
      { id: practiceId, now: NOW },
    ),
  );
  const logId = randomUUID();
  run(
    driver,
    buildInsert(
      'practice_logs',
      { practice_id: practiceId, date: '2026-09-09', done_at: NOW },
      { id: logId, now: NOW },
    ),
  );
  run(driver, buildSoftDelete('practice_logs', { id: logId }, NOW));
  check(
    all(db, buildSelect('practice_logs', { where: 'practice_id = ?', params: [practiceId] })).length === 0,
    '체크를 해제했는데 로그가 살아 있다',
  );

  let uniqueViolation = false;
  try {
    run(
      driver,
      buildInsert(
        'practice_logs',
        { practice_id: practiceId, date: '2026-09-09', done_at: NOW },
        { id: randomUUID(), now: NOW },
      ),
    );
  } catch {
    uniqueViolation = true;
  }
  check(uniqueViolation, 'UNIQUE(practice_id, date) 가 안 걸린다 — 하루 두 건이 생긴다');

  run(driver, buildRevive('practice_logs', { id: logId }, NOW));
  const revived = all(db, buildSelect('practice_logs', { where: 'practice_id = ?', params: [practiceId] }));
  check(revived.length === 1, '🔴 해제한 체크를 같은 날 되살리지 못한다(§1.4)');

  // ② tags — 같은 이름을 다시 만든다
  const tagId = randomUUID();
  run(driver, buildInsert('tags', { name: '생산성' }, { id: tagId, now: NOW }));
  run(driver, buildSoftDelete('tags', { id: tagId }, NOW));
  run(driver, buildReviveWhere('tags', 'name = ?', ['생산성'], NOW));
  check(
    all(db, buildSelect('tags', { where: 'name = ?', params: ['생산성'] })).length === 1,
    '🔴 지운 태그와 같은 이름을 다시 만들 수 없다(§1.4)',
  );
  check(
    db.prepare('SELECT COUNT(*) AS n FROM tags WHERE name = ?').get('생산성').n === 1,
    '같은 이름의 죽은 행이 쌓였다',
  );

  db.close();
}

function checkPracticeDelete() {
  const { db, driver } = migrated();
  const practiceId = randomUUID();
  run(
    driver,
    buildInsert(
      'practices',
      { title: '산책', started_at: NOW, repeat_rule: 'weekdays', active: 1 },
      { id: practiceId, now: NOW },
    ),
  );
  run(
    driver,
    buildInsert(
      'practice_logs',
      { practice_id: practiceId, date: '2026-09-08', done_at: NOW },
      { id: randomUUID(), now: NOW },
    ),
  );

  for (const step of deletePracticeSteps(practiceId, NOW)) run(driver, step);

  check(
    all(db, buildSelect('practices', { where: 'id = ?', params: [practiceId] })).length === 0,
    '실천이 안 지워졌다',
  );
  check(
    all(db, buildSelect('practice_logs', { where: 'practice_id = ?', params: [practiceId] })).length === 0,
    '실천을 지웠는데 체크 기록이 남아 있다',
  );
  db.close();
}

/**
 * 파생값(진행률) — `KNOWLEDGE_SYSTEM.md` §4.4 · `DATABASE.md` §4.
 * 🔴 여기서 재는 핵심은 **"모른다(null)"와 "0%"가 구분되는가** 다. 섞이면 화면이 거짓말을 한다.
 */
function checkProgress() {
  check(progressPercent({ total_pages: 250, read_pages: 180 }) === 72, '기본 계산이 틀린다');
  check(progressPercent({ total_pages: 250, read_pages: 0 }) === 0, '0쪽은 0% 여야 한다');

  // 🔴 모르는 것은 null 이다 — 0 이 아니다
  check(progressRatio({ total_pages: null, read_pages: 100 }) === null, '총 쪽을 모르는데 비율이 나왔다');
  check(progressRatio({ total_pages: 250, read_pages: null }) === null, '읽은 쪽을 모르는데 비율이 나왔다');
  check(progressRatio({ total_pages: 0, read_pages: 0 }) === null, '총 0쪽인데 0으로 나눴다');

  // ⚠ 넘치면 자른다(개정판·전자책)
  check(progressPercent({ total_pages: 100, read_pages: 300 }) === 100, '100%를 넘겼다');
  check(progressRatio({ total_pages: 100, read_pages: -5 }) === null, '음수를 그대로 썼다');

  // 입력 파싱 — 빈 값과 숫자 아닌 것은 "모름"
  check(parsePages('  180 ') === 180, '공백 낀 숫자를 못 읽는다');
  check(parsePages('') === null, '빈 값이 0 이 됐다');
  check(parsePages('백팔십') === null, '숫자가 아닌데 값이 나왔다');
  check(parsePages('12.5') === null, '소수를 받아들였다');
  check(parsePages('0') === 0, '0 을 못 받는다');
}

function checkSource() {
  // 🔴 자동증가 정수 ID 0건 (PLAN Phase 1 완료 기준)
  let auto = 0;
  for (const f of sourceFiles('db')) auto += scanAutoincrement(readFileSync(join(ROOT, f), 'utf8'));
  check(auto === 0, `AUTOINCREMENT 가 db/ 에 ${auto}건 있다 — UUID PK 규약 위반(결정 #8)`);

  // db/ 밖에서 tombstone 표를 직접 조회하는 자리
  const files = [
    ...sourceFiles('app'),
    ...sourceFiles('components'),
    ...sourceFiles('lib'),
    ...sourceFiles('theme'),
  ];
  for (const f of files) {
    for (const hit of scanRawSelects(readFileSync(join(ROOT, f), 'utf8'))) {
      bad.push(`${relative('.', f)}:${hit.line} — deleted_at 필터 없이 직접 조회한다: ${hit.text}`);
    }
  }
}

// ── 실행 ─────────────────────────────────────────────────────────────
/**
 * 🔴 단계마다 감싼다. 감싸지 않으면 스키마가 깨진 변이에서 **예외로 죽어**
 *    앞 단계가 모아 둔 실패 목록이 화면에 안 나온다 — exit 1 은 나는데 이유를 못 읽는다
 *    (2026-09-09 변이 주입에서 실제로 셋이 그랬다).
 */
function stage(name, fn) {
  try {
    fn();
  } catch (e) {
    bad.push(`${name} 단계가 예외로 죽었다: ${e instanceof Error ? e.message : String(e)}`);
  }
}

selfTest();
stage('스키마', checkSchema);
stage('멱등', checkIdempotent);
stage('업그레이드', checkUpgrade);
stage('tombstone', checkTombstone);
stage('책 삭제', checkBookDelete);
stage('고아 태그', checkOrphanTags);
stage('되살리기', checkRevive);
stage('실천 삭제', checkPracticeDelete);
stage('진행률', checkProgress);
stage('소스 스캔', checkSource);

if (bad.length > 0) {
  console.error(`check:db FAIL (${bad.length})`);
  for (const m of bad) console.error('  ' + m);
  process.exit(1);
}
console.log(
  `check:db OK — 12표 · 마이그레이션 v${CODE_SCHEMA_VERSION}(${MIGRATIONS.length}단계) 멱등 · tombstone·되살리기·삭제규칙 · 진행률 파생값 · SELF-TEST 7종`,
);
