/**
 * 통계 조회 — `docs/STATS_SYSTEM.md`.
 *
 * 이 파일은 **얇다.** 판정이 되는 것(기억률의 분모 0 · 연속일의 "오늘" 경계)은
 * `compute.ts` 에 있고 가드가 그것을 전수로 잰다.
 */
import { count, getDb } from '@/db';

import { localDayKey, retentionRate, streakDays, type Totals } from './compute';
import { activityTimesQuery, reviewTallyQuery, tagDistributionQuery } from './sql';

export type { Totals };

export interface TagSlice {
  readonly name: string;
  readonly n: number;
}

/** 🔴 전부 매번 센다. 캐시하지 않는다(`DATABASE.md` §4) */
export function loadStats(now: Date = new Date()): Totals {
  const db = getDb();

  const tally = reviewTallyQuery();
  const row = db.getFirstSync<{ total: number; again: number | null }>(tally.text, tally.params as never);
  const total = row?.total ?? 0;
  const again = row?.again ?? 0;

  const times = activityTimesQuery();
  const rows = db.getAllSync<{ at: string }>(times.text, times.params as never);
  // 🔴 로컬 날짜로 접는 것은 여기서 한다. SQLite 의 date() 는 UTC 라 경계가 어긋난다(sql.ts 주석)
  const days = new Set(rows.map((r) => localDayKey(r.at)));

  return {
    knowledge: count('knowledge'),
    books: count('books'),
    thoughts: count('thoughts'),
    reviews: total,
    retention: retentionRate(total, again),
    streak: streakDays(days, localDayKey(now.toISOString())),
  };
}

/** 분야별. 🔴 하나도 없으면 빈 배열이고, 화면은 그때 그 절을 **아예 안 그린다**(§6) */
export function loadTagDistribution(limit = 12): TagSlice[] {
  const sql = tagDistributionQuery(limit);
  return getDb().getAllSync<TagSlice>(sql.text, sql.params as never);
}
