/**
 * 삭제 규칙 — `docs/DATABASE.md` §3 의 표를 코드로 옮긴 곳. **여기 말고 다른 데서 지우지 않는다.**
 *
 * 🔴 순수하다 — 실행하지 않고 **단계 목록만** 만든다. 그래서 가드가 node 에서 전부 돌려
 *    "지웠는데 조회에 남아 있나"를 실제로 잰다(`docs/PLAN.md` Phase 1 완료 기준).
 *
 * 🔴 규칙 셋이 여기 걸려 있다:
 *    ① 책을 지워도 지식은 남는다 — `book_id` 만 끊는다
 *    ② 지식을 지워도 `review_logs` 는 남고, `practices` 는 연결만 끊긴다
 *    ③ 물리 삭제는 한 줄도 없다 — 전부 tombstone
 */
import { buildSoftDelete, buildSoftDeleteWhere, buildUpdateWhere, type Sql } from './sql.ts';

/**
 * 지식 삭제 — 딸린 것은 tombstone, `review_logs` 는 보존, `practices` 는 연결 해제.
 * 마지막에 이 지식이 달고 있던 **고아 태그**를 정리한다(`docs/KNOWLEDGE_SYSTEM.md` §7).
 */
export function deleteKnowledgeSteps(knowledgeId: string, now: string): readonly Sql[] {
  const byKnowledge = (table: 'thoughts' | 'ai_analyses' | 'recall_questions' | 'knowledge_tags') =>
    buildSoftDeleteWhere(table, 'knowledge_id = ?', [knowledgeId], now);

  return [
    buildSoftDelete('knowledge', { id: knowledgeId }, now),
    byKnowledge('thoughts'),
    byKnowledge('ai_analyses'),
    byKnowledge('recall_questions'),
    byKnowledge('knowledge_tags'),
    buildSoftDelete('review_schedules', { knowledge_id: knowledgeId }, now),
    // 🔴 실천은 지우지 않는다 — 연결만 끊는다(기둥 4). 고아가 되지 않게 NULL 로 둔다
    buildUpdateWhere('practices', 'knowledge_id = ?', [knowledgeId], { knowledge_id: null }, now),
    // 🚫 review_logs 에 대한 단계가 없는 것이 규칙이다(§2 물리 보존 · FSRS optimizer 의 유일한 입력)
    orphanTagCleanup(knowledgeId, now),
  ];
}

/**
 * 고아 태그 정리 — 이 지식이 달고 있던 태그 중 **살아 있는 연결이 0개**가 된 것만 tombstone.
 * ⚠ 전역 청소가 아니다. 아직 아무 지식에도 안 붙인 새 태그를 쓸어가면 안 된다.
 * 빌더로 표현할 수 없는 `NOT EXISTS` 라서 이 한 곳에만 손으로 쓴다.
 */
function orphanTagCleanup(knowledgeId: string, now: string): Sql {
  return {
    text: `UPDATE tags SET deleted_at = ?, updated_at = ?
            WHERE deleted_at IS NULL
              AND id IN (SELECT tag_id FROM knowledge_tags WHERE knowledge_id = ?)
              AND NOT EXISTS (
                SELECT 1 FROM knowledge_tags kt
                 WHERE kt.tag_id = tags.id AND kt.deleted_at IS NULL
              )`,
    params: [now, now, knowledgeId],
  };
}

/**
 * 책 삭제 — 🔴 **지식을 지우지 않는다.** `book_id` 만 NULL 로 끊는다(§3).
 * 지식은 책보다 오래 남는 것이 이 제품의 전제다.
 */
export function deleteBookSteps(bookId: string, now: string): readonly Sql[] {
  return [
    buildUpdateWhere('knowledge', 'book_id = ?', [bookId], { book_id: null }, now),
    buildSoftDelete('books', { id: bookId }, now),
  ];
}

/** 실천 삭제 — 체크 기록은 tombstone, 지식은 그대로(§3). */
export function deletePracticeSteps(practiceId: string, now: string): readonly Sql[] {
  return [
    buildSoftDelete('practices', { id: practiceId }, now),
    buildSoftDeleteWhere('practice_logs', 'practice_id = ?', [practiceId], now),
  ];
}
