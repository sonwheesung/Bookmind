import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Divider } from '@/components/Divider';
import { niceMax } from '@/features/stats/charts';
import { useTheme } from '@/theme';

type Props = {
  values: readonly number[];
  /** 막대 아래 글자. `null` 인 자리는 비운다(월 31개에 전부 쓰면 겹친다) */
  labels: readonly (string | null)[];
  accessibilityLabel: string;
};

const PLOT_HEIGHT = 88;
const LABEL_WIDTH = 40;

/**
 * 세로 막대 — `docs/STATS_SYSTEM.md` §4.2 · `docs/UI_GUIDE.md` §2.
 *
 * 🔴 축 맨 위 값은 **깔끔한 수**다(`niceMax`). 데이터 최대값을 그대로 쓰면 `7` · `13` 같은 축이 된다.
 * 🔴 색은 글자색 한 가지다. 🚫 목표선 · 평균선 · 신호등 색이 없다(기둥 5).
 * 0 인 날은 막대가 없고 바닥 선만 남는다.
 */
export function BarChart({ values, labels, accessibilityLabel }: Props) {
  const { palette, radius, spacing } = useTheme();
  const top = niceMax(Math.max(0, ...values));
  const gap = values.length > 12 ? 1 : 4;

  return (
    <View accessible accessibilityLabel={accessibilityLabel}>
      <View style={styles.axis}>
        <AppText variant="caption" tone="muted">
          {String(top)}
        </AppText>
      </View>
      <View style={[styles.plot, { height: PLOT_HEIGHT, borderTopColor: palette.divider }]}>
        {values.map((v, i) => (
          <View key={`bar-${i}`} style={[styles.slot, { paddingHorizontal: gap / 2 }]}>
            {v > 0 && top > 0 && (
              <View
                style={{
                  height: Math.max(2, (v / top) * PLOT_HEIGHT),
                  backgroundColor: palette.text,
                  opacity: 0.72,
                  borderTopLeftRadius: radius.sm / 2,
                  borderTopRightRadius: radius.sm / 2,
                }}
              />
            )}
          </View>
        ))}
      </View>
      <Divider />
      <View style={[styles.labels, { marginTop: spacing.xs }]}>
        {labels.map((label, i) =>
          label === null ? null : (
            <AppText
              key={`label-${i}`}
              variant="caption"
              tone="muted"
              numberOfLines={1}
              style={[styles.label, { left: `${((i + 0.5) / Math.max(1, values.length)) * 100}%` as `${number}%` }]}
            >
              {label}
            </AppText>
          ),
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  axis: { alignItems: 'flex-end' },
  plot: { flexDirection: 'row', alignItems: 'flex-end', borderTopWidth: 1 },
  slot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  labels: { height: 16 },
  label: { position: 'absolute', width: LABEL_WIDTH, marginLeft: -LABEL_WIDTH / 2, textAlign: 'center' },
});
