import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BookCover } from '@/components/BookCover';
import { useTheme } from '@/theme';

type Props = {
  book: { title: string; cover_color: string | null };
  /** 제목 아래 한 줄(저자 · 읽기 상태). 🚫 비어 있으면 줄을 만들지 않는다 */
  caption?: string | null;
};

/** 표지 + 제목 + 한 줄 설명 — `docs/UI_GUIDE.md` §2. 책 목록과 책 고르기가 같은 모양을 쓴다 */
export function BookLine({ book, caption }: Props) {
  const { spacing } = useTheme();

  return (
    <View style={[styles.row, { gap: spacing.md }]}>
      <BookCover book={book} size="sm" />
      <View style={styles.grow}>
        <AppText numberOfLines={2}>{book.title}</AppText>
        {caption != null && caption !== '' && (
          <AppText variant="caption" tone="muted" numberOfLines={1} style={{ marginTop: spacing.xs }}>
            {caption}
          </AppText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1 },
});
