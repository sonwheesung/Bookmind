#!/usr/bin/env node
/**
 * check:review — 복습 규칙을 **값으로** 잰다(`docs/REVIEW_SYSTEM.md` §2.1~§2.3 · §3.1).
 *
 * 🔴 왜 가드로 두나: 여기 걸린 것들은 **기기에서 재현하기 어려운 축**이다 —
 *    자정 경계·시간대·밀린 카드 200장·이모지 경계. 손으로 밟으면 한 번 보고 다시는 안 본다.
 *
 * 🔴 SELF-TEST 가 먼저다(exit 2). 검사 실패는 exit 1.
 */
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

import { runMigrations } from '../db/migrate.ts';
import { buildInsert } from '../db/sql.ts';
import { deleteKnowledgeSteps } from '../db/cascade.ts';
import { pickCue, CUE_HEAD_CHARS } from '../features/review/cue.ts';
import { DAILY_LIMIT, endOfLocalDay, firstDueAt, takeDue } from '../features/review/queue.ts';
import { dueQuery } from '../features/review/sql.ts';
import { applyRating, intervalDays, newSchedule, RATINGS } from '../features/review/schedule.ts';
import { REMINDER_DAYS, REMINDER_TIMES, parseTime, planReminders } from '../features/review/notify.ts';

// ── 🔴 SELF-TEST — 판정 함수가 살아 있는가 ───────────────────────────
function selfTest() {
  const fail = (m) => {
    console.error(`SELF-TEST FAIL: ${m}`);
    process.exit(2);
  };

  // ① pickCue 가 실제로 갈래를 가르는가 (한 갈래만 돌려주면 아래 검사가 무의미하다)
  const kinds = new Set([
    pickCue({ content: 'x'.repeat(50), thought: '생각' }).kind,
    pickCue({ content: 'x'.repeat(50), bookTitle: '책' }).kind,
    pickCue({ content: 'x'.repeat(50), tags: ['t'] }).kind,
    pickCue({ content: 'x'.repeat(50) }).kind,
  ]);
  if (kinds.size !== 4) fail(`pickCue 가 갈래를 못 가른다 — ${[...kinds].join(',')}`);

  // ② takeDue 가 실제로 자르는가 / 안 자를 때도 있는가
  const many = Array.from({ length: 5 }, (_, i) => ({ knowledge_id: `k${i}`, due_at: `2026-09-0${i + 1}` }));
  if (takeDue(many, 2).length !== 2) fail('takeDue 가 상한을 안 지킨다');
  if (takeDue(many, 99).length !== 5) fail('상한이 넉넉한데도 잘랐다');

  // ③ endOfLocalDay 가 시각을 실제로 옮기는가
  const a = endOfLocalDay(new Date(2026, 8, 9, 1, 0, 0));
  const b = endOfLocalDay(new Date(2026, 8, 9, 23, 0, 0));
  if (a !== b) fail('같은 날인데 하루의 끝이 다르게 나온다');
  if (endOfLocalDay(new Date(2026, 8, 10, 1, 0, 0)) === a) fail('다음 날인데 하루의 끝이 같다');

  // ④ planReminders 가 **넣기도 하고 안 넣기도 하는가** (한쪽만 하면 아래 검사가 무의미하다)
  const now = new Date(2026, 8, 9, 10, 0, 0);
  const some = planReminders({ dueAts: ['2026-09-09T00:00:00.000Z'], now, time: '21:00' });
  if (some.length === 0) fail('만기가 있는데 하나도 예약하지 않는다');
  if (planReminders({ dueAts: [], now, time: '21:00' }).length !== 0) {
    fail('만기가 없는데 예약한다 — 0건인 날 알림은 신뢰를 깎는다');
  }
  if (parseTime('21:00') === null) fail('정상 시각을 못 읽는다');
}

// ── 검사 ─────────────────────────────────────────────────────────────
const bad = [];
const check = (cond, msg) => {
  if (!cond) bad.push(msg);
};

