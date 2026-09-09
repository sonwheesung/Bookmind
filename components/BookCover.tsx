import { StyleSheet, Text, View } from 'react-native';

import { coverColorOf, coverLetter } from '@/features/books/cover';
import { useTheme } from '@/theme';

type Props = {
  book: { title: string; cover_color: string | null };
  size?: 'sm' | 'md';
};

/**
 * 책 표지 자리표시자 — 제목 첫 글자 + 고정 색(`docs/DESIGN_REVIEW.md` §3).
 *
 * 🔴 **이미지 파일이 없다.** `View` 배경색 + `Text` 한 글자가 전부다.
 * 🔴 글자는 **시스템 폰트 그대로** — 어떤 언어의 책이 와도 두부(□)가 안 된다(결정 #13).
 */
export function BookCover({ book, size = 'md' }: Props) {
  const { palette, radius, typography } = useTheme();
  const w = size === 'sm' ? 34 : 48;
  const h = size === 'sm' ? 48 : 68;

  return (
    <View
      style={[
        styles.box,
        {
          width: w,
          height: h,
          borderRadius: radius.sm,
          backgroundColor: coverColorOf(book),
          borderColor: palette.border,
        },
      ]}
    >
      {/* 🚫 색에 의미를 주지 않는다 — 글자는 언제나 진한 텍스트색이다 */}
      <Text
        style={[size === 'sm' ? typography.body : typography.title, { color: '#1C1A17' }]}
        numberOfLines={1}
      >
        {coverLetter(book.title)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
});
