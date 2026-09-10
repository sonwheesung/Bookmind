/**
 * 검색 — `docs/KNOWLEDGE_SYSTEM.md` §6.
 *
 * 이 파일은 **얇다.** 판정이 되는 것(이스케이프·네 축·tombstone)은 전부 `sql.ts` 에 있고
 * 가드가 그것을 실물 SQLite 로 잰다.
 */
import { getDb } from '@/db';

import { searchQuery, type SearchRow } from './sql';

export type { SearchRow };

/** 어느 축에서 맞았나. 화면이 그대로 라벨로 쓴다(§6.1) */
export type MatchAxis = 'content' | 'thought' | 'tag' | 'book';

export interface SearchHit {
  readonly id: string;
  readonly content: string;
  readonly createdAt: string;
  readonly bookTitle: string | null;
  readonly axes: readonly MatchAxis[];
}

/** 빈 검색어면 **빈 배열**이다. 전체를 뿌리지 않는다(§6.4) */
export function searchKnowledge(term: string): SearchHit[] {
  const sql = searchQuery(term);
  if (sql === null) return [];

  const rows = getDb().getAllSync<SearchRow>(sql.text, sql.params as never);
  return rows.map((r) => {
    const axes: MatchAxis[] = [];
    // 🔴 순서가 곧 화면 순서다. 원문이 먼저이고 그 다음이 사용자의 생각이다(기둥 6)
    if (r.m_content) axes.push('content');
    if (r.m_thought) axes.push('thought');
    if (r.m_tag) axes.push('tag');
    if (r.m_book) axes.push('book');
    return {
      id: r.id,
      content: r.content,
      createdAt: r.created_at,
      bookTitle: r.book_title,
      axes,
    };
  });
}