function checkCue() {
  const long = '목표보다 시스템을 만드는 것이 중요하다는 이야기';

  // §3.1 우선순위 — 있는 것부터
  check(
    pickCue({ content: long, thought: ' 내 생각 ', bookTitle: '책', tags: ['t'] }).kind === 'thought',
    '내 생각이 1순위가 아니다',
  );
  check(
    pickCue({ content: long, bookTitle: '책', page: '123p', tags: ['t'] }).kind === 'source',
    '책·페이지가 2순위가 아니다',
  );
  check(pickCue({ content: long, tags: ['습관'] }).kind === 'tags', '태그가 3순위가 아니다');
  check(pickCue({ content: long }).kind === 'head', '단서가 없을 때 앞 글자가 안 나온다');

  // 공백만 있는 값은 단서가 아니다
  check(pickCue({ content: long, thought: '   ' }).kind !== 'thought', '공백뿐인 생각을 단서로 썼다');
  check(
    pickCue({ content: long, bookTitle: '  ', page: '  ' }).kind !== 'source',
    '공백뿐인 출처를 단서로 썼다',
  );
  check(pickCue({ content: long, tags: ['', '  '] }).kind !== 'tags', '공백뿐인 태그를 단서로 썼다');

  // 🔴 앞 글자 단서는 원문보다 짧아야 한다 — 다 보여주면 회상이 아니다
  const head = pickCue({ content: long });
  check(head.text.endsWith('…'), '앞 글자 단서에 말줄임이 없다');
  check(
    [...head.text].length === CUE_HEAD_CHARS + 1,
    `앞 글자 수가 ${CUE_HEAD_CHARS} 가 아니다: ${head.text}`,
  );

  // 짧은 원문은 단서를 아예 주지 않는다(§8 엣지 케이스)
  check(pickCue({ content: '짧다' }).kind === 'none', '짧은 원문인데 앞 글자를 보여줬다');
  check(
    pickCue({ content: 'x'.repeat(CUE_HEAD_CHARS) }).kind === 'none',
    '경계(=12자)에서 단서를 줬다 — 다 보여주게 된다',
  );
  check(pickCue({ content: 'x'.repeat(CUE_HEAD_CHARS + 1) }).kind === 'head', '경계+1 에서 단서를 안 줬다');

  // 🔴 이모지·조합 문자를 코드 유닛으로 자르면 글자가 깨진다
  const emoji = pickCue({ content: '🔴'.repeat(20) });
  check([...emoji.text].length === CUE_HEAD_CHARS + 1, '이모지 원문에서 글자 수가 어긋난다');
  check(
    !emoji.text.includes('�') &&
      !/[\uD800-\uDFFF]/.test(emoji.text.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')),
    '🔴 서로게이트가 깨졌다 — 반쪽 글자가 화면에 나간다',
  );
}

function checkQueue() {
  // §2.3 저장한 날에는 안 뜬다
  const saved = new Date(2026, 8, 9, 23, 0, 0); // 밤 11시 저장
  const due = firstDueAt(saved);
  check(due > saved.toISOString(), '새 카드가 저장 시점보다 앞에 예약됐다');
  check(due >= endOfLocalDay(saved), '저장한 날 안에 뜬다 — 되읽기가 된다(§2.3)');

  // 자정을 넘기면 뜬다
  const justAfterMidnight = new Date(2026, 8, 10, 0, 30, 0);
  check(due < endOfLocalDay(justAfterMidnight), '자정을 넘겼는데 큐에 안 뜬다');

  // §2.2 밀린 카드 200장 → 상한까지만, 오래된 순
  const backlog = Array.from({ length: 200 }, (_, i) => ({
    knowledge_id: `k${i}`,
    due_at: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(),
  }));
  const shuffled = [...backlog].reverse();
  const taken = takeDue(shuffled);
  check(taken.length === DAILY_LIMIT, `상한이 ${DAILY_LIMIT} 인데 ${taken.length} 장이 나왔다`);
  check(taken[0]?.knowledge_id === 'k0', '오래된 순이 아니다 — 밀린 것이 계속 밀린다');
  check(taken[DAILY_LIMIT - 1]?.knowledge_id === `k${DAILY_LIMIT - 1}`, '정렬이 어긋난다');

  // 빈 큐
  check(takeDue([]).length === 0, '빈 큐에서 뭔가 나왔다');
}

// ── 큐 질의를 실물 SQLite 에 세워서 잰다 ──────────────────────────────
function openDb() {
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

const NOW = '2026-09-09T00:00:00.000Z';
const PAST = '2026-09-01T00:00:00.000Z';

function addCard(driver, dueAt) {
  const id = randomUUID();
  const stamp = { id, now: NOW };
  const k = buildInsert(
    'knowledge',
    { book_id: null, content: '큐 확인용', page: null, source_type: 'manual', lang: null },
    stamp,
  );
  driver.run(k.text, k.params);
  const r = buildInsert(
    'review_schedules',
    {
      knowledge_id: id,
      due_at: dueAt,
      state: 'new',
      stability: 0,
      difficulty: 0,
      reps: 0,
      lapses: 0,
      last_reviewed_at: null,
    },
    { id: randomUUID(), now: NOW },
  );
  driver.run(r.text, r.params);
  return id;
}

function checkDueQuery() {
  const { db, driver } = openDb();
  const endOfDay = '2026-09-10T00:00:00.000Z';

  const due = addCard(driver, PAST);
  const later = addCard(driver, '2026-12-01T00:00:00.000Z');
  const doomed = addCard(driver, PAST);

  const run = (sql) => db.prepare(sql.text).all(...sql.params);

  let rows = run(dueQuery(endOfDay));
  check(rows.length === 2, `기한이 지난 2장이어야 하는데 ${rows.length}장이다`);
  check(!rows.some((r) => r.knowledge_id === later), '아직 기한이 안 된 카드가 큐에 들어왔다');

  // 🔴 Phase 3 완료 기준 — 지운 지식이 큐에 나타나지 않는다
  for (const step of deleteKnowledgeSteps(doomed, NOW)) driver.run(step.text, step.params);
  rows = run(dueQuery(endOfDay));
  check(rows.length === 1, `지운 뒤 1장이어야 하는데 ${rows.length}장이다`);
  check(rows[0]?.knowledge_id === due, '남은 카드가 다르다');

  // 🔴 두 겹 방어 — 예약 행이 살아남은 상태에서도 지식이 죽었으면 안 뜬다
  const orphan = addCard(driver, PAST);
  driver.run('UPDATE knowledge SET deleted_at = ? WHERE id = ?', [NOW, orphan]);
  rows = run(dueQuery(endOfDay));
  check(
    !rows.some((r) => r.knowledge_id === orphan),
    '🔴 예약만 살아 있는 카드가 큐에 떴다 — 지운 지식이 복습에 되살아난다',
  );

  db.close();
}

// ── FSRS — Phase 3 완료 기준 "4등급이 간격을 바꾼다 · again 이 가장 짧다" ──
function checkFsrs() {
  const at = new Date('2026-09-10T00:00:00.000Z');
  const fresh = newSchedule('k1', '2026-09-10T00:00:00.000Z');
  const days = Object.fromEntries(RATINGS.map((r) => [r, intervalDays(fresh, r, at)]));

  check(
    days.again < days.hard && days.hard < days.good && days.good < days.easy,
    `등급 순서가 어긋난다 — ${RATINGS.map((r) => `${r}:${days[r].toFixed(3)}`).join(' ')}`,
  );
  check(days.again > 0, 'again 간격이 0 이하다 — 같은 순간에 다시 뜬다');

  // 등급을 매기면 기록이 남는다(🔴 optimizer 의 유일한 입력)
  const good = applyRating(fresh, 'good', at);
  check(good.schedule.reps === 1, `reps 가 안 는다: ${good.schedule.reps}`);
  check(good.schedule.last_reviewed_at === at.toISOString(), 'last_reviewed_at 이 안 찍힌다');
  check(good.schedule.state !== 'new', `등급을 줬는데 state 가 new 그대로다`);
  check(typeof good.log.elapsed_days === 'number', 'elapsed_days 가 없다');
  check(typeof good.log.scheduled_days === 'number', 'scheduled_days 가 없다');

  // 🔴🔴 반복 노출 — 간격이 **자라는가**. 이 검사가 없어서 결함이 통과했다(2026-09-09)
  //     [기억났다]만 누르는 사용자의 카드가 learning 에서 졸업하지 못하고 10분에 고정돼 있었다.
  //     원인은 ts-fsrs 의 learning_steps 를 우리 표가 안 들고 다닌 것(마이그레이션 v3 로 고침).
  //     ⚠ 한 시점의 단조성(again<hard<good<easy)만 재면 이 결함은 **영원히 초록이다.**
  {
    let row = newSchedule('k-loop', '2026-09-10T00:00:00.000Z');
    let at2 = new Date('2026-09-10T00:00:00.000Z');
    const gaps = [];
    let reachedReview = false;
    for (let i = 0; i < 6; i++) {
      gaps.push(intervalDays(row, 'good', at2));
      const next = applyRating(row, 'good', at2);
      row = { knowledge_id: 'k-loop', ...next.schedule };
      at2 = new Date(next.schedule.due_at);
      if (row.state === 'review') reachedReview = true;
    }
    check(reachedReview, '🔴 [기억났다]를 여섯 번 눌러도 learning 에서 졸업하지 못한다');
    check(
      gaps[gaps.length - 1] > gaps[0] * 10,
      `🔴 간격이 안 자란다 — 첫 ${gaps[0].toFixed(4)}일 → 마지막 ${gaps[gaps.length - 1].toFixed(1)}일`,
    );
    for (let i = 1; i < gaps.length; i++) {
      check(gaps[i] >= gaps[i - 1], `간격이 뒤로 갔다: ${i}번째 ${gaps[i]} < ${gaps[i - 1]}`);
    }
  }

  // 🔴 잊었다 → lapses 가 는다. 복습한 카드에서만 의미가 있다
  const reviewed = { ...fresh, ...applyRating(fresh, 'easy', at).schedule };
  const later = new Date('2026-09-20T00:00:00.000Z');
  const lapsed = applyRating(reviewed, 'again', later);
  check(lapsed.schedule.lapses === reviewed.lapses + 1, 'again 인데 lapses 가 안 는다');
  check(
    intervalDays(reviewed, 'again', later) < intervalDays(reviewed, 'good', later),
    '복습한 카드에서도 again 이 good 보다 짧아야 한다',
  );
}

/**
 * 🔴 알림 예약(§6.2.1) — **숫자는 경계값을 잰다.**
 *    시각 파싱이 대충 통과하면 `new Date(...)` 가 조용히 다른 날로 굴러간다.
 */
function checkReminder() {
  // ① 시각 파싱 경계
  for (const good of REMINDER_TIMES) check(parseTime(good) !== null, `정상 시각을 거부한다: ${good}`);
  check(parseTime('00:00')?.hour === 0, '00:00 을 못 읽는다');
  check(parseTime('23:59')?.minute === 59, '23:59 를 못 읽는다');
  for (const bad2 of [
    '24:00',
    '21:60',
    '-1:00',
    '9:00',
    '21:0',
    '',
    ' 21:00',
    '21:00 ',
    '2100',
    'ab:cd',
    '1e1:00',
    '٢١:٠٠',
  ]) {
    check(parseTime(bad2) === null, `이상한 시각을 통과시킨다: ${JSON.stringify(bad2)}`);
  }

  const now = new Date(2026, 8, 9, 10, 0, 0); // 로컬 09/09 10:00
  const dueNow = ['2026-09-09T00:00:00.000Z'];

  // ② 만기가 이미 왔고 오늘 시각이 아직이면 오늘부터 7일
  const full = planReminders({ dueAts: dueNow, now, time: '21:00' });
  check(full.length === REMINDER_DAYS, `오늘부터 ${REMINDER_DAYS}일이 아니라 ${full.length}일이다`);
  check(full[0]?.getDate() === 9 && full[0]?.getHours() === 21, '첫 예약이 오늘 21시가 아니다');

  // ③ 오늘 시각이 이미 지났으면 오늘은 뺀다
  const late = planReminders({ dueAts: dueNow, now: new Date(2026, 8, 9, 22, 0, 0), time: '21:00' });
  check(late.length === REMINDER_DAYS - 1, `지난 시각을 넣었다: ${late.length}`);
  check(late[0]?.getDate() === 10, '지난 시각을 빼고 나서 다음 날부터가 아니다');

  // 🔴 경계: 정확히 같은 시각이면 넣지 않는다(넣으면 즉시 발화한다)
  const exact = planReminders({ dueAts: dueNow, now: new Date(2026, 8, 9, 21, 0, 0), time: '21:00' });
  check(exact.length === REMINDER_DAYS - 1, '지금과 같은 시각을 예약했다');

  // ④ 만기가 사흘 뒤면 그 앞의 날들은 뺀다
  const later = planReminders({
    dueAts: [new Date(2026, 8, 12, 9, 0, 0).toISOString()],
    now,
    time: '21:00',
  });
  check(later.length === REMINDER_DAYS - 3, `앞선 날을 예약했다: ${later.length}`);
  check(later[0]?.getDate() === 12, '만기 날부터가 아니다');

  // ⑤ 만기가 아주 멀면(8일 뒤) 예약이 없다 — 예산 밖이다
  const far = planReminders({
    dueAts: [new Date(2026, 8, 20, 9, 0, 0).toISOString()],
    now,
    time: '21:00',
  });
  check(far.length === 0, `예산(${REMINDER_DAYS}일) 밖인데 예약했다: ${far.length}`);

  // ⑥ 이상한 입력에서 조용히 0을 준다(예외로 앱을 죽이지 않는다)
  check(planReminders({ dueAts: dueNow, now, time: '25:00' }).length === 0, '이상한 시각인데 예약한다');
  check(planReminders({ dueAts: dueNow, now, time: '21:00', days: 0 }).length === 0, 'days 0 인데 예약한다');
  check(
    planReminders({ dueAts: dueNow, now, time: '21:00', days: -1 }).length === 0,
    'days 음수인데 예약한다',
  );
  check(planReminders({ dueAts: ['', 'x'], now, time: '21:00' }).length === 0, '빈 문자열을 만기로 친다');

  // ⑦ 🔴 자정 경계 — 오늘 23:00 만기 카드는 **오늘 21시 알림에 포함**된다(§2.1 과 같은 기준)
  const tonight = planReminders({
    dueAts: [new Date(2026, 8, 9, 23, 0, 0).toISOString()],
    now,
    time: '21:00',
  });
  check(tonight[0]?.getDate() === 9, '오늘 자정 전 만기인데 오늘 알림에서 빠졌다');
}

selfTest();
checkFsrs();
checkReminder();
checkCue();
checkQueue();
checkDueQuery();

if (bad.length > 0) {
  console.error(`check:review FAIL (${bad.length})`);
  for (const m of bad) console.error('  ' + m);
  process.exit(1);
}
console.log(
  `check:review OK — FSRS 4등급 순서·간격 성장 · 단서 4갈래 · 자정 경계 · 상한 ${DAILY_LIMIT} · 큐 질의(지운 지식 2겹 차단) · 알림 예약(시각 경계 12종 · 예산 ${REMINDER_DAYS}일) · SELF-TEST 4종`,
);
