/**
 * 실천 질의 — `docs/PRACTICE_SYSTEM.md` §2.1 · §5.
 *
 * 🔴 **오늘의 실천 질의가 넷을 함께 본다**: tombstone · `active` · 시작일 · 종료일.
 *    하나라도 빠지면 화면은 멀쩡한 채로 **틀린 목록**이 나온다.
 */
// 🔴 상대 경로다(가드가 이 파일을 직접 import 한다).
import type { Sql } from '../../db/sql.ts';

export interface PracticeRow {
  readonly id: string;
  readonly knowledge_id: string | null;
  readonly title: string;
  readonly started_at: string;
  readonly repeat_rule: string;
  readonly ended_at: string | null;
  readonly active: number;
  readonly created_at: string;
}

/**
 * 오늘 돌아가는 실천만. `today` 는 **로컬 날짜 키**(`YYYY-MM-DD`)다.
 *
 * ⚠ `started_at` · `ended_at` 도 로컬 날짜 키로 저장한다(시각이 아니다).
 *    시각으로 두면 `<=` 비교가 시:분에 걸려 "오늘 만든 실천이 오늘 안 보이는" 일이 난다.
 */
export function runningPracticesQuery(today: string): Sql {
  return {
    text: `SELECT id, knowledge_id, title, started_at, repeat_rule, ended_at, active, created_at
           FROM practices
           WHERE deleted_at IS NULL
             AND active = 1
             AND started_at <= ?
             AND (ended_at IS NULL OR ended_at >= ?)
           ORDER BY created_at ASC`,
    params: [today, today],
  };
}

/** 전부(종료·중단 포함). 목록 화면이 상태별로 접는다 */
export function allPracticesQuery(): Sql {
  return {
    text: `SELECT id, knowledge_id, title, started_at, repeat_rule, ended_at, active, created_at
           FROM practices
           WHERE deleted_at IS NULL
           ORDER BY created_at DESC`,
    params: [],
  };
}

/** 한 실천의 체크한 날들. 🔴 tombstone 된 로그는 안 센다(해제한 체크다) */
export function doneDaysQuery(practiceId: string): Sql {
  return {
    text: `SELECT date FROM practice_logs
           WHERE practice_id = ? AND deleted_at IS NULL
           ORDER BY date DESC`,
    params: [practiceId],
  };
}

/**
 * 실천 제안을 띄울 카드인가(§1.1).
 *
 * 🔴 **[넘어가기] 를 누른 카드는 다시 안 묻는다.** `practice_skipped_at IS NULL` 이 그 조건이다.
 * 🔴 이미 그 카드로 실천을 만들었으면 그것도 안 묻는다.
 */
export function shouldSuggestQuery(knowledgeId: string): Sql {
  return {
    text: `SELECT COUNT(*) AS n
           FROM knowledge k
           JOIN ai_analyses a
             ON a.knowledge_id = k.id AND a.deleted_at IS NULL AND a.actionability = 'high'
           WHERE k.id = ?
             AND k.deleted_at IS NULL
             AND k.practice_skipped_at IS NULL
             AND NOT EXISTS (
               SELECT 1 FROM practices p
               WHERE p.knowledge_id = k.id AND p.deleted_at IS NULL
             )`,
    params: [knowledgeId],
  };
}
