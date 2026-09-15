import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme';

type Props = {
  label: string;
  active?: boolean;
  onPress: () => void;
  /** 라벨 뒤에 붙는 표식(제거 `×` 등). 🔴 라벨과 **별도 요소**여야 한다 — 아래 참조 */
  trailing?: string;
  accessibilityLabel?: string;
  /**
   * 조용한 칩 — 골라도 **accent 로 채우지 않는다.** 고른 칩은 글자색 테두리 + 글자색, 나머지는 흐린 글자다.
   * 🔴 같은 화면에 accent 칩 줄이 이미 있을 때 그 아래 둘째 고르기에만 쓴다(한 화면 accent 하나 · 2026-09-15)
   */
  quiet?: boolean;
};

/**
 * 칩 하나. 책 선택 · 태그 · 읽기 상태가 전부 이걸 쓴다.
 *
 * 🔴 **`trailing` 이 별도 요소인 것이 이 파일의 요점이다.**
 *    처음에는 라벨에 `${name}  ×` 로 붙여 썼는데, 이름이 길면 **× 까지 말줄임에 먹혀서**
 *    "지울 수 없는 태그"처럼 보였다(2026-09-09 점검). 라벨만 줄어들고 표식은 항상 남아야 한다.
 */
export function Chip({ label, active = false, onPress, trailing, accessibilityLabel, quiet = false }: Props) {
  const { palette, radius, spacing, typography } = useTheme();
  const fg = quiet ? (active ? palette.text : palette.textMuted) : active ? palette.onAccent : palette.text;
  const bg = quiet ? 'transparent' : active ? palette.accent : palette.surface;
  const edge = quiet ? (active ? palette.text : palette.border) : active ? palette.accent : palette.border;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        backgroundColor: bg,
        borderColor: edge,
        borderWidth: 1,
        borderRadius: radius.full,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        maxWidth: '100%',
      }}
    >
      <View style={[styles.row, { gap: spacing.sm }]}>
        <Text style={[typography.label, styles.label, { color: fg }]} numberOfLines={1}>
          {label}
        </Text>
        {trailing !== undefined && (
          <Text style={[typography.label, styles.trailing, { color: fg }]}>{trailing}</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  /** 라벨만 줄어든다 */
  label: { flexShrink: 1 },
  /** 🔴 표식은 절대 줄어들지 않는다 */
  trailing: { flexShrink: 0 },
});
