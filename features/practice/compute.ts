/**
 * 실천 계산 — `docs/PRACTICE_SYSTEM.md` §2.1 · §6.1.
 *
 * 🔴 **여기서 틀리면 성실한 사용자에게 "끊겼다"고 말하게 된다.** `weekdays` 실천을 금요일까지
 *    한 사람이 월요일 아침에 여는 상황이 그 자리다. 주말을 끊김으로 세면 `0일` 이 나온다.
 *
 * 🔴 "하루"의 셈법은 `lib/day.ts` 하나다. 통계도 같은 것을 쓴다.
 */
// 🔴 상대 경로다. `@/` 별칭은 Metro·tsc 만 알고 node 는 모른다(가드가 이 파일을 직접 import 한다).
import {
  daysOfMonth,
  isoWeekday,
  mondayOf,
  monthOf,
  nextDayKey,
  previousDayKey,
  type DayKey,
  type MonthKey,
} from '../../lib/day.ts';

export type RepeatKind = 'daily' | 'weekdays' | 'weekly';

export interface Repeat {
  readonly kind: RepeatKind;
  /** ISO 요일(월=1 … 일=7). `daily` 는 일곱 개, `weekdays` 는 1~5 */
  readonly days: readonly number[];
}

const ALL = [1, 2, 3, 4, 5, 6, 7];
const WEEKDAYS = [1, 2, 3, 4, 5];

/**
 * `daily` · `weekdays` · `weekly:1,3,5` 를 읽는다.
 *
 * 🔴 **못 읽는 문자열을 삼키지 않는다.** 조용히 `daily` 로 떨어뜨리면 사용자가 고른 주기가
 *    말없이 바뀐 것이고, 화면은 멀쩡한 채로 연속일만 틀린다.
 */
export function parseRepeat(rule: string): Repeat {
  if (rule === 'daily') return { kind: 'daily', days: ALL };
  if (rule === 'weekdays') return { kind: 'weekdays', days: WEEKDAYS };

  if (rule.startsWith('weekly:')) {
    const raw = rule.slice('weekly:'.length);
    if (raw === '') throw new Error(`반복 주기에 요일이 없다: ${rule}`);
    const days = [
      ...new Set(
        raw.split(',').map((p) => {
          const n = Number(p);
          if (!Number.isInteger(n) || n < 1 || n > 7) throw new Error(`요일이 1~7 이 아니다: ${rule}`);
          return n;
        }),
      ),
    ].sort((a, b) => a - b);
    return { kind: 'weekly', days };
  }

  throw new Error(`모르는 반복 주기다: ${rule}`);
}

/** 그 날이 이 실천의 **예정일**인가 */
export function isScheduled(rule: string, day: DayKey): boolean {
  return parseRepeat(rule).days.includes(isoWeekday(day));
}

export interface PracticeWindow {
  readonly startedDay: DayKey;
  /** 없으면 무기한 */
  readonly endedDay: DayKey | null;
  /** 사용자가 [그만두기] 를 눌렀나 */
  readonly active: boolean;
}

/**
 * 오늘 이 실천을 보여줄 것인가(§2.1).
 *
 * 🚫 종료일이 지났다고 `active` 를 고쳐 두지 않는다. **매번 판정한다.**
 *    고쳐 두려면 "누가 언제 고치나"를 정해야 하는데, 앱을 한 달 안 켠 사람에게는 아무도 안 고쳐 준다.
 */
export function isRunning(w: PracticeWindow, today: DayKey): boolean {
  if (!w.active) return false;
  if (w.startedDay > today) return false;
  if (w.endedDay !== null && w.endedDay < today) return false;
  return true;
}

/** 목록에서 보여줄 상태. 🔴 `종료됨` 은 저장된 값이 아니라 오늘과 비교한 결과다 */
export type PracticeState = 'running' | 'upcoming' | 'ended' | 'stopped';

export function practiceState(w: PracticeWindow, today: DayKey): PracticeState {
  if (!w.active) return 'stopped';
  if (w.startedDay > today) return 'upcoming';
  if (w.endedDay !== null && w.endedDay < today) return 'ended';
  return 'running';
}

/**
 * 실천 연속일(§6.1).
 *
 * ```
 * 1. 오늘 체크했으면 오늘부터, 아니면 어제부터 거슬러 센다
 * 2. 예정일이 아닌 날은 건너뛴다(끊김도 아니고 세지도 않는다)
 * 3. 예정일인데 기록이 없으면 멈춘다
 * 4. 시작일 이전으로는 안 간다
 * ```
 *
 * 🔴 1번은 학습 연속일과 **같은 규칙**이다(`STATS_SYSTEM.md` §3.3).
 *    두 곳에서 규칙이 다르면 사용자가 한 화면에서 서로 다른 셈법을 본다.
 * 🔴 2번이 `weekdays` 의 급소다. 금요일까지 한 사람이 월요일에 `0일` 을 보면 안 된다.
 */
