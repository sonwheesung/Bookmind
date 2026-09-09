/**
 * 지식 카드 — `docs/KNOWLEDGE_SYSTEM.md` §1 · §3.
 *
 * 🔴 **필수는 `content` 하나다**(기둥 1). 책·페이지·생각·태그는 전부 선택이고,
 *    이 파일에 "책이 없으면 저장 거부" 같은 분기를 추가하자는 요구는 그 기둥으로 기각한다.
 */
import { count, deleteKnowledge, insert, revive, selectAll, selectOne, softDelete, update } from '@/db';
import { ensureTag } from '@/features/tags/repo';
import type { KnowledgeRow, SourceType, ThoughtRow } from '@/features/types';

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

  return id;
}

export function listKnowledge(limit?: number): KnowledgeRow[] {
  return selectAll<KnowledgeRow>('knowledge', {
    orderBy: 'created_at DESC',
    ...(limit === undefined ? {} : { limit }),
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

export function thoughtsOf(knowledgeId: string): ThoughtRow[] {
  return selectAll<ThoughtRow>('thoughts', {
    where: 'knowledge_id = ?',
    params: [knowledgeId],
    orderBy: 'created_at DESC',
  });
}

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
