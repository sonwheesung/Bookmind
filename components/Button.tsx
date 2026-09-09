import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

type Variant = 'primary' | 'ghost' | 'danger';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  style?: ViewStyle;
};

/** 🔴 `danger` 는 되돌릴 수 없는 동작에만 — 실패·미달성 표시에 쓰지 않는다(기둥 5, `theme/tokens.ts`). */
export function Button({ label, onPress, variant = 'primary', disabled = false, style }: Props) {
  const { palette, radius, spacing, typography } = useTheme();

  const bg = variant === 'primary' ? palette.accent : variant === 'danger' ? palette.danger : 'transparent';
  const fg = variant === 'ghost' ? palette.text : variant === 'danger' ? palette.onAccent : palette.onAccent;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bg,
          borderColor: variant === 'ghost' ? palette.border : bg,
          borderRadius: radius.md,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      <Text style={[typography.label, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', borderWidth: 1 },
});
