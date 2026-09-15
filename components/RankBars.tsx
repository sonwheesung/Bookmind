import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme';

export interface RankItem {
  readonly key: string;
  readonly label: string;
  readonly n: number;
}

/**
 * 가로 막대 순위(분야별 · 책별 상위 몇 개) — `docs/STATS_SYSTEM.md` §4.2 · `docs/UI_GUIDE.md` §2.
 *
 * 🚫 파이 차트가 아니다. 항목이 많고 폰 폭이 좁아 조각을 못 읽는다.
 * 막대 길이는 **1위 대비**다. 🔴 순위 번호 · 메달을 붙이지 않는다(비교가 아니라 현황이다).
 */
export function RankBars({ items }: { items: readonly RankItem[] }) {
  const { palette, radius, spacing } = useTheme();
  const max = Math.max(1, ...items.map((i) => i.n));

  return (
    <View style={{ gap: spacing.md }}>
      {items.map((item) => (
        <View key={item.key}>
          <View style={[styles.row, { gap: spacing.sm }]}>
            <AppText numberOfLines={1} style={styles.grow}>
              {item.label}
            </AppText>
            <AppText tone="muted">{String(item.n)}</AppText>
          </View>
          <View
            style={[styles.track, { marginTop: spacing.xs, borderRadius: radius.full, backgroundColor: palette.border }]}
          >
            <View
              style={{
                width: `${(item.n / max) * 100}%` as `${number}%`,
                height: '100%',
                borderRadius: radius.full,
                backgroundColor: palette.text,
                opacity: 0.72,
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1 },
  track: { height: 6, overflow: 'hidden' },
});
