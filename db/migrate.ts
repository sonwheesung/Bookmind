/**
 * 마이그레이션 러너 — `docs/DATABASE.md` §1.3(Expand-only) · §2 `meta`.
 *
 * 🔴 이 파일은 **순수하다**. 드라이버 인터페이스만 받으므로
 *    expo-sqlite(앱)와 node:sqlite(가드)가 **같은 러너**를 돈다 —
 *    가드가 러너를 베껴 만들면 검사하는 것이 러너가 아니라 사본이 된다.
 */
import { META_TABLE_SQL, MIGRATIONS } from './schema.ts';

/** 러너가 필요한 최소 능력. expo-sqlite·node:sqlite 양쪽이 이 모양으로 감싸진다. */
export interface SqlDriver {
  exec(sql: string): void;
  get<T>(sql: string, params?: readonly unknown[]): T | undefined;
  run(sql: string, params?: readonly unknown[]): void;
}

const VERSION_KEY = 'schema_version';

/** 코드가 아는 최신 버전. 🔴 `PRAGMA user_version` 을 함께 쓰지 않는다(§2 meta). */
export const CODE_SCHEMA_VERSION = MIGRATIONS.length;

export function readSchemaVersion(db: SqlDriver): number {
  const row = db.get<{ value: string }>('SELECT value FROM meta WHERE key = ?', [VERSION_KEY]);
  if (row === undefined) return 0;
  const n = Number(row.value);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`meta.schema_version 이 정수가 아니다: ${JSON.stringify(row.value)}`);
  }
  return n;
}

/**
 * 버전 순서대로 한 번씩만 적용한다. 이미 최신이면 아무것도 하지 않는다(멱등).
 * @returns 적용 후 버전
 */
export function runMigrations(db: SqlDriver): number {
  db.exec(META_TABLE_SQL);
  const from = readSchemaVersion(db);

  if (from > CODE_SCHEMA_VERSION) {
    // 🔴 앱을 다운그레이드한 상황이다. down 이 없으므로(§1.3) 조용히 진행하면 안 된다 —
    //    코드가 모르는 컬럼이 이미 있고, 그 위에 쓰면 데이터가 어긋난다.
    throw new Error(
      `DB 가 코드보다 앞서 있다: DB v${from} > 코드 v${CODE_SCHEMA_VERSION}. 앱을 다운그레이드했다.`,
    );
  }

  for (let v = from; v < MIGRATIONS.length; v++) {
    const sql = MIGRATIONS[v];
    if (sql === undefined) throw new Error(`마이그레이션 v${v + 1} 이 비어 있다`);
    db.exec('BEGIN');
    try {
      db.exec(sql);
      db.run(
        'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        [VERSION_KEY, String(v + 1)],
      );
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
  return CODE_SCHEMA_VERSION;
}
