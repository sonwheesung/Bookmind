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
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runMigrations } from '../db/migrate.ts';
import { buildCount, buildInsert } from '../db/sql.ts';
import { localDayKey, previousDayKey } from '../lib/day.ts';
import { retentionRate, streakDays } from '../features/stats/compute.ts';
import {
  activityLevel,
  chartsReady,
  clampPeriod,
  countByDay,
  forecast,
  mergeCounts,
  MIN_ACTIVE_DAYS,
  monthGrid,
  niceMax,
  parseStatsPeriod,
  periodBounds,
  periodBuckets,
  periodEnd,
  periodStart,
  shiftPeriod,
  sumBuckets,
  tallyIn,
} from '../features/stats/charts.ts';
import {
  activityTimesQuery,
  bookDistributionQuery,
  dueTimesQuery,
  reviewMarksQuery,
  reviewTallyQuery,
  saveTimesQuery,
  tagDistributionQuery,
} from '../features/stats/sql.ts';

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

// ── ⑧~⑫ 차트 (§4.2) ──
{
  const throws = (fn) => {
    try {
      fn();
      return false;
    } catch {
      return true;
    }
  };

  // ── ⑧ 기간 ──
  // 🔴 오늘은 **목요일 · 월 중간**(09-10)이다. 월요일 · 1일이면 기간 시작 계산을 지워도 초록이다
  check(periodStart('week', TODAY) === '2026-09-07', `⑧ 주 시작이 ${periodStart('week', TODAY)} 다(월요일 09-07)`);
  check(periodStart('month', TODAY) === '2026-09-01', `⑧ 달 시작: ${periodStart('month', TODAY)}`);
  check(periodStart('year', TODAY) === '2026-01-01', `⑧ 해 시작: ${periodStart('year', TODAY)}`);
  check(periodEnd('week', TODAY) === '2026-09-13', `⑧ 주 끝: ${periodEnd('week', TODAY)}`);
  check(periodEnd('month', '2026-02-10') === '2026-02-28', '⑧ 평년 2월 끝이 28일이 아니다');
  check(periodEnd('month', '2028-02-10') === '2028-02-29', '⑧ 🔴 윤년 2월 끝이 29일이 아니다');
  check(periodEnd('month', TODAY) === '2026-09-30', '⑧ 9월 끝이 30일이 아니다');
  check(periodEnd('year', TODAY) === '2026-12-31', '⑧ 해 끝이 12-31 이 아니다');
  check(shiftPeriod('week', '2026-12-30', 1) === '2027-01-04', `⑧ 🔴 해를 넘기는 주: ${shiftPeriod('week', '2026-12-30', 1)}`);
  check(shiftPeriod('week', TODAY, -1) === '2026-08-31', `⑧ 달을 넘기는 지난 주: ${shiftPeriod('week', TODAY, -1)}`);
  check(shiftPeriod('month', '2026-01-20', -1) === '2025-12-01', '⑧ 🔴 해를 넘기는 지난 달');
  check(shiftPeriod('year', TODAY, -1) === '2025-01-01', '⑧ 지난 해');
  check(shiftPeriod('week', TODAY, 0) === '2026-09-07', '⑧ 0 이동이 기간 첫날로 안 맞춘다');
  check(throws(() => shiftPeriod('week', TODAY, 0.5)), '⑧ 🔴 기간 수 0.5 를 조용히 받는다');
  check(throws(() => shiftPeriod('month', TODAY, Number.NaN)), '⑧ 🔴 기간 수 NaN 을 조용히 받는다');

  const pb = periodBounds('month', '2026-07-20', TODAY);
  check(pb.first === '2026-07-01' && pb.last === '2026-09-01', `⑧ 넘기기 범위: ${JSON.stringify(pb)}`);
  check(clampPeriod('month', null, pb) === '2026-09-01', '⑧ 고른 기간이 없는데 이번 달이 아니다');
  check(clampPeriod('month', '2026-05-10', pb) === '2026-07-01', '⑧ 🔴 첫 활동보다 앞 기간으로 간다');
  check(clampPeriod('month', '2026-12-01', pb) === '2026-09-01', '⑧ 🔴 이번 기간보다 뒤로 간다');
  check(clampPeriod('month', '2026-08-15', pb) === '2026-08-01', '⑧ 범위 안 기간을 기간 첫날로 안 맞춘다');
  const noAct = periodBounds('week', null, TODAY);
  check(noAct.first === '2026-09-07' && noAct.last === '2026-09-07', '⑧ 활동이 없을 때 이번 주 하나가 아니다');
  const future = periodBounds('week', '2026-10-01', TODAY);
  check(future.first === future.last, '⑧ 🔴 첫 활동이 미래로 찍혀 범위가 뒤집혔다');
  check(parseStatsPeriod('month') === 'month' && parseStatsPeriod('year') === 'year', '⑧ 저장된 기간을 못 읽는다');
  for (const v of [undefined, null, '', 'day', 'WEEK', 0, {}, ['month']]) {
    check(parseStatsPeriod(v) === 'week', `⑧ 🔴 깨진 기간 값 ${JSON.stringify(v)} 를 week 로 안 돌린다`);
  }

  // ── ⑨ 일별 집계(실물 SQLite) ──
  const sq = saveTimesQuery();
  const saveRows = db.prepare(sq.text).all(...sq.params);
  check(saveRows.length === 2, `⑨ 🔴 저장 시각이 ${saveRows.length}건이다. 지운 문장의 저장이 들어왔나`);
  const saveDays = countByDay(saveRows.map((r) => r.at));
  check(
    saveDays.get('2026-09-08') === 1 && saveDays.get('2026-09-09') === 1 && !saveDays.has('2026-09-06'),
    `⑨ 저장 날짜별 수: ${JSON.stringify([...saveDays])}`,
  );
  const rq = reviewMarksQuery();
  const markRows = db.prepare(rq.text).all(...rq.params);
  check(markRows.length === 4, `⑨ 복습 표시가 ${markRows.length}건이다(지운 문장의 복습 포함 4)`);
  const marks = markRows.map((r) => ({ day: localDayKey(r.at), again: r.rating === 'again' }));
  const t89 = tallyIn(marks, '2026-09-08', '2026-09-09');
  check(t89.total === 2 && t89.again === 1, `⑨ 기간 기억률 재료: ${JSON.stringify(t89)}`);
  const t10 = tallyIn(marks, TODAY, TODAY);
  check(t10.total === 1 && t10.again === 0, `⑨ 🔴 기간 양끝을 포함하지 않는다: ${JSON.stringify(t10)}`);
  check(tallyIn(marks, '2026-08-01', '2026-08-31').total === 0, '⑨ 기간 밖 복습을 센다');

  const wk = periodBuckets('week', TODAY, saveDays);
  check(wk.length === 7 && wk[0]?.key === '2026-09-07', `⑨ 주 막대: ${wk.length}개 · ${wk[0]?.key}`);
  check(wk[1]?.value === 1 && wk[2]?.value === 1 && sumBuckets(wk) === 2, '⑨ 주 막대 값이 날짜와 어긋났다');
  const feb = periodBuckets('month', '2026-02-15', new Map());
  check(feb.length === 28 && feb[0]?.key === '2026-02-01' && sumBuckets(feb) === 0, '⑨ 2월 막대가 28개가 아니다');
  const yr = periodBuckets(
    'year',
    TODAY,
    new Map([
      ['2026-09-08', 2],
      ['2026-09-30', 3],
      ['2026-01-01', 1],
      ['2025-09-08', 9],
      ['2027-01-01', 4],
    ]),
  );
  check(yr.length === 12 && yr[8]?.key === '2026-09', `⑨ 년 막대: ${yr.length}개 · ${yr[8]?.key}`);
  check(yr[8]?.value === 5 && yr[0]?.value === 1, '⑨ 년 막대가 달별로 안 합쳐졌다');
  check(sumBuckets(yr) === 6, `⑨ 🔴 년 막대가 다른 해를 섞는다(합 ${sumBuckets(yr)} ≠ 6)`);
  const a = new Map([['2026-09-08', 1]]);
  const merged = mergeCounts(a, new Map([['2026-09-08', 2], ['2026-09-09', 1]]));
  check(merged.get('2026-09-08') === 3 && merged.get('2026-09-09') === 1, '⑨ 활동 합치기가 틀렸다');
  check(a.get('2026-09-08') === 1, '⑨ 🔴 mergeCounts 가 입력을 바꿨다');

  // ── 🔴 ⑩ 다가올 복습 ──
  const sched = (kid, dueAt) =>
    driver.run(
      `INSERT INTO review_schedules (knowledge_id, due_at, state, stability, difficulty, reps, lapses,
         last_reviewed_at, created_at, updated_at, deleted_at)
       VALUES (?, ?, 'review', 1, 5, 1, 0, NULL, ?, ?, NULL)`,
      [kid, dueAt, dueAt, dueAt],
    );
  sched(kA, localIso(2026, 9, 5, 9)); // 밀린 카드
  sched(kB, localIso(2026, 9, 10, 23)); // 오늘 밤
  sched(kDel, localIso(2026, 9, 10, 8)); // 🔴 지운 문장
  const dq = dueTimesQuery();
  const dueRows = db.prepare(dq.text).all(...dq.params);
  check(dueRows.length === 2, `⑩ 🔴 만기가 ${dueRows.length}건이다. 지운 문장의 만기가 들어왔나`);
  const fc = forecast(
    dueRows.map((r) => localDayKey(r.at)),
    TODAY,
    7,
    20,
  );
  check(fc.length === 7 && fc[0]?.key === TODAY, `⑩ 다가올 복습 창: ${fc.length}일 · ${fc[0]?.key}`);
  check(fc[0]?.value === 2 && sumBuckets(fc) === 2, `⑩ 🔴 밀린 카드가 오늘로 안 모인다: ${fc.map((b) => b.value)}`);

  const many = [...Array(25).fill('2026-09-01'), ...Array(3).fill(TODAY), ...Array(5).fill('2026-09-11')];
  const f2 = forecast(many, TODAY, 3, 20).map((b) => b.value).join();
  check(f2 === '20,13,0', `⑩ 🔴 상한을 넘는 수가 다음 날로 안 넘어간다: ${f2}(기대 20,13,0)`);
  const f3 = forecast(Array(50).fill('2026-09-01'), TODAY, 3, 20).map((b) => b.value).join();
  check(f3 === '20,20,10', `⑩ 넘김이 여러 날 이어지지 않는다: ${f3}`);
  check(sumBuckets(forecast(['2026-09-17'], TODAY, 7, 20)) === 0, '⑩ 창 밖 만기를 센다');
  check(forecast(['2026-09-16'], TODAY, 7, 20)[6]?.value === 1, '⑩ 🔴 창의 마지막 날 만기를 빠뜨린다');
  check(forecast([], TODAY, 30, 20).length === 30, '⑩ 30일 창이 30칸이 아니다');
  for (const [d, c] of [
    [0, 20],
    [1.5, 20],
    [7, -1],
    [7, 2.5],
    [Number.NaN, 20],
  ]) {
    check(throws(() => forecast([], TODAY, d, c)), `⑩ 🔴 날 수 ${d} · 상한 ${c} 를 조용히 받는다`);
  }

  // ── ⑪ 축 · 칸 ──
  for (const [n, want] of [
    [0, 0],
    [0.4, 1],
    [1, 1],
    [2, 2],
    [3, 5],
    [5, 5],
    [6, 10],
    [10, 10],
    [11, 20],
    [21, 50],
    [99, 100],
    [101, 200],
  ]) {
    check(niceMax(n) === want, `⑪ niceMax(${n}) = ${niceMax(n)} (기대 ${want})`);
  }
  for (const n of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    check(throws(() => niceMax(n)), `⑪ 🔴 축 값 ${n} 을 조용히 받는다`);
  }
  for (const [n, want] of [
    [0, 0],
    [1, 1],
    [2, 1],
    [3, 2],
    [5, 2],
    [6, 3],
    [10, 3],
    [11, 4],
    [20, 4],
  ]) {
    check(activityLevel(n) === want, `⑪ activityLevel(${n}) = ${activityLevel(n)} (기대 ${want})`);
  }
  for (const n of [-1, 1.5, Number.NaN]) {
    check(throws(() => activityLevel(n)), `⑪ 🔴 활동 수 ${n} 을 조용히 받는다`);
  }
  const nov = monthGrid('2026-11');
  check(nov.length === 42 && nov[5] === null && nov[6] === '2026-11-01', '⑪ 🔴 일요일 시작 달의 1일이 일곱 번째 칸이 아니다');
  const feb27 = monthGrid('2027-02');
  check(feb27.length === 28 && feb27[0] === '2027-02-01', '⑪ 🔴 딱 맞는 달에 빈칸이 생긴다');
  check(monthGrid('2026-09').length % 7 === 0, '⑪ 달력 칸 수가 7 의 배수가 아니다');

  // ── ⑫ 뜨는 조건 · 책별 · 배선 ──
  check(!chartsReady(6) && chartsReady(7), `⑫ 🔴 차트 문턱이 ${MIN_ACTIVE_DAYS}(활동 6일 숨김 · 7일 표시)이 아니다`);
  check(!chartsReady(0) && !chartsReady(Number.NaN), '⑫ 활동 0 · NaN 에 차트를 그린다');

  const bLive = addRow(driver, 'books', { title: '명상록', status: 'reading' }, localIso(2026, 9, 1));
  const bDead = addRow(driver, 'books', { title: '지워진 책', status: 'reading' }, localIso(2026, 9, 1));
  driver.run('UPDATE knowledge SET book_id = ? WHERE id IN (?, ?, ?)', [bLive, kA, kB, kDel]);
  const kOnDead = newKnowledge(driver, '지워진 책의 문장', localIso(2026, 9, 9, 12));
  driver.run('UPDATE knowledge SET book_id = ? WHERE id = ?', [bDead, kOnDead]);
  softDelete(driver, 'books', 'id = ?', [bDead]);
  const bq = bookDistributionQuery(5);
  const bookRows = db.prepare(bq.text).all(...bq.params);
  check(bookRows.length === 1, `⑫ 🔴 책별이 ${bookRows.length}권이다. 지운 책이 나왔나`);
  check(bookRows[0]?.name === '명상록' && bookRows[0]?.n === 2, `⑫ 🔴 책별 수가 틀렸다(지운 문장 포함?): ${JSON.stringify(bookRows[0])}`);
  const bq0 = bookDistributionQuery(0);
  check(db.prepare(bq0.text).all(...bq0.params).length === 0, '⑫ 책별 limit 이 안 먹는다');

  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const screen = readFileSync(join(root, 'app', 'stats.tsx'), 'utf8');
  for (const needle of ['chartsReady(', 'periodBuckets(', 'clampPeriod(', 'tallyIn(']) {
    check(screen.includes(needle), `⑫ 🔴 통계 화면이 ${needle} 를 안 거친다(규칙이 화면에 따로 생긴다)`);
  }
  // 🔴 `DAILY_LIMIT` 글자가 **있는지**가 아니라 `forecast(…, DAILY_LIMIT)` 로 **넘기는지** 잰다.
  //    처음엔 includes 로 쟀는데 import 줄이 그 글자를 담고 있어서, 상한을 999 로 바꾼 변이에 침묵했다(2026-09-15)
  check(
    /forecast\([^;]*\bDAILY_LIMIT\s*\)/.test(screen),
    '⑫ 🔴 다가올 복습이 오늘의 복습 상한(DAILY_LIMIT)으로 안 흐른다. 첫 막대가 홈의 복습 수와 달라진다',
  );
  // 양성 대조 — 그 정규식이 옛 모양(상한 없는 호출)을 **실제로 거르는가**
  check(
    !/forecast\([^;]*\bDAILY_LIMIT\s*\)/.test("import { DAILY_LIMIT } from 'x';\nforecast(a, b, 7, 999);"),
    '⑫ 🔴 상한 배선 정규식이 import 줄에 속는다',
  );
  check(
    readFileSync(join(root, 'features', 'settings', 'stats-period.ts'), 'utf8').includes('parseStatsPeriod('),
    '⑫ 🔴 기간 저장소가 복원할 때 값을 안 거른다',
  );
}

if (bad.length > 0) {
  console.error(`\ncheck:stats 실패 ${bad.length}건:\n`);
  for (const m of bad) console.error(`  ✗ ${m}`);
  console.error('');
  process.exit(1);
}
console.log(
  `\ncheck:stats OK — tombstone · 기억률(🔴 분모 0 → null) · 지운 지식의 복습 ·` +
    `\n  🔴 연속일 경계(오늘이 비어도 유지) · 끊김 4종 · 로컬 자정 · 태그 분포` +
    `\n  ⑧기간(월요일 · 월말 · 윤년 · 해 넘김 · 범위) ⑨일별 집계(🔴 년은 그 해만) 🔴⑩다가올 복습(밀린 것 오늘로 · 상한 넘김) ⑪축·칸 경계 ⑫뜨는 조건 7일 · 책별 · 배선` +
    `\n  SELF-TEST 통과(기억률·연속일 양성 대조 포함)\n`,
);
