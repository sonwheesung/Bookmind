import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

export interface KeyboardMetrics {
  /** 키보드 높이(dp). 닫혀 있으면 0 */
  readonly height: number;
  /** 키보드 **윗변**의 화면 좌표(dp). 닫혀 있으면 0 */
  readonly screenY: number;
}

/**
 * 키보드의 실제 크기와 위치 — 조각(`diary/hooks/use-keyboard.ts`) 승계.
 * Idea Repository 가 같은 코드를 쓰고 있고, 둘 다 실기기에서 다듬은 것이다.
 *
 * 🔴 **높이만으로는 부족하다.** 화면 높이에서 빼는 방식은 edge-to-edge 에서
 *    시스템 바를 포함하느냐에 따라 어긋난다. 키보드 윗변의 **절대 좌표**를 그대로 받아
 *    `measureInWindow` 결과와 **같은 좌표계**에서 비교한다.
 */
export function useKeyboard(): KeyboardMetrics {
  const [metrics, setMetrics] = useState<KeyboardMetrics>({ height: 0, screenY: 0 });

  useEffect(() => {
    // iOS 는 will* 이 애니메이션과 함께 와서 덜 튄다. 안드로이드는 did* 만 온다
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const show = Keyboard.addListener(showEvent, (e) => {
      setMetrics({ height: e.endCoordinates.height, screenY: e.endCoordinates.screenY });
    });
    const hide = Keyboard.addListener(hideEvent, () => setMetrics({ height: 0, screenY: 0 }));

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return metrics;
}
