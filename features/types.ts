/**
 * DB 행 타입 — `docs/DATABASE.md` §2 와 1:1.
 * 🔴 컬럼을 여기 늘리기 전에 문서와 `db/schema.ts` 를 먼저 고친다(문서 → 코드 순서).
 */

export type BookStatus = 'wish' | 'reading' | 'done';
export const BOOK_STATUSES: readonly BookStatus[] = ['wish', 'reading', 'done'];

export type SourceType = 'manual' | 'ocr' | 'paste';

export interface BookRow {
  id: string;
  title: string;
  author: string | null;
  cover_uri: string | null;
  status: BookStatus;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeRow {
  id: string;
  book_id: string | null;
  content: string;
  page: string | null;
  source_type: SourceType;
  lang: string | null;
  created_at: string;
  updated_at: string;
}

export interface ThoughtRow {
  id: string;
  knowledge_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface TagRow {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

/** 책 상세의 파생 집계 — 🔴 저장하지 않는다(`KNOWLEDGE_SYSTEM.md` §4.2) */
export interface BookCounts {
  knowledge: number;
  thoughts: number;
  reviews: number;
  practices: number;
}
