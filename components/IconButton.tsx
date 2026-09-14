import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/theme';

type Props = {
  icon: LucideIcon;
  /** 🔴 글자가 없으므로 스크린리더가 읽을 이름이 필수다 */
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

const ICON_SIZE = 22;
/** 누르는 자리. 헤더 한 줄의 높이도 이 값이다(`Header`) */
export const ICON_HIT = 40;

/**
 * 헤더 오른쪽의 행동 아이콘 — `docs/UI_GUIDE.md` §2 · `docs/DESIGN_REVIEW.md` §3(2026-09-14).
 *
 * 🔄 등록 · 수정 · 삭제가 본문의 글자 버튼이라 화면이 산만했다(사용자 지시). 행동을 위 오른쪽으로 모은다.
 * 🔴 색은 글자색 하나다. 삭제도 빨갛게 하지 않는다. 확인창이 막고, 빨간 버튼은 확인창에 있다.
 */
export function IconButton({ icon: Icon, label, onPress, disabled = false }: Props) {
  const { palette } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      style={({ pressed }) => [styles.box, { opacity: disabled ? 0.3 : pressed ? 0.5 : 1 }]}
    >
      <Icon size={ICON_SIZE} color={palette.text} strokeWidth={1.9} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { width: ICON_HIT, height: ICON_HIT, alignItems: 'center', justifyContent: 'center' },
});
