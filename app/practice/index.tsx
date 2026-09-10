import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { listAll, type PracticeCard } from '@/features/practice/repo';
import { useDbQuery } from '@/hooks/useDbQuery';
import { useTheme } from '@/theme';

/**
 * 실천 목록 — `docs/PRACTICE_SYSTEM.md` §8.
 *
 * 🚫 성공률·달성 그래프를 두지 않는다(§4). 실천은 평가 대상이 아니다.
 * 🔴 `종료됨` 은 저장된 값이 아니라 **오늘과 견준 결과**다(§2.1).
 */
export default function PracticeList() {
  const { t } = useTranslation();
  const { palette, spacing, typography } = useTheme();

  const { data } = useDbQuery(() => listAll());

  const running = data.filter((p) => p.state === 'running' || p.state === 'upcoming');
  const closed = data.filter((p) => p.state === 'ended' || p.state === 'stopped');

  const row = (p: PracticeCard) => (
    <Card key={p.id} onPress={() => router.push(`/practice/${p.id}`)}>
      <Text style={[typography.thought, { color: palette.text }]} numberOfLines={3}>
        {p.title}
      </Text>
      <Text style={[typography.caption, { color: palette.textMuted, marginTop: spacing.sm }]}>
        {[
          t(`practice.repeat.${p.repeatRule.startsWith('weekly:') ? 'weekly' : p.repeatRule}`),
          p.state === 'running' ? null : t(`practice.state.${p.state}`),
          // 🚫 연속일이 0 이면 그 조각을 아예 안 붙인다(§8)
          p.streak > 0 ? t('practice.streak', { count: p.streak }) : null,
        ]
          .filter((v) => v !== null)
          .join(' · ')}
      </Text>
    </Card>
  );

  return (
    <Screen scroll>
      <Header title={t('practice.title')} back />

      <Button
        label={t('practice.create')}
        onPress={() => router.push('/practice/new')}
        style={{ marginBottom: spacing.xl }}
      />

      {data.length === 0 ? (
        /* 🔴 실천이 0개인 것은 결핍이 아니다(기둥 4). 만들라고 밀지 않는다 */
        <Text style={[typography.body, { color: palette.textMuted }]}>{t('practice.empty')}</Text>
      ) : (
        <>
          {running.map(row)}

          {closed.length > 0 && (
            <View style={{ marginTop: spacing.xl }}>
              <Text style={[typography.section, { color: palette.text, marginBottom: spacing.sm }]}>
                {t('practice.closedTitle')}
              </Text>
              {closed.map(row)}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}
