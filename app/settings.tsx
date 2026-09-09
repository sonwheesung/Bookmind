import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { LANGUAGE_NAMES, useLanguageStore } from '@/features/settings/language';
import { SUPPORTED } from '@/lib/i18n';
import { useTheme } from '@/theme';

/**
 * 설정 — 지금은 언어 하나다(`docs/I18N_SYSTEM.md` §2.1 에서 Phase 6 → Phase 2 로 당겼다).
 *
 * 🚫 "시스템 자동" 항목을 두지 않는다(§2). 목록은 지원 언어 그 자체이고,
 *    이름은 **그 언어의 표기 그대로**다 — 번역하면 그 언어만 읽는 사용자가 자기 언어를 못 찾는다.
 */
export default function Settings() {
  const { t } = useTranslation();
  const { palette, spacing, typography } = useTheme();
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);

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
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
