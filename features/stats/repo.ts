/**
 * 통계 조회 — `docs/STATS_SYSTEM.md`.
 *
 * 이 파일은 **얇다.** 판정이 되는 것(기억률의 분모 0 · 연속일의 "오늘" 경계)은
 * `compute.ts` 에 있고 가드가 그것을 전수로 잰다.
 */
import { count, getDb } from '@/db';

import type { DayKey } from '@/lib/day';

import { countByDay, mergeCounts, type ReviewMark } from './charts';
import { localDayKey, retentionRate, streakDays, type Totals } from './compute';
import {
  activityTimesQuery,
  bookDistributionQuery,
  dueTimesQuery,
  reviewMarksQuery,
  reviewTallyQuery,
  saveTimesQuery,
  tagDistributionQuery,
} from './sql';

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

// ── 차트 (§4.2) ──────────────────────────────────────────────────────

export interface ChartSource {
  readonly saveDays: ReadonlyMap<DayKey, number>;
  readonly reviewDays: ReadonlyMap<DayKey, number>;
  /** 저장 + 복습. 🔴 연속일과 같은 활동 정의다(§3.3) */
  readonly activityDays: ReadonlyMap<DayKey, number>;
  readonly marks: readonly ReviewMark[];
  readonly dueDays: readonly DayKey[];
  /** 첫 활동 날. 없으면 `null` */
  readonly firstDay: DayKey | null;
}

/** 차트 재료를 한 번에 읽는다. 🔴 계산은 `charts.ts` 가 하고 여기서는 날짜로 접기만 한다 */
export function loadChartSource(): ChartSource {
  const db = getDb();
  const saves = saveTimesQuery();
  const reviews = reviewMarksQuery();
  const due = dueTimesQuery();

  const saveRows = db.getAllSync<{ at: string }>(saves.text, saves.params as never);
  const reviewRows = db.getAllSync<{ at: string; rating: string }>(reviews.text, reviews.params as never);
  const dueRows = db.getAllSync<{ at: string }>(due.text, due.params as never);

  const saveDays = countByDay(saveRows.map((r) => r.at));
  const reviewDays = countByDay(reviewRows.map((r) => r.at));
  const activityDays = mergeCounts(saveDays, reviewDays);

  return {
    saveDays,
    reviewDays,
    activityDays,
    marks: reviewRows.map((r) => ({ day: localDayKey(r.at), again: r.rating === 'again' })),
    dueDays: dueRows.map((r) => localDayKey(r.at)),
    firstDay: [...activityDays.keys()].sort()[0] ?? null,
  };
}

export interface BookSlice {
  readonly id: string;
  readonly name: string;
  readonly n: number;
}

/** 책별. 🔴 하나도 없으면 빈 배열이고 화면은 그 절을 안 그린다 */
export function loadBookDistribution(limit = 5): BookSlice[] {
  const sql = bookDistributionQuery(limit);
  return getDb().getAllSync<BookSlice>(sql.text, sql.params as never);
}
