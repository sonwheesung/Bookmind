import { Children, type ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

type Props = {
  children: ReactNode;
  gap?: 'sm' | 'md';
  style?: ViewStyle;
};

/**
 * 버튼을 같은 폭으로 나란히 — `docs/UI_GUIDE.md` §2.
 *
 * 칸마다 `flex: 1` 을 준다. 🔴 `false`·`null` 자식은 칸을 만들지 않는다(조건부 버튼이 빈 칸을 남기지 않게).
 */
export function ButtonRow({ children, gap = 'md', style }: Props) {
  const { spacing } = useTheme();
  return (
    <View style={[styles.row, { gap: spacing[gap] }, style]}>
      {Children.toArray(children).map((child, i) => (
        <View key={i} style={styles.cell}>
          {child}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  cell: { flex: 1 },
});
