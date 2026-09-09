import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

type Props = {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
};

/** 목록 행·상세 블록의 공용 상자. 화면마다 borderWidth 를 다시 쓰지 않게 한다. */
export function Card({ children, onPress, style }: Props) {
  const { palette, radius, spacing } = useTheme();

  const box: ViewStyle = {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
  };

  if (onPress === undefined) return <View style={[styles.box, box, style]}>{children}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.box, box, { opacity: pressed ? 0.7 : 1 }, style]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1 },
});
