/**
 * 통계 차트 계산 — `docs/STATS_SYSTEM.md` §4.2.
 *
 * 🔴 **차트는 틀려도 화면이 멀쩡하다.** 막대 하나가 하루 밀리거나 다른 해가 섞여도 아무도 모른다.
 *    그래서 기간 · 칸 · 축 · 다가올 복습을 전부 여기 순수 함수로 두고 가드가 경계를 잰다.
 * 🔴 "하루"의 셈법은 `lib/day.ts` 하나다(로컬 자정).
 */
// 🔴 상대 경로다. `@/` 별칭은 Metro·tsc 만 알고 node 는 모른다(가드가 이 파일을 직접 import 한다).
import {
  addMonths,
  daysBetween,
  daysOfMonth,
  fromDate,
  isoWeekday,
  localDayKey,
  mondayOf,
  monthOf,
  nextDayKey,
  toDate,
  type DayKey,
  type MonthKey,
} from '../../lib/day.ts';

// ── 기간 ─────────────────────────────────────────────────────────────

/** 🔴 "일"은 기간이 아니라 차트 안의 단위다. 하루 저장이 1~3개라 막대 하나짜리 화면이 된다(§4.2) */
export const STATS_PERIODS = ['week', 'month', 'year'] as const;
export type StatsPeriod = (typeof STATS_PERIODS)[number];

/** 기기에 저장된 기간을 읽는다. 🔴 깨졌거나 모르는 값이면 `week` */
export function parseStatsPeriod(v: unknown): StatsPeriod {
  return (STATS_PERIODS as readonly unknown[]).includes(v) ? (v as StatsPeriod) : 'week';
}

/** 그 날이 속한 기간의 첫날. 주는 월요일에 시작한다 */
export function periodStart(kind: StatsPeriod, day: DayKey): DayKey {
  if (kind === 'week') return mondayOf(day);
  if (kind === 'month') return `${monthOf(day)}-01`;
  return `${monthOf(day).slice(0, 4)}-01-01`;
}

/** 기간의 마지막 날(양끝 포함) */
export function periodEnd(kind: StatsPeriod, day: DayKey): DayKey {
  const start = periodStart(kind, day);
  if (kind === 'week') {
    let d = start;
    for (let i = 0; i < 6; i += 1) d = nextDayKey(d);
    return d;
  }
  if (kind === 'month') {
    const last = daysOfMonth(monthOf(start)).at(-1);
    if (last === undefined) throw new Error(`날이 없는 달이다: ${start}`);
    return last;
  }
  return `${start.slice(0, 4)}-12-31`;
}

/** 기간 넘기기. 🔴 결과는 언제나 기간의 첫날이다 */
export function shiftPeriod(kind: StatsPeriod, day: DayKey, n: number): DayKey {
  if (!Number.isInteger(n)) throw new Error(`기간 수가 정수가 아니다: ${n}`);
  const start = periodStart(kind, day);
  if (kind === 'week') {
    const d = toDate(start);
    d.setDate(d.getDate() + 7 * n);
    return fromDate(d);
  }
  if (kind === 'month') return `${addMonths(monthOf(start), n)}-01`;
  return `${String(Number(start.slice(0, 4)) + n).padStart(4, '0')}-01-01`;
}

export interface PeriodBounds {
  readonly first: DayKey;
  readonly last: DayKey;
}

/**
 * 넘길 수 있는 범위. 🔴 첫 활동이 있는 기간보다 앞, 이번 기간보다 뒤로 안 간다.
 * 활동이 없거나(`null`) 첫 활동이 미래로 찍혀 있으면 이번 기간 하나다.
 */
export function periodBounds(kind: StatsPeriod, firstDay: DayKey | null, today: DayKey): PeriodBounds {
  const last = periodStart(kind, today);
  const first = firstDay === null || firstDay > today ? last : periodStart(kind, firstDay);
  return { first, last };
}

/** 고른 기간을 범위 안으로. `null` 이면 이번 기간 */
export function clampPeriod(kind: StatsPeriod, wanted: DayKey | null, bounds: PeriodBounds): DayKey {
  if (wanted === null) return bounds.last;
  const start = periodStart(kind, wanted);
  if (start < bounds.first) return bounds.first;
  if (start > bounds.last) return bounds.last;
  return start;
}

// ── 🔴 차트가 뜨는 조건 ──────────────────────────────────────────────

/** 활동한 날이 이만큼 모이기 전에는 차트를 안 그린다. 텅 빈 차트는 미완성으로 보인다(§4.2) */
export const MIN_ACTIVE_DAYS = 7;

export function chartsReady(activeDayCount: number): boolean {
  return Number.isFinite(activeDayCount) && activeDayCount >= MIN_ACTIVE_DAYS;
}

// ── 날짜별 수 ────────────────────────────────────────────────────────

/** UTC 시각들 → 로컬 날짜별 개수. 🔴 SQLite 의 date() 는 UTC 라 여기서 접는다(`sql.ts` 주석) */
export function countByDay(isoTimes: Iterable<string>): Map<DayKey, number> {
  const out = new Map<DayKey, number>();
  for (const iso of isoTimes) {
    const day = localDayKey(iso);
    out.set(day, (out.get(day) ?? 0) + 1);
  }
  return out;
}

/** 두 날짜별 수를 더한다. 입력을 바꾸지 않는다 */
export function mergeCounts(a: ReadonlyMap<DayKey, number>, b: ReadonlyMap<DayKey, number>): Map<DayKey, number> {
  const out = new Map(a);
  for (const [day, n] of b) out.set(day, (out.get(day) ?? 0) + n);
  return out;
}

export interface Bucket {
  /** 주 · 월은 날짜 키, 년은 달 키 */
  readonly key: string;
  readonly value: number;
}

