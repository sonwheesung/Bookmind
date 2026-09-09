/**
 * 지식 카드 — `docs/KNOWLEDGE_SYSTEM.md` §1 · §3.
 *
 * 🔴 **필수는 `content` 하나다**(기둥 1). 책·페이지·생각·태그는 전부 선택이고,
 *    이 파일에 "책이 없으면 저장 거부" 같은 분기를 추가하자는 요구는 그 기둥으로 기각한다.
 */
import { count, deleteKnowledge, insert, revive, selectAll, selectOne, softDelete, update } from '@/db';
import { getBook } from '@/features/books/repo';
import { scheduleNewCard } from '@/features/review/repo';
import { ensureTag } from '@/features/tags/repo';
import type { KnowledgeRow, SourceType } from '@/features/types';

export interface SaveInput {
  content: string;
  bookId?: string | null;
  page?: string;
  thought?: string;
  tagNames?: readonly string[];
  sourceType?: SourceType;
}

/** 빠른 저장. 원문만 채워도 끝난다. 생각·태그가 같이 오면 한 번에 붙인다. */
export function saveKnowledge(input: SaveInput): string {
  const content = input.content.trim();
  if (content === '') throw new Error('원문이 비어 있다 — 저장 버튼이 열려 있었던 것이 버그다');

  const id = insert('knowledge', {
    book_id: input.bookId ?? null,
    content,
    page: input.page?.trim() ? input.page.trim() : null,
    source_type: input.sourceType ?? 'manual',
    lang: null,
  });

  const thought = input.thought?.trim();
  if (thought) addThought(id, thought);
  for (const name of input.tagNames ?? []) attachTag(id, name);

  // 🔴 예약을 **그 자리에서** 만든다(`REVIEW_SYSTEM.md` §2.3). 나중에 "예약 없는 카드"를 찾아
  //    채우는 배치를 두지 않는다 — 빠뜨리면 카드가 영원히 큐에 안 뜨는 형태로 조용히 실패한다.
  scheduleNewCard(id);

  return id;
}

export function listKnowledge(limit?: number): KnowledgeRow[] {
  return selectAll<KnowledgeRow>('knowledge', {
    orderBy: 'created_at DESC',
    ...(limit === undefined ? {} : { limit }),
  });
}

/** 홈의 최근 저장 한 줄에 붙는 출처. 🔴 없으면 **억지로 만들지 않는다**(`DESIGN_REVIEW.md` §3) */
export interface RecentCard extends KnowledgeRow {
  readonly bookTitle: string | null;
  readonly bookAuthor: string | null;
}

/**
 * 홈 전용 목록. 카드 테두리를 걷어낸 뒤로 문장들이 서로 붙어 보여서
 * **출처 한 줄이 구분자 겸 맥락** 역할을 한다(2026-09-09 홈 개편).
 *
 * ⚠ 책을 건당 한 번 더 읽는다. `limit` 이 3 이라 최대 3회이고, 그래서 조인을 만들지 않았다 —
 *    빌더에 JOIN 을 넣으면 `deleted_at` 필터를 빠뜨릴 통로가 하나 는다(`db/sql.ts` 의 존재 이유).
 */
export function listRecent(limit: number): RecentCard[] {
  return listKnowledge(limit).map((k) => {
    const book = k.book_id === null ? undefined : getBook(k.book_id);
    return { ...k, bookTitle: book?.title ?? null, bookAuthor: book?.author ?? null };
  });
}

export function listKnowledgeOfBook(bookId: string): KnowledgeRow[] {
  return selectAll<KnowledgeRow>('knowledge', {
    where: 'book_id = ?',
    params: [bookId],
    orderBy: 'created_at DESC',
  });
}

export function countKnowledge(): number {
  return count('knowledge');
}

export function getKnowledge(id: string): KnowledgeRow | undefined {
  return selectOne<KnowledgeRow>('knowledge', { where: 'id = ?', params: [id] });
}

export function editKnowledge(
  id: string,
  patch: { content?: string; page?: string | null; bookId?: string | null },
): void {
  const next: Record<string, unknown> = {};
  if (patch.content !== undefined) {
    const content = patch.content.trim();
    if (content === '') throw new Error('원문을 비울 수 없다');
    next.content = content;
  }
  if (patch.page !== undefined) next.page = patch.page?.trim() ? patch.page.trim() : null;
  if (patch.bookId !== undefined) next.book_id = patch.bookId;
  if (Object.keys(next).length === 0) return;
  update('knowledge', { id }, next);
}

/** 🔴 딸린 것의 처리는 `db/cascade.ts` 가 정한다(§3) — 실천은 남고, 복습 로그도 남는다. */
export function removeKnowledge(id: string): void {
  deleteKnowledge(id);
}

// ── 내 생각 (1:N) ────────────────────────────────────────────────────
// 🔴 여러 개 쌓이는 것이 제품 컨셉이다(기획서 §3). 덮어쓰지 않는다.

// 🔴 정의는 `features/knowledge/thoughts.ts` 로 옮겼다(순환 import 를 끊으려고). 여기서는 다시 내보내기만 한다
export { thoughtsOf } from '@/features/knowledge/thoughts';

export function addThought(knowledgeId: string, body: string): string | null {
  const text = body.trim();
  if (text === '') return null;
  return insert('thoughts', { knowledge_id: knowledgeId, body: text });
}

export function editThought(id: string, body: string): void {
  const text = body.trim();
  if (text === '') return;
  update('thoughts', { id }, { body: text });
}

export function removeThought(id: string): void {
  softDelete('thoughts', { id });
}

// ── 태그 연결 ────────────────────────────────────────────────────────

/** 이름으로 붙인다. 끊었던 연결이면 되살린다(§1.4 — 복합 PK 라 새 행을 만들 수 없다). */
export function attachTag(knowledgeId: string, rawName: string): void {
  const tagId = ensureTag(rawName);
  if (tagId === null) return;

  const key = { knowledge_id: knowledgeId, tag_id: tagId };
  const live = selectOne<{ tag_id: string }>('knowledge_tags', {
    columns: ['tag_id'],
    where: 'knowledge_id = ? AND tag_id = ?',
    params: [knowledgeId, tagId],
  });
  if (live !== undefined) return;

  const dead = selectOne<{ tag_id: string }>('knowledge_tags', {
    columns: ['tag_id'],
    where: 'knowledge_id = ? AND tag_id = ?',
    params: [knowledgeId, tagId],
    includeDeleted: true,
  });
  if (dead !== undefined) {
    revive('knowledge_tags', key);
    return;
  }
  insert('knowledge_tags', key);
}

/**
 * 연결만 끊는다. ⚠ 고아 태그 정리는 **지식 삭제 때** 도는 규칙이고(§3),
 * 태그 하나를 떼는 것만으로 태그를 지우지는 않는다 — 사용자가 다시 붙일 수 있어야 한다.
 */
export function detachTag(knowledgeId: string, tagId: string): void {
  softDelete('knowledge_tags', { knowledge_id: knowledgeId, tag_id: tagId });
}
