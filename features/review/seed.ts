/**
 * 개발용 시드 — 복습 규칙을 **기다리지 않고** 확인하기 위한 장치(`docs/PLAN.md` Phase 3 ★).
 *
 * 🔴 여기서 조작하는 것은 **시간뿐이다. 저장 행위는 조작하지 않는다.**
 *    시드 카드는 사용자가 기억한 적이 없어서 회상이 성립하지 않는다 —
 *    "AI 없이 쓸 만한가"의 판정 재료는 **사용자가 실제로 저장한 카드**이고 그건 시간이 흘러야 한다.
 *    이 파일이 만드는 것은 **기능 확인용 더미**이지 판정 재료가 아니다.
 *
 * 🚫 릴리스에 들어가지 않는다 — 호출부를 `__DEV__` 안에 둔다.
 */
import { deleteKnowledge, insert, selectAll } from '@/db';
import type { KnowledgeRow } from '@/features/types';

/** 시드가 만든 것을 나중에 알아보기 위한 표식. 사용자가 쓸 리 없는 문자열이다 */
const MARK = '[seed]';

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

/** 그 날의 다음 로컬 자정 — 큐 판정 기준(`queue.ts` 와 같은 규칙) */
function dueAtFor(savedAt: Date): string {
  return new Date(savedAt.getFullYear(), savedAt.getMonth(), savedAt.getDate() + 1, 0, 0, 0, 0).toISOString();
}

export interface SeedOptions {
  readonly count: number;
  /** 며칠 전에 저장한 것으로 칠 것인가(0 = 오늘 → 내일 뜬다) */
  readonly agedDays: number;
  /** 🔴 단서가 하나도 없는 카드로 만든다 — §3.1 화면 확인용 */
  readonly bare?: boolean;
}

/**
 * 밀린 카드를 만든다.
 *
 * ⚠ **`created_at` 은 과거로 밀지 않는다.** 규약 칸이라 헬퍼가 막고, 그 통로를 여는 것이
 *   `DATABASE.md` §1.1 이 닫아 둔 바로 그 구멍이다. 그래서 시드 카드의 "저장 시점" 표시는
 *   오늘로 보인다 — 큐 동작 확인에는 지장이 없고, 그게 보고 싶으면 실제 카드로 봐야 한다.
 */
export function seedDueCards(opts: SeedOptions): string[] {
  const savedAt = daysAgo(opts.agedDays);
  const ids: string[] = [];

  for (let i = 0; i < opts.count; i++) {
    const id = insert('knowledge', {
      book_id: null,
      content: opts.bare === true ? `${MARK} 짧다` : `${MARK} 규칙 확인용 더미 문장 ${i + 1} 번이다.`,
      page: null,
      source_type: 'manual',
      lang: null,
    });

    insert('review_schedules', {
      knowledge_id: id,
      due_at: dueAtFor(savedAt),
      state: 'new',
      stability: 0,
      difficulty: 0,
      reps: 0,
      lapses: 0,
      last_reviewed_at: null,
      learning_steps: 0,
    });

    // 단서가 있는 쪽은 생각을 붙인다(§3.1 1순위 단서)
    if (opts.bare !== true) insert('thoughts', { knowledge_id: id, body: `${MARK} 생각 ${i + 1}` });

    ids.push(id);
  }
  return ids;
}

/**
 * 시드가 남긴 카드를 전부 치운다. 🚫 물리 삭제는 이 앱에 없다 — tombstone 이다.
 *
 * 🔴 `knowledge` 만 지우면 **예약 행이 살아남아 큐에 계속 뜬다.** 그래서 삭제 규칙(§3)을 그대로 탄다 —
 *    지우는 방법이 두 개가 되는 순간 하나는 반드시 낡는다.
 */
export function clearSeed(): number {
  const rows = selectAll<KnowledgeRow>('knowledge', {
    where: 'content LIKE ?',
    params: [`${MARK}%`],
  });
  for (const r of rows) deleteKnowledge(r.id);
  return rows.length;
}
