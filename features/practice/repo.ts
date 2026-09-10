/**
 * 실천 조회·저장 — `docs/PRACTICE_SYSTEM.md`.
 *
 * 이 파일은 **얇다.** 판정이 되는 것(반복 규칙 · 연속일 · 오늘 보여줄까)은 `compute.ts` 와
 * `sql.ts` 에 있고, 가드가 그것을 실물 SQLite 로 잰다.
 */
import {
  deletePractice as cascadeDelete,
  getDb,
  insert,
  reviveWhere,
  selectOne,
  softDelete,
  update,
} from '@/db';
import { fromDate, type DayKey } from '@/lib/day';

import {
  canCheck,
  isRunning,
  practiceState,
  practiceStreak,
  weekCells,
  type PracticeState,
  type PracticeWindow,
  type WeekCell,
} from './compute';
import {
  allPracticesQuery,
  doneDaysQuery,
  runningPracticesQuery,
  shouldSuggestQuery,
  type PracticeRow,
} from './sql';

export type { PracticeRow, PracticeState, WeekCell };

export interface PracticeCard {
  readonly id: string;
  readonly knowledgeId: string | null;
  readonly title: string;
  readonly repeatRule: string;
  readonly startedDay: DayKey;
  readonly endedDay: DayKey | null;
  readonly state: PracticeState;
  readonly streak: number;
  readonly doneToday: boolean;
  readonly cells: readonly WeekCell[];
}

export function todayKey(now: Date = new Date()): DayKey {
  return fromDate(now);
}

function windowOf(r: PracticeRow): PracticeWindow {
  return { startedDay: r.started_at, endedDay: r.ended_at, active: r.active === 1 };
}

function doneDays(id: string): Set<DayKey> {
  const sql = doneDaysQuery(id);
  const rows = getDb().getAllSync<{ date: string }>(sql.text, sql.params as never);
  return new Set(rows.map((x) => x.date));
}

function toCard(r: PracticeRow, today: DayKey): PracticeCard {
  const w = windowOf(r);
  const done = doneDays(r.id);
  return {
    id: r.id,
    knowledgeId: r.knowledge_id,
    title: r.title,
    repeatRule: r.repeat_rule,
    startedDay: r.started_at,
    endedDay: r.ended_at,
    state: practiceState(w, today),
    streak: practiceStreak(r.repeat_rule, done, today, r.started_at),
    doneToday: done.has(today),
    cells: weekCells(r.repeat_rule, done, today, w),
  };
}

/** 오늘의 실천. 🔴 하나도 없으면 홈이 그 영역을 **아예 안 그린다**(§3) */
export function listToday(today: DayKey = todayKey()): PracticeCard[] {
  const sql = runningPracticesQuery(today);
  const rows = getDb().getAllSync<PracticeRow>(sql.text, sql.params as never);
  return rows.map((r) => toCard(r, today));
}

/** 목록 화면용. 진행 중·예정·종료·중단이 섞여 온다 */
export function listAll(today: DayKey = todayKey()): PracticeCard[] {
  const sql = allPracticesQuery();
  const rows = getDb().getAllSync<PracticeRow>(sql.text, sql.params as never);
  return rows.map((r) => toCard(r, today));
}

export function getPractice(id: string, today: DayKey = todayKey()): PracticeCard | undefined {
  const row = selectOne<PracticeRow>('practices', { where: 'id = ?', params: [id] });
  return row === undefined ? undefined : toCard(row, today);
}

export function countPractices(): number {
  const sql = allPracticesQuery();
  return getDb().getAllSync<PracticeRow>(sql.text, sql.params as never).length;
}

export interface CreateInput {
  readonly title: string;
  readonly repeatRule: string;
  readonly startedDay: DayKey;
  readonly endedDay?: DayKey | null;
  readonly knowledgeId?: string | null;
}

