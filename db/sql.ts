/**
 * 쿼리 빌더 — `docs/DATABASE.md` §1.1 의 마지막 줄("헬퍼로 강제한다")이 여기다.
 *
 * 🔴 이 파일이 존재하는 이유는 딱 하나다: **`WHERE deleted_at IS NULL` 을 빠뜨릴 수 없게 만드는 것.**
 *    빠뜨리면 빈 화면이 아니라 **틀린 화면**이 난다(지운 지식이 복습 큐에 되살아난다) —
 *    `docs/REVIEW_SYSTEM.md` §8 이 이미 그 증상을 버그 목록에 적어 뒀다.
 *
 * 🔴 순수하다 — expo 모듈도, 시각도, UUID 도 만들지 않는다. `id`·`now` 는 **받는다**.
 *    그래서 가드가 node 에서 이 빌더로 실제 SQL 을 세워 돌려볼 수 있다.
 */
import { TABLES, type TableName } from './schema.ts';

export interface Sql {
  readonly text: string;
  readonly params: readonly unknown[];
}

/** 헬퍼가 채워 주는 값. 호출부가 UUID·시각을 손으로 쓰지 않게 한다(결정 #8). */
export interface Stamp {
  readonly id: string;
  readonly now: string;
}

export interface SelectOptions {
  readonly columns?: readonly string[];
  /** `?` 파라미터를 쓰는 조건절. `deleted_at` 은 여기 적지 않는다 — 빌더가 붙인다 */
  readonly where?: string;
  readonly params?: readonly unknown[];
  readonly orderBy?: string;
  readonly limit?: number;
  /** 🔴 tombstone 을 **명시적으로** 볼 때만 켠다(백업·병합·복원 검증) */
  readonly includeDeleted?: boolean;
}

const IDENT = /^[a-z_][a-z0-9_]*$/;

function meta(table: TableName) {
  const m = TABLES[table];
  if (m === undefined) throw new Error(`알 수 없는 표: ${table}`);
  return m;
}

function assertColumn(name: string): void {
  if (!IDENT.test(name)) throw new Error(`컬럼 이름이 아니다: ${JSON.stringify(name)}`);
}

/** 규약 칸은 호출부가 직접 쓰지 못한다 — 헬퍼가 채운다 */
const MANAGED = ['id', 'created_at', 'updated_at', 'deleted_at'] as const;

function assertNotManaged(table: TableName, keys: readonly string[]): void {
  const m = meta(table);
  for (const k of keys) {
    if (k === 'id' && !m.id) continue; // review_schedules·knowledge_tags 는 PK 를 값으로 받는다
    if ((MANAGED as readonly string[]).includes(k)) {
      throw new Error(`\`${table}.${k}\` 는 헬퍼가 채운다 — 값으로 넘기지 않는다 (DATABASE.md §1.1)`);
    }
  }
}

function pkWhere(table: TableName, key: Readonly<Record<string, unknown>>): Sql {
  const m = meta(table);
  const parts: string[] = [];
  const params: unknown[] = [];
  for (const col of m.pk) {
    if (!(col in key)) throw new Error(`\`${table}\` PK 값이 빠졌다: ${col}`);
    assertColumn(col);
    parts.push(`${col} = ?`);
    params.push(key[col]);
  }
  return { text: parts.join(' AND '), params };
}

/**
 * INSERT — `id`·`created_at`·`updated_at` 은 **빌더가 붙인다**.
 * `id` 가 없는 표(§1.1 예외)는 PK 를 `values` 로 받는다.
 */
