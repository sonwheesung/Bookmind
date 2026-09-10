/**
 * 통계 계산 — `docs/STATS_SYSTEM.md` §3.
 *
 * 🔴 **여기서 틀리면 화면은 멀쩡한데 숫자만 조용히 틀린다.** 이 프로젝트가 하루에 다섯 번 만난
 *    바로 그 모양이라(`CLAUDE.md` §16) 계산을 순수 모듈로 빼고 가드가 경계를 전수로 잰다.
 *
 * 🔴 "하루"의 셈법은 `lib/day.ts` 하나다. 실천도 같은 것을 쓴다. 두 곳에서 하루를 다르게
 *    자르면 사용자가 한 화면에서 서로 다른 연속일을 본다(`PRACTICE_SYSTEM.md` §6.1).
 */
// 🔴 상대 경로다. `@/` 별칭은 Metro·tsc 만 알고 node 는 모른다(가드가 이 파일을 직접 import 한다).
import { localDayKey, previousDayKey, type DayKey } from '../../lib/day.ts';

export { localDayKey, previousDayKey };

/**
 * 기억률 = `again` 이 아닌 비율. **분모가 0이면 `null`**(§3.2).
 *
 * 🔴 `0` 을 돌려주지 않는다. 복습을 한 번도 안 한 사람에게 `0%` 는 **사실이 아니고 기분만 나쁘다.**
 *    독서 진행률이 같은 결정을 이미 했다. *"0%는 '안 읽었다'이지 '모른다'가 아니다"*
 *    (`KNOWLEDGE_SYSTEM.md` §4.4).
 */
export function retentionRate(total: number, again: number): number | null {
  if (total < 0 || again < 0) throw new Error('복습 수가 음수다');
  if (again > total) throw new Error('again 이 전체보다 크다');
  if (total === 0) return null;
  return (total - again) / total;
}

/**
 * 연속 학습일. `activeDays` 는 활동이 있었던 **로컬 날짜 키**의 집합이다.
 *
 * 🔴 **오늘 활동이 없어도 어제까지의 연속을 끊지 않는다**(§3.3).
 *    이 규칙이 없으면 어제까지 열흘을 이어온 사람이 아침 8시에 앱을 열었을 뿐인데 `0일` 을 본다.
 *    사실도 아니고 기둥 5 와도 부딪힌다. **하루가 끝나기 전에는 그 하루를 실패로 세지 않는다.**
 */
export function streakDays(activeDays: Iterable<DayKey>, todayKey: DayKey): number {
  const days = activeDays instanceof Set ? activeDays : new Set(activeDays);
  // 오늘 했으면 오늘부터, 아니면 어제부터 거슬러 센다. 어제도 없으면 0이다
  let cursor = days.has(todayKey) ? todayKey : previousDayKey(todayKey);
  if (!days.has(cursor)) return 0;

  let n = 0;
  while (days.has(cursor)) {
    n += 1;
    const prev = previousDayKey(cursor);
    // 🔴 커서가 안 줄면 이 반복은 **영원히 끝나지 않는다.** 그러면 통계 화면이 느려지는 게 아니라
    //    JS 스레드가 멈추고 앱 전체가 언다. 숫자가 틀린 것과 앱이 서는 것은 등급이 다르다.
    //    날짜 키가 `YYYY-MM-DD` 라 문자열 비교로 충분하다(`EDGE_CASES.md` §12).
    if (prev >= cursor) throw new Error(`날짜가 거꾸로 가지 않는다: ${cursor} → ${prev}`);
    cursor = prev;
  }
  return n;
}

export interface Totals {
  readonly knowledge: number;
  readonly books: number;
  readonly thoughts: number;
  readonly reviews: number;
  /** 🔴 복습이 0회면 `null` 이다. 화면은 그때 이 줄을 안 그린다 */
  readonly retention: number | null;
  readonly streak: number;
}
