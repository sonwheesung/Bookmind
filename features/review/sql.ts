/**
 * 오늘의 복습 큐 질의 — `docs/REVIEW_SYSTEM.md` §5 · `docs/DATABASE.md` §4.
 *
 * 🔴 질의를 **순수 모듈로 뺀 이유**: Phase 3 완료 기준에 *"지운 지식이 큐에 나타나지 않는다"* 가 있는데,
 *    그건 기기에서 확인하기 번거롭고 **한 번 보고 다시는 안 보는** 종류다.
 *    여기 있으면 가드가 실물 SQLite 에 데이터를 넣고 매번 잰다.
 */
// 🔴 상대 경로다. `@/` 별칭은 Metro·tsc 만 알고 **node 는 모른다** —
//    가드(`scripts/check-review.mjs`)가 이 파일을 그대로 import 해서 실물 SQLite 에 물린다.
//    가드가 읽는 모듈에는 별칭을 쓰지 않는다.
import { buildSelect, type Sql } from '../../db/sql.ts';

/**
 * 오늘 뜰 카드. **두 겹으로 막는다**:
 *   ① `review_schedules.deleted_at IS NULL` — 빌더가 자동으로 붙인다
 *   ② 지식 자체가 살아 있는가 — 아래 서브쿼리
 *
 * 🔴 ②가 왜 필요한가: 삭제 규칙(§3)이 예약 행도 함께 tombstone 하므로 ①만으로 충분해야 **맞다.**
 *    그런데 그 규칙이 한 단계라도 빠지면 **지운 지식이 복습 큐에 되살아난다** —
 *    `REVIEW_SYSTEM.md` §8 이 버그 목록에 올려 둔 바로 그 증상이고,
 *    사용자에게는 빈 화면이 아니라 **틀린 화면**으로 나타난다. 그래서 겹쳐 막는다.
 */
export function dueQuery(endOfDayIso: string): Sql {
  return buildSelect('review_schedules', {
    columns: ['knowledge_id', 'due_at'],
    where: 'due_at < ? AND knowledge_id IN (SELECT id FROM knowledge WHERE deleted_at IS NULL)',
    params: [endOfDayIso],
    orderBy: 'due_at',
  });
}