export function buildInsert(table: TableName, values: Readonly<Record<string, unknown>>, stamp: Stamp): Sql {
  const m = meta(table);
  const keys = Object.keys(values);
  assertNotManaged(table, keys);

  const row: Record<string, unknown> = { ...values };
  if (m.id) row.id = stamp.id;
  if (m.stamps) {
    row.created_at = stamp.now;
    row.updated_at = stamp.now;
  }
  if (m.soft) row.deleted_at = null;

  const cols = Object.keys(row);
  if (cols.length === 0) throw new Error(`\`${table}\` INSERT 에 컬럼이 없다`);
  cols.forEach(assertColumn);

  return {
    text: `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    params: cols.map((c) => row[c] ?? null),
  };
}

/**
 * SELECT — 🔴 soft 표에는 `deleted_at IS NULL` 이 **항상** 붙는다.
 * `includeDeleted` 를 켜야만 tombstone 이 보인다.
 */
export function buildSelect(table: TableName, opts: SelectOptions = {}): Sql {
  const m = meta(table);
  if (opts.includeDeleted === true && !m.soft) {
    // 🔴 조용히 무시하면 "지운 것도 본다"는 착각이 남는다. `review_logs` 에는 지운 것이 없다
    throw new Error(`\`${table}\` 에는 deleted_at 이 없다 — includeDeleted 를 켤 수 없다`);
  }

  const columns = opts.columns ?? ['*'];
  for (const c of columns) if (c !== '*') assertColumn(c);

  const conds: string[] = [];
  if (opts.where !== undefined && opts.where.trim() !== '') conds.push(`(${opts.where})`);
  if (m.soft && opts.includeDeleted !== true) conds.push('deleted_at IS NULL');

  let text = `SELECT ${columns.join(', ')} FROM ${table}`;
  if (conds.length > 0) text += ` WHERE ${conds.join(' AND ')}`;
  if (opts.orderBy !== undefined && opts.orderBy.trim() !== '') text += ` ORDER BY ${opts.orderBy}`;

  const params: unknown[] = [...(opts.params ?? [])];
  if (opts.limit !== undefined) {
    if (!Number.isInteger(opts.limit) || opts.limit < 0) throw new Error(`limit 이 정수가 아니다`);
    text += ' LIMIT ?';
    params.push(opts.limit);
  }
  return { text, params };
}

/** UPDATE — `updated_at` 을 빌더가 갱신하고, tombstone 된 행은 고치지 않는다. */
export function buildUpdate(
  table: TableName,
  key: Readonly<Record<string, unknown>>,
  patch: Readonly<Record<string, unknown>>,
  now: string,
): Sql {
  const m = meta(table);
  const keys = Object.keys(patch);
  if (keys.length === 0) throw new Error(`\`${table}\` UPDATE 에 바꿀 컬럼이 없다`);
  assertNotManaged(table, keys);
  keys.forEach(assertColumn);

  const sets = keys.map((k) => `${k} = ?`);
  const params: unknown[] = keys.map((k) => patch[k] ?? null);
  if (m.stamps) {
    sets.push('updated_at = ?');
    params.push(now);
  }

  const where = pkWhere(table, key);
  const tail = m.soft ? ` AND deleted_at IS NULL` : '';
  return {
    text: `UPDATE ${table} SET ${sets.join(', ')} WHERE ${where.text}${tail}`,
    params: [...params, ...where.params],
  };
}

/** tombstone — 🔴 물리 삭제는 어디에도 없다(§1.1). `review_logs` 는 아예 막는다(§2). */
export function buildSoftDelete(table: TableName, key: Readonly<Record<string, unknown>>, now: string): Sql {
  const m = meta(table);
  if (!m.soft) {
    throw new Error(`\`${table}\` 는 지우지 않는다 — 물리 보존 (DATABASE.md §2 · §1.1 예외)`);
  }
  const where = pkWhere(table, key);
  const sets = m.stamps ? 'deleted_at = ?, updated_at = ?' : 'deleted_at = ?';
  const params = m.stamps ? [now, now] : [now];
  return {
    text: `UPDATE ${table} SET ${sets} WHERE ${where.text} AND deleted_at IS NULL`,
    params: [...params, ...where.params],
  };
}

