/**
 * 백업 실행 — `docs/BACKUP_SYSTEM.md` §3 · §4.
 *
 * 🔴 규칙은 여기 없다. 형식은 `format.ts`, 병합 규칙은 `merge.ts` 에 있고 **둘 다 순수**다.
 *    이 파일은 그것들을 DB·파일 시스템에 물리는 얇은 층이다(가드가 규칙을 직접 재는 이유).
 */
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { CODE_SCHEMA_VERSION, applyRestore, dumpTable, schemaVersion, tableColumns } from '@/db';
import {
  BACKUP_TABLES,
  backupFileName,
  buildBackup,
  parseBackup,
  type BackupFile,
  type ParseFailure,
  type Row,
} from '@/features/backup/format';
import { planMerge, planReplace, type Columns, type Plan } from '@/features/backup/merge';

const APP_VERSION = '1.0.0';

function columns(): Columns {
  const out: Record<string, readonly string[]> = {};
  for (const t of BACKUP_TABLES) out[t] = tableColumns(t);
  return out;
}

function snapshot(): Record<string, readonly Row[]> {
  const out: Record<string, readonly Row[]> = {};
  // 🔴 `dumpTable` 이다 — tombstone 이 들어 있어야 "저쪽에서 지웠다"가 전달된다(§1)
  for (const t of BACKUP_TABLES) out[t] = dumpTable(t);
  return out;
}

export function buildBackupJson(now: Date): { name: string; json: string } {
  const file = buildBackup({
    tables: snapshot(),
    schemaVersion: schemaVersion(),
    appVersion: APP_VERSION,
    platform: Platform.OS,
    exportedAt: now.toISOString(),
  });
  return { name: backupFileName(now), json: JSON.stringify(file) };
}

export type ExportResult = 'shared' | 'unavailable';

/**
 * 캐시에 쓰고 → OS 공유 시트로 넘기고 → 임시 파일을 지운다(§3).
 * 🔴 시트가 닫힌 것이 "보관됐다"는 뜻은 아니다. OS 가 성공/취소를 구분해 주지 않는다 —
 *    그래서 화면 문구도 **"마지막 내보내기"** 까지만 쓴다.
 */
export async function exportBackup(now: Date = new Date()): Promise<ExportResult> {
  if (!(await Sharing.isAvailableAsync())) return 'unavailable';

  const { name, json } = buildBackupJson(now);
  const file = new File(Paths.cache, name);
  try {
    if (file.exists) file.delete();
    file.create();
    file.write(json);
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      UTI: 'public.json',
    });
    return 'shared';
  } finally {
    // 🔴 캐시에 남기지 않는다 — 평문이다(§6)
    try {
      if (file.exists) file.delete();
    } catch {
      /* 캐시 정리 실패는 사용자에게 알릴 일이 아니다 */
    }
  }
}

export type PickResult =
  | { readonly ok: true; readonly file: BackupFile }
  | { readonly ok: false; readonly reason: ParseFailure | 'canceled' };

/** 파일 고르기 → 읽기 → 검증(§4.2). 여기서는 **아무것도 쓰지 않는다** — 미리보기까지다. */
export async function pickBackup(): Promise<PickResult> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (picked.canceled) return { ok: false, reason: 'canceled' };

  const asset = picked.assets[0];
  if (asset === undefined) return { ok: false, reason: 'canceled' };

  let text: string;
  try {
    text = new File(asset.uri).textSync();
  } catch {
    return { ok: false, reason: 'invalidFile' };
  }

  const parsed = parseBackup(text, CODE_SCHEMA_VERSION);
  if (!parsed.ok) return { ok: false, reason: parsed.reason };
  return { ok: true, file: parsed.file };
}

export type ImportMode = 'merge' | 'replace';

/** 🔴 계획을 세우고 **한 트랜잭션**으로 적용한다. 중간에 실패하면 아무것도 안 바뀐다(§4.1) */
export function applyBackup(file: BackupFile, mode: ImportMode): Plan {
  const cols = columns();
  const plan = mode === 'merge' ? planMerge(file.data, snapshot(), cols) : planReplace(file.data, cols);
  applyRestore(plan.ops);
  return plan;
}
