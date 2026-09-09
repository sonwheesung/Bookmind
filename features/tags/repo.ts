/**
 * 태그 — `docs/KNOWLEDGE_SYSTEM.md` §5.
 *
 * 🚫 시드 태그를 넣지 않는다. 우리가 고른 분류가 사용자의 것을 밀어낸다.
 * 🔴 지운 태그와 **같은 이름을 다시 만들면 되살린다**(`DATABASE.md` §1.4) —
 *    새 행을 만들면 `name` UNIQUE(NOCASE)에 부딪혀 죽는다.
 */
import { insert, revive, selectAll, selectOne } from '@/db';
import type { TagRow } from '@/features/types';

export function listTags(): TagRow[] {
  return selectAll<TagRow>('tags', { orderBy: 'name' });
}

/** 이름으로 태그를 확보한다 — 있으면 그것, tombstone 이면 되살리고, 없으면 만든다. */
export function ensureTag(rawName: string): string | null {
  const name = rawName.trim();
  if (name === '') return null;

  const live = selectOne<TagRow>('tags', { where: 'name = ?', params: [name] });
  if (live !== undefined) return live.id;

  // 🔴 tombstone 까지 봐야 한다. 안 보면 UNIQUE 위반으로 죽는다(§1.4)
  const dead = selectOne<TagRow>('tags', {
    where: 'name = ?',
    params: [name],
    includeDeleted: true,
  });
  if (dead !== undefined) {
    revive('tags', { id: dead.id });
    return dead.id;
  }

  return insert('tags', { name });
}

/** 지식에 붙은 태그 — 연결 표를 지나 두 번 읽는다(조인 대신 `IN`, v1 규모에서 충분하다). */
export function tagsOf(knowledgeId: string): TagRow[] {
  const ids = selectAll<{ tag_id: string }>('knowledge_tags', {
    columns: ['tag_id'],
    where: 'knowledge_id = ?',
    params: [knowledgeId],
  }).map((r) => r.tag_id);
  if (ids.length === 0) return [];
  return selectAll<TagRow>('tags', {
    where: `id IN (${ids.map(() => '?').join(', ')})`,
    params: ids,
    orderBy: 'name',
  });
}