/**
 * 조건으로 tombstone — 자식 표를 부모 키로 지울 때 쓴다(§3 삭제 규칙).
 * 🔴 `AND deleted_at IS NULL` 이 항상 붙어 이미 지운 행의 시각을 덮지 않는다.
 */
export function buildSoftDeleteWhere(
  table: TableName,
  where: string,
  params: readonly unknown[],
  now: string,
): Sql {
  const m = meta(table);
  if (!m.soft) {
    throw new Error(`\`${table}\` 는 지우지 않는다 — 물리 보존 (DATABASE.md §2 · §1.1 예외)`);
  }
  if (where.trim() === '') throw new Error('지울 조건이 비어 있다');
  const sets = m.stamps ? 'deleted_at = ?, updated_at = ?' : 'deleted_at = ?';
  const head: unknown[] = m.stamps ? [now, now] : [now];
  return {
    text: `UPDATE ${table} SET ${sets} WHERE (${where}) AND deleted_at IS NULL`,
    params: [...head, ...params],
  };
}

/** 조건으로 UPDATE — 부모를 지울 때 자식의 연결만 끊는 자리(`knowledge.book_id` 등). */
export function buildUpdateWhere(
  table: TableName,
  where: string,
  whereParams: readonly unknown[],
  patch: Readonly<Record<string, unknown>>,
  now: string,
): Sql {
  const m = meta(table);
  const keys = Object.keys(patch);
  if (keys.length === 0) throw new Error(`\`${table}\` UPDATE 에 바꿀 컬럼이 없다`);
  if (where.trim() === '') throw new Error('고칠 조건이 비어 있다');
  assertNotManaged(table, keys);
  keys.forEach(assertColumn);

  const sets = keys.map((k) => `${k} = ?`);
  const params: unknown[] = keys.map((k) => patch[k] ?? null);
  if (m.stamps) {
    sets.push('updated_at = ?');
    params.push(now);
  }
  const tail = m.soft ? ' AND deleted_at IS NULL' : '';
  return {
    text: `UPDATE ${table} SET ${sets.join(', ')} WHERE (${where})${tail}`,
    params: [...params, ...whereParams],
  };
}

/**
 * tombstone 되살리기 — UNIQUE 와 부딪히는 자리의 정답(§1.4).
 * 🚫 같은 키로 새 행을 만들지 않는다. 그러면 UNIQUE 위반으로 죽거나 죽은 행이 쌓인다.
 */
export function buildRevive(table: TableName, key: Readonly<Record<string, unknown>>, now: string): Sql {
  const m = meta(table);
  if (!m.soft) throw new Error(`\`${table}\` 에는 되살릴 tombstone 이 없다`);
  const where = pkWhere(table, key);
  const sets = m.stamps ? 'deleted_at = NULL, updated_at = ?' : 'deleted_at = NULL';
  const params: unknown[] = m.stamps ? [now] : [];
  return {
    text: `UPDATE ${table} SET ${sets} WHERE ${where.text} AND deleted_at IS NOT NULL`,
    params: [...params, ...where.params],
  };
}

/** 조건으로 tombstone 을 되살린다 — UNIQUE 열이 PK 가 아닌 표(`tags.name` 등)용. */
export function buildReviveWhere(
  table: TableName,
  where: string,
  params: readonly unknown[],
  now: string,
): Sql {
  const m = meta(table);
  if (!m.soft) throw new Error(`\`${table}\` 에는 되살릴 tombstone 이 없다`);
  if (where.trim() === '') throw new Error('되살릴 조건이 비어 있다');
  const sets = m.stamps ? 'deleted_at = NULL, updated_at = ?' : 'deleted_at = NULL';
  const head: unknown[] = m.stamps ? [now] : [];
  return {
    text: `UPDATE ${table} SET ${sets} WHERE (${where}) AND deleted_at IS NOT NULL`,
    params: [...head, ...params],
  };
}
