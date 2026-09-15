/**
 * 통계 질의 — `docs/STATS_SYSTEM.md` §3.
 *
 * 🔴 **파생값은 저장하지 않고 매번 센다**(`DATABASE.md` §4). 캐시 표를 만들지 않는다.
 *    만드는 순간 "무엇이 진실인가"가 둘이 된다.
 */
// 🔴 상대 경로다(가드가 이 파일을 직접 import 한다).
import type { Sql } from '../../db/sql.ts';

/** 복습 횟수와 `again` 수를 한 번에. 🔴 `review_logs` 는 물리 보존이라 tombstone 이 없다 */
export function reviewTallyQuery(): Sql {
  return {
    text: `SELECT COUNT(*) AS total,
             SUM(CASE WHEN rating = 'again' THEN 1 ELSE 0 END) AS again
           FROM review_logs`,
    params: [],
  };
}

/**
 * 연속일의 재료. **활동이 있었던 시각**만 모으고 로컬 날짜로 접는 것은 순수 모듈이 한다.
 *
 * 🔴 날짜 접기를 SQL 로 하지 않는 이유: SQLite 의 `date()` 는 **UTC 기준**이라
 *    로컬 자정 경계(§3.3)와 어긋난다. 시각을 그대로 받아 `localDayKey` 로 접는다.
 */
export function activityTimesQuery(): Sql {
  return {
    text: `SELECT reviewed_at AS at FROM review_logs
           UNION ALL
           SELECT created_at AS at FROM knowledge WHERE deleted_at IS NULL`,
    params: [],
  };
}

/** 태그별 지식 수. 🔴 연결·태그·지식이 **셋 다 살아 있는 것만** 센다(§3.4) */
export function tagDistributionQuery(limit = 12): Sql {
  return {
    text: `SELECT g.name AS name, COUNT(*) AS n
           FROM knowledge_tags kt
           JOIN tags g ON g.id = kt.tag_id AND g.deleted_at IS NULL
           JOIN knowledge k ON k.id = kt.knowledge_id AND k.deleted_at IS NULL
           WHERE kt.deleted_at IS NULL
           GROUP BY g.id
           ORDER BY n DESC, g.name ASC
           LIMIT ?`,
    params: [limit],
  };
}

// ── 차트 재료 (§4.2) ─────────────────────────────────────────────────
// 🔴 전부 **시각을 그대로** 받는다. 로컬 날짜로 접는 것은 `charts.ts` 가 한다(UTC date() 금지)

/** 저장 시각. 🔴 지운 문장의 저장은 활동이 아니다(§3.1 · `activityTimesQuery` 와 같은 규칙) */
export function saveTimesQuery(): Sql {
  return {
    text: `SELECT created_at AS at FROM knowledge WHERE deleted_at IS NULL`,
    params: [],
  };
}

/** 복습 시각과 등급. 🔴 `review_logs` 는 물리 보존이라 지운 문장의 복습도 남는다(§3.2) */
export function reviewMarksQuery(): Sql {
  return {
    text: `SELECT reviewed_at AS at, rating FROM review_logs`,
    params: [],
  };
}

/** 다음 복습 시각. 🔴 오늘의 복습 질의(`review/sql.ts` dueQuery)와 같이 **지운 문장은 뺀다** */
export function dueTimesQuery(): Sql {
  return {
    text: `SELECT due_at AS at FROM review_schedules
           WHERE deleted_at IS NULL
             AND knowledge_id IN (SELECT id FROM knowledge WHERE deleted_at IS NULL)`,
    params: [],
  };
}

/** 책별 문장 수. 🔴 책과 문장이 **둘 다 살아 있는 것만** 센다. 문장 0 인 책은 안 나온다 */
export function bookDistributionQuery(limit = 5): Sql {
  return {
    text: `SELECT b.id AS id, b.title AS name, COUNT(*) AS n
           FROM knowledge k
           JOIN books b ON b.id = k.book_id AND b.deleted_at IS NULL
           WHERE k.deleted_at IS NULL
           GROUP BY b.id
           ORDER BY n DESC, b.title ASC
           LIMIT ?`,
    params: [limit],
  };
}
