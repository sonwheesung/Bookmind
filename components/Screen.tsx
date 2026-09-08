import { type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

type Props = {
  children: ReactNode;
  /** 스크롤이 필요한 화면(폼 등). 기본은 고정 화면 */
  scroll?: boolean;
  /** 헤더가 있는 화면은 상단 인셋을 헤더가 먹는다 */
  hasHeader?: boolean;
  style?: ViewStyle;
};

/**
 * 🔴 **모든 화면은 이걸로 감싼다.**
 * 화면에서 SafeAreaView·ScrollView 를 직접 쓰지 않는다 (`docs/README.md` §4).
 *
 * 세이프에어리어(노치·상태바·홈 인디케이터)와 키보드 가림을 **한 곳에서** 처리한다.
 * 조각(diary) 승계 — 화면마다 따로 하면 반드시 한두 화면이 빠지고,
 * 빠진 것은 그 기기를 쓰는 사용자에게만 보이므로 우리가 모른다.
 */
export function Screen({ children, scroll = false, hasHeader = false, style }: Props) {
  const insets = useSafeAreaInsets();
  const { palette, spacing } = useTheme();

  const pad: ViewStyle = {
    paddingTop: hasHeader ? 0 : insets.top,
    paddingBottom: insets.bottom,
    paddingLeft: Math.max(insets.left, spacing.lg),
    paddingRight: Math.max(insets.right, spacing.lg),
  };

  const body = scroll ? (
    <ScrollView
      style={styles.fill}
      contentContainerStyle={[pad, style]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.fill, pad, style]}>{children}</View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.fill, { backgroundColor: palette.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {body}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
