import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import type { ActivityLevel } from '@/features/stats/charts';
import { fromDate } from '@/lib/day';
import { useTheme } from '@/theme';

export interface ActivityCell {
  readonly day: string;
  readonly level: ActivityLevel;
}

type Props = {
  /** 7 칸씩 한 줄. `null` 은 그 기간이 아닌 빈칸이다 */
  cells: readonly (ActivityCell | null)[];
  /** 위에 요일 글자를 둘 때(주 · 월). 연간의 작은 달력에는 안 둔다 */
  weekdayLabels?: readonly string[];
  gap?: number;
  accessibilityLabel?: string;
};

/** 단계별 진하기. 🔴 색이 아니라 글자색 한 가지의 농도다(`STATS_SYSTEM.md` §4.2) */
const INK: Record<Exclude<ActivityLevel, 0>, number> = { 1: 0.22, 2: 0.42, 3: 0.66, 4: 0.9 };

/**
 * 활동 달력 칸 — `docs/STATS_SYSTEM.md` §4.2 · `docs/UI_GUIDE.md` §2.
 *
 * 🚫 **빈 날은 빈 칸이다.** 실패 표시도 붉은색도 없다. 연속일 숫자보다 압박이 적은 이유가 그것이다.
 * 오늘 칸에만 테두리를 둔다(판정이 아니라 표시라 여기서 센다).
 */
export function ActivityGrid({ cells, weekdayLabels, gap = 4, accessibilityLabel }: Props) {
  const { palette, radius } = useTheme();
  const today = fromDate(new Date());

  const rows: (ActivityCell | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <View style={{ gap }} accessible={accessibilityLabel !== undefined} accessibilityLabel={accessibilityLabel}>
      {weekdayLabels !== undefined && (
        <View style={[styles.row, { gap }]}>
          {weekdayLabels.map((label) => (
            <AppText key={label} variant="caption" tone="muted" style={styles.head}>
              {label}
            </AppText>
          ))}
        </View>
      )}
      {rows.map((row, r) => (
        <View key={row.find((c) => c !== null)?.day ?? `row-${r}`} style={[styles.row, { gap }]}>
          {row.map((c, i) =>
            c === null ? (
              <View key={`blank-${i}`} style={styles.cell} />
            ) : (
              <View
                key={c.day}
                style={[
                  styles.cell,
                  {
                    borderRadius: radius.sm / 2,
                    borderWidth: c.day === today ? 1 : 0,
                    borderColor: palette.text,
                    overflow: 'hidden',
                  },
                ]}
              >
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    c.level === 0
                      ? { backgroundColor: palette.border }
                      : { backgroundColor: palette.text, opacity: INK[c.level] },
                  ]}
                />
              </View>
            ),
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  cell: { flex: 1, aspectRatio: 1 },
  head: { flex: 1, textAlign: 'center' },
});
