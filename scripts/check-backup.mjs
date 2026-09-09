#!/usr/bin/env node
/**
 * check:backup — 내보내기·가져오기를 **실물 SQLite 왕복으로** 잰다(`docs/BACKUP_SYSTEM.md` §7).
 *
 * 🔴 **표 목록이 어긋나는 것이 이 기능의 유일한 조용한 실패다.**
 *    표를 하나 추가하고 백업에 안 넣으면 화면도 안 깨지고 다른 가드도 안 터지는데,
 *    사용자는 **기기를 바꾼 뒤에야** 안다. 그래서 축 ①이 `TABLE_NAMES` − `meta` 와의 대조다.
 *
 * 🔴 되는 이유는 `db/`·`features/backup/{format,merge}.ts` 가 순수하기 때문이다 —
 *    앱과 **같은 코드**를 node 에서 돌린다. expo-file-system·expo-sharing 은 화면 쪽 얇은 층뿐이다.
 *
 * 검사 실패는 exit 1, SELF-TEST 실패는 exit 2.
 */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { TABLES, TABLE_NAMES } from '../db/schema.ts';
import { runMigrations, readSchemaVersion, CODE_SCHEMA_VERSION } from '../db/migrate.ts';
import { buildDeleteAll, buildRowInsert, buildRowUpdate, pickKnown } from '../db/restore.ts';
import {
  BACKUP_TABLES,
  DELETE_ORDER,
  INSERT_ORDER,
  backupFileName,
  buildBackup,
  parseBackup,
  FORMAT_VERSION,
} from '../features/backup/format.ts';
import { planMerge, planReplace, missingTables } from '../features/backup/merge.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const bad = [];
const note = (m) => bad.push(m);

// ── 하네스 ────────────────────────────────────────────────────────────
function open() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  const driver = {
    exec: (sql) => db.exec(sql),
    get: (sql, params = []) => db.prepare(sql).get(...params),
    run: (sql, params = []) => db.prepare(sql).run(...params),
  };
  runMigrations(driver);
  return db;
}

const columnsOf = (db, table) =>
  db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .map((r) => r.name);

function allColumns(db) {
  const out = {};
  for (const t of BACKUP_TABLES) out[t] = columnsOf(db, t);
  return out;
}

/** 🔴 tombstone 까지 통째로 — 앱의 `dumpTable` 과 같은 질의다 */
const dump = (db, table) => db.prepare(`SELECT * FROM ${table}`).all();

function snapshot(db) {
  const out = {};
  for (const t of BACKUP_TABLES) out[t] = dump(db, t);
  return out;
}

const runSql = (db, sql) => db.prepare(sql.text).run(...sql.params);

