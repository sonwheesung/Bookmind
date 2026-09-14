#!/usr/bin/env node
/**
 * check:practice — 실천 여덟 축을 **실물 SQLite 로** 잰다(`docs/PRACTICE_SYSTEM.md` §9).
 *
 * 🔴 왜 가드로 두나: `weekdays` 실천의 주말을 끊김으로 세면 **금요일까지 성실했던 사람이
 *    월요일 아침에 `0일` 을 본다.** 화면은 멀쩡하고 숫자만 틀린다. 이 프로젝트가 여섯 번 만난 모양이다.
 *
 * 🔴 SELF-TEST 가 먼저다(exit 2). 검사 실패는 exit 1.
 */
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runMigrations } from '../db/migrate.ts';
import { buildInsert } from '../db/sql.ts';
import {
  addMonths,
  daysOfMonth,
  fromDate,
  isoWeekday,
  mondayOf,
  monthOf,
  nextDayKey,
  previousDayKey,
} from '../lib/day.ts';
import {
  calendarBounds,
  canCheck,
  isScheduled,
  parseRepeat,
  practiceState,
  practiceStreak,
  monthCells,
  weekCells,
} from '../features/practice/compute.ts';
import { doneDaysQuery, runningPracticesQuery, shouldSuggestQuery } from '../features/practice/sql.ts';

// 🔴 2026-09-10 은 목요일이다. 아래 날짜 셈이 전부 이 사실 위에 서 있다
const THU = '2026-09-10';
const FRI = '2026-09-11';
const SAT = '2026-09-12';
const SUN = '2026-09-13';
const MON = '2026-09-14';

