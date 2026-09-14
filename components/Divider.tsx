import { StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

/** 머리카락 선 한 줄 — `docs/UI_GUIDE.md` §2. 여백은 `style` 로 준다 */
export function Divider({ style }: { style?: ViewStyle }) {
  const { palette } = useTheme();
  return <View style={[styles.line, { backgroundColor: palette.border }, style]} />;
}

const styles = StyleSheet.create({
  line: { height: StyleSheet.hairlineWidth },
});
