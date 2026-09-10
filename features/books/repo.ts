/**
 * 책 — `docs/KNOWLEDGE_SYSTEM.md` §4.
 *
 * 🔴 **책을 지워도 지식은 남는다**(§4.3). 그 규칙은 `db/cascade.ts` 에 있고 여기서는 부르기만 한다 —
 *    화면이 삭제 순서를 직접 조립하면 규칙이 두 곳에 살게 된다.
 */
import { count, deleteBook, getDb, insert, selectAll, selectOne, update } from '@/db';
import { pickCoverColor } from '@/features/books/cover';
import { listBooksQuery } from '@/features/books/sql';
import type { BookCounts, BookRow, BookStatus } from '@/features/types';

/**
 * 🔴 **최근에 쓴 책이 위로 온다**(§4.0). 지금 읽는 책이 저절로 맨 위에 오게 하는 것이 요점이다.
 *    정렬 규칙은 `sql.ts` 에 있고 가드가 실물 SQLite 로 잰다.
 */
export function listBooks(): BookRow[] {
  const sql = listBooksQuery();
  return getDb().getAllSync<BookRow>(sql.text, sql.params as never);
}

export function countBooks(): number {
  return count('books');
}

export function getBook(id: string): BookRow | undefined {
  return selectOne<BookRow>('books', { where: 'id = ?', params: [id] });
}

/** 제목만 있으면 성립한다. 저자·상태는 선택(상태 기본값 `wish`). */
export function createBook(input: {
  title: string;
  author?: string;
  status?: BookStatus;
  totalPages?: number | null;
  readPages?: number | null;
}): string {
  return insert('books', {
    title: input.title.trim(),
    author: input.author?.trim() ? input.author.trim() : null,
    status: input.status ?? 'wish',
    total_pages: input.totalPages ?? null,
    read_pages: input.readPages ?? null,
    // 🔴 등록할 때 한 번 배정한다 — 랜덤이면 열 때마다 바뀌어 기억이 안 생긴다
    cover_color: pickCoverColor(input.title),
  });
}

/** ⚠ 상태 전이를 자동화하지 않는다 — 사용자가 고른 것만 반영한다(§4.1). */
export function setBookStatus(id: string, status: BookStatus): void {
  update('books', { id }, { status });
}

export function renameBook(
  id: string,
  patch: {
    title?: string;
    author?: string | null;
    /** 🔴 `null` 은 "모른다"다. 값을 지우는 것도 정상 입력이다(§4.4) */
    totalPages?: number | null;
    readPages?: number | null;
  },
): void {
  const next: Record<string, unknown> = {};
  if (patch.title !== undefined) next.title = patch.title.trim();
  if (patch.author !== undefined) next.author = patch.author?.trim() ? patch.author.trim() : null;
  if (patch.totalPages !== undefined) next.total_pages = patch.totalPages;
  if (patch.readPages !== undefined) next.read_pages = patch.readPages;
  if (Object.keys(next).length === 0) return;
  update('books', { id }, next);
}

/** 🔴 지식은 `book_id` 만 끊긴다. 삭제 확인 문구에 아래 `knowledge` 수를 반드시 넣는다(§4.3). */
export function removeBook(id: string): void {
  deleteBook(id);
}

/** 🔴 파생 집계 — 저장하지 않고 매번 센다(§4.2). */
export function bookCounts(bookId: string): BookCounts {
  const ids = selectAll<{ id: string }>('knowledge', {
    columns: ['id'],
    where: 'book_id = ?',
    params: [bookId],
  }).map((r) => r.id);

  if (ids.length === 0) return { knowledge: 0, thoughts: 0, reviews: 0, practices: 0 };
  const holes = ids.map(() => '?').join(', ');

  return {
    knowledge: ids.length,
    thoughts: count('thoughts', { where: `knowledge_id IN (${holes})`, params: ids }),
    reviews: count('review_logs', { where: `knowledge_id IN (${holes})`, params: ids }),
    practices: count('practices', { where: `knowledge_id IN (${holes})`, params: ids }),
  };
}
