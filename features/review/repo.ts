/**
 * 복습 — `docs/REVIEW_SYSTEM.md` §1 · §2 · §5.
 *
 * 🔴 규칙은 전부 순수 모듈에 있다(`schedule.ts` · `queue.ts` · `cue.ts` · `sql.ts`).
 *    여기는 그것들을 DB 에 물리는 층이다 — 규칙을 여기서 다시 쓰지 않는다.
 */
import { getDb, insert, nowIso, selectAll, selectOne, update } from '@/db';
import { getBook } from '@/features/books/repo';
import { thoughtsOf } from '@/features/knowledge/repo';
import { tagsOf } from '@/features/tags/repo';
import type { KnowledgeRow } from '@/features/types';
import { pickCue, type Cue } from '@/features/review/cue';
import { DAILY_LIMIT, endOfLocalDay, firstDueAt, takeDue } from '@/features/review/queue';
import { applyRating, newSchedule, type ReviewRating, type ScheduleRow } from '@/features/review/schedule';
import { dueQuery } from '@/features/review/sql';

/** 저장 직후 호출한다 — 🔴 예약을 그 자리에서 만든다(§2.3). 나중에 채우는 배치를 두지 않는다 */
export function scheduleNewCard(knowledgeId: string, savedAt: Date = new Date()): void {
  const row = newSchedule(knowledgeId, firstDueAt(savedAt));
  insert('review_schedules', {
    knowledge_id: row.knowledge_id,
    due_at: row.due_at,
    state: row.state,
    stability: row.stability,
    difficulty: row.difficulty,
    reps: row.reps,
    lapses: row.lapses,
    last_reviewed_at: row.last_reviewed_at,
  });
}

/** 오늘 뜰 카드 수. 홈이 쓴다 — 🔴 개수만 보여주고 "밀렸다"고 말하지 않는다(§2.2) */
export function dueCount(now: Date = new Date()): number {
  const sql = dueQuery(endOfLocalDay(now));
  return takeDue(getDb().getAllSync<{ knowledge_id: string; due_at: string }>(sql.text, sql.params as never))
    .length;
}

export interface ReviewCard {
  readonly knowledge: KnowledgeRow;
  readonly cue: Cue;
  readonly bookTitle: string | null;
  readonly savedAt: string;
}

/** 오늘의 복습 목록. 오래된 순, 하루 상한까지(§2.2) */
export function todayQueue(now: Date = new Date()): ReviewCard[] {
  const sql = dueQuery(endOfLocalDay(now));
  const due = takeDue(
    getDb().getAllSync<{ knowledge_id: string; due_at: string }>(sql.text, sql.params as never),
    DAILY_LIMIT,
  );

  const cards: ReviewCard[] = [];
  for (const d of due) {
    const k = selectOne<KnowledgeRow>('knowledge', { where: 'id = ?', params: [d.knowledge_id] });
    if (k === undefined) continue; // 두 겹 방어(§sql.ts)를 지나온 뒤라 원래 없어야 한다
    const bookTitle = k.book_id === null ? null : (getBook(k.book_id)?.title ?? null);
    cards.push({
      knowledge: k,
      bookTitle,
      savedAt: k.created_at,
      cue: pickCue({
        content: k.content,
        thought: thoughtsOf(k.id)[0]?.body ?? null,
        bookTitle,
        page: k.page,
        tags: tagsOf(k.id).map((t) => t.name),
      }),
    });
  }
  return cards;
}

/**
 * 사용자가 고른 등급을 반영한다.
 *
 * 🔴 두 가지를 한 번에 한다: 다음 노출 시점 갱신 + **기록 남기기**.
 *    기록은 지우지 않는다 — 지식을 지워도 남는다(`DATABASE.md` §2).
 */
export function rate(knowledgeId: string, rating: ReviewRating, answer?: string): void {
  const row = selectOne<ScheduleRow>('review_schedules', {
    where: 'knowledge_id = ?',
    params: [knowledgeId],
  });
  if (row === undefined) return;

  const now = new Date();
  const { schedule, log } = applyRating(row, rating, now);

  update('review_schedules', { knowledge_id: knowledgeId }, { ...schedule });
  insert('review_logs', {
    knowledge_id: knowledgeId,
    question_id: null,
    rating: log.rating,
    answer_text: answer?.trim() ? answer.trim() : null,
    elapsed_days: Math.round(log.elapsed_days),
    scheduled_days: Math.round(log.scheduled_days),
    reviewed_at: log.reviewed_at,
  });
}

/** 통계용 — 🔴 파생값이라 저장하지 않는다(§7). 기억률 = again 이 아닌 비율 */
export function recallRate(): number | null {
  const logs = selectAll<{ rating: ReviewRating }>('review_logs', { columns: ['rating'] });
  if (logs.length === 0) return null;
  return logs.filter((l) => l.rating !== 'again').length / logs.length;
}

export { nowIso };
