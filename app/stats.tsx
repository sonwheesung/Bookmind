import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ActivityGrid, type ActivityCell } from '@/components/ActivityGrid';
import { AppText } from '@/components/AppText';
import { BarChart } from '@/components/BarChart';
import { Chip } from '@/components/Chip';
import { ChipRow } from '@/components/ChipRow';
import { Divider } from '@/components/Divider';
import { Header } from '@/components/Header';
import { IconButton } from '@/components/IconButton';
import { RankBars } from '@/components/RankBars';
import { Screen } from '@/components/Screen';
import { DAILY_LIMIT } from '@/features/review/queue';
import { useStatsPeriodStore } from '@/features/settings/stats-period';
import {
  activityLevel,
  chartsReady,
  clampPeriod,
  forecast,
  monthGrid,
  periodBounds,
  periodBuckets,
  periodEnd,
  shiftPeriod,
  STATS_PERIODS,
  sumBuckets,
  tallyIn,
  type Bucket,
} from '@/features/stats/charts';
import { retentionRate } from '@/features/stats/compute';
import { loadBookDistribution, loadChartSource, loadStats, loadTagDistribution } from '@/features/stats/repo';
import { useDbQuery } from '@/hooks/useDbQuery';
import { WEEKDAY_KEYS, daysBetween, fromDate, isoWeekday, monthOf } from '@/lib/day';
import { formatDayShort, formatMonth, formatMonthShort, formatYear, joinMeta } from '@/lib/format';
import { deviceLocale } from '@/lib/i18n';
import { useTheme } from '@/theme';

/** 다가올 복습을 며칠 볼까. 주는 한 주, 월 · 년은 한 달 */
const FORECAST_DAYS = { week: 7, month: 30, year: 30 } as const;
/** 분야별 · 책별 몇 개까지 */
const RANK_LIMIT = 5;

/**
 * 통계 — `docs/STATS_SYSTEM.md` §4 · §4.2.
 *
 * 🔴 **기억률은 성취가 아니라 현황이다.** 낮다고 붉게 칠하지 않고 높다고 칭찬하지 않는다(§1).
 * 🔴 **복습이 0회면 기억률을 아예 안 쓴다.** `0%` 는 사실이 아니고 기분만 나쁘다(§3.2).
 * 🔴 모든 수는 **매번 센다.** 캐시 표를 만들지 않는다(§2).
 * 🔄 2026-09-15 차트를 넣었다(사용자 지시 · 추천안). 기간 주 · 월 · 년 · 활동 달력 · 저장/복습 막대 ·
 *    다가올 복습 · 분야별/책별 순위. 🔴 활동한 날이 7일이 되기 전에는 차트를 안 그린다(§4.2).
 */
