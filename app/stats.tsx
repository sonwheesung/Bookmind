import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { loadStats, loadTagDistribution } from '@/features/stats/repo';
import { useDbQuery } from '@/hooks/useDbQuery';
import { useTheme } from '@/theme';

/**
 * 통계 — `docs/STATS_SYSTEM.md` §4.
 *
 * 🔴 **기억률은 성취가 아니라 현황이다.** 낮다고 붉게 칠하지 않고 높다고 칭찬하지 않는다.
 *    숫자 옆에 형용사를 붙이지 않는다(§1). 색은 이 화면에 하나도 없다.
 * 🔴 **복습이 0회면 기억률 줄을 아예 안 그린다.** `0%` 는 사실이 아니고 기분만 나쁘다(§3.2).
 * 🔴 모든 수는 **매번 센다.** 캐시 표를 만들지 않는다(§2).
 */
export default function StatsScreen() {
  const { t } = useTranslation();
  const { palette, spacing, typography } = useTheme();

  const { data } = useDbQuery(() => ({
    totals: loadStats(),
    tags: loadTagDistribution(),
  }));

  const { totals, tags } = data;
  const empty = totals.knowledge === 0 && totals.books === 0;

  const label = [typography.label, { color: palette.textMuted }];
  const value = [typography.body, { color: palette.text }];

  const rows: { key: string; text: string }[] = [
    {
      key: 'saved',
      text: t('stats.savedValue', {
        knowledge: totals.knowledge,
        books: totals.books,
        thoughts: totals.thoughts,
      }),
    },
  ];

  // 🚫 복습 0회에 `0회 · 기억률 0%` 를 만들지 않는다. 줄 자체가 없다
  // 🔴 `retention` 은 복습이 0회일 때만 null 이라 두 조건이 늘 같이 참이거나 같이 거짓이다.
  //    그래도 둘 다 적는다. 타입이 그걸 요구하고, 한쪽 규칙이 바뀌어도 화면이 안 깨진다
  if (totals.reviews > 0 && totals.retention !== null) {
    rows.push({
      key: 'review',
      text: t('stats.reviewValue', {
        count: totals.reviews,
        percent: Math.round(totals.retention * 100),
      }),
    });
  }

  // 🚫 `연속 0일` 을 쓰지 않는다(§4.1). 0 을 적으면 다음에 압박 문구가 붙는다
  if (totals.streak > 0) {
    rows.push({ key: 'streak', text: t('stats.streakValue', { count: totals.streak }) });
  }

  return (
    <Screen scroll>
      <Header title={t('stats.title')} back />

      {empty ? (
        /* 🚫 `문장 0 · 책 0` 을 크게 보여주지 않는다. 성취 대시보드가 된다(§4) */
        <Text style={[typography.body, { color: palette.textMuted }]}>{t('stats.empty')}</Text>
      ) : (
        <>
          {rows.map((r) => (
            <View key={r.key} style={[styles.row, { marginBottom: spacing.lg }]}>
              <Text style={[...label, styles.rowLabel]}>{t(`stats.label.${r.key}`)}</Text>
              <Text style={[...value, styles.rowValue]}>{r.text}</Text>
            </View>
          ))}

          {/* 태그가 하나도 없으면 이 절을 **아예 안 그린다**. 빈 상자를 만들지 않는다(§6) */}
          {tags.length > 0 && (
            <>
              <View
                style={{
                  height: StyleSheet.hairlineWidth,
                  backgroundColor: palette.border,
                  marginVertical: spacing.lg,
                }}
              />
              <Text style={[typography.section, { color: palette.text, marginBottom: spacing.sm }]}>
                {t('stats.tags')}
              </Text>
              <Text style={[typography.body, { color: palette.text }]}>
                {tags.map((g) => `${g.name} ${g.n}`).join(' · ')}
              </Text>
            </>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  rowLabel: { width: 96 },
  rowValue: { flex: 1 },
});