export function practiceStreak(
  rule: string,
  doneDays: Iterable<DayKey>,
  today: DayKey,
  startedDay: DayKey,
): number {
  const done = doneDays instanceof Set ? doneDays : new Set(doneDays);
  const repeat = parseRepeat(rule);
  const onSchedule = (d: DayKey): boolean => repeat.days.includes(isoWeekday(d));

  // 오늘이 아직 안 끝났으므로, 오늘 기록이 없으면 어제부터 본다
  let cursor = done.has(today) ? today : previousDayKey(today);

  let n = 0;
  // 🔴 상한을 둔다. 커서가 안 줄면 여기서 영원히 돈다(`EDGE_CASES.md` §12 에서 실제로 겪었다)
  for (let i = 0; i < 3660; i += 1) {
    if (cursor < startedDay) break;
    if (onSchedule(cursor)) {
      if (!done.has(cursor)) break;
      n += 1;
    }
    const prev = previousDayKey(cursor);
    if (prev >= cursor) throw new Error(`날짜가 거꾸로 가지 않는다: ${cursor} → ${prev}`);
    cursor = prev;
  }
  return n;
}

export interface WeekCell {
  readonly day: DayKey;
  /** 이 실천의 예정일인가 */
  readonly scheduled: boolean;
  readonly done: boolean;
  /** 🔴 미래와 시작일 이전은 누를 수 없다(§8) */
  readonly checkable: boolean;
}

/** 이번 주 일곱 칸(월 … 일). 화면이 그대로 그린다(§3) */
export function weekCells(
  rule: string,
  doneDays: Iterable<DayKey>,
  today: DayKey,
  window: PracticeWindow,
): WeekCell[] {
  const done = doneDays instanceof Set ? doneDays : new Set(doneDays);
  const repeat = parseRepeat(rule);

  const cells: WeekCell[] = [];
  let day = mondayOf(today);
  for (let i = 0; i < 7; i += 1) {
    cells.push(cellOf(day, repeat, done, today, window));
    day = nextDayKey(day);
  }
  return cells;
}

/** 체크를 허용할 날인가(§3). 🔴 미래와 시작일 이전은 막는다 */
export function canCheck(day: DayKey, today: DayKey, window: PracticeWindow): boolean {
  if (day > today) return false;
  if (day < window.startedDay) return false;
  if (window.endedDay !== null && day > window.endedDay) return false;
  return true;
}

/** 한 칸의 판정. 🔴 주 칸과 달력이 **같은 함수**를 거친다. 둘이 같은 날을 다르게 보면 안 된다(§3.1) */
function cellOf(
  day: DayKey,
  repeat: Repeat,
  done: ReadonlySet<DayKey>,
  today: DayKey,
  window: PracticeWindow,
): WeekCell {
  return {
    day,
    scheduled: repeat.days.includes(isoWeekday(day)),
    done: done.has(day),
    checkable: canCheck(day, today, window),
  };
}

/**
 * 기록 달력 한 달(§3.1). 주는 월요일에 시작하고, `null` 은 그 달이 아닌 빈칸이다.
 *
 * 🔴 칸 수는 언제나 7 의 배수다. 앞 빈칸 = 1일의 요일 - 1, 뒤 빈칸은 마지막 주를 채운다.
 */
export function monthCells(
  rule: string,
  doneDays: Iterable<DayKey>,
  today: DayKey,
  window: PracticeWindow,
  month: MonthKey,
): (WeekCell | null)[] {
  const done = doneDays instanceof Set ? doneDays : new Set(doneDays);
  const repeat = parseRepeat(rule);
  const days = daysOfMonth(month);
  const first = days[0];
  if (first === undefined) throw new Error(`날이 없는 달이다: ${month}`);

  const cells: (WeekCell | null)[] = Array.from({ length: isoWeekday(first) - 1 }, () => null);
  for (const day of days) cells.push(cellOf(day, repeat, done, today, window));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/**
 * 달 넘기기 범위(§3.1).
 *
 * 🔴 시작한 달보다 앞, 이번 달(종료했으면 종료한 달)보다 뒤로 안 간다. 빈 달을 넘기게 하지 않는다.
 * 🔴 시작 전 실천은 시작하는 달 하나다. 범위가 뒤집히면 화살표가 둘 다 열려 끝없이 넘어간다.
 */
export function calendarBounds(
  startedDay: DayKey,
  endedDay: DayKey | null,
  today: DayKey,
): { first: MonthKey; last: MonthKey } {
  const first = monthOf(startedDay);
  const lastDay = endedDay !== null && endedDay < today ? endedDay : today;
  const last = monthOf(lastDay);
  return { first, last: last < first ? first : last };
}
