/**
 * 로컬 DB — 사용자 데이터의 정본(`CLAUDE.md` §6, 결정 #1). 서버에는 지식이 없다.
 *
 * 🔴 **여기만 expo-sqlite 를 안다.** 스키마·러너·빌더·삭제 규칙은 전부 순수 모듈이고
 *    이 파일은 그것들을 실제 DB 에 물리는 얇은 층이다. 그래서 가드가 node 에서 같은 코드를 돌린다.
 *
 * 🔴 화면·features 는 SQL 을 직접 쓰지 않는다 — 여기 헬퍼를 쓴다.
 *    `WHERE deleted_at IS NULL` 을 빠뜨릴 수 있는 통로를 만들지 않기 위해서다(`docs/DATABASE.md` §1.1).
 */
import { randomUUID } from 'expo-crypto';
import * as SQLite from 'expo-sqlite';

import { deleteBookSteps, deleteKnowledgeSteps, deletePracticeSteps } from './cascade.ts';
import { runMigrations, type SqlDriver } from './migrate.ts';
import { type TableName } from './schema.ts';
import {
  buildCount,
  buildInsert,
  buildRevive,
  buildReviveWhere,
  buildSelect,
  buildSoftDelete,
  buildUpdate,
  type SelectOptions,
  type Sql,
} from './sql.ts';

const DB_NAME = 'reread.db';

/** UTC ISO 8601 — 저장은 언제나 UTC 다. 표시할 때만 로케일(§1.2) */
export function nowIso(): string {
  return new Date().toISOString();
}

/** UUID v4 — 🚫 자동증가 정수 ID 를 쓰지 않는다(결정 #8) */
export function newId(): string {
  return randomUUID();
}

function wrap(database: SQLite.SQLiteDatabase): SqlDriver {
  return {
    exec: (sql) => database.execSync(sql),
    get: <T>(sql: string, params: readonly unknown[] = []) =>
      database.getFirstSync<T>(sql, params as SQLite.SQLiteBindParams) ?? undefined,
    run: (sql: string, params: readonly unknown[] = []) => {
      database.runSync(sql, params as SQLite.SQLiteBindParams);
    },
  };
}

let cached: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (cached !== null) return cached;
  const database = SQLite.openDatabaseSync(DB_NAME);
  // SQLite 기본이 OFF 다 — ON DELETE SET NULL·CASCADE 가 이 한 줄에 달려 있다
  database.execSync('PRAGMA foreign_keys = ON');
  runMigrations(wrap(database));
  cached = database;
  return database;
}

/** 테스트·재부팅 용. 다음 `getDb()` 가 다시 연다. */
export function closeDb(): void {
  if (cached === null) return;
  cached.closeSync();
  cached = null;
}

function exec(sql: Sql): void {
  getDb().runSync(sql.text, sql.params as SQLite.SQLiteBindParams);
}

function execAll(steps: readonly Sql[]): void {
  const database = getDb();
  database.withTransactionSync(() => {
    for (const s of steps) database.runSync(s.text, s.params as SQLite.SQLiteBindParams);
  });
}

/** INSERT — `id`·`created_at`·`updated_at` 은 손으로 쓰지 않는다. 만들어진 `id` 를 돌려준다. */
export function insert(table: TableName, values: Readonly<Record<string, unknown>>): string {
  const id = newId();
  exec(buildInsert(table, values, { id, now: nowIso() }));
  return id;
}

export function update(
  table: TableName,
  key: Readonly<Record<string, unknown>>,
  patch: Readonly<Record<string, unknown>>,
): void {
  exec(buildUpdate(table, key, patch, nowIso()));
}

/** 🔴 tombstone. 물리 삭제는 이 앱에 없다(§1.1). */
export function softDelete(table: TableName, key: Readonly<Record<string, unknown>>): void {
  exec(buildSoftDelete(table, key, nowIso()));
}

export function selectAll<T>(table: TableName, opts: SelectOptions = {}): T[] {
  const sql = buildSelect(table, opts);
  return getDb().getAllSync<T>(sql.text, sql.params as SQLite.SQLiteBindParams);
}

export function selectOne<T>(table: TableName, opts: SelectOptions = {}): T | undefined {
  const sql = buildSelect(table, { ...opts, limit: 1 });
  return getDb().getFirstSync<T>(sql.text, sql.params as SQLite.SQLiteBindParams) ?? undefined;
}

/** 🔴 파생값은 저장하지 않고 매번 센다(`DATABASE.md` §4 · `KNOWLEDGE_SYSTEM.md` §4.2). */
export function count(
  table: TableName,
  opts: Omit<SelectOptions, 'columns' | 'orderBy' | 'limit'> = {},
): number {
  const sql = buildCount(table, opts);
  const row = getDb().getFirstSync<{ n: number }>(sql.text, sql.params as SQLite.SQLiteBindParams);
  return row?.n ?? 0;
}

/** tombstone 되살리기 — UNIQUE 와 부딪히는 자리(§1.4). 되살린 행 수를 돌려준다. */
export function revive(table: TableName, key: Readonly<Record<string, unknown>>): number {
  const sql = buildRevive(table, key, nowIso());
  return getDb().runSync(sql.text, sql.params as SQLite.SQLiteBindParams).changes;
}

export function reviveWhere(table: TableName, where: string, params: readonly unknown[]): number {
  const sql = buildReviveWhere(table, where, params, nowIso());
  return getDb().runSync(sql.text, sql.params as SQLite.SQLiteBindParams).changes;
}

/** 삭제 규칙(§3)은 전부 `db/cascade.ts` 가 정하고, 여기서는 한 트랜잭션으로 돌리기만 한다. */
export function deleteKnowledge(knowledgeId: string): void {
  execAll(deleteKnowledgeSteps(knowledgeId, nowIso()));
}

export function deleteBook(bookId: string): void {
  execAll(deleteBookSteps(bookId, nowIso()));
}

export function deletePractice(practiceId: string): void {
  execAll(deletePracticeSteps(practiceId, nowIso()));
}
