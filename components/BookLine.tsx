import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme';

type Props = {
  book: { title: string };
  /** 제목 아래 한 줄(저자 · 읽기 상태). 🚫 비어 있으면 줄을 만들지 않는다 */
  caption?: string | null;
};

/**
 * 제목 + 한 줄 설명 — `docs/UI_GUIDE.md` §2. 책 목록과 책 고르기가 같은 모양을 쓴다.
 *
 * 🔄 2026-09-14 표지 자리(첫 글자 + 색 상자)를 지웠다(사용자 선택 · `DESIGN_REVIEW.md` §3).
 *    표지를 저장하는 곳이 없는데 사진을 넣는 자리처럼 보였다.
 */
export function BookLine({ book, caption }: Props) {
  const { spacing } = useTheme();

  return (
    <View>
      <AppText numberOfLines={2}>{book.title}</AppText>
      {caption != null && caption !== '' && (
        <AppText variant="caption" tone="muted" numberOfLines={1} style={{ marginTop: spacing.xs }}>
          {caption}
        </AppText>
      )}
    </View>
  );
}
