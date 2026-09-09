/**
 * 복원 전용 SQL 빌더 — `docs/BACKUP_SYSTEM.md` §4.3 · §4.4.
 *
 * 🔴 **`db/sql.ts` 를 쓰지 않는 유일한 자리다.** 그 빌더는 `id`·`created_at`·`updated_at`·`deleted_at`
 *    을 호출부가 못 쓰게 막는 것이 존재 이유인데(§1.1), 복원은 **파일에 적힌 그 값을 그대로 넣어야 한다.**
 *    시각을 새로 찍으면 `updated_at` 비교가 무너져 다음 가져오기 때 이 기기가 항상 이긴다.
 *
 * 🔴 그래서 이 파일은 **복원 말고 아무 데서도 부르지 않는다.** 화면·features 는 `db/index.ts` 헬퍼를 쓴다.
 * 🔴 순수하다 — 시각도 UUID 도 만들지 않는다.
 */
import { TABLES, type TableName } from './schema.ts';
import { type Sql } from './sql.ts';

const IDENT = /^[a-z_][a-z0-9_]*$/;

function assertColumn(name: string): void {
  if (!IDENT.test(name)) throw new Error(`컬럼 이름이 아니다: ${JSON.stringify(name)}`);
}

/** 파일 행에서 **앱이 아는 컬럼만** 고른다. 모르는 컬럼은 버리고, 빠진 컬럼은 DB DEFAULT 로 간다(§4.3) */
export function pickKnown(
  row: Readonly<Record<string, unknown>>,
  known: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const c of known) {
    if (c in row) out[c] = row[c] ?? null;
  }
  return out;
}

/** 🔴 파일 값을 **그대로** 넣는다(`id`·시각 포함) */
export function buildRowInsert(table: TableName, row: Readonly<Record<string, unknown>>): Sql {
  const cols = Object.keys(row);
  if (cols.length === 0) throw new Error(`\`${table}\` 복원 INSERT 에 컬럼이 없다`);
  cols.forEach(assertColumn);
  return {
    text: `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    params: cols.map((c) => row[c] ?? null),
  };
}

/** PK 를 뺀 나머지를 파일 값으로 덮는다. 🔴 `deleted_at` 도 값이다 — 저쪽에서 지운 것이 여기로 온다 */
export function buildRowUpdate(table: TableName, row: Readonly<Record<string, unknown>>): Sql {
  const m = TABLES[table];
  const pk = m.pk as readonly string[];
  const cols = Object.keys(row).filter((c) => !pk.includes(c));
  if (cols.length === 0) throw new Error(`\`${table}\` 복원 UPDATE 에 바꿀 컬럼이 없다`);
  cols.forEach(assertColumn);
  pk.forEach(assertColumn);

  const where = pk.map((c) => `${c} = ?`).join(' AND ');
  return {
    text: `UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE ${where}`,
    params: [...cols.map((c) => row[c] ?? null), ...pk.map((c) => row[c] ?? null)],
  };
}

/** 🔴 물리 삭제. **바꾸기(§4.4) 전용이다** — 기기를 파일 상태로 되돌리는 것이지 "지웠다"고 기록하는 게 아니다 */
export function buildDeleteAll(table: TableName): Sql {
  return { text: `DELETE FROM ${table}`, params: [] };
}
