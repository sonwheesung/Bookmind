/**
 * 검색 질의 — `docs/KNOWLEDGE_SYSTEM.md` §6.
 *
 * 🔴 **순수 모듈로 뺀 이유는 와일드카드다.** 사용자가 `100%` 를 치면 `%` 가 LIKE 의
 *    "아무 문자열"이 되어 **전부 걸린다.** 오류가 안 나고 결과만 조용히 틀린다.
 *    책 문장에 `%` 는 실제로 나온다(통계·경제서). 그래서 가드가 실물 SQLite 로 매번 잰다.
 */
// 🔴 상대 경로다. `@/` 별칭은 Metro·tsc 만 알고 node 는 모른다(가드가 이 파일을 직접 import 한다).
import type { Sql } from '../../db/sql.ts';

/** LIKE 이스케이프 문자. `\` 를 쓰고 질의마다 `ESCAPE '\'` 를 붙인다 */
const ESC = '\\';

/**
 * `%` · `_` · `\` 를 무력화한다.
 *
 * 🔴 **`\` 를 먼저 바꾼다.** `%` 를 먼저 바꾸면 그때 넣은 `\` 를 다음 치환이 또 이스케이프해서
 *    `\\%` 가 되고, 그러면 "역슬래시 다음 아무 문자열"이라는 **다른 뜻**이 된다.
 */
export function escapeLike(term: string): string {
  return term
    .replaceAll(ESC, ESC + ESC)
    .replaceAll('%', `${ESC}%`)
    .replaceAll('_', `${ESC}_`);
}

/** 검색어를 `%…%` 패턴으로. 빈 검색어면 null 이다. 전체를 뿌리지 않는다(§6.4) */
export function likePattern(raw: string): string | null {
  const term = raw.trim();
  if (term === '') return null;
  return `%${escapeLike(term)}%`;
}

export interface SearchRow {
  readonly id: string;
  readonly content: string;
  readonly created_at: string;
  readonly book_title: string | null;
  /** 어느 축에서 맞았나. 🔴 안 보여주면 사용자가 "왜 이게 나왔지"를 해석하게 된다(§6.1) */
  readonly m_content: number;
  readonly m_book: number;
  readonly m_thought: number;
  readonly m_tag: number;
}

/**
 * 네 축 중 하나라도 맞는 지식 카드.
 *
 * 🔴 **태그·생각은 조인이 아니라 `EXISTS` 다.** 조인하면 카드가 태그 수만큼 중복되고
 *    `DISTINCT` 로 접어야 하는데, 그러면 "어느 축에서 맞았나"를 같이 못 고른다.
 *    `EXISTS` 는 중복을 애초에 안 만든다(§6.3).
 *
 * 🔴 **네 축 전부 `deleted_at IS NULL`** 이다. 지운 생각으로 지운 카드가 되살아나면 안 된다.
 */
export function searchQuery(raw: string): Sql | null {
  const pattern = likePattern(raw);
  if (pattern === null) return null;

  const thoughtHit = `EXISTS (SELECT 1 FROM thoughts t WHERE t.knowledge_id = k.id
      AND t.deleted_at IS NULL AND t.body LIKE ? ESCAPE '${ESC}')`;
  const tagHit = `EXISTS (SELECT 1 FROM knowledge_tags kt JOIN tags g ON g.id = kt.tag_id
      WHERE kt.knowledge_id = k.id AND kt.deleted_at IS NULL AND g.deleted_at IS NULL
      AND g.name LIKE ? ESCAPE '${ESC}')`;
  const contentHit = `k.content LIKE ? ESCAPE '${ESC}'`;
  const bookHit = `COALESCE(b.title, '') LIKE ? ESCAPE '${ESC}'`;

  const text = `SELECT k.id, k.content, k.created_at, b.title AS book_title,
      (${contentHit}) AS m_content,
      (${bookHit}) AS m_book,
      (${thoughtHit}) AS m_thought,
      (${tagHit}) AS m_tag
    FROM knowledge k
    LEFT JOIN books b ON b.id = k.book_id AND b.deleted_at IS NULL
    WHERE k.deleted_at IS NULL
      AND ((${contentHit}) OR (${bookHit}) OR (${thoughtHit}) OR (${tagHit}))
    ORDER BY k.created_at DESC`;

  // 🔴 같은 패턴이 여덟 번 쓰인다(플래그 넷 + WHERE 넷). 순서가 곧 `?` 순서다.
  //    이름 있는 파라미터를 쓰면 줄겠지만, 빌더가 위치 파라미터로 통일돼 있어 여기만 다르게 하지 않는다.
  return { text, params: Array.from({ length: 8 }, () => pattern) };
}
