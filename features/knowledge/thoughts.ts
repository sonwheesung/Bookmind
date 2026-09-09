import { selectAll } from '@/db';
import type { ThoughtRow } from '@/features/types';

/**
 * 내 생각 조회 — `docs/KNOWLEDGE_SYSTEM.md` §2.
 *
 * 🔴 **이 파일이 따로 있는 이유는 순환 import 때문이다**(2026-09-09 실기기 실행에서 발견).
 * ```
 * knowledge/repo → review/repo (scheduleNewCard)
 * review/repo    → knowledge/repo (thoughtsOf)      ← 고리가 닫혔다
 * ```
 * Metro 가 매 번들마다 경고했다: *"Require cycles are allowed, but can result in uninitialized values."*
 * ⚠ 지금은 안 깨진다. 둘 다 **호출 시점에** 함수를 찾기 때문이다. 하지만 어느 한쪽이 모듈 최상위에서
 * 상대를 쓰는 순간 `undefined` 가 되고, 그 증상은 "가끔 빈 화면"처럼 나타난다.
 * 🚫 그래서 경고를 끄지 않고 **고리를 끊었다** — 양쪽이 이 파일을 본다.
 */
export function thoughtsOf(knowledgeId: string): ThoughtRow[] {
  return selectAll<ThoughtRow>('thoughts', {
    where: 'knowledge_id = ?',
    params: [knowledgeId],
    orderBy: 'created_at DESC',
  });
}
