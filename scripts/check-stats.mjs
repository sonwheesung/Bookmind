#!/usr/bin/env node
/**
 * check:stats — 통계 일곱 축을 **실물 SQLite 로** 잰다(`docs/STATS_SYSTEM.md` §5).
 *
 * 🔴 왜 가드로 두나: 통계는 **틀려도 화면이 멀쩡하다.** 기억률이 조금 높게 나와도,
 *    연속일이 하루 짧아도 아무도 오류를 못 본다. 그게 이 프로젝트가 다섯 번 겪은 모양이다.
 *
 * 🔴 SELF-TEST 가 먼저다(exit 2). 검사 실패는 exit 1.
 */
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

import { runMigrations } from '../db/migrate.ts';
import { buildCount, buildInsert } from '../db/sql.ts';
import { localDayKey, previousDayKey, retentionRate, streakDays } from '../features/stats/compute.ts';
import { activityTimesQuery, reviewTallyQuery, tagDistributionQuery } from '../features/stats/sql.ts';

// ── 🔴 SELF-TEST ─────────────────────────────────────────────────────
function selfTest() {
  const fail = (m) => {
    console.error(`SELF-TEST FAIL: ${m}`);
    process.exit(2);
  };

  // ① 🔴 양성 대조 — 기억률이 `again` 을 **실제로 읽는가**.
  //    상수를 돌려주는 함수도 아래 ② 를 통과할 수 있다. 먼저 그걸 배제한다
  if (retentionRate(4, 0) === retentionRate(4, 4)) fail('기억률이 again 을 안 읽는다');
  if (retentionRate(4, 1) !== 0.75) fail('기억률 계산이 틀렸다');
  if (retentionRate(0, 0) !== null) fail('🔴 분모 0 에 null 을 안 준다');
  if (retentionRate(1, 0) === null) fail('멀쩡한 입력에 null 을 준다');

  // ② 🔴 양성 대조 — 연속일이 **0 도 낼 수 있는가**. 늘 양수면 ④ 가 의미 없다
  if (streakDays([], '2026-09-10') !== 0) fail('빈 집합에 0 을 안 준다');
  if (streakDays(['2026-09-10'], '2026-09-10') !== 1) fail('오늘 하루를 1 로 안 센다');

  // ③ 날짜 계산이 경계를 넘는가
  if (previousDayKey('2026-03-01') !== '2026-02-28') fail('달 경계를 못 넘는다');
  if (previousDayKey('2026-01-01') !== '2025-12-31') fail('해 경계를 못 넘는다');

  // 🔴 ③-1 커서가 **반드시 줄어야** 한다. 안 줄면 연속일 반복이 영원히 안 끝난다.
  //    이 줄은 ② 보다 뒤에 있어서 늦다. 그래서 종료 보장은 `compute.ts` 안에도 박아 뒀다
  //    (검사가 멈추는 것보다 코드가 터지는 게 낫다 · `EDGE_CASES.md` §12)
  for (const k of ['2026-09-10', '2026-03-01', '2026-01-01', '2024-03-01']) {
    if (!(previousDayKey(k) < k)) fail(`날짜가 거꾸로 안 간다: ${k} → ${previousDayKey(k)}`);
  }
  let looped = false;
  try {
    streakDays(['2026-09-10', '2026-09-09'], '2026-09-10');
    looped = true;
  } catch {
    /* 종료 보장이 살아 있으면 멀쩡한 입력에서는 안 던진다 */
  }
  if (!looped) fail('멀쩡한 연속일 입력에서 종료 보장이 잘못 터진다');

  // ④ 잘못된 입력을 **삼키지 않는가**
  let threw = false;
  try {
    localDayKey('시각이 아니다');
  } catch {
    threw = true;
  }
  if (!threw) fail('못 읽는 시각을 조용히 넘긴다');

  // ⑤ 질의가 **무언가를 담고 있는가**(빈 문자열을 돌려주는 함수가 아닌가)
  if (!reviewTallyQuery().text.includes('review_logs')) fail('복습 집계 질의가 비었다');
  if (!activityTimesQuery().text.includes('knowledge')) fail('활동 시각 질의가 비었다');
  if (tagDistributionQuery(7).params[0] !== 7) fail('태그 분포가 limit 을 안 싣는다');
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

/** 로컬 시각 → UTC ISO. 🔴 저장은 UTC 로 하고 접는 것만 로컬이다(§3.3) */
function localIso(y, m, d, h = 12) {
  return new Date(y, m - 1, d, h, 0, 0).toISOString();
}

function addRow(driver, table, values, now) {
  const id = randomUUID();
  const sql = buildInsert(table, values, { id, now });
  driver.run(sql.text, sql.params);
  return id;
}

function softDelete(driver, table, where, params) {
  driver.run(`UPDATE ${table} SET deleted_at = ? WHERE ${where}`, [localIso(2026, 9, 10, 23), ...params]);
}

function addLog(driver, knowledgeId, rating, reviewedAt) {
  return addRow(
    driver,
    'review_logs',
    {
      knowledge_id: knowledgeId,
      question_id: null,
      rating,
      answer_text: null,
      elapsed_days: null,
      scheduled_days: null,
      reviewed_at: reviewedAt,
    },
    reviewedAt,
  );
}

function newKnowledge(driver, content, now) {
  return addRow(
    driver,
    'knowledge',
    { book_id: null, content, page: null, source_type: 'manual', lang: null },
    now,
  );
}

// ── 본검사 ───────────────────────────────────────────────────────────
selfTest();

const { db, driver } = freshDb();
const bad = [];
const check = (cond, msg) => {
  if (!cond) bad.push(msg);
};

const TODAY = '2026-09-10';

// 시드 — 활동일이 09-07 · 09-08 · 09-09 · 09-10 넷이 되도록 놓는다
const kA = newKnowledge(driver, '살아 있는 문장 A', localIso(2026, 9, 8, 10));
const kB = newKnowledge(driver, '살아 있는 문장 B', localIso(2026, 9, 9, 11));
// 🔴 ① 용 — 09-06 에 만들고 지운다. 지운 문장의 **저장일**은 활동일이 아니다
const kDel = newKnowledge(driver, '지워질 문장', localIso(2026, 9, 6, 10));
softDelete(driver, 'knowledge', 'id = ?', [kDel]);

addLog(driver, kA, 'good', localIso(2026, 9, 10, 9));
addLog(driver, kB, 'again', localIso(2026, 9, 9, 20));
addLog(driver, kA, 'easy', localIso(2026, 9, 8, 8));
// 🔴 ③ 용 — 지운 문장의 복습 기록은 **남고 기억률에 포함된다**(§3.2)
addLog(driver, kDel, 'good', localIso(2026, 9, 7, 8));

// ── ① tombstone ──
const cnt = buildCount('knowledge');
const alive = db.prepare(cnt.text).get(...cnt.params).n;
check(alive === 2, `① 지운 문장이 개수에 남았다(${alive} ≠ 2)`);

// ── ② 기억률 · ③ 지운 지식의 복습 ──
const tally = reviewTallyQuery();
const row = db.prepare(tally.text).get(...tally.params);
const total = row?.total ?? 0;
const again = row?.again ?? 0;
check(total === 4, `③ 복습 기록 수가 ${total} 이다. 지운 문장의 기록이 사라졌나`);
check(again === 1, `② again 집계가 ${again} 이다`);
check(retentionRate(total, again) === 0.75, '② 기억률이 0.75 가 아니다');

// ── ⑥ 로컬 자정 ──
const times = activityTimesQuery();
const rows = db.prepare(times.text).all(...times.params);
check(rows.length === 6, `⑥ 활동 시각이 ${rows.length}건이다. 기대는 4(복습) + 2(살아 있는 문장)`);
// 🔴 SQL 이 날짜로 접어 오면 안 된다. 접는 것은 로컬을 아는 JS 가 한다
check(
  rows.every((r) => typeof r.at === 'string' && r.at.includes('T')),
  '⑥ 🔴 SQL 이 시각을 날짜로 접어 왔다. SQLite 의 date() 는 UTC 라 경계가 어긋난다',
);

const days = new Set(rows.map((r) => localDayKey(r.at)));
check(
  [...days].sort().join() === '2026-09-07,2026-09-08,2026-09-09,2026-09-10',
  `⑥ 활동일이 [${[...days].sort().join(' ')}] 이다`,
);
check(!days.has('2026-09-06'), '① 지운 문장의 저장일이 활동일로 새어 들어왔다');

// 🔴 로컬 자정과 UTC 자정이 **다르게** 나오나. 시간대가 UTC 인 기계에서는 잴 수 없는 축이다
const offsetMin = new Date(2026, 8, 10).getTimezoneOffset();
if (offsetMin !== 0) {
  const early = localIso(2026, 9, 10, 0);
  const late = localIso(2026, 9, 10, 23);
  const differs = localDayKey(early) !== early.slice(0, 10) || localDayKey(late) !== late.slice(0, 10);
  check(differs, '⑥ 🔴 로컬이 아니라 UTC 로 날짜를 접고 있다');
  check(localDayKey(early) === TODAY && localDayKey(late) === TODAY, '⑥ 로컬 하루가 안 맞는다');
}

// ── 🔴 ④ 연속일 경계 ──
check(streakDays(days, TODAY) === 4, `④ 연속일이 ${streakDays(days, TODAY)} 이다(기대 4)`);

// 오늘 활동이 없을 때. 🔴 어제까지의 연속을 **끊지 않는다**
const noToday = new Set([...days].filter((d) => d !== TODAY));
check(
  streakDays(noToday, TODAY) === 3,
  `④ 🔴 오늘 활동이 없다고 연속이 ${streakDays(noToday, TODAY)} 로 무너졌다(기대 3)`,
);

// ── ⑤ 연속일 끊김 ──
check(streakDays(['2026-09-09'], TODAY) === 1, '⑤ 어제 하루만 있을 때 1 이 아니다');
check(streakDays(['2026-09-08'], TODAY) === 0, '⑤ 이틀 전만 있는데 연속이 남았다');
check(streakDays(['2026-09-07', '2026-09-08'], TODAY) === 0, '⑤ 하루를 건너뛰었는데 연속이 이어졌다');
check(streakDays(['2026-09-07', '2026-09-09'], TODAY) === 1, '⑤ 중간이 빈 연속을 이어 세었다');

// ── ⑦ 태그 분포 ──
const tLive = addRow(driver, 'tags', { name: '생산성' }, localIso(2026, 9, 8));
const tOnDead = addRow(driver, 'tags', { name: '경제' }, localIso(2026, 9, 8));
const tDead = addRow(driver, 'tags', { name: '지워진태그' }, localIso(2026, 9, 8));
const tUnlinked = addRow(driver, 'tags', { name: '끊긴연결' }, localIso(2026, 9, 8));

const link = (kid, tid) =>
  addRow(driver, 'knowledge_tags', { knowledge_id: kid, tag_id: tid }, localIso(2026, 9, 8));

link(kA, tLive);
link(kB, tLive);
link(kDel, tOnDead); // 지식이 죽었다
link(kA, tDead);
softDelete(driver, 'tags', 'id = ?', [tDead]); // 태그가 죽었다
link(kA, tUnlinked);
softDelete(driver, 'knowledge_tags', 'knowledge_id = ? AND tag_id = ?', [kA, tUnlinked]); // 연결이 죽었다

const dist = tagDistributionQuery(12);
const slices = db.prepare(dist.text).all(...dist.params);
check(slices.length === 1, `⑦ 분야가 ${slices.length}개다. 살아 있는 것은 하나뿐이다`);
check(slices[0]?.name === '생산성' && slices[0]?.n === 2, '⑦ 분야 집계가 틀렸다');

const capped = tagDistributionQuery(0);
check(db.prepare(capped.text).all(...capped.params).length === 0, '⑦ limit 이 안 먹는다');

if (bad.length > 0) {
  console.error(`\ncheck:stats 실패 ${bad.length}건:\n`);
  for (const m of bad) console.error(`  ✗ ${m}`);
  console.error('');
  process.exit(1);
}
console.log(
  `\ncheck:stats OK — tombstone · 기억률(🔴 분모 0 → null) · 지운 지식의 복습 ·` +
    `\n  🔴 연속일 경계(오늘이 비어도 유지) · 끊김 4종 · 로컬 자정 · 태그 분포` +
    `\n  SELF-TEST 통과(기억률·연속일 양성 대조 포함)\n`,
);