/**
 * 막대 한 벌. 주 7개 · 월은 그 달 날짜 수 · 년 12개(달별 합).
 * 🔴 년은 **그 해의 날만** 더한다. 다른 해의 같은 달이 섞이면 막대가 조용히 부푼다.
 *    달 키(`YYYY-MM`)로 모으고 그 해의 열두 키만 꺼내므로 다른 해는 읽히지 않는다.
 *    ⚠ 해를 거르는 줄을 따로 두었더니 변이 주입에서 **지워도 결과가 같았다**(2026-09-15). 없는 것과 같은 줄이라 뺐다.
 */
export function periodBuckets(kind: StatsPeriod, day: DayKey, byDay: ReadonlyMap<DayKey, number>): Bucket[] {
  const start = periodStart(kind, day);
  if (kind !== 'year') {
    return daysBetween(start, periodEnd(kind, start)).map((d) => ({ key: d, value: byDay.get(d) ?? 0 }));
  }
  const year = start.slice(0, 4);
  const sums = new Map<MonthKey, number>();
  for (const [d, n] of byDay) {
    const month = d.slice(0, 7);
    sums.set(month, (sums.get(month) ?? 0) + n);
  }
  return Array.from({ length: 12 }, (_, i) => {
    const key = `${year}-${String(i + 1).padStart(2, '0')}`;
    return { key, value: sums.get(key) ?? 0 };
  });
}

export function sumBuckets(buckets: readonly Bucket[]): number {
  return buckets.reduce((n, b) => n + b.value, 0);
}

// ── 축 · 칸 ──────────────────────────────────────────────────────────

/** 축 맨 위 값. 🔴 데이터 최대값이 아니라 **깔끔한 수**(1 · 2 · 5 · 10 · 20 …). 0 이면 0 */
export function niceMax(n: number): number {
  if (!Number.isFinite(n) || n < 0) throw new Error(`축 값이 이상하다: ${n}`);
  if (n === 0) return 0;
  let base = 1;
  for (let i = 0; i < 16; i += 1) {
    for (const m of [1, 2, 5]) if (n <= m * base) return m * base;
    base *= 10;
  }
  throw new Error(`축 값이 너무 크다: ${n}`);
}

export type ActivityLevel = 0 | 1 | 2 | 3 | 4;

/**
 * 활동 칸의 진하기. 0 · 1~2 · 3~5 · 6~10 · 11+.
 * 하루 복습 상한이 20 이라(`REVIEW_SYSTEM.md` §2.2) 그 위는 가르지 않는다.
 */
export function activityLevel(n: number): ActivityLevel {
  if (!Number.isInteger(n) || n < 0) throw new Error(`활동 수가 이상하다: ${n}`);
  if (n === 0) return 0;
  if (n <= 2) return 1;
  if (n <= 5) return 2;
  if (n <= 10) return 3;
  return 4;
}

/** 달력 한 장의 칸. 주는 월요일에 시작하고 `null` 은 그 달이 아닌 빈칸이다. 칸 수는 7 의 배수 */
export function monthGrid(month: MonthKey): (DayKey | null)[] {
  const days = daysOfMonth(month);
  const first = days[0];
  if (first === undefined) throw new Error(`날이 없는 달이다: ${month}`);
  const cells: (DayKey | null)[] = Array.from({ length: isoWeekday(first) - 1 }, () => null);
  cells.push(...days);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// ── 🔴 다가올 복습 ───────────────────────────────────────────────────

/**
 * 오늘부터 `days` 일 동안 다시 만날 문장 수.
 *
 * 🔴 **오늘의 복습과 같은 규칙으로 흘린다.** 밀린 카드는 오늘로 모으고, 하루 상한을 넘는 것은
 *    다음 날로 넘긴다(`REVIEW_SYSTEM.md` §2.2). 날짜별 만기 수를 그대로 쌓으면
 *    첫 막대가 홈의 "오늘의 복습"과 다른 수가 된다.
 * 🚫 밀린 수를 따로 돌려주지 않는다. 크게 띄울 자리를 만들지 않는다.
 */
export function forecast(dueDays: Iterable<DayKey>, today: DayKey, days: number, cap: number): Bucket[] {
  if (!Number.isInteger(days) || days < 1) throw new Error(`날 수가 이상하다: ${days}`);
  if (!Number.isInteger(cap) || cap < 0) throw new Error(`상한이 이상하다: ${cap}`);

  const span: DayKey[] = [];
  let cursor = today;
  for (let i = 0; i < days; i += 1) {
    span.push(cursor);
    cursor = nextDayKey(cursor);
  }
  const lastDay = span[span.length - 1] ?? today;

  const due = new Map<DayKey, number>();
  for (const d of dueDays) {
    if (d > lastDay) continue;
    const key = d < today ? today : d;
    due.set(key, (due.get(key) ?? 0) + 1);
  }

  let carry = 0;
  return span.map((d) => {
    const available = carry + (due.get(d) ?? 0);
    const shown = Math.min(cap, available);
    carry = available - shown;
    return { key: d, value: shown };
  });
}

// ── 기간 기억률 ──────────────────────────────────────────────────────

export interface ReviewMark {
  /** 로컬 날짜 키 */
  readonly day: DayKey;
  readonly again: boolean;
}

/** 기간 안(양끝 포함) 복습 수와 `again` 수. 기억률은 `retentionRate` 가 낸다(분모 0 → null) */
export function tallyIn(marks: Iterable<ReviewMark>, start: DayKey, end: DayKey): { total: number; again: number } {
  let total = 0;
  let again = 0;
  for (const m of marks) {
    if (m.day < start || m.day > end) continue;
    total += 1;
    if (m.again) again += 1;
  }
  return { total, again };
}
