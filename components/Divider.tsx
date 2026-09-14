import { StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

/**
 * 구분선 한 줄 — `docs/UI_GUIDE.md` §2. 여백은 `style` 로 준다.
 *
 * 🔄 2026-09-14 머리카락 선(`hairlineWidth` · 카드 테두리색 `border`)이 **너무 희미해서 안 보였다**(사용자 지적).
 *    1dp · 한 단계 진한 `divider` 색으로 바꿨다. 카드 테두리는 그대로다(카드가 무거워진다).
 */
export function Divider({ style }: { style?: ViewStyle }) {
  const { palette } = useTheme();
  return <View style={[styles.line, { backgroundColor: palette.divider }, style]} />;
}

const styles = StyleSheet.create({
  line: { height: 1 },
});
