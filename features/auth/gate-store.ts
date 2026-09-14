import { create } from 'zustand';

import { deviceThreshold } from './age-store';

/**
 * 연령 게이트 화면 상태 (`docs/AUTH_SYSTEM.md` §1.6 · 조각 `features/auth/gate-store.ts` 승계)
 *
 * 게이트를 여는 쪽(부팅 · Phase 7 의 `signIn()`)은 화면을 그릴 수 없다.
 * 그래서 스토어가 **약속(Promise)을 들고** 있다가 화면이 답하면 그때 풀어준다.
 */

type Resolver = (verified: boolean) => void;

interface AgeGateState {
  /** 화면을 띄울 것인가 */
  visible: boolean;
  /** 이 기기에 적용할 기준 연령 — 화면이 문구에 쓴다 */
  threshold: number;
  /**
   * 미달 판정을 받았는가.
   *
   * 🔴 같은 세션에서 **다시 입력할 수 없다.** 이 값이 참이 되면 연도 선택으로 못 돌아간다 —
   *   재입력으로 우회 가능하면 게이트가 아니다.
   */
  blocked: boolean;
  resolver: Resolver | null;
}

const useAgeGateStore = create<AgeGateState>(() => ({
  visible: false,
  threshold: 13,
  blocked: false,
  resolver: null,
}));

export const useAgeGate = useAgeGateStore;

/**
 * 게이트를 열고 사용자의 답을 기다린다.
 *
 * `true`  — 방금 통과했다.
 * `false` — 미달이거나 사용자가 닫았다. (Phase 7) 로그인 SDK 를 부르지 않는다.
 */
export function requestAgeVerification(): Promise<boolean> {
  const prev = useAgeGateStore.getState().resolver;
  // 이미 열려 있는데 또 불렸다면 앞의 약속을 취소로 닫는다 — 영원히 안 풀리는 약속을 남기지 않는다.
  if (prev) prev(false);

  return new Promise<boolean>((resolve) => {
    useAgeGateStore.setState({
      visible: true,
      threshold: deviceThreshold(),
      // ⚠ blocked 는 초기화하지 않는다 — 같은 세션에서 다시 시도해도 미달은 미달이다.
      resolver: resolve,
    });
  });
}

/** 화면이 판정을 마쳤거나 사용자가 닫았을 때 부른다. */
export function settleAgeGate(verified: boolean): void {
  const { resolver } = useAgeGateStore.getState();
  useAgeGateStore.setState({ visible: false, resolver: null });
  resolver?.(verified);
}

/** 미달로 확정한다. 화면은 안내로 바뀌고, 약속은 아직 풀지 않는다(사용자가 닫을 때 푼다). */
export function markAgeBlocked(): void {
  useAgeGateStore.setState({ blocked: true });
}
