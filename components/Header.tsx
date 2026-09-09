import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme';

type Props = {
  title: string;
  /** 뒤로가기를 둘 것인가. 홈에는 없다 */
  back?: boolean;
  right?: React.ReactNode;
};

export function Header({ title, back = false, right }: Props) {
  const { palette, spacing, typography } = useTheme();

  return (
    <View style={[styles.row, { marginBottom: spacing.lg, gap: spacing.sm }]}>
      {back && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="back"
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Text style={[typography.title, { color: palette.textMuted }]}>{'‹'}</Text>
        </Pressable>
      )}
      <Text style={[typography.title, styles.title, { color: palette.text }]} numberOfLines={1}>
        {title}
      </Text>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1 },
});
