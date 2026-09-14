import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

/** 칩 여러 개를 줄바꿈으로 — `docs/UI_GUIDE.md` §2. 간격은 `spacing.sm` 고정이고 여백은 `style` 로 준다 */
export function ChipRow({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { spacing } = useTheme();
  return <View style={[styles.row, { gap: spacing.sm }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
});
