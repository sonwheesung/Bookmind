/**
 * 알림 예약 계산 — `docs/REVIEW_SYSTEM.md` §6.2.1.
 *
 * 🔴 **순수하다.** `expo-notifications` 도 DB 도 모른다 — 만기 시각 목록과 "지금"을 받아
 *    **언제 울려야 하는가**만 돌려준다. 그래서 가드가 시간대·경계를 바꿔 가며 잰다.
 *
 * 🔴 왜 미리 여러 날을 계산하나: **로컬 알림은 발송 시점에 코드를 돌리지 못한다.**
 *    "복습할 게 있을 때만 보낸다"(§6.2)를 지킬 수 있는 순간은 **예약할 때**뿐이다.
 */
import { endOfLocalDay } from './queue.ts';

/** 출발값(⚠ 미결정). 사용자가 설정에서 바꾼다 */
export const DEFAULT_REMINDER_TIME = '21:00';

/** 🔴 앱을 안 여는 동안의 예산(§6.2.1). 늘리면 만기 없는 날에도 울릴 위험이 커진다 */
export const REMINDER_DAYS = 7;

/** 설정 화면이 고르는 값. 🚫 자유 입력을 받지 않는다 — 잘못된 문자열이 조용한 무예약이 된다 */
export const REMINDER_TIMES: readonly string[] = ['08:00', '13:00', '18:00', '21:00', '22:00'];

export interface HourMinute {
  readonly hour: number;
  readonly minute: number;
}

/**
 * `"21:00"` → `{hour:21, minute:0}`. 🔴 조금이라도 이상하면 **null** 이다.
 * 경계: `24:00`·`21:60`·`-1:00`·`9:0`·빈 문자열·`NaN` 전부 거부한다 —
 * 여기서 대충 통과시키면 `new Date(...)` 가 조용히 다른 날로 굴러간다.
 */
export function parseTime(text: string): HourMinute | null {
  const m = /^([0-9]{2}):([0-9]{2})$/.exec(text);
  if (m === null) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

export interface PlanInput {
  /** 살아 있는 카드의 `due_at`(UTC ISO). 정렬돼 있지 않아도 된다 */
  readonly dueAts: readonly string[];
  readonly now: Date;
  readonly time: string;
  readonly days?: number;
}

/**
 * 앞으로 `days` 일 중 **울려야 하는 날의 시각**을 돌려준다(로컬).
 *
 * - 이미 지난 시각은 버린다(오늘 21시에 계산하면 오늘 21시는 안 넣는다).
 * - 그 날의 **자정 경계**까지 만기가 오는 카드가 하나라도 있어야 넣는다(§2.1 과 같은 기준).
 * - 🟢 밀린 카드는 사라지지 않으므로 결과는 언제나 **연속된 날들**이 된다.
 */
export function planReminders(input: PlanInput): Date[] {
  const hm = parseTime(input.time);
  if (hm === null) return [];

  const days = input.days ?? REMINDER_DAYS;
  if (!Number.isInteger(days) || days < 0) return [];

  // 만기가 하나도 없으면 예약할 것도 없다 — 0건인 날 알림은 신뢰를 깎는다(§6.2)
  let earliest: string | null = null;
  for (const d of input.dueAts) {
    if (typeof d !== 'string' || d === '') continue;
    if (earliest === null || d < earliest) earliest = d;
  }
  if (earliest === null) return [];

  const out: Date[] = [];
  const { now } = input;
  for (let i = 0; i < days; i++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, hm.hour, hm.minute, 0, 0);
    if (day.getTime() <= now.getTime()) continue;
    if (earliest < endOfLocalDay(day)) out.push(day);
  }
  return out;
}
