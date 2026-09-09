/**
 * FSRS 스케줄러 — `docs/REVIEW_SYSTEM.md` §2 (결정 #5).
 *
 * 🔴 기획서 §15 의 `1/3/7/14/30/90` 은 **사용자 설명용 근사**다. 실제 간격은 여기서 나온다 —
 *    문서·화면에 고정 간격표를 스펙처럼 쓰지 않는다.
 *
 * 🔴 순수하다. `ts-fsrs` 는 순수 JS 라 node 가드가 그대로 돌린다 —
 *    "again 이 가장 짧다"(Phase 3 완료 기준)를 기기 없이 잰다.
 *
 * ⚠ `@/` 별칭을 쓰지 않는다(가드가 이 파일을 직접 import 한다).
 */
// `Grade` = Rating 중 사용자가 고를 수 있는 넷(Manual 제외). 🔴 우리 등급 넷과 정확히 대응한다
import { createEmptyCard, fsrs, Rating, State, type Card, type Grade } from 'ts-fsrs';

export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';
export const RATINGS: readonly ReviewRating[] = ['again', 'hard', 'good', 'easy'];

export type ReviewState = 'new' | 'learning' | 'review' | 'relearning';

/** `review_schedules` 한 행(`docs/DATABASE.md` §2) */
export interface ScheduleRow {
  readonly knowledge_id: string;
  readonly due_at: string;
  readonly state: ReviewState;
  readonly stability: number;
  readonly difficulty: number;
  readonly reps: number;
  readonly lapses: number;
  readonly last_reviewed_at: string | null;
}

export interface RatingResult {
  /** `review_schedules` 에 덮어쓸 값 */
  readonly schedule: Omit<ScheduleRow, 'knowledge_id'>;
  /** `review_logs` 에 남길 값. 🔴 optimizer(v1.2)의 유일한 입력이다 */
  readonly log: {
    readonly rating: ReviewRating;
    readonly elapsed_days: number;
    readonly scheduled_days: number;
    readonly reviewed_at: string;
  };
}

const scheduler = fsrs();

const TO_STATE: Record<ReviewState, State> = {
  new: State.New,
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning,
};
const FROM_STATE: Record<number, ReviewState> = {
  [State.New]: 'new',
  [State.Learning]: 'learning',
  [State.Review]: 'review',
  [State.Relearning]: 'relearning',
};
const TO_RATING: Record<ReviewRating, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

function toCard(row: ScheduleRow): Card {
  const empty = createEmptyCard(new Date(row.due_at));
  return {
    ...empty,
    due: new Date(row.due_at),
    stability: row.stability,
    difficulty: row.difficulty,
    reps: row.reps,
    lapses: row.lapses,
    state: TO_STATE[row.state],
    ...(row.last_reviewed_at === null ? {} : { last_review: new Date(row.last_reviewed_at) }),
  };
}

/** 새 카드의 초기 상태. 🔴 첫 노출 시점은 `queue.ts` 가 정한다(저장 다음 날) */
export function newSchedule(knowledgeId: string, dueAt: string): ScheduleRow {
  const empty = createEmptyCard();
  return {
    knowledge_id: knowledgeId,
    due_at: dueAt,
    state: 'new',
    stability: empty.stability,
    difficulty: empty.difficulty,
    reps: 0,
    lapses: 0,
    last_reviewed_at: null,
  };
}

/**
 * 사용자가 고른 등급을 적용한다.
 *
 * 🚫 채점이 아니다 — 등급은 사용자가 **스스로** 고른 것이고(기둥 5), 여기서는 그저
 *    다음 노출 시점을 계산하는 입력값이다.
 */
export function applyRating(row: ScheduleRow, rating: ReviewRating, now: Date): RatingResult {
  const { card, log } = scheduler.next(toCard(row), now, TO_RATING[rating]);
  const state = FROM_STATE[card.state];
  if (state === undefined) throw new Error(`알 수 없는 FSRS 상태: ${String(card.state)}`);

  return {
    schedule: {
      due_at: card.due.toISOString(),
      state,
      stability: card.stability,
      difficulty: card.difficulty,
      reps: card.reps,
      lapses: card.lapses,
      last_reviewed_at: now.toISOString(),
    },
    log: {
      rating,
      elapsed_days: log.elapsed_days,
      scheduled_days: log.scheduled_days,
      reviewed_at: now.toISOString(),
    },
  };
}

/** 등급별 다음 간격(일). 🚫 화면에 내부값을 보여주지 않는다 — 가드·개발용이다(§5 규칙 8) */
export function intervalDays(row: ScheduleRow, rating: ReviewRating, now: Date): number {
  const next = applyRating(row, rating, now);
  return (new Date(next.schedule.due_at).getTime() - now.getTime()) / 86_400_000;
}
