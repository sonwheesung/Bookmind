/**
 * 합치기·바꾸기 규칙 — `docs/BACKUP_SYSTEM.md` §4.3 · §4.4.
 *
 * 🔴 **순수하다.** DB 도 시각도 모른다 — 파일의 행 배열과 기기의 행 배열을 받아 **할 일 목록**을 낸다.
 *    가드가 node 에서 같은 함수로 규칙을 잰다.
 * 🔴 `@/` 별칭을 쓰지 않는다.
 */
import { TABLES, type TableName } from '../../db/schema.ts';
import { pickKnown } from '../../db/restore.ts';
import { BACKUP_TABLES, DELETE_ORDER, INSERT_ORDER, type BackupData, type Row } from './format.ts';

export type OpKind = 'insert' | 'update' | 'delete-all';

export interface Op {
  readonly kind: OpKind;
  readonly table: TableName;
  /** `delete-all` 에는 없다 */
  readonly row?: Record<string, unknown>;
}

export interface Plan {
  readonly ops: readonly Op[];
  readonly added: number;
  readonly updated: number;
  readonly skipped: number;
}

/** 표별로 앱이 아는 컬럼. 실행 시 `PRAGMA table_info` 로 만든다 — 손으로 나열하지 않는다 */
export type Columns = Readonly<Record<string, readonly string[]>>;

/**
 * 열쇠를 이을 때 쓰는 구분자.
 * 🔴 **실제 NUL 문자를 소스에 박지 않는다** — 2026-09-09 에 그렇게 썼다가 `check:chars` 가 잡았다.
 *    기능은 멀쩡히 돌아서 가드가 아니었으면 그대로 커밋됐을 것이다(`EDGE_CASES.md` §7).
 */
const SEP = '\u0000';

function pkOf(table: TableName, row: Row): string {
  return (TABLES[table].pk as readonly string[]).map((c) => String(row[c])).join(SEP);
}

function index(table: TableName, rows: readonly Row[]): Map<string, Row> {
  const m = new Map<string, Row>();
  for (const r of rows) m.set(pkOf(table, r), r);
  return m;
}

function stampOf(row: Row): string {
  const v = row.updated_at;
  return typeof v === 'string' ? v : '';
}

/** `name` 처럼 **PK 가 아닌 UNIQUE** 열의 열쇠. 🔴 대소문자를 무시한다(`tags.name` 은 NOCASE) */
function nameKey(row: Row): string {
  return String(row.name ?? '')
    .trim()
    .toLowerCase();
}

function dateKey(row: Row): string {
  return `${String(row.practice_id ?? '')}${SEP}${String(row.date ?? '')}`;
}

/**
 * 합치기 계획.
 *
 * 규칙(§4.3)
 * - `updated_at` 이 있는 표: 파일 쪽이 **크면** 덮고, 아니면 로컬 유지. `deleted_at` 도 함께 덮는다.
 * - `review_logs`: 같은 `id` 는 **같은 사건**이라 건너뛴다(비교할 `updated_at` 이 없다).
 * - `tags`: 같은 이름이 로컬에 있으면 **파일 id → 로컬 id 로 재매핑**한다. UNIQUE 를 지키는 유일한 길이다.
 * - `practice_logs`: `(practice_id, date)` 가 UNIQUE 다 — 같은 날의 실천 체크는 **같은 사실**이라
 *   id 가 달라도 로컬을 유지한다. 🔴 안 그러면 UNIQUE 위반으로 트랜잭션 전체가 롤백된다.
 */
export function planMerge(file: BackupData, local: BackupData, columns: Columns): Plan {
  const ops: Op[] = [];
  let added = 0;
  let updated = 0;
  let skipped = 0;

  // ── ① 태그 재매핑을 먼저 만든다 — knowledge_tags 가 이 표를 참조한다 ──
  const localTags = local.tags ?? [];
  const localTagIds = new Set(localTags.map((r) => String(r.id)));
  const localByName = new Map<string, Row>();
  for (const r of localTags) if (!localByName.has(nameKey(r))) localByName.set(nameKey(r), r);

  /** 파일의 태그 id → 실제로 쓸 id */
  const tagRemap = new Map<string, string>();
  for (const r of file.tags ?? []) {
    const fileId = String(r.id);
    if (localTagIds.has(fileId)) continue; // 같은 id — 로컬 유지(재매핑 불필요)
    const hit = localByName.get(nameKey(r));
    if (hit !== undefined) tagRemap.set(fileId, String(hit.id));
  }

  // ── ② practice_logs 의 (practice_id, date) 색인 ──
  const localLogByDate = new Map<string, Row>();
  for (const r of local.practice_logs ?? []) localLogByDate.set(dateKey(r), r);

  const remapRow = (table: TableName, row: Row): Row => {
    if (table === 'knowledge_tags') {
      const to = tagRemap.get(String(row.tag_id));
      if (to !== undefined) return { ...row, tag_id: to };
    }
    return row;
  };

  for (const table of INSERT_ORDER) {
    const known = columns[table] ?? [];
    const localRows = local[table] ?? [];
    const localIndex = index(table, localRows);

    for (const raw of file[table] ?? []) {
      const row = remapRow(table, raw);

      // 태그: 이름으로 재매핑됐으면 그 행은 넣지 않는다(로컬 것을 쓴다)
      if (table === 'tags' && tagRemap.has(String(raw.id))) {
        skipped++;
        continue;
      }
      // 실천 로그: 같은 날이 이미 있으면 로컬을 남긴다
      if (table === 'practice_logs') {
        const hit = localLogByDate.get(dateKey(row));
        if (hit !== undefined && String(hit.id) !== String(row.id)) {
          skipped++;
          continue;
        }
      }

      const key = pkOf(table, row);
      const mine = localIndex.get(key);
      const picked = pickKnown(row, known);

      if (mine === undefined) {
        ops.push({ kind: 'insert', table, row: picked });
        localIndex.set(key, row);
        if (table === 'practice_logs') localLogByDate.set(dateKey(row), row);
        added++;
        continue;
      }

      // 🔴 `review_logs` 는 같은 id 면 같은 사건이다 — 덮어쓸 것이 없다
      if (!TABLES[table].stamps || stampOf(row) <= stampOf(mine)) {
        skipped++;
        continue;
      }
      ops.push({ kind: 'update', table, row: picked });
      updated++;
    }
  }

  return { ops, added, updated, skipped };
}

/**
 * 바꾸기 계획(§4.4) — 자식부터 **물리 삭제**한 뒤 부모부터 넣는다.
 * 🔴 `meta` 는 건드리지 않는다. 스키마 버전이 날아가면 다음 부팅에서 러너가 처음부터 다시 돈다.
 */
export function planReplace(file: BackupData, columns: Columns): Plan {
  const ops: Op[] = [];
  for (const table of DELETE_ORDER) ops.push({ kind: 'delete-all', table });

  let added = 0;
  for (const table of INSERT_ORDER) {
    const known = columns[table] ?? [];
    for (const row of file[table] ?? []) {
      ops.push({ kind: 'insert', table, row: pickKnown(row, known) });
      added++;
    }
  }
  return { ops, added, updated: 0, skipped: 0 };
}

/** 🔴 파일 형식의 표 목록이 스키마와 어긋나지 않는지 — 가드(§7 축 ①)와 앱이 같은 함수로 잰다 */
export function missingTables(data: BackupData): readonly TableName[] {
  return BACKUP_TABLES.filter((t) => !Array.isArray(data[t]));
}
