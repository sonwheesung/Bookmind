/**
 * 오늘의 복습 큐 — `docs/REVIEW_SYSTEM.md` §2.1 · §2.2 · §2.3.
 *
 * 🔴 여기서 다루는 것은 **"하루"의 경계**와 **상한**이다. 둘 다 순수 계산이라
 *    가드가 node 에서 시간대·밀린 카드 수를 바꿔 가며 잰다 — 기기에서는 재현이 어려운 축이다.
 *
 * 🔴 "하루"는 **기기 로컬 자정 고정**이다(§2.1). 로케일(주 시작 요일 등)을 따르지 않는다 —
 *    따르면 복습 큐가 날마다 달라진다.
 */

/** 하루에 보여주는 최대 장수(§2.2 — 2026-09-09 확정). 카드 한 장이 무겁다 */
export const DAILY_LIMIT = 20;

/**
 * 그 시각이 속한 **로컬 날짜의 다음 자정**(= 오늘의 끝). UTC ISO 로 돌려준다.
 *
 * 🔴 큐 판정은 `due_at < 이 값` 이다. 그래서 밤 11시에 저장한 카드도
 *    자정이 지나면 뜬다 — 경계는 시각이 아니라 **날짜**다(§2.3).
 */
export function endOfLocalDay(now: Date): string {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return end.toISOString();
}

/** 저장한 카드의 첫 노출 시점 = **다음 로컬 자정**(§2.3). 저장한 날에는 안 뜬다 */
export function firstDueAt(savedAt: Date): string {
  return endOfLocalDay(savedAt);
}

export interface DueCard {
  readonly knowledge_id: string;
  readonly due_at: string;
}

/**
 * 밀린 것은 **오래된 순**으로 상한까지만. 나머지는 조용히 다음 날로(§2.2).
 *
 * 🚫 "37개가 밀렸습니다"를 만들지 않는다 — 앱을 여는 것 자체를 부담으로 만든다(기둥 5).
 *    그래서 이 함수는 **자른 뒤의 목록만** 돌려주고 잘린 개수를 밖으로 내보내지 않는다.
 */
export function takeDue(cards: readonly DueCard[], limit: number = DAILY_LIMIT): DueCard[] {
  if (limit < 0) throw new Error('상한이 음수다');
  return [...cards].sort((a, b) => (a.due_at < b.due_at ? -1 : a.due_at > b.due_at ? 1 : 0)).slice(0, limit);
}
