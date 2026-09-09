/**
 * 백업 파일 형식 — 정본은 `docs/BACKUP_SYSTEM.md` §2.
 *
 * 🔴 **순수하다.** expo 모듈도 DB 핸들도 모른다 — 행 배열만 다룬다.
 *    그래서 `check:backup` 이 node 에서 **같은 코드로** 왕복을 잰다.
 * 🔴 `@/` 별칭을 쓰지 않는다(가드가 node 로 직접 import 한다).
 */
import { TABLES, TABLE_NAMES, type TableName } from '../../db/schema.ts';

export type Row = Readonly<Record<string, unknown>>;
export type BackupData = Readonly<Record<string, readonly Row[]>>;

/** 다른 JSON 을 잘못 고르면 여기서 걸린다 */
export const BACKUP_FORMAT = 'reread-backup';

/** 🔴 **구조**가 바뀔 때만 올린다. 컬럼이 하나 늘었다고 올리지 않는다(§2) */
export const FORMAT_VERSION = 1;

/** 문자열 길이 기준. 문장 앱이라 실사용은 수 MB 안쪽이다(§2) */
export const MAX_CHARS = 20 * 1024 * 1024;

/**
 * 🔴 백업 범위 = `TABLE_NAMES` − `meta`.
 * `meta` 는 앱 내부 상태(스키마 버전)이지 사용자 데이터가 아니다(`DATABASE.md` §1.1 예외).
 * ⚠ 이 식을 손으로 나열하지 않는 것이 중요하다 — 표가 늘면 자동으로 따라온다.
 */
export const BACKUP_TABLES: readonly TableName[] = TABLE_NAMES.filter((t) => t !== 'meta');

/**
 * 넣는 순서 — **부모 먼저**. FK 가 ON 이라 순서가 틀리면 트랜잭션이 통째로 롤백된다.
 * `recall_questions` 가 `ai_analyses` 를 참조하고, `knowledge_tags` 가 `tags` 를 참조한다.
 */
export const INSERT_ORDER: readonly TableName[] = [
  'books',
  'knowledge',
  'tags',
  'thoughts',
  'ai_analyses',
  'recall_questions',
  'review_schedules',
  'review_logs',
  'practices',
  'practice_logs',
  'knowledge_tags',
];

/** 지우는 순서 — **자식 먼저**. `INSERT_ORDER` 의 역순이다 */
export const DELETE_ORDER: readonly TableName[] = [...INSERT_ORDER].reverse();

export interface BackupFile {
  readonly format: string;
  readonly formatVersion: number;
  readonly schemaVersion: number;
  readonly app: { readonly version: string; readonly platform: string };
  readonly exportedAt: string;
  readonly counts: Readonly<Record<string, number>>;
  readonly data: BackupData;
}

/**
 * 미리보기에 쓰는 네 숫자. 🔴 **검증용이 아니다** — 틀려도 거부하지 않는다(§2).
 *
 * 🔴 **살아 있는 행만 센다.** 파일에는 tombstone 이 함께 실리는데(§1) 그것까지 세면
 *    *"문장 2"* 라고 안내하고 화면에는 하나만 나타난다 — 우리가 사용자에게 거짓말을 하는 자리다.
 *    (2026-09-09 에뮬레이터 실측에서 실제로 그렇게 떴다 — `EDGE_CASES.md` §8)
 */
export function countsOf(data: BackupData): Record<string, number> {
  const alive = (rows: readonly Row[] | undefined) =>
    (rows ?? []).filter((r) => r.deleted_at === null || r.deleted_at === undefined).length;
  return {
    books: alive(data.books),
    knowledge: alive(data.knowledge),
    thoughts: alive(data.thoughts),
    practices: alive(data.practices),
  };
}

export interface BuildInput {
  readonly tables: BackupData;
  readonly schemaVersion: number;
  readonly appVersion: string;
  readonly platform: string;
  readonly exportedAt: string;
}

