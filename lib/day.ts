/**
 * "하루"의 경계 — 기기 **로컬 자정** 고정 (`CLAUDE.md` §9 · `REVIEW_SYSTEM.md` §2.1).
 *
 * 🔴 통계와 실천이 **같은 날짜 셈법을 써야 한다.** 두 곳에서 하루를 다르게 자르면
 *    사용자는 한 화면에서 서로 다른 연속일을 보게 된다. 그래서 여기 하나로 모아 뒀다
 *    (원래 `features/stats/compute.ts` 에 있었고, Phase 9 에서 실천이 같은 것을 필요로 해 옮겼다).
 *
 * 🔴 순수하다. expo 도, 로케일도, 저장소도 안 쓴다. 가드가 node 에서 그대로 돌린다.
 * 🚫 로케일을 따르지 않는다. 로케일마다 주의 시작이 다르지만 **하루의 경계는 자정 하나**다.
 */

/** 로컬 날짜 키 `YYYY-MM-DD`. 문자열 비교가 곧 날짜 비교가 된다 */
export type DayKey = string;

/** UTC ISO → 그 시각이 속한 **로컬 날짜** 키 */
export function localDayKey(iso: string): DayKey {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error(`시각을 못 읽었다: ${iso}`);
  return fromDate(d);
}

/** `Date` → 로컬 날짜 키 */
export function fromDate(d: Date): DayKey {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 날짜 키 → 그 날 자정의 로컬 `Date` */
export function toDate(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  if (y === undefined || m === undefined || d === undefined || Number.isNaN(y * m * d)) {
    throw new Error(`날짜 키가 이상하다: ${key}`);
  }
  return new Date(y, m - 1, d);
}

/** 하루 전 */
export function previousDayKey(key: DayKey): DayKey {
  const d = toDate(key);
  d.setDate(d.getDate() - 1);
  return fromDate(d);
}

/** 하루 뒤 */
export function nextDayKey(key: DayKey): DayKey {
  const d = toDate(key);
  d.setDate(d.getDate() + 1);
  return fromDate(d);
}

/**
 * 요일. 🔴 **ISO 번호(월=1 … 일=7)** 다.
 *
 * `repeat_rule` 의 `weekly:1,3,5` 가 월·수·금을 뜻하도록 맞춘 것이다
 * (JS 의 `getDay()` 는 일요일이 0 이라 그대로 쓰면 규칙 문자열이 사람이 읽기 어려워진다).
 */
export function isoWeekday(key: DayKey): number {
  const n = toDate(key).getDay();
  return n === 0 ? 7 : n;
}

/** 그 날이 속한 주의 **월요일**. 주는 월요일에 시작한다(`PRACTICE_SYSTEM.md` §3 의 `월 화 수 …`) */
export function mondayOf(key: DayKey): DayKey {
  let cursor = key;
  for (let i = 0; i < 7; i += 1) {
    if (isoWeekday(cursor) === 1) return cursor;
    cursor = previousDayKey(cursor);
  }
  // 🔴 도달하면 요일 계산이 깨진 것이다. 조용히 틀린 주를 돌려주지 않는다
  throw new Error(`한 주 안에 월요일이 없다: ${key}`);
}

/** `from` 부터 `to` 까지(양끝 포함) 날짜 키. 🔴 뒤집힌 구간은 빈 배열이 아니라 오류다 */
export function daysBetween(from: DayKey, to: DayKey): DayKey[] {
  if (from > to) throw new Error(`구간이 뒤집혔다: ${from} → ${to}`);
  const out: DayKey[] = [];
  let cursor = from;
  // 🔴 상한을 둔다. 커서가 안 늘면 여기서 영원히 돈다(`EDGE_CASES.md` §12 와 같은 함정)
  for (let i = 0; i <= 3660 && cursor <= to; i += 1) {
    out.push(cursor);
    const next = nextDayKey(cursor);
    if (next <= cursor) throw new Error(`날짜가 앞으로 안 간다: ${cursor} → ${next}`);
    cursor = next;
  }
  return out;
}