// ── 🔴 SELF-TEST ─────────────────────────────────────────────────────
function selfTest() {
  const fail = (m) => {
    console.error(`SELF-TEST FAIL: ${m}`);
    process.exit(2);
  };

  // ① 요일 셈이 맞나. 여기가 틀리면 아래 전부가 뜻 없는 초록이 된다
  if (isoWeekday(THU) !== 4) fail(`${THU} 이 목요일이 아니라고 한다: ${isoWeekday(THU)}`);
  if (isoWeekday(SAT) !== 6) fail('토요일 번호가 틀렸다');
  if (isoWeekday(SUN) !== 7) fail('🔴 일요일이 7 이 아니다. getDay() 의 0 을 안 고쳤다');
  if (isoWeekday(MON) !== 1) fail('월요일 번호가 틀렸다');
  if (mondayOf(SUN) !== '2026-09-07') fail(`주의 시작이 월요일이 아니다: ${mondayOf(SUN)}`);
  if (mondayOf(MON) !== MON) fail('월요일의 주 시작이 자기 자신이 아니다');

  // ② 🔴 양성 대조 — 반복 규칙이 **실제로 갈라지는가**.
  //    전부 참을 돌려주는 함수도 아래 검사를 통과할 수 있다. 먼저 그걸 배제한다
  if (isScheduled('weekdays', SAT)) fail('weekdays 가 토요일을 예정일이라 한다');
  if (!isScheduled('weekdays', FRI)) fail('weekdays 가 금요일을 뺀다');
  if (isScheduled('daily', SAT) !== true) fail('daily 가 토요일을 뺀다');
  if (parseRepeat('weekly:1,3,5').days.join() !== '1,3,5') fail('weekly 요일을 못 읽는다');
  if (parseRepeat('weekly:5,1,3').days.join() !== '1,3,5') fail('weekly 요일을 정렬 안 한다');

  // ③ 🔴 못 읽는 규칙을 **삼키지 않는가**. 조용히 daily 로 떨어지면 주기가 말없이 바뀐다
  for (const bad of ['', 'DAILY', 'weekly:', 'weekly:0', 'weekly:8', 'weekly:a', 'monthly']) {
    let threw = false;
    try {
      parseRepeat(bad);
    } catch {
      threw = true;
    }
    if (!threw) fail(`깨진 반복 주기를 삼킨다: ${JSON.stringify(bad)}`);
  }

  // ④ 🔴 양성 대조 — 연속일이 **0 도 낼 수 있는가**
  if (practiceStreak('daily', [], THU, '2026-01-01') !== 0) fail('빈 기록에 0 을 안 준다');
  if (practiceStreak('daily', [THU], THU, '2026-01-01') !== 1) fail('오늘 하루를 1 로 안 센다');

  // ⑤ 날짜가 앞뒤로 움직이나
  if (previousDayKey('2026-03-01') !== '2026-02-28') fail('달 경계를 못 넘는다');
  if (nextDayKey('2026-12-31') !== '2027-01-01') fail('해 경계를 못 넘는다');

  // ⑥ 질의가 무언가를 담고 있는가(빈 문자열을 돌려주는 함수가 아닌가)
  if (!runningPracticesQuery(THU).text.includes('active')) fail('오늘의 실천 질의가 비었다');
  if (runningPracticesQuery(THU).params.length !== 2) fail('오늘 날짜가 질의에 안 실린다');
  if (!shouldSuggestQuery('x').text.includes('practice_skipped_at')) fail('제안 질의가 넘어가기를 안 본다');
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

const NOW = '2026-09-10T09:00:00.000Z';

function addRow(driver, table, values, now = NOW) {
  const id = randomUUID();
  const sql = buildInsert(table, values, { id, now });
  driver.run(sql.text, sql.params);
  return id;
}

function newPractice(driver, over = {}) {
  return addRow(driver, 'practices', {
    knowledge_id: null,
    title: '자기 전에 스마트폰을 책상에 놓는다',
    started_at: '2026-09-01',
    repeat_rule: 'daily',
    ended_at: null,
    active: 1,
    ...over,
  });
}

function check3(driver, practiceId, day) {
  addRow(driver, 'practice_logs', { practice_id: practiceId, date: day, done_at: NOW });
}

function doneOf(db, id) {
  const sql = doneDaysQuery(id);
  return new Set(
    db
      .prepare(sql.text)
      .all(...sql.params)
      .map((r) => r.date),
  );
}

function runningIds(db, today) {
  const sql = runningPracticesQuery(today);
  return db
    .prepare(sql.text)
    .all(...sql.params)
    .map((r) => r.id);
}

// ── 본검사 ───────────────────────────────────────────────────────────
selfTest();

const { db, driver } = freshDb();
const bad = [];
const check = (cond, msg) => {
  if (!cond) bad.push(msg);
};

// ── ① 반복 규칙 ──
check(isScheduled('weekly:1,3,5', MON), '① weekly:1,3,5 가 월요일을 뺀다');
check(!isScheduled('weekly:1,3,5', '2026-09-15'), '① weekly:1,3,5 가 화요일을 넣는다');
check(isScheduled('weekly:1,3,5', '2026-09-16'), '① weekly:1,3,5 가 수요일을 뺀다');

// ── 🔴 ② weekdays 는 주말에 안 끊긴다 ──
const wd = newPractice(driver, { repeat_rule: 'weekdays', started_at: '2026-09-07' });
for (const d of ['2026-09-07', '2026-09-08', '2026-09-09', THU, FRI]) check3(driver, wd, d);
// 월요일 아침, 아직 오늘 체크 전
const wdStreak = practiceStreak('weekdays', doneOf(db, wd), MON, '2026-09-07');
check(
  wdStreak === 5,
  `② 🔴 금요일까지 이어온 weekdays 실천이 월요일에 ${wdStreak}일로 나온다(기대 5). 주말을 끊김으로 셌다`,
);
// 같은 기록을 daily 로 보면 주말이 비어 있으므로 0 이어야 한다(대조군)
check(
  practiceStreak('daily', doneOf(db, wd), MON, '2026-09-07') === 0,
  '② 대조군이 안 맞는다. daily 로 보면 주말이 비어 끊겨야 한다',
);

// ── ③ 연속일 경계: 오늘 아직 안 했을 때 ──
const daily = newPractice(driver, { started_at: '2026-09-01' });
for (const d of ['2026-09-08', '2026-09-09']) check3(driver, daily, d);
check(
  practiceStreak('daily', doneOf(db, daily), THU, '2026-09-01') === 2,
  '③ 🔴 오늘 활동이 없다고 어제까지의 연속이 무너졌다',
);
check3(driver, daily, THU);
check(
  practiceStreak('daily', doneOf(db, daily), THU, '2026-09-01') === 3,
  '③ 오늘 체크가 연속일에 안 들어간다',
);
check(
  practiceStreak('daily', doneOf(db, daily), SAT, '2026-09-01') === 0,
  '③ 이틀을 건너뛰었는데 연속이 남았다',
);

// ── ④ 시작일 이전으로 안 간다 ──
const late = newPractice(driver, { started_at: '2026-09-09' });
for (const d of ['2026-09-08', '2026-09-09', THU]) check3(driver, late, d);
check(practiceStreak('daily', doneOf(db, late), THU, '2026-09-09') === 2, '④ 시작일 이전 기록까지 세었다');

// ── ⑤ 오늘의 실천 질의 넷 ──
const gone = newPractice(driver, { title: '지워진 실천' });
driver.run('UPDATE practices SET deleted_at = ? WHERE id = ?', [NOW, gone]);
const stopped = newPractice(driver, { title: '그만둔 실천', active: 0 });
const upcoming = newPractice(driver, { title: '내일 시작', started_at: FRI });
const ended = newPractice(driver, { title: '어제 끝남', started_at: '2026-09-01', ended_at: '2026-09-09' });
const endsToday = newPractice(driver, { title: '오늘까지', started_at: '2026-09-01', ended_at: THU });

const today = runningIds(db, THU);
check(!today.includes(gone), '⑤ 지운 실천이 오늘의 실천에 나온다');
check(!today.includes(stopped), '⑤ 그만둔 실천이 오늘의 실천에 나온다');
check(!today.includes(upcoming), '⑤ 내일 시작하는 실천이 오늘 나온다');
check(!today.includes(ended), '⑤ 어제 끝난 실천이 오늘 나온다');
check(today.includes(endsToday), '⑤ 🔴 오늘이 종료일인 실천이 빠졌다. 종료일은 포함이다');
check(today.includes(daily), '⑤ 멀쩡한 실천이 오늘의 실천에 없다');

// 🔴 `active` 를 고치지 않고 판정하나(§2.1)
const endedRow = db.prepare('SELECT active FROM practices WHERE id = ?').get(ended);
check(endedRow.active === 1, '⑤ 🔴 종료일이 지났다고 active 를 고쳐 놨다. 그건 저장된 파생값이다');
check(
  practiceState({ startedDay: '2026-09-01', endedDay: '2026-09-09', active: true }, THU) === 'ended',
  '⑤ 종료 판정이 안 된다',
);
check(
  practiceState({ startedDay: FRI, endedDay: null, active: true }, THU) === 'upcoming',
  '⑤ 시작 전 판정이 안 된다',
);
check(
  practiceState({ startedDay: '2026-09-01', endedDay: null, active: false }, THU) === 'stopped',
  '⑤ 그만둠 판정이 안 된다',
);

// ── ⑥ 하루 1건 · 해제 후 재체크 ──
const twice = newPractice(driver, { title: '두 번 체크' });
check3(driver, twice, THU);
let unique = true;
try {
  check3(driver, twice, THU);
} catch {
  unique = false;
}
check(!unique, '⑥ 🔴 같은 날 두 건이 들어갔다. UNIQUE 가 안 걸렸다');

// 해제(tombstone) 뒤 같은 날 다시 체크 → INSERT 는 여전히 UNIQUE 에 막힌다. 되살려야 한다
driver.run('UPDATE practice_logs SET deleted_at = ? WHERE practice_id = ? AND date = ?', [NOW, twice, THU]);
check(doneOf(db, twice).size === 0, '⑥ 해제한 체크가 아직 살아 있다');
let insertBlocked = false;
try {
  check3(driver, twice, THU);
} catch {
  insertBlocked = true;
}
check(
  insertBlocked,
  '⑥ 🔴 해제한 날에 INSERT 가 통과했다. UNIQUE 가 tombstone 을 안 본다는 뜻이라 되살리기 규칙의 전제가 깨진다',
);
driver.run('UPDATE practice_logs SET deleted_at = NULL WHERE practice_id = ? AND date = ?', [twice, THU]);
check(doneOf(db, twice).has(THU), '⑥ 되살린 체크가 안 보인다');

// ── ⑦ 지식 삭제 ──
const k = addRow(driver, 'knowledge', {
  book_id: null,
  content: '환경을 바꾸면 행동이 쉬워진다',
  page: null,
  source_type: 'manual',
  lang: null,
});
const linked = newPractice(driver, { title: '지식에 붙은 실천', knowledge_id: k });
driver.run('UPDATE knowledge SET deleted_at = ? WHERE id = ?', [NOW, k]);
driver.run('UPDATE practices SET knowledge_id = NULL WHERE knowledge_id = ?', [k]);
const survivor = db.prepare('SELECT knowledge_id, deleted_at FROM practices WHERE id = ?').get(linked);
check(survivor.deleted_at === null, '⑦ 🔴 지식을 지웠더니 실천까지 죽었다');
check(survivor.knowledge_id === null, '⑦ 연결이 안 끊겼다');

// ── 🔴 ⑧ 넘어가기 ──
const k2 = addRow(driver, 'knowledge', {
  book_id: null,
  content: '실천 제안이 붙을 카드',
  page: null,
  source_type: 'manual',
  lang: null,
});
addRow(driver, 'ai_analyses', {
  knowledge_id: k2,
  content_type: 'ACTION',
  summary: '요약',
  key_concept: null,
  topics: null,
  author_claim: null,
  thought_relation: null,
  actionability: 'high',
  lang: 'ko',
  model: null,
  prompt_ver: null,
  revision: 1,
});
const ask = (id) => {
  const sql = shouldSuggestQuery(id);
  return db.prepare(sql.text).get(...sql.params).n > 0;
};
check(ask(k2), '⑧ 대조군이 0이다. actionability=high 카드에 제안이 안 뜬다');

driver.run('UPDATE knowledge SET practice_skipped_at = ? WHERE id = ?', [NOW, k2]);
check(!ask(k2), '⑧ 🔴 [넘어가기] 뒤에 제안이 또 뜬다. 그건 제안이 아니라 압박이다');

// 실천을 만든 카드에도 다시 안 묻는다
const k3 = addRow(driver, 'knowledge', {
  book_id: null,
  content: '이미 실천을 만든 카드',
  page: null,
  source_type: 'manual',
  lang: null,
});
addRow(driver, 'ai_analyses', {
  knowledge_id: k3,
  content_type: 'ACTION',
  summary: '요약',
  key_concept: null,
  topics: null,
  author_claim: null,
  thought_relation: null,
  actionability: 'high',
  lang: 'ko',
  model: null,
  prompt_ver: null,
  revision: 1,
});
check(ask(k3), '⑧ 대조군이 0이다(k3)');
newPractice(driver, { knowledge_id: k3, title: 'k3 의 실천' });
check(!ask(k3), '⑧ 실천을 이미 만든 카드에 또 제안한다');

// actionability 가 high 가 아니면 아예 안 묻는다
const k4 = addRow(driver, 'knowledge', {
  book_id: null,
  content: '실천할 것이 없는 카드',
  page: null,
  source_type: 'manual',
  lang: null,
});
addRow(driver, 'ai_analyses', {
  knowledge_id: k4,
  content_type: 'FACT',
  summary: '요약',
  key_concept: null,
  topics: null,
  author_claim: null,
  thought_relation: null,
  actionability: 'none',
  lang: 'ko',
  model: null,
  prompt_ver: null,
  revision: 1,
});
check(!ask(k4), '⑧ actionability 가 none 인데 제안한다');

// ── 화면이 그리는 일곱 칸 ──
//
// 🔴 **오늘을 목요일로 둔다.** 월요일로 재면 `mondayOf` 가 아무 일도 안 해도 통과한다
//    (2026-09-10 변이 주입에서 실제로 침묵했다). 주의 시작을 재려면 오늘이 주 중간이어야 한다.
const cells = weekCells('weekdays', doneOf(db, wd), THU, {
  startedDay: '2026-09-07',
  endedDay: null,
  active: true,
});
check(cells.length === 7, `주 칸이 ${cells.length}개다`);
check(cells[0]?.day === '2026-09-07', `주가 그 주 월요일에서 시작하지 않는다(${cells[0]?.day})`);
check(cells[3]?.day === THU, `목요일 칸이 네 번째가 아니다(${cells[3]?.day})`);
check(cells[6]?.day === SUN, `일요일 칸이 마지막이 아니다(${cells[6]?.day})`);
check(cells[5]?.scheduled === false && cells[6]?.scheduled === false, '주말이 예정일로 잡힌다');
check(
  cells.slice(0, 4).every((c) => c.checkable),
  '오늘까지의 칸을 못 누른다. 과거 체크는 허용이다',
);
check(
  cells.slice(4).every((c) => !c.checkable),
  '🔴 미래 칸을 누를 수 있다',
);
check(
  cells.slice(0, 4).every((c) => c.done),
  '월~목 체크가 칸에 안 비친다',
);

// 월요일에 봐도 그 주 월요일에서 시작한다(경계)
const monCells = weekCells('weekdays', doneOf(db, wd), MON, {
  startedDay: '2026-09-07',
  endedDay: null,
  active: true,
});
check(monCells[0]?.day === MON, `월요일에 본 주가 ${monCells[0]?.day} 에서 시작한다`);

// 시작일 이전은 못 누른다
check(
  !canCheck('2026-09-06', THU, { startedDay: '2026-09-07', endedDay: null, active: true }),
  '시작일 이전을 누를 수 있다',
);
check(
  !canCheck(FRI, THU, { startedDay: '2026-09-01', endedDay: null, active: true }),
  '🔴 미래를 누를 수 있다',
);
check(
  canCheck('2026-09-08', THU, { startedDay: '2026-09-01', endedDay: null, active: true }),
  '과거 체크가 막혀 있다. 어제 했는데 오늘 켠 사람이 실제로 많다',
);

// ── ⑨ 기록 달력 (§3.1) ──
//
// 🔴 달의 첫 요일을 **서로 다르게** 고른다. 전부 월요일 시작인 달이면 앞 빈칸 계산을 지워도 초록이다.
{
  const calWin = { startedDay: '2026-09-07', endedDay: null, active: true };

  // 2026-09 는 화요일 시작 · 30일 → 앞 1칸 + 30 + 뒤 4칸 = 35
  const calSep = monthCells('daily', new Set(['2026-09-08']), MON, calWin, '2026-09');
  check(calSep.length === 35, `⑨ 9월 칸이 ${calSep.length}개다(35)`);
  check(calSep[0] === null && calSep[1]?.day === '2026-09-01', `⑨ 🔴 9월 1일이 화요일 칸이 아니다(${calSep[1]?.day})`);
  check(
    calSep[30]?.day === '2026-09-30' && calSep[31] === null && calSep[34] === null,
    '⑨ 9월 말일 또는 뒤 빈칸이 틀렸다',
  );

  // 2026-11 은 일요일 시작 → 앞 6칸 · 6주
  const calNov = monthCells('daily', [], MON, calWin, '2026-11');
  check(
    calNov.slice(0, 6).every((c) => c === null) && calNov[6]?.day === '2026-11-01',
    '⑨ 🔴 일요일 시작 달의 1일이 일곱 번째 칸이 아니다',
  );
  check(calNov.length === 42, `⑨ 🔴 11월이 ${calNov.length}칸이다(42 · 뒤 빈칸이 마지막 주를 못 채운다)`);

  // 2027-02 는 월요일 시작 · 28일 → 빈칸 없이 딱 4주
  const calFeb = monthCells('daily', [], MON, calWin, '2027-02');
  check(calFeb.length === 28 && calFeb.every((c) => c !== null), `⑨ 🔴 딱 맞는 달에 빈칸이 생긴다(${calFeb.length})`);
  check(daysOfMonth('2028-02').length === 29, '⑨ 🔴 윤년 2월이 29일이 아니다');
  check(daysOfMonth('2026-02').length === 28, '⑨ 평년 2월이 28일이 아니다');
  check(daysOfMonth('2026-12').at(-1) === '2026-12-31', '⑨ 12월 말일이 틀렸다');

  // 🔴 판정은 canCheck 하나다
  const calByDay = new Map(calSep.filter((c) => c !== null).map((c) => [c.day, c]));
  check(calByDay.get('2026-09-08')?.done === true, '⑨ 한 날이 달력에 안 비친다');
  check(calByDay.get('2026-09-09')?.done === false, '⑨ 안 한 날이 한 날로 보인다');
  check(calByDay.get('2026-09-08')?.checkable === true, '⑨ 🔴 지난 날을 달력에서 못 누른다(사용자 선택: 지난 날도 체크)');
  check(calByDay.get('2026-09-06')?.checkable === false, '⑨ 🔴 시작일 이전을 달력에서 누를 수 있다');
  check(calByDay.get(MON)?.checkable === true, '⑨ 오늘을 달력에서 못 누른다');
  check(calByDay.get('2026-09-15')?.checkable === false, '⑨ 🔴 미래를 달력에서 누를 수 있다');
  for (const c of calSep) {
    if (c !== null && c.checkable !== canCheck(c.day, MON, calWin)) {
      check(false, `⑨ 🔴 달력과 canCheck 가 ${c.day} 를 다르게 본다`);
    }
  }
  const calEnded = monthCells('daily', [], MON, { ...calWin, endedDay: '2026-09-10' }, '2026-09');
  check(
    calEnded.find((c) => c?.day === '2026-09-11')?.checkable === false,
    '⑨ 🔴 종료 뒤를 달력에서 누를 수 있다',
  );
  const calWd = monthCells('weekdays', [], MON, calWin, '2026-09');
  check(
    calWd.find((c) => c?.day === SAT)?.scheduled === false && calWd.find((c) => c?.day === THU)?.scheduled === true,
    '⑨ 달력의 예정일이 반복 규칙과 다르다',
  );

  // 달 셈
  check(monthOf('2026-09-14') === '2026-09', `⑨ monthOf: ${monthOf('2026-09-14')}`);
  check(addMonths('2026-12', 1) === '2027-01', '⑨ 🔴 해를 넘기는 달 더하기가 틀렸다');
  check(addMonths('2027-01', -1) === '2026-12', '⑨ 🔴 해를 넘기는 달 빼기가 틀렸다');
  check(addMonths('2026-01', -13) === '2024-12', `⑨ 여러 달 거꾸로: ${addMonths('2026-01', -13)}`);
  check(addMonths('2026-09', 0) === '2026-09', '⑨ 0 달 더하기가 달을 바꾼다');
  for (const badMonth of ['2026-13', '2026-00', '2026-9', '', 'abcd-ef', '2026-09-01']) {
    let threw = false;
    try {
      daysOfMonth(badMonth);
    } catch {
      threw = true;
    }
    check(threw, `⑨ 🔴 깨진 달 키 ${JSON.stringify(badMonth)} 를 조용히 받는다`);
  }
  for (const badN of [0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    let threw = false;
    try {
      addMonths('2026-09', badN);
    } catch {
      threw = true;
    }
    check(threw, `⑨ 🔴 달 수 ${badN} 를 조용히 받는다`);
  }

  // 달 넘기기 범위
  const b1 = calendarBounds('2026-07-20', null, MON);
  check(b1.first === '2026-07' && b1.last === '2026-09', `⑨ 달 범위: ${JSON.stringify(b1)}`);
  const b2 = calendarBounds('2026-07-20', '2026-08-10', MON);
  check(b2.last === '2026-08', `⑨ 🔴 종료한 실천이 종료 뒤 달로 넘어간다: ${JSON.stringify(b2)}`);
  const b3 = calendarBounds('2026-10-01', null, MON);
  check(b3.first === '2026-10' && b3.last === '2026-10', `⑨ 🔴 시작 전 실천의 달 범위가 뒤집혔다: ${JSON.stringify(b3)}`);
  const b4 = calendarBounds('2026-07-20', '2026-12-31', MON);
  check(b4.last === '2026-09', `⑨ 🔴 종료일이 미래인데 미래 달로 넘어간다: ${JSON.stringify(b4)}`);

  // 🔴 상세 화면이 달력을 그리나
  const detail = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'practice', '[id].tsx'), 'utf8');
  check(
    detail.includes('<MonthCalendar') && detail.includes('calendarBounds(') && detail.includes('practiceMonth('),
    '⑨ 🔴 실천 상세가 달력을 안 그린다',
  );
}

// 오늘이 실제로 무슨 요일이든 `fromDate` 와 `isoWeekday` 가 맞물리나
const realToday = fromDate(new Date());
check(isoWeekday(realToday) >= 1 && isoWeekday(realToday) <= 7, '오늘 요일이 1~7 이 아니다');

if (bad.length > 0) {
  console.error(`\ncheck:practice 실패 ${bad.length}건:\n`);
  for (const m of bad) console.error(`  ✗ ${m}`);
  console.error('');
  process.exit(1);
}
console.log(
  `\ncheck:practice OK — 반복 3종 · 🔴 weekdays 주말 · 연속일 경계 · 시작일 ·` +
    `\n  오늘의 실천 4조건 · 하루 1건과 되살리기 · 지식 삭제 · 🔴 넘어가기 3갈래 · 주 7칸 · ⑨ 기록 달력(요일 칸 · 7 의 배수 · canCheck 일치 · 달 범위)` +
    `\n  SELF-TEST 통과(요일·반복 규칙 양성 대조 포함)\n`,
);