/** 🔴 사용자가 [만들기] 를 눌러야 여기까지 온다. 자동 생성은 없다(기둥 3 · §1) */
export function createPractice(input: CreateInput): string {
  const title = input.title.trim();
  if (title === '') throw new Error('실천 문장이 비어 있다. 만들기 버튼이 열려 있었던 것이 버그다');
  return insert('practices', {
    knowledge_id: input.knowledgeId ?? null,
    title,
    started_at: input.startedDay,
    repeat_rule: input.repeatRule,
    ended_at: input.endedDay ?? null,
    active: 1,
  });
}

export function editPractice(
  id: string,
  patch: { title?: string; repeatRule?: string; endedDay?: DayKey | null },
): void {
  const next: Record<string, unknown> = {};
  if (patch.title !== undefined) {
    const t = patch.title.trim();
    if (t === '') throw new Error('실천 문장이 비어 있다');
    next.title = t;
  }
  if (patch.repeatRule !== undefined) next.repeat_rule = patch.repeatRule;
  if (patch.endedDay !== undefined) next.ended_at = patch.endedDay;
  if (Object.keys(next).length === 0) return;
  update('practices', { id }, next);
}

/** [그만두기]. 🔴 지우는 것이 아니다. 기록은 남고 목록에서 접힌다(§2.1) */
export function stopPractice(id: string): void {
  update('practices', { id }, { active: 0 });
}

export function resumePractice(id: string): void {
  update('practices', { id }, { active: 1 });
}

export function removePractice(id: string): void {
  cascadeDelete(id);
}

/**
 * 체크 토글. 🔴 **`(practice_id, date)` UNIQUE 라 해제한 로그를 되살린다**(`DATABASE.md` §1.4).
 * 새로 INSERT 하면 UNIQUE 에 부딪혀 "두 번째 체크가 안 되는" 결함이 난다.
 *
 * 돌려주는 값은 **토글 뒤의 상태**다.
 */
export function toggleCheck(id: string, day: DayKey, today: DayKey = todayKey()): boolean {
  const row = selectOne<PracticeRow>('practices', { where: 'id = ?', params: [id] });
  if (row === undefined) throw new Error(`없는 실천이다: ${id}`);
  if (!canCheck(day, today, windowOf(row))) {
    // 🚫 미래·시작일 이전은 화면에서도 못 누른다. 여기까지 오면 화면이 틀린 것이다
    throw new Error(`체크할 수 없는 날이다: ${day}`);
  }

  const alive = getDb().getFirstSync<{ id: string }>(
    'SELECT id FROM practice_logs WHERE practice_id = ? AND date = ? AND deleted_at IS NULL',
    [id, day] as never,
  );
  if (alive !== null && alive !== undefined) {
    softDelete('practice_logs', { id: alive.id });
    return false;
  }

  // 지워 둔 로그가 있으면 되살린다. 없으면 새로 넣는다
  if (reviveWhere('practice_logs', 'practice_id = ? AND date = ?', [id, day]) > 0) return true;

  insert('practice_logs', { practice_id: id, date: day, done_at: new Date().toISOString() });
  return true;
}

// ── 실천 제안 (§1 · §1.1) ────────────────────────────────────────────

/** 이 카드에 제안 배너를 띄울까. 🔴 [넘어가기] 뒤에는 영원히 `false` 다 */
export function shouldSuggest(knowledgeId: string): boolean {
  const sql = shouldSuggestQuery(knowledgeId);
  const row = getDb().getFirstSync<{ n: number }>(sql.text, sql.params as never);
  return (row?.n ?? 0) > 0;
}

/** [넘어가기]. 🔴 **영구적이다.** 같은 카드에 다시 묻지 않는다(§1.1) */
export function skipSuggestion(knowledgeId: string): void {
  getDb().runSync('UPDATE knowledge SET practice_skipped_at = ?, updated_at = ? WHERE id = ?', [
    new Date().toISOString(),
    new Date().toISOString(),
    knowledgeId,
  ] as never);
}

export { isRunning };