export function buildBackup(input: BuildInput): BackupFile {
  const data: Record<string, readonly Row[]> = {};
  for (const t of BACKUP_TABLES) data[t] = input.tables[t] ?? [];
  return {
    format: BACKUP_FORMAT,
    formatVersion: FORMAT_VERSION,
    schemaVersion: input.schemaVersion,
    app: { version: input.appVersion, platform: input.platform },
    exportedAt: input.exportedAt,
    counts: countsOf(data),
    data,
  };
}

/** 파일 이름 — 기기 로컬 시각(§2). `Date` 를 받아 순수하게 만든다 */
export function backupFileName(at: Date): string {
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  const stamp = `${at.getFullYear()}${p(at.getMonth() + 1)}${p(at.getDate())}-${p(at.getHours())}${p(at.getMinutes())}`;
  return `ReRead-backup-${stamp}.json`;
}

/** 거부 사유 = i18n 키의 뒷부분(`backup.import.*`) */
export type ParseFailure = 'invalidFile' | 'newerApp';

export type ParseResult =
  | { readonly ok: true; readonly file: BackupFile }
  | { readonly ok: false; readonly reason: ParseFailure; readonly detail: string };

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * 🔴 하나라도 틀리면 **거부**한다(§4.2). 반쯤 읽어 반쯤 넣는 경로를 만들지 않는다.
 *
 * `schemaVersion` 이 앱보다 크면 `newerApp` 이다 — 🔴 경고가 아니라 거부다.
 * 우리는 expand-only 라 구버전 앱이 새 컬럼을 **조용히 버리고** 저장한다.
 */
export function parseBackup(text: string, codeSchemaVersion: number): ParseResult {
  if (text.length > MAX_CHARS) {
    return { ok: false, reason: 'invalidFile', detail: `너무 크다: ${text.length}자` };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'invalidFile', detail: 'JSON 이 아니다' };
  }
  if (!isObject(raw)) return { ok: false, reason: 'invalidFile', detail: '최상위가 객체가 아니다' };
  if (raw.format !== BACKUP_FORMAT) {
    return { ok: false, reason: 'invalidFile', detail: `format 이 다르다: ${String(raw.format)}` };
  }

  const fv = raw.formatVersion;
  if (typeof fv !== 'number' || !Number.isInteger(fv) || fv < 1) {
    return { ok: false, reason: 'invalidFile', detail: `formatVersion 이 정수가 아니다: ${String(fv)}` };
  }
  if (fv > FORMAT_VERSION) {
    return { ok: false, reason: 'newerApp', detail: `formatVersion ${fv} > ${FORMAT_VERSION}` };
  }

  const sv = raw.schemaVersion;
  if (typeof sv !== 'number' || !Number.isInteger(sv) || sv < 1) {
    return { ok: false, reason: 'invalidFile', detail: `schemaVersion 이 정수가 아니다: ${String(sv)}` };
  }
  if (sv > codeSchemaVersion) {
    return { ok: false, reason: 'newerApp', detail: `schemaVersion ${sv} > ${codeSchemaVersion}` };
  }

  if (!isObject(raw.data)) return { ok: false, reason: 'invalidFile', detail: 'data 가 없다' };
  const data: Record<string, readonly Row[]> = {};
  for (const t of BACKUP_TABLES) {
    const rows = (raw.data as Record<string, unknown>)[t];
    if (!Array.isArray(rows)) {
      return { ok: false, reason: 'invalidFile', detail: `data.${t} 가 배열이 아니다` };
    }
    for (const r of rows) {
      if (!isObject(r))
        return { ok: false, reason: 'invalidFile', detail: `data.${t} 에 객체가 아닌 행이 있다` };
      for (const col of TABLES[t].pk) {
        if (typeof r[col] !== 'string' || r[col] === '') {
          return { ok: false, reason: 'invalidFile', detail: `${t}.${col} 가 문자열이 아니다` };
        }
      }
    }
    data[t] = rows as readonly Row[];
  }

  const app = isObject(raw.app) ? raw.app : {};
  return {
    ok: true,
    file: {
      format: BACKUP_FORMAT,
      formatVersion: fv,
      schemaVersion: sv,
      app: {
        version: typeof app.version === 'string' ? app.version : '?',
        platform: typeof app.platform === 'string' ? app.platform : '?',
      },
      exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
      counts: countsOf(data),
      data,
    },
  };
}
