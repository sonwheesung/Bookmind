import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Text } from 'react-native';

import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { applyBackup, exportBackup, pickBackup } from '@/features/backup/repo';
import { useBackupStore } from '@/features/backup/store';
import type { BackupFile } from '@/features/backup/format';
import { useTheme } from '@/theme';

/**
 * 백업 — `docs/BACKUP_SYSTEM.md` §5. 결정 #15(무료 · v1.0).
 *
 * 🔴 이 화면이 결정 #1 의 대가(기기 교체 시 전손)를 **무료 사용자에게** 닫는 유일한 자리다.
 *    암호화 금고(#6)는 v1.1 이고 Premium 이라 그것만으로는 영원히 안 닫힌다.
 *
 * 🚫 *"첫 백업을 만들어보세요!"* 같은 유도 문구를 넣지 않는다(기둥 5 · `DESIGN_REVIEW.md` §3).
 * 🚫 *"백업하면 안전합니다"* 라고 쓰지 않는다 — 파일 분실·유출은 사용자 영역이다.
 */
export default function Backup() {
  const { t, i18n } = useTranslation();
  const { palette, spacing, typography } = useTheme();
  const lastExportedAt = useBackupStore((s) => s.lastExportedAt);
  const markExported = useBackupStore((s) => s.markExported);
  const [busy, setBusy] = useState(false);

  const lastText =
    lastExportedAt === null ? t('backup.never') : new Date(lastExportedAt).toLocaleDateString(i18n.language);

  async function onExport() {
    if (busy) return;
    setBusy(true);
    try {
      const now = new Date();
      const result = await exportBackup(now);
      if (result === 'unavailable') {
        Alert.alert(t('backup.title'), t('backup.shareUnavailable'));
        return;
      }
      // 🔴 "시트를 열었다"까지가 사실이다(§3). 그 이상을 적으면 거짓이 된다
      markExported(now.toISOString());
    } catch {
      Alert.alert(t('backup.title'), t('backup.exportFailed'));
    } finally {
      setBusy(false);
    }
  }

  /** 🔴 바꾸기는 되돌릴 수 없다 — 2단계 확인(§4.1) */
  function confirmReplace(file: BackupFile) {
    Alert.alert(t('backup.import.replaceConfirmTitle'), t('backup.import.replaceConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('backup.import.replace'), style: 'destructive', onPress: () => run(file, 'replace') },
    ]);
  }

  function run(file: BackupFile, mode: 'merge' | 'replace') {
    try {
      const plan = applyBackup(file, mode);
      Alert.alert(
        t('backup.title'),
        t('backup.import.done', { added: plan.added, updated: plan.updated, skipped: plan.skipped }),
      );
    } catch {
      Alert.alert(t('backup.title'), t('backup.import.failed'));
    }
  }

  async function onImport() {
    if (busy) return;
    setBusy(true);
    try {
      const picked = await pickBackup();
      if (!picked.ok) {
        if (picked.reason === 'canceled') return;
        Alert.alert(t('backup.title'), t(`backup.import.${picked.reason}`));
        return;
      }
      const c = picked.file.counts;
      Alert.alert(
        t('backup.import.preview'),
        t('backup.import.previewBody', {
          books: c.books,
          knowledge: c.knowledge,
          thoughts: c.thoughts,
          practices: c.practices,
        }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('backup.import.replace'), onPress: () => confirmReplace(picked.file) },
          { text: t('backup.import.merge'), onPress: () => run(picked.file, 'merge') },
        ],
      );
    } catch {
      Alert.alert(t('backup.title'), t('backup.import.failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll>
      <Header title={t('backup.title')} back />

      <Text style={[typography.body, { color: palette.text, marginBottom: spacing.xl }]}>
        {t('backup.intro')}
      </Text>

      <Button label={t('backup.exportAction')} onPress={() => void onExport()} disabled={busy} />
      <Text style={[typography.caption, { color: palette.textMuted, marginTop: spacing.xs }]}>
        {t('backup.lastExport', { value: lastText })}
      </Text>

      <Button
        label={t('backup.importAction')}
        variant="ghost"
        onPress={() => void onImport()}
        disabled={busy}
        style={{ marginTop: spacing.xl }}
      />

      <Text style={[typography.caption, { color: palette.textMuted, marginTop: spacing.xl }]}>
        {t('backup.caution')}
      </Text>
    </Screen>
  );
}
