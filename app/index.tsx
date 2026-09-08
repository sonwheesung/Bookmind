import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { useTheme } from '@/theme';

/**
 * 홈 — "오늘 무엇을 하면 되는가" (`docs/KNOWLEDGE_SYSTEM.md` §7).
 * 🔴 홈은 책장이 아니다. Phase 3 에서 오늘의 복습이 여기 맨 위에 온다.
 *
 * Phase 0 에서는 토큰·i18n·Screen 이 실제로 도는지만 보여준다.
 */
export default function Home() {
  const { t } = useTranslation();
  const { palette, spacing, typography } = useTheme();

  return (
    <Screen>
      <View style={[styles.header, { marginBottom: spacing.xl }]}>
        <Text style={[typography.title, { color: palette.text }]}>{t('app.name')}</Text>
        <Text style={[typography.caption, { color: palette.textMuted, marginTop: spacing.xs }]}>
          {t('app.tagline')}
        </Text>
      </View>

      <View
        style={[
          styles.card,
          {
            backgroundColor: palette.surface,
            borderColor: palette.border,
            borderRadius: 10,
            padding: spacing.lg,
          },
        ]}
      >
        <Text style={[typography.label, { color: palette.textMuted }]}>{t('home.today.title')}</Text>
        <Text style={[typography.body, { color: palette.text, marginTop: spacing.sm }]}>
          {t('home.today.empty')}
        </Text>
      </View>

      <Text style={[typography.caption, { color: palette.textMuted, marginTop: spacing.xl }]}>
        {t('knowledge.save.hint')}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 8 },
  card: { borderWidth: 1 },
});
