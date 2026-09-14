import { Text, type TextProps } from 'react-native';

import { useTheme, type Theme } from '@/theme';

type Tone = 'text' | 'muted' | 'accent';

type Props = TextProps & {
  /** 타이포 토큰 이름. 기본 `body` */
  variant?: keyof Theme['typography'];
  /** 🔴 색은 셋뿐이다. 의미를 더하는 색(성공·경고)을 여기 늘리지 않는다(`docs/UI_GUIDE.md` §5) */
  tone?: Tone;
};

/**
 * 화면의 모든 글자 — `docs/UI_GUIDE.md` §2.
 *
 * 🔴 화면에서 `[typography.body, { color: palette.textMuted }]` 를 조립하지 않는다.
 *    80곳에서 따로 조립하면 톤을 바꿀 때 반드시 몇 곳이 남는다(2026-09-13 점검).
 * `style` 은 토큰 **뒤에** 붙는다. 여백과 예외 색은 거기서 준다.
 */
export function AppText({ variant = 'body', tone = 'text', style, ...rest }: Props) {
  const { palette, typography } = useTheme();
  const color = tone === 'muted' ? palette.textMuted : tone === 'accent' ? palette.accent : palette.text;
  return <Text {...rest} style={[typography[variant], { color }, style]} />;
}
