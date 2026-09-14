import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { WeekRow } from '@/components/WeekRow';
import { parseRepeat } from '@/features/practice/compute';
import { listAll, listToday, toggleCheck, type PracticeCard } from '@/features/practice/repo';
import { useDbQuery } from '@/hooks/useDbQuery';
import { joinMeta } from '@/lib/format';
import { useTheme } from '@/theme';

/**
 * 실천 탭 — `docs/PRACTICE_SYSTEM.md` §3 · §8 · 결정 #26.
 *
 * 🔄 2026-09-14 홈의 "오늘의 실천"(월~일 칸)을 여기로 옮겼다. 위는 오늘 체크할 것, 아래는 나머지다.
 * 🚫 성공률·달성 그래프를 두지 않는다(§4). 실천은 평가 대상이 아니다.
 * 🔴 `종료됨` 은 저장된 값이 아니라 **오늘과 견준 결과**다(§2.1).
 */
export default function PracticeTab() {
  const { t } = useTranslation();
  const { spacing } = useTheme();

  const { data, reload } = useDbQuery(() => ({ today: listToday(), all: listAll() }));

  const todayIds = new Set(data.today.map((p) => p.id));
  // 아직 시작 전인 실천 — 오늘 칸에는 없고 끝난 것도 아니다
  const upcoming = data.all.filter(
    (p) => !todayIds.has(p.id) && p.state !== 'ended' && p.state !== 'stopped',
  );
  const closed = data.all.filter((p) => p.state === 'ended' || p.state === 'stopped');

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
    <Screen scroll tab>
      <Header title={t('practice.title')} />

      <Button
        label={t('practice.create')}
        onPress={() => router.push('/practice/new')}
        style={{ marginBottom: spacing.xl }}
      />

      {data.all.length === 0 ? (
        /* 🔴 실천이 0개인 것은 결핍이 아니다(기둥 4). 만들라고 밀지 않는다 */
        <AppText tone="muted">{t('practice.empty')}</AppText>
      ) : (
        <>
          {/* ── 오늘의 실천 ────────────────────────────────────────────
              🔴 **진행 중인 실천이 0개면 이 절을 통째로 안 그린다**(§3). 빈 상자를 두면 할 일 목록이 된다.
              🚫 "오늘 끊깁니다" 류 문구를 붙이지 않는다(§4 · 기둥 5). */}
          {data.today.length > 0 && (
            <View style={{ marginBottom: spacing.section }}>
              <AppText variant="section" style={{ marginBottom: spacing.md }}>
                {t('practice.todayTitle')}
              </AppText>

              {data.today.map((p, i) => (
                <View key={p.id} style={{ marginTop: i > 0 ? spacing.xl : 0 }}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => router.push(`/practice/${p.id}`)}
                    style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                  >
                    <AppText variant="thought" numberOfLines={2}>
                      {p.title}
                    </AppText>
                  </Pressable>
                  <View style={{ marginTop: spacing.sm }}>
                    <WeekRow
                      cells={p.cells}
                      onToggle={(day) => {
                        // 🔴 `day` 는 누른 칸의 날짜다. "오늘"로 넘기면 아무 날이나 오늘이 된다
                        toggleCheck(p.id, day);
                        reload();
                      }}
                    />
                  </View>
                  {p.streak > 0 && (
                    <AppText variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>
                      {t('practice.streak', { count: p.streak })}
                    </AppText>
                  )}
                </View>
              ))}
            </View>
          )}

          {upcoming.map(row)}

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
