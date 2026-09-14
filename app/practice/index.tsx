import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { parseRepeat } from '@/features/practice/compute';
import { listAll, type PracticeCard } from '@/features/practice/repo';
import { useDbQuery } from '@/hooks/useDbQuery';
import { joinMeta } from '@/lib/format';
import { useTheme } from '@/theme';

/**
 * 실천 목록 — `docs/PRACTICE_SYSTEM.md` §8.
 *
 * 🚫 성공률·달성 그래프를 두지 않는다(§4). 실천은 평가 대상이 아니다.
 * 🔴 `종료됨` 은 저장된 값이 아니라 **오늘과 견준 결과**다(§2.1).
 */
export default function PracticeList() {
  const { t } = useTranslation();
  const { spacing } = useTheme();

  const { data } = useDbQuery(() => listAll());

  const running = data.filter((p) => p.state === 'running' || p.state === 'upcoming');
  const closed = data.filter((p) => p.state === 'ended' || p.state === 'stopped');

  const row = (p: PracticeCard) => (
    <Card key={p.id} onPress={() => router.push(`/practice/${p.id}`)}>
      <AppText variant="thought" numberOfLines={3}>
        {p.title}
      </AppText>
      <AppText variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>
        {joinMeta([
          // 🔴 반복 주기 판정은 `parseRepeat` 한 곳이다. 화면에서 문자열로 다시 가르지 않는다
          t(`practice.repeat.${parseRepeat(p.repeatRule).kind}`),
          p.state === 'running' ? null : t(`practice.state.${p.state}`),
          // 🚫 연속일이 0 이면 그 조각을 아예 안 붙인다(§8)
          p.streak > 0 ? t('practice.streak', { count: p.streak }) : null,
        ])}
      </AppText>
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
        <AppText tone="muted">{t('practice.empty')}</AppText>
      ) : (
        <>
          {running.map(row)}

          {closed.length > 0 && (
            <View style={{ marginTop: spacing.xl }}>
              <AppText variant="section" style={{ marginBottom: spacing.sm }}>
                {t('practice.closedTitle')}
              </AppText>
              {closed.map(row)}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}