function apply(db, ops) {
  db.exec('BEGIN');
  try {
    for (const op of ops) {
      const sql =
        op.kind === 'delete-all'
          ? buildDeleteAll(op.table)
          : op.kind === 'insert'
            ? buildRowInsert(op.table, op.row)
            : buildRowUpdate(op.table, op.row);
      runSql(db, sql);
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

const T0 = '2026-09-01T00:00:00.000Z';
const T1 = '2026-09-05T00:00:00.000Z';
const T2 = '2026-09-09T00:00:00.000Z';

/** 씨앗 — 표를 골고루 채운다. 지운 것 하나, 태그 둘, 실천 로그 하나가 포인트다 */
function seed(db, { now = T0 } = {}) {
  const ins = (t, row) => runSql(db, buildRowInsert(t, row));
  ins('books', {
    id: 'b1',
    title: 'Atomic Habits',
    author: 'James Clear',
    cover_uri: null,
    status: 'reading',
    started_at: null,
    finished_at: null,
    total_pages: 320,
    read_pages: 120,
    cover_color: '#DCE6EC',
    created_at: now,
    updated_at: now,
    deleted_at: null,
  });
  ins('knowledge', {
    id: 'k1',
    book_id: 'b1',
    content: 'Systems beat goals.',
    page: '45',
    source_type: 'manual',
    lang: 'en',
    created_at: now,
    updated_at: now,
    deleted_at: null,
  });
  // 🔴 지운 문장 — 파일에 tombstone 으로 실려야 한다
  ins('knowledge', {
    id: 'k2',
    book_id: null,
    content: 'deleted one',
    page: null,
    source_type: 'manual',
    lang: null,
    created_at: now,
    updated_at: now,
    deleted_at: now,
  });
  ins('thoughts', {
    id: 'th1',
    knowledge_id: 'k1',
    body: 'move the phone',
    created_at: now,
    updated_at: now,
    deleted_at: null,
  });
  ins('tags', { id: 'tg1', name: 'habit', created_at: now, updated_at: now, deleted_at: null });
  ins('tags', { id: 'tg2', name: 'environment', created_at: now, updated_at: now, deleted_at: null });
  ins('knowledge_tags', {
    knowledge_id: 'k1',
    tag_id: 'tg1',
    created_at: now,
    updated_at: now,
    deleted_at: null,
  });
  ins('review_schedules', {
    knowledge_id: 'k1',
    due_at: T1,
    state: 'learning',
    stability: 1.5,
    difficulty: 5.2,
    reps: 1,
    lapses: 0,
    last_reviewed_at: now,
    learning_steps: 1,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  });
  ins('review_logs', {
    id: 'rl1',
    knowledge_id: 'k1',
    question_id: null,
    rating: 'good',
    answer_text: null,
    elapsed_days: 0,
    scheduled_days: 0,
    reviewed_at: now,
  });
  ins('practices', {
    id: 'p1',
    knowledge_id: 'k1',
    title: 'phone out of bedroom',
    started_at: now,
    repeat_rule: 'daily',
    ended_at: null,
    active: 1,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  });
  ins('practice_logs', {
    id: 'pl1',
    practice_id: 'p1',
    date: '2026-09-01',
    done_at: now,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  });
}

const exportOf = (db) =>
  buildBackup({
    tables: snapshot(db),
    schemaVersion: readSchemaVersion({ get: (s, p = []) => db.prepare(s).get(...p) }),
    appVersion: '1.0.0',
    platform: 'test',
    exportedAt: T2,
  });

const sortRows = (table, rows) =>
  [...rows].sort((a, b) => {
    const k = (r) => TABLES[table].pk.map((c) => String(r[c])).join(' ');
    return k(a) < k(b) ? -1 : k(a) > k(b) ? 1 : 0;
  });

/** 두 DB 를 **행 단위로** 맞댄다. 개수만 세면 값이 뒤바뀐 것을 못 잡는다 */
function diffAll(a, b) {
  const out = [];
  for (const t of BACKUP_TABLES) {
    const x = sortRows(t, dump(a, t));
    const y = sortRows(t, dump(b, t));
    if (x.length !== y.length) {
      out.push(`${t}: 행 수가 다르다 ${x.length} ≠ ${y.length}`);
      continue;
    }
    for (let i = 0; i < x.length; i++) {
      if (JSON.stringify(x[i]) !== JSON.stringify(y[i])) {
        out.push(`${t}[${i}]: ${JSON.stringify(x[i])} ≠ ${JSON.stringify(y[i])}`);
      }
    }
  }
  return out;
}

// ── 🔴 SELF-TEST — 판정 도구가 살아 있는가 (exit 2) ────────────────────
function selfTest() {
  const fail = (m) => {
    console.error(`SELF-TEST FAIL: ${m}`);
    process.exit(2);
  };

  // ① 하네스가 실제로 표를 세우고 씨앗이 들어가는가
  const db = open();
  seed(db);
  if (dump(db, 'knowledge').length !== 2) fail('씨앗이 안 들어갔다 — 아래 왕복 검사가 전부 무의미해진다');
  if (dump(db, 'knowledge').filter((r) => r.deleted_at !== null).length !== 1) {
    fail('tombstone 씨앗이 없다 — ③ 축이 아무것도 못 잰다');
  }

  // ② diffAll 이 차이를 실제로 보는가 (같으면 0, 다르면 >0)
  const twin = open();
  seed(twin);
  if (diffAll(db, twin).length !== 0) fail('같은 두 DB 를 다르다고 한다');
  runSql(twin, buildRowUpdate('books', { id: 'b1', title: 'CHANGED' }));
  if (diffAll(db, twin).length === 0) fail('제목을 바꿨는데 diffAll 이 못 본다');

  // ③ pickKnown 이 모르는 컬럼을 실제로 버리는가
  const picked = pickKnown({ id: 'x', future_col: 1 }, ['id']);
  if (picked.future_col !== undefined || picked.id !== 'x') fail('pickKnown 이 컬럼을 못 고른다');

  // ④ parseBackup 이 좋은 것을 통과시키는가 (거부만 보면 "항상 거부"도 통과한다)
  const good = parseBackup(JSON.stringify(exportOf(db)), CODE_SCHEMA_VERSION);
  if (!good.ok) fail(`정상 파일을 거부한다: ${good.detail}`);
  if (parseBackup('{}', CODE_SCHEMA_VERSION).ok) fail('빈 객체를 통과시킨다');

  db.close();
  twin.close();
}

// ── ① 표 목록 = TABLE_NAMES − meta ────────────────────────────────────
function checkTableList() {
  const want = TABLE_NAMES.filter((t) => t !== 'meta');
  const got = [...BACKUP_TABLES];
  for (const t of want) if (!got.includes(t)) note(`① 표 누락: ${t} 가 백업 범위에 없다`);
  for (const t of got) if (!want.includes(t)) note(`① 표 잉여: ${t}`);
  if (got.includes('meta')) note('① meta 는 사용자 데이터가 아니다 — 백업에 넣지 않는다');

  // 순서 배열도 같은 집합이어야 한다 — 하나 빠지면 그 표만 조용히 복원되지 않는다
  for (const [name, order] of [
    ['INSERT_ORDER', INSERT_ORDER],
    ['DELETE_ORDER', DELETE_ORDER],
  ]) {
    if (order.length !== want.length) note(`① ${name} 길이 ${order.length} ≠ ${want.length}`);
    for (const t of want) if (!order.includes(t)) note(`① ${name} 에 ${t} 가 없다`);
  }
  if (DELETE_ORDER.join() !== [...INSERT_ORDER].reverse().join()) {
    note('① DELETE_ORDER 가 INSERT_ORDER 의 역순이 아니다 — FK 로 롤백된다');
  }

  const file = exportOf(open());
  const miss = missingTables(file.data);
  if (miss.length > 0) note(`① 파일에 배열이 없는 표: ${miss.join(', ')}`);
}

// ── ② 왕복: 시드 → 내보내기 → 빈 DB 로 가져오기 → 행 단위 대조 ────────
function checkRoundTrip() {
  const src = open();
  seed(src);
  const json = JSON.stringify(exportOf(src));

  const dst = open();
  const parsed = parseBackup(json, CODE_SCHEMA_VERSION);
  if (!parsed.ok) {
    note(`② 자기가 만든 파일을 자기가 거부한다: ${parsed.detail}`);
    return;
  }
  const plan = planReplace(parsed.file.data, allColumns(dst));
  apply(dst, plan.ops);

  const diff = diffAll(src, dst);
  for (const d of diff) note(`② 왕복 불일치 — ${d}`);

  // 🔴 같은 파일을 두 번 넣어도 같아야 한다(바꾸기는 멱등이다)
  apply(dst, planReplace(parsed.file.data, allColumns(dst)).ops);
  for (const d of diffAll(src, dst)) note(`② 두 번 넣으니 달라진다 — ${d}`);
  src.close();
  dst.close();
}

// ── ③ tombstone 이 파일에 실리고, 복원 뒤에도 지워진 채로 있다 ─────────
function checkTombstone() {
  const src = open();
  seed(src);
  const file = exportOf(src);
  const dead = file.data.knowledge.filter((r) => r.deleted_at !== null);
  if (dead.length !== 1) note(`③ 파일에 tombstone 이 ${dead.length}개다 — 지운 기록이 빠졌다`);

  const dst = open();
  apply(dst, planReplace(file.data, allColumns(dst)).ops);
  const revived = dump(dst, 'knowledge').filter((r) => r.id === 'k2' && r.deleted_at === null);
  if (revived.length > 0) note('③ 🔴 지운 문장이 복원으로 되살아났다');

  // 합치기에서도 같아야 한다: 살아 있는 로컬 행을 파일의 tombstone 이 덮는다
  const local = open();
  seed(local, { now: T0 });
  runSql(local, buildRowUpdate('knowledge', { id: 'k2', deleted_at: null, updated_at: T0 }));
  const later = {
    ...file.data,
    knowledge: file.data.knowledge.map((r) => (r.id === 'k2' ? { ...r, updated_at: T2 } : r)),
  };
  apply(local, planMerge(later, snapshot(local), allColumns(local)).ops);
  const row = dump(local, 'knowledge').find((r) => r.id === 'k2');
  if (row?.deleted_at === null) note('③ 🔴 파일이 더 최신인데 tombstone 이 적용되지 않았다');
  src.close();
  dst.close();
  local.close();
}

// ── ④ 합치기: updated_at 이 큰 쪽이 이긴다(양방향) · 재매핑 ────────────
function checkMerge() {
  // 파일이 더 최신 → 덮는다
  const a = open();
  seed(a);
  const fileNewer = {
    ...exportOf(a).data,
    books: [
      {
        id: 'b1',
        title: 'FROM FILE',
        author: 'x',
        cover_uri: null,
        status: 'done',
        started_at: null,
        finished_at: null,
        total_pages: 320,
        read_pages: 320,
        cover_color: '#DCE6EC',
        created_at: T0,
        updated_at: T2,
        deleted_at: null,
      },
    ],
  };
  const p1 = planMerge(fileNewer, snapshot(a), allColumns(a));
  apply(a, p1.ops);
  if (dump(a, 'books').find((r) => r.id === 'b1')?.title !== 'FROM FILE') {
    note('④ 파일이 더 최신인데 안 덮었다');
  }
  if (p1.updated !== 1) note(`④ updated 가 ${p1.updated} 다 — 1 이어야 한다`);

  // 로컬이 더 최신 → 유지한다
  const b = open();
  seed(b);
  runSql(b, buildRowUpdate('books', { id: 'b1', title: 'LOCAL WINS', updated_at: T2 }));
  const fileOlder = {
    ...exportOf(open()).data,
    books: [
      { id: 'b1', title: 'FROM FILE', status: 'wish', created_at: T0, updated_at: T0, deleted_at: null },
    ],
  };
  const p2 = planMerge(fileOlder, snapshot(b), allColumns(b));
  apply(b, p2.ops);
  if (dump(b, 'books').find((r) => r.id === 'b1')?.title !== 'LOCAL WINS') {
    note('④ 로컬이 더 최신인데 덮였다');
  }
  if (p2.updated !== 0) note('④ 로컬이 이겼는데 updated 가 0 이 아니다');

  // 같으면 로컬 유지(뒤집히지 않는다)
  const c = open();
  seed(c);
  const same = planMerge(exportOf(c).data, snapshot(c), allColumns(c));
  if (same.added !== 0 || same.updated !== 0) {
    note(`④ 자기 파일을 자기에게 합쳤는데 added=${same.added} updated=${same.updated}`);
  }

  // 🔴 태그 재매핑 — 같은 이름 다른 id 는 UNIQUE 로 터진다
  const d = open();
  seed(d);
  const remapFile = {
    ...exportOf(open()).data,
    tags: [{ id: 'OTHER', name: 'habit', created_at: T0, updated_at: T2, deleted_at: null }],
    knowledge_tags: [
      { knowledge_id: 'k1', tag_id: 'OTHER', created_at: T0, updated_at: T2, deleted_at: null },
    ],
    knowledge: [],
  };
  try {
    apply(d, planMerge(remapFile, snapshot(d), allColumns(d)).ops);
  } catch (e) {
    note(`④ 🔴 같은 이름의 태그에서 터졌다(재매핑 실패): ${e.message}`);
  }
  if (dump(d, 'tags').filter((r) => String(r.name).toLowerCase() === 'habit').length !== 1) {
    note('④ 같은 이름의 태그가 둘이 됐다');
  }
  if (dump(d, 'knowledge_tags').some((r) => r.tag_id === 'OTHER')) {
    note('④ knowledge_tags 가 재매핑되지 않았다');
  }

  // 🔴 실천 로그 — (practice_id, date) 가 UNIQUE 다. id 만 다른 같은 날은 건너뛴다
  const e2 = open();
  seed(e2);
  const dupLog = {
    ...exportOf(open()).data,
    practice_logs: [
      {
        id: 'OTHERLOG',
        practice_id: 'p1',
        date: '2026-09-01',
        done_at: T2,
        created_at: T2,
        updated_at: T2,
        deleted_at: null,
      },
    ],
    knowledge: [],
    practices: [],
  };
  try {
    apply(e2, planMerge(dupLog, snapshot(e2), allColumns(e2)).ops);
  } catch (err) {
    note(`④ 🔴 같은 날 실천 로그에서 터졌다: ${err.message}`);
  }
  if (dump(e2, 'practice_logs').length !== 1) note('④ 같은 날 실천 로그가 둘이 됐다');

  for (const db of [a, b, c, d, e2]) db.close();
}

// ── ⑤ 거부: 남의 JSON · 미래 형식 · 미래 스키마 · 깨진 행 ─────────────
function checkReject() {
  const db = open();
  seed(db);
  const ok = exportOf(db);

  const cases = [
    ['남의 JSON', JSON.stringify({ hello: 1 }), 'invalidFile'],
    ['JSON 아님', 'not json', 'invalidFile'],
    ['배열 최상위', '[]', 'invalidFile'],
    ['미래 형식', JSON.stringify({ ...ok, formatVersion: FORMAT_VERSION + 1 }), 'newerApp'],
    ['미래 스키마', JSON.stringify({ ...ok, schemaVersion: CODE_SCHEMA_VERSION + 1 }), 'newerApp'],
    ['표 하나 없음', JSON.stringify({ ...ok, data: { ...ok.data, tags: undefined } }), 'invalidFile'],
    [
      'PK 가 숫자',
      JSON.stringify({ ...ok, data: { ...ok.data, books: [{ ...ok.data.books[0], id: 7 }] } }),
      'invalidFile',
    ],
    ['20MB 초과', `{"format":"reread-backup","x":"${'a'.repeat(21 * 1024 * 1024)}"}`, 'invalidFile'],
  ];
  for (const [name, text, want] of cases) {
    const r = parseBackup(text, CODE_SCHEMA_VERSION);
    if (r.ok) note(`⑤ ${name} 을 통과시킨다`);
    else if (r.reason !== want) note(`⑤ ${name}: 사유가 ${r.reason} 다 — ${want} 여야 한다`);
  }

  // 정상 파일은 통과해야 한다(거부 검사만 있으면 "항상 거부"도 초록이다)
  const good = parseBackup(JSON.stringify(ok), CODE_SCHEMA_VERSION);
  if (!good.ok) note(`⑤ 정상 파일을 거부한다: ${good.detail}`);

  // 🔴 옛 파일은 받는다 — 컬럼이 늘기만 하므로 아는 컬럼만 골라 넣으면 된다
  const older = parseBackup(JSON.stringify({ ...ok, schemaVersion: 1 }), CODE_SCHEMA_VERSION);
  if (!older.ok) note('⑤ 구버전 스키마 파일을 거부한다 — 그건 받아야 한다');

  // 모르는 컬럼이 섞여도 받고, 그 컬럼은 버린다
  const withFuture = {
    ...ok,
    data: { ...ok.data, books: ok.data.books.map((r) => ({ ...r, future_col: 'x' })) },
  };
  const dst = open();
  try {
    apply(dst, planReplace(withFuture.data, allColumns(dst)).ops);
  } catch (e) {
    note(`⑤ 모르는 컬럼에서 터졌다: ${e.message}`);
  }
  db.close();
  dst.close();
}

// ── ⑥-b 미리보기 숫자는 **살아 있는 행만** 센다 ───────────────────────
/**
 * 🔴 파일에는 tombstone 이 함께 실린다(③). 그것까지 세면 *"문장 2"* 라고 안내하고
 *    화면에는 하나만 나타난다 — 사용자에게 거짓말을 하는 자리다.
 */
function checkCounts() {
  const db = open();
  seed(db);
  const file = exportOf(db);
  if (file.data.knowledge.length !== 2) note('⑥ 씨앗이 바뀌었다 — 이 검사가 무의미하다');
  if (file.counts.knowledge !== 1) {
    note(`⑥ 🔴 미리보기가 tombstone 을 센다: ${file.counts.knowledge} — 살아 있는 1 이어야 한다`);
  }
  if (file.counts.books !== 1) note(`⑥ books 카운트가 ${file.counts.books} 다`);
  db.close();
}

// ── ⑥ 파일 이름 ──────────────────────────────────────────────────────
function checkFileName() {
  const name = backupFileName(new Date(2026, 8, 9, 5, 7));
  if (name !== 'ReRead-backup-20260909-0507.json') note(`⑥ 파일 이름이 다르다: ${name}`);
}

// ── ⑦ 소스 스캔: 내보내기가 tombstone 을 거르는 통로로 가지 않는가 ────
/**
 * 🔴 위 ②③은 **가드의 dump** 로 잰다. 앱이 `selectAll`(자동으로 `deleted_at IS NULL`)로
 *    갈아타면 그 검사들은 여전히 초록인데 **파일에서만** 지운 기록이 사라진다 —
 *    화면도 안 깨지고 아무 데서도 안 보인다. 그래서 통로 자체를 잰다.
 */
function checkSource() {
  const text = readFileSync(join(ROOT, 'features/backup/repo.ts'), 'utf8');
  if (!/\bdumpTable\b/.test(text)) {
    note('⑦ features/backup/repo.ts 가 dumpTable 을 안 쓴다 — tombstone 이 파일에서 빠진다');
  }
  if (/\bselectAll\b/.test(text)) {
    note('⑦ 🔴 내보내기가 selectAll 을 쓴다 — 그 헬퍼는 deleted_at IS NULL 을 붙인다');
  }
  const db = readFileSync(join(ROOT, 'db/index.ts'), 'utf8');
  const fn = db.split('export function dumpTable')[1]?.split('export ')[0] ?? '';
  if (fn === '') note('⑦ db/index.ts 에 dumpTable 이 없다');
  else if (/deleted_at/.test(fn)) note('⑦ 🔴 dumpTable 이 deleted_at 을 거른다');
}

// ── 실행 ─────────────────────────────────────────────────────────────
function stage(name, fn) {
  try {
    fn();
  } catch (e) {
    bad.push(`${name} 단계가 예외로 죽었다: ${e instanceof Error ? e.message : String(e)}`);
  }
}

selfTest();
stage('표 목록', checkTableList);
stage('왕복', checkRoundTrip);
stage('tombstone', checkTombstone);
stage('합치기', checkMerge);
stage('거부', checkReject);
stage('미리보기 수', checkCounts);
stage('파일 이름', checkFileName);
stage('소스 스캔', checkSource);

if (bad.length > 0) {
  console.error(`check:backup FAIL (${bad.length})`);
  for (const m of bad) console.error('  ' + m);
  process.exit(1);
}
console.log(
  `check:backup OK — ${BACKUP_TABLES.length}표(meta 제외) · 왕복 행 단위 일치 · tombstone 보존 · 합치기 양방향 · 태그/실천로그 UNIQUE · 거부 8종 · 미리보기 수 · 소스 통로 · SELF-TEST 4종`,
);
