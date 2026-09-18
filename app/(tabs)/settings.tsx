import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { ChipRow } from '@/components/ChipRow';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { Select } from '@/components/Select';
import { useBackupStore } from '@/features/backup/store';
import { REMINDER_TIMES } from '@/features/review/notify';
import { syncReminders } from '@/features/review/reminder';
import { LANGUAGE_NAMES, useLanguageStore } from '@/features/settings/language';
import { useReminderStore } from '@/features/settings/reminder';
import { formatDate } from '@/lib/format';
import { deviceLocale, SUPPORTED } from '@/lib/i18n';
import { useTheme } from '@/theme';

/** 설정 한 줄(왼쪽 이름 · 오른쪽 값). 🔴 이 화면에서만 반복되므로 파일 안에 둔다(`docs/UI_GUIDE.md` §4) */
function Row({ onPress, children }: { onPress: () => void; children: ReactNode }) {
  return (
    <Card onPress={onPress}>
      <View style={styles.row}>{children}</View>
    </Card>
  );
}

/**
 * 설정 — 지금은 언어 하나다(`docs/I18N_SYSTEM.md` §2.1 에서 Phase 6 → Phase 2 로 당겼다).
 *
 * 🚫 "시스템 자동" 항목을 두지 않는다(§2). 목록은 지원 언어 그 자체이고,
 *    이름은 **그 언어의 표기 그대로**다 — 번역하면 그 언어만 읽는 사용자가 자기 언어를 못 찾는다.
 */
export default function Settings() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const lastExportedAt = useBackupStore((s) => s.lastExportedAt);
  const enabled = useReminderStore((s) => s.enabled);
  const time = useReminderStore((s) => s.time);
  const setEnabled = useReminderStore((s) => s.setEnabled);
  const setTime = useReminderStore((s) => s.setTime);
  const [denied, setDenied] = useState(false);

  const copy = { title: t('reminder.notify.title'), body: t('reminder.notify.body') };

  /**
   * 🔴 예약을 **상태를 바꾼 직후에** 다시 맞춘다(`REVIEW_SYSTEM.md` §6.2.1).
   * 권한을 거절당하면 스위치를 도로 끈다. 🚫 켜진 척하지 않는다.
   */
  async function toggleReminder() {
    const next = !enabled;
    setEnabled(next);
    const r = await syncReminders(next, time, copy);
    if (r.blocked === 'permission') {
      setEnabled(false);
      setDenied(true);
      return;
    }
    setDenied(false);
  }

  async function pickTime(v: string) {
    setTime(v);
    await syncReminders(enabled, v, copy);
  }

  const group = (text: string, first = false) => (
    <AppText
      variant="label"
      tone="muted"
      style={{ marginTop: first ? 0 : spacing.xl, marginBottom: spacing.sm }}
    >
      {text}
    </AppText>
  );

  return (
    <Screen scroll tab>
      <Header title={t('settings.title')} />

      {group(t('settings.language.title'), true)}

      {/* 🔄 2026-09-18 카드 목록 → 셀렉트(사용자 지시 · `I18N_SYSTEM.md` §2.1). 이름은 그 언어 자신의 표기다(§2.2) */}
      <Select
        title={t('settings.language.title')}
        value={language}
        options={SUPPORTED.map((lang) => ({ value: lang, label: LANGUAGE_NAMES[lang] }))}
        onChange={setLanguage}
      />

      <AppText variant="caption" tone="muted" style={{ marginTop: spacing.md }}>
        {t('settings.language.hint')}
      </AppText>

      {/* 🔴 알림은 기둥 7 의 도달 수단이다. 그런데 **기본값은 꺼짐**이다(`REVIEW_SYSTEM.md` §6.2) */}
      {group(t('reminder.title'))}
      <Row onPress={() => void toggleReminder()}>
        <AppText>{t('reminder.title')}</AppText>
        <AppText tone={enabled ? 'accent' : 'muted'}>
          {enabled ? t('reminder.on') : t('reminder.off')}
        </AppText>
      </Row>

      {enabled && (
        <>
          <AppText variant="caption" tone="muted" style={{ marginTop: spacing.md }}>
            {t('reminder.time')}
          </AppText>
          <ChipRow style={{ marginTop: spacing.sm }}>
            {REMINDER_TIMES.map((v) => (
              <Chip key={v} label={v} active={v === time} onPress={() => void pickTime(v)} />
            ))}
          </ChipRow>
        </>
      )}

      <AppText variant="caption" tone="muted" style={{ marginTop: spacing.md }}>
        {denied ? t('reminder.denied') : t('reminder.hint')}
      </AppText>

      {/* 🔴 백업은 설정 안에 있지만 부가 기능이 아니다 — 결정 #1 의 대가를 닫는 자리다(결정 #15) */}
      {group(t('settings.backup'))}
      <Row onPress={() => router.push('/backup')}>
        <AppText>{t('backup.exportAction')}</AppText>
        {/* 🔴 날짜는 기기 로케일이다. UI 언어가 아니다(`CLAUDE.md` §9) */}
        <AppText variant="caption" tone="muted">
          {lastExportedAt === null ? t('backup.never') : formatDate(lastExportedAt, deviceLocale())}
        </AppText>
      </Row>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
