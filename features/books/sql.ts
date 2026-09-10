/**
 * 책 질의 — `docs/KNOWLEDGE_SYSTEM.md` §4.0.
 *
 * 🔴 **정렬이 여기 있는 이유**: 틀려도 화면은 멀쩡하다. 책이 세 권일 때는 어느 순서든 그럴듯해서
 *    아무도 못 본다. 스무 권이 되고 나서야 "왜 지금 읽는 책이 아래에 있지"가 된다.
 *
 * 🔴 순수하다. 가드가 node 에서 실물 SQLite 로 그대로 돌린다.
 */
// 🔴 상대 경로다(가드가 이 파일을 직접 import 한다).
import type { Sql } from '../../db/sql.ts';

/**
 * 최근에 쓴 책이 위로(§4.0).
 *
 * ```
 * 정렬 키 = 그 책에 마지막으로 문장을 저장한 시각, 없으면 책을 등록한 시각
 * ```
 *
 * 🔴 **지운 문장은 안 센다.** 지운 것 때문에 책이 위로 올라오면 그건 틀린 화면이다.
 * 🔴 **파생값이라 저장하지 않는다**(`DATABASE.md` §4). 매번 잰다.
 * ⚠ 제목을 두 번째 키로 둔다. 시각이 같으면(같은 초에 만든 책 둘) 순서가 흔들리면 안 된다.
 */
export function listBooksQuery(): Sql {
  return {
    text: `SELECT b.*,
             COALESCE(
               (SELECT MAX(k.created_at) FROM knowledge k
                 WHERE k.book_id = b.id AND k.deleted_at IS NULL),
               b.created_at
             ) AS last_used_at
           FROM books b
           WHERE b.deleted_at IS NULL
           ORDER BY last_used_at DESC, b.title ASC`,
    params: [],
  };
}
