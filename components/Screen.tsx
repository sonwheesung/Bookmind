import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, TextInput, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useKeyboard } from '@/hooks/useKeyboard';
import { useTheme } from '@/theme';

type Props = {
  children: ReactNode;
  /** 스크롤이 필요한 화면(폼 등). 기본은 고정 화면 */
  scroll?: boolean;
  /** 헤더가 있는 화면은 상단 인셋을 헤더가 먹는다 */
  hasHeader?: boolean;
  style?: ViewStyle;
};

/** 포커스된 입력창과 키보드 사이에 남길 여유 */
const FOCUS_MARGIN = 16;

/**
 * 🔴 **모든 화면은 이걸로 감싼다.**
 * 화면에서 SafeAreaView·ScrollView 를 직접 쓰지 않는다 (`docs/README.md` §4).
 *
 * 세이프에어리어(노치·상태바·홈 인디케이터)와 **키보드 가림**을 한 곳에서 처리한다.
 * 조각(diary) 승계 — 화면마다 따로 하면 반드시 한두 화면이 빠지고,
 * 빠진 것은 그 기기를 쓰는 사용자에게만 보이므로 우리가 모른다.
 *
 * 🔴 **2026-09-09 키보드 가림을 고쳤다.** 그전에는 `KeyboardAvoidingView` 로 감싸 놓고
 *    안드로이드에 `behavior={undefined}` 를 줬다 — **감싼 모양만 있고 아무 일도 안 했다.**
 *    "처리했다"고 착각하기 딱 좋은 코드였고, 실제로 대표님 폰에서 입력창이 가려졌다.
 *    조각·Idea Repository 가 같은 버그를 겪고 푼 방식을 승계한다.
 */
export function Screen({ children, scroll = false, hasHeader = false, style }: Props) {
  const insets = useSafeAreaInsets();
  const { palette, spacing } = useTheme();
  const keyboard = useKeyboard();

  const rootRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef(0);
  const [overlap, setOverlap] = useState(0);

  /*
   * 🔴 키보드에 가려지는 높이만큼 **영역을 줄인다**(아래 여백을 더하는 게 아니다).
   *    여백만 더하면 손으로 스크롤해야 닿는다. 영역 자체가 짧아지면 안드로이드 ScrollView 가
   *    크기 변화에 맞춰 포커스된 입력창을 보이는 데까지 **스스로 스크롤한다.**
   *
   * 🟢 창이 이미 줄어드는 기기(`adjustResize` 가 먹는 경우)에서는 겹침이 0 으로 계산되어
   *    아무 일도 하지 않는다 — 두 경우를 **코드로 나누지 않고 실제로 재서** 판단한다.
   */
  useEffect(() => {
    if (keyboard.height === 0) {
      setOverlap(0);
      return;
    }
    const measure = () => {
      rootRef.current?.measureInWindow((_x, y, _width, height) => {
        setOverlap(Math.max(0, y + height - keyboard.screenY));
      });
    };
    // ⚠ 두 번 잰다. 창이 줄어드는 기기는 레이아웃이 끝난 뒤라야 값이 맞고,
    //   키보드가 뜬 뒤 제안 줄·툴바가 붙어 높이가 한 번 더 커지는 경우가 있다(Gboard).
    const early = setTimeout(measure, 60);
    const late = setTimeout(measure, 350);
    return () => {
      clearTimeout(early);
      clearTimeout(late);
    };
  }, [keyboard.height, keyboard.screenY]);

  // iOS 는 `automaticallyAdjustKeyboardInsets` 가 같은 일을 한다. 여기서 또 줄이면 **두 번 밀린다**
  const scrollOverlap = Platform.OS === 'android' ? overlap : 0;

  // 영역을 줄여도 안 올라오는 경우의 보완책. 이미 올라왔으면 겹침이 없어 그냥 지나간다
  useEffect(() => {
    if (scrollOverlap === 0 || !scroll) return;
    const timer = setTimeout(() => {
      const focused = TextInput.State.currentlyFocusedInput();
      if (focused === null) return;
      focused.measureInWindow((_x, y, _width, height) => {
        const hidden = y + height + FOCUS_MARGIN - keyboard.screenY;
        if (hidden > 0) scrollRef.current?.scrollTo({ y: scrollOffsetRef.current + hidden, animated: true });
      });
    }, 180);
    return () => clearTimeout(timer);
  }, [scrollOverlap, keyboard.screenY, scroll]);

  const pad: ViewStyle = {
    paddingTop: hasHeader ? 0 : insets.top,
    paddingBottom: insets.bottom,
    paddingLeft: Math.max(insets.left, spacing.lg),
    paddingRight: Math.max(insets.right, spacing.lg),
  };

  return (
    <View ref={rootRef} style={[styles.fill, { backgroundColor: palette.bg }]}>
      {scroll ? (
        <ScrollView
          ref={scrollRef}
          style={[styles.fill, { marginBottom: scrollOverlap }]}
          contentContainerStyle={[pad, style]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          onScroll={(e) => {
            scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          // iOS 는 이 옵션만으로 포커스된 입력창을 키보드 위로 밀어준다
          automaticallyAdjustKeyboardInsets
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.fill, pad, style, { marginBottom: overlap }]}>{children}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
