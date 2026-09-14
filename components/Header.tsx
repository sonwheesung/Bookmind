import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { ICON_HIT } from '@/components/IconButton';
import { useTheme } from '@/theme';

type Props = {
  title: string;
  /** 뒤로가기를 둘 것인가. 탭 화면에는 없다 */
  back?: boolean;
  /** 🔴 `IconButton` 만 넣는다(추가 · 저장 · 수정 · 삭제 · 검색 · 통계 · `docs/UI_GUIDE.md` §2) */
  right?: React.ReactNode;
};

export function Header({ title, back = false, right }: Props) {
  const { spacing } = useTheme();

  return (
    // 🔴 줄 높이를 아이콘 자리에 맞춰 둔다. 검색 아이콘이 생기고 사라질 때 제목이 들썩이지 않게
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
      {right !== undefined && <View style={[styles.actions, { gap: spacing.xs }]}>{right}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: ICON_HIT },
  title: { flex: 1 },
  actions: { flexDirection: 'row', alignItems: 'center' },
});
