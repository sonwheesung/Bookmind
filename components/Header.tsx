import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme';

type Props = {
  title: string;
  /** 뒤로가기를 둘 것인가. 홈에는 없다 */
  back?: boolean;
  right?: React.ReactNode;
};

export function Header({ title, back = false, right }: Props) {
  const { spacing } = useTheme();

  return (
    <View style={[styles.row, { marginBottom: spacing.lg, gap: spacing.sm }]}>
      {back && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="back"
          onPress={() => router.back()}
          hitSlop={12}
        >
          <AppText variant="title" tone="muted">
            {'‹'}
          </AppText>
        </Pressable>
      )}
      <AppText variant="title" style={styles.title} numberOfLines={1}>
        {title}
      </AppText>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1 },
});
