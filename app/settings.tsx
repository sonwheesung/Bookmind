import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { useBackupStore } from '@/features/backup/store';
import { REMINDER_TIMES } from '@/features/review/notify';
import { syncReminders } from '@/features/review/reminder';
import { LANGUAGE_NAMES, useLanguageStore } from '@/features/settings/language';
import { useReminderStore } from '@/features/settings/reminder';
import { SUPPORTED } from '@/lib/i18n';
import { useTheme } from '@/theme';

/**
 * 설정 — 지금은 언어 하나다(`docs/I18N_SYSTEM.md` §2.1 에서 Phase 6 → Phase 2 로 당겼다).
 *
 * 🚫 "시스템 자동" 항목을 두지 않는다(§2). 목록은 지원 언어 그 자체이고,
 *    이름은 **그 언어의 표기 그대로**다 — 번역하면 그 언어만 읽는 사용자가 자기 언어를 못 찾는다.
 */
export default function Settings() {
  const { t, i18n } = useTranslation();
  const { palette, spacing, typography } = useTheme();
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

  return (
    <Screen scroll>
      <Header title={t('settings.title')} back />

      <Text style={[typography.label, { color: palette.textMuted, marginBottom: spacing.sm }]}>
        {t('settings.language.title')}
      </Text>

      {SUPPORTED.map((lang) => {
        const active = lang === language;
        return (
          <Card key={lang} onPress={() => setLanguage(lang)}>
            <View style={styles.row}>
              <Text style={[typography.body, { color: palette.text }]}>{LANGUAGE_NAMES[lang]}</Text>
              {active && (
                <Text style={[typography.body, { color: palette.accent }]} accessibilityLabel="selected">
                  ✓
                </Text>
              )}
            </View>
          </Card>
        );
      })}

      <Text style={[typography.caption, { color: palette.textMuted, marginTop: spacing.md }]}>
        {t('settings.language.hint')}
      </Text>

      {/* 🔴 알림은 기둥 7 의 도달 수단이다. 그런데 **기본값은 꺼짐**이다(`REVIEW_SYSTEM.md` §6.2) */}
      <Text
        style={[
          typography.label,
          { color: palette.textMuted, marginTop: spacing.xl, marginBottom: spacing.sm },
        ]}
      >
        {t('reminder.title')}
      </Text>
      <Card onPress={() => void toggleReminder()}>
        <View style={styles.row}>
          <Text style={[typography.body, { color: palette.text }]}>{t('reminder.title')}</Text>
          <Text style={[typography.body, { color: enabled ? palette.accent : palette.textMuted }]}>
            {enabled ? t('reminder.on') : t('reminder.off')}
          </Text>
        </View>
      </Card>

      {enabled && (
        <>
          <Text style={[typography.caption, { color: palette.textMuted, marginTop: spacing.md }]}>
            {t('reminder.time')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm }}>
            {REMINDER_TIMES.map((v) => (
              <Chip key={v} label={v} active={v === time} onPress={() => void pickTime(v)} />
            ))}
          </View>
        </>
      )}

      <Text style={[typography.caption, { color: palette.textMuted, marginTop: spacing.md }]}>
        {denied ? t('reminder.denied') : t('reminder.hint')}
      </Text>

      {/* 🔴 백업은 설정 안에 있지만 부가 기능이 아니다 — 결정 #1 의 대가를 닫는 자리다(결정 #15) */}
      <Text
        style={[
          typography.label,
          { color: palette.textMuted, marginTop: spacing.xl, marginBottom: spacing.sm },
        ]}
      >
        {t('settings.backup')}
      </Text>
      <Card onPress={() => router.push('/backup')}>
        <View style={styles.row}>
          <Text style={[typography.body, { color: palette.text }]}>{t('backup.exportAction')}</Text>
          <Text style={[typography.caption, { color: palette.textMuted }]}>
            {lastExportedAt === null
              ? t('backup.never')
              : new Date(lastExportedAt).toLocaleDateString(i18n.language)}
          </Text>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