export default function StatsScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const period = useStatsPeriodStore((s) => s.period);
  const setPeriod = useStatsPeriodStore((s) => s.setPeriod);
  // 🔴 고른 기간이 없으면 이번 기간이다. 기간 칩을 바꾸면 이번 기간으로 돌아온다
  const [wanted, setWanted] = useState<string | null>(null);

  const { data } = useDbQuery(() => ({
    totals: loadStats(),
    tags: loadTagDistribution(RANK_LIMIT),
    books: loadBookDistribution(RANK_LIMIT),
    chart: loadChartSource(),
  }));

  const { totals, tags, books, chart } = data;
  const empty = totals.knowledge === 0 && totals.books === 0;
  const lang = deviceLocale();
  const today = fromDate(new Date());

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

  // ── 기간 ──
  const ready = chartsReady(chart.activityDays.size);
  const bounds = periodBounds(period, chart.firstDay, today);
  const start = clampPeriod(period, wanted, bounds);
  const end = periodEnd(period, start);
  const saveBuckets = periodBuckets(period, start, chart.saveDays);
  const reviewBuckets = periodBuckets(period, start, chart.reviewDays);
  const savedN = sumBuckets(saveBuckets);
  const reviewedN = sumBuckets(reviewBuckets);
  const tally = tallyIn(chart.marks, start, end);
  const retention = retentionRate(tally.total, tally.again);
  // 🚫 0 인 조각은 안 붙인다(`joinMeta`). 전부 비면 중립 문장 하나
  const summary = joinMeta([
    savedN > 0 ? t('stats.period.saved', { count: savedN }) : null,
    reviewedN > 0 ? t('stats.period.reviewed', { count: reviewedN }) : null,
    retention !== null ? t('stats.period.retention', { percent: Math.round(retention * 100) }) : null,
  ]);
  // 🔴 오늘의 복습과 같은 상한으로 흘린다. 첫 막대가 홈의 복습 수와 같아야 한다(§4.2)
  const upcoming = forecast(chart.dueDays, today, FORECAST_DAYS[period], DAILY_LIMIT);

  const weekday = (day: string) => t(`practice.weekday.${WEEKDAY_KEYS[isoWeekday(day) - 1] ?? 'mon'}`);
  const weekdayLabels = WEEKDAY_KEYS.map((key) => t(`practice.weekday.${key}`));
  const cellOf = (day: string): ActivityCell => ({ day, level: activityLevel(chart.activityDays.get(day) ?? 0) });
  const activeInPeriod = daysBetween(start, end).filter((d) => (chart.activityDays.get(d) ?? 0) > 0).length;

  const periodLabel =
    period === 'week'
      ? `${formatDayShort(start, lang)} – ${formatDayShort(end, lang)}`
      : period === 'month'
        ? formatMonth(monthOf(start), lang)
        : formatYear(start.slice(0, 4), lang);

  const barLabels = (buckets: readonly Bucket[]) =>
    buckets.map((b, i) => {
      if (period === 'week') return weekday(b.key);
      if (period === 'month') return i % 7 === 0 ? String(i + 1) : null;
      return i % 3 === 0 ? formatMonthShort(b.key, lang) : null;
    });
  const forecastLabels = upcoming.map((b, i) => {
    if (i === 0) return t('stats.forecast.today');
    if (period === 'week') return weekday(b.key);
    return i % 7 === 0 ? t('stats.forecast.plusDays', { count: i }) : null;
  });

  return (
    <Screen scroll>
      <Header title={t('stats.title')} back />

      {empty ? (
        /* 🚫 `문장 0 · 책 0` 을 크게 보여주지 않는다. 성취 대시보드가 된다(§4) */
        <AppText tone="muted">{t('stats.empty')}</AppText>
      ) : (
        <>
          {/* 🔴 활동한 날이 7일 미만이면 이 절 전체를 안 그린다. 텅 빈 차트는 미완성으로 보인다(§4.2) */}
          {ready && (
            <>
              <ChipRow style={{ marginBottom: spacing.md }}>
                {STATS_PERIODS.map((p) => (
                  <Chip
                    key={p}
                    label={t(`stats.period.${p}`)}
                    active={p === period}
                    onPress={() => {
                      setPeriod(p);
                      setWanted(null);
                    }}
                  />
                ))}
              </ChipRow>

              <View style={[styles.nav, { marginBottom: spacing.xs }]}>
                <IconButton
                  icon={ChevronLeft}
                  label={t('stats.nav.prev')}
                  onPress={() => setWanted(shiftPeriod(period, start, -1))}
                  disabled={start <= bounds.first}
                />
                <AppText variant="section" style={styles.center}>
                  {periodLabel}
                </AppText>
                <IconButton
                  icon={ChevronRight}
                  label={t('stats.nav.next')}
                  onPress={() => setWanted(shiftPeriod(period, start, 1))}
                  disabled={start >= bounds.last}
                />
              </View>
              <AppText tone="muted" style={[styles.center, { marginBottom: spacing.xl }]}>
                {summary === '' ? t('stats.period.none') : summary}
              </AppText>

              <AppText variant="label" tone="muted" style={{ marginBottom: spacing.sm }}>
                {t('stats.chart.activity')}
              </AppText>
              {period === 'year' ? (
                <View
                  style={[styles.months, { rowGap: spacing.lg }]}
                  accessible
                  accessibilityLabel={t('stats.chart.activeDays', { count: activeInPeriod })}
                >
                  {saveBuckets.map((b) => (
                    <View key={b.key} style={styles.month}>
                      <AppText variant="caption" tone="muted" style={{ marginBottom: spacing.xs }}>
                        {formatMonthShort(b.key, lang)}
                      </AppText>
                      <ActivityGrid cells={monthGrid(b.key).map((d) => (d === null ? null : cellOf(d)))} gap={2} />
                    </View>
                  ))}
                </View>
              ) : (
                <ActivityGrid
                  cells={
                    period === 'month'
                      ? monthGrid(monthOf(start)).map((d) => (d === null ? null : cellOf(d)))
                      : daysBetween(start, end).map(cellOf)
                  }
                  weekdayLabels={weekdayLabels}
                  accessibilityLabel={t('stats.chart.activeDays', { count: activeInPeriod })}
                />
              )}

              {/* 그 기간 합이 0 이면 그 차트를 안 그린다. 바닥 선만 있는 빈 차트를 만들지 않는다 */}
              {savedN > 0 && (
                <View style={{ marginTop: spacing.xl }}>
                  <AppText variant="label" tone="muted" style={{ marginBottom: spacing.xs }}>
                    {t('stats.chart.saved')}
                  </AppText>
                  <BarChart
                    values={saveBuckets.map((b) => b.value)}
                    labels={barLabels(saveBuckets)}
                    accessibilityLabel={joinMeta([t('stats.chart.saved'), String(savedN)])}
                  />
                </View>
              )}
              {reviewedN > 0 && (
                <View style={{ marginTop: spacing.xl }}>
                  <AppText variant="label" tone="muted" style={{ marginBottom: spacing.xs }}>
                    {t('stats.chart.reviewed')}
                  </AppText>
                  <BarChart
                    values={reviewBuckets.map((b) => b.value)}
                    labels={barLabels(reviewBuckets)}
                    accessibilityLabel={joinMeta([t('stats.chart.reviewed'), String(reviewedN)])}
                  />
                </View>
              )}

              {sumBuckets(upcoming) > 0 && (
                <>
                  <Divider style={{ marginVertical: spacing.xl }} />
                  <AppText variant="section" style={{ marginBottom: spacing.sm }}>
                    {t('stats.forecast.title')}
                  </AppText>
                  <BarChart
                    values={upcoming.map((b) => b.value)}
                    labels={forecastLabels}
                    accessibilityLabel={joinMeta([t('stats.forecast.title'), String(sumBuckets(upcoming))])}
                  />
                </>
              )}

              <Divider style={{ marginVertical: spacing.xl }} />
              <AppText variant="section" style={{ marginBottom: spacing.md }}>
                {t('stats.total')}
              </AppText>
            </>
          )}

          {rows.map((r) => (
            <View key={r.key} style={[styles.row, { marginBottom: spacing.lg }]}>
              <AppText variant="label" tone="muted" style={styles.rowLabel}>
                {t(`stats.label.${r.key}`)}
              </AppText>
              <AppText style={styles.rowValue}>{r.text}</AppText>
            </View>
          ))}

          {/* 태그가 하나도 없으면 이 절을 **아예 안 그린다**. 빈 상자를 만들지 않는다(§6) */}
          {tags.length > 0 && (
            <>
              <Divider style={{ marginVertical: spacing.lg }} />
              <AppText variant="section" style={{ marginBottom: spacing.md }}>
                {t('stats.tags')}
              </AppText>
              <RankBars items={tags.map((g) => ({ key: g.name, label: g.name, n: g.n }))} />
            </>
          )}

          {books.length > 0 && (
            <>
              <Divider style={{ marginVertical: spacing.lg }} />
              <AppText variant="section" style={{ marginBottom: spacing.md }}>
                {t('stats.books')}
              </AppText>
              <RankBars items={books.map((b) => ({ key: b.id, label: b.name, n: b.n }))} />
            </>
          )}
          <View style={{ height: spacing.xl }} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center' },
  center: { flex: 1, textAlign: 'center' },
  months: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  month: { width: '30%' },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  rowLabel: { width: 96 },
  rowValue: { flex: 1 },
});
