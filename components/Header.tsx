import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme';

type Props = {
  title: string;
  /** 뒤로가기를 둘 것인가. 홈에는 없다 */
  back?: boolean;
  right?: React.ReactNode;
  /** 🔴 `brand` 는 홈의 앱 이름 한 곳만 쓴다. 상세 화면 제목까지 커지면 콘텐츠가 밀린다(`docs/DESIGN_REVIEW.md` §3) */
  variant?: 'default' | 'brand';
};

export function Header({ title, back = false, right, variant = 'default' }: Props) {
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
      <AppText variant={variant === 'brand' ? 'brand' : 'title'} style={styles.title} numberOfLines={1}>
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
