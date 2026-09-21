import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { create } from 'zustand';

import {
  AD_FREE_CACHE_KEY,
  REMOVE_ADS_PRODUCT_ID,
  ownsRemoveAds,
  parseAdFreeCache,
  purchaseFailureOf,
  serializeAdFreeCache,
  type PurchaseFailure,
} from './compute';

/**
 * 평생 광고 제거 (`docs/MONETIZATION_SYSTEM.md` §A.5 · My Word `src/contexts/PurchaseContext.tsx` 승계)
 *
 * 🔴 **진실은 Google Play 다.** 기기 캐시는 부팅 직후 광고가 번쩍이지 않게 하는 용도다.
 *    매 부팅 `getAvailablePurchases()` 로 다시 묻고, 환불되면 목록에서 빠져 다음 부팅에 광고가 돌아온다.
 * ⚠ 서버 영수증 검증을 하지 않는다(결정 #31). 일회성이라 뚫려도 손해가 상품 한 건이다.
 */

type Iap = typeof import('expo-iap');

// 네이티브 모듈이 없는 환경(Expo Go)에서도 앱이 죽지 않아야 한다. 광고 코드와 같은 방어 규약이다
let iap: Iap | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  iap = Platform.OS === 'android' ? (require('expo-iap') as Iap) : null;
} catch {
  iap = null;
}

export type PurchaseOutcome = { ok: true } | { ok: false; reason: PurchaseFailure };

interface PurchaseState {
  /** 광고를 숨겨야 하는가 */
  adFree: boolean;
  /** Play 조회가 끝났는가. `false` 면 아직 캐시 값을 보고 있다 */
  ready: boolean;
  /** 스토어가 준 지역 통화 표시가. 못 받았으면 `null` 이고 화면이 가격을 숨긴다 */
  price: string | null;
  /** 구매·복원 진행 중. 버튼 중복 탭 방지 */
  busy: boolean;
}

export const usePurchase = create<PurchaseState>(() => ({
  adFree: false,
  ready: false,
  price: null,
  busy: false,
}));

/** 상태와 캐시를 함께 바꾼다. 캐시 쓰기가 실패해도 화면은 이미 맞다 */
async function apply(owned: boolean): Promise<void> {
  usePurchase.setState({ adFree: owned });
  try {
    await AsyncStorage.setItem(AD_FREE_CACHE_KEY, serializeAdFreeCache(owned));
  } catch {
    // 다음 부팅에 Play 를 다시 묻는다
  }
}

let started: Promise<void> | null = null;

/**
 * 부팅에 한 번 부른다. 두 번 불려도 한 번만 돈다.
 * 돌려주는 약속은 **Play 조회까지 끝났을 때** 풀린다. 광고 부팅이 이것을 기다린다(§A.1).
 */
export function startPurchases(): Promise<void> {
  started ??= boot();
  return started;
}

async function boot(): Promise<void> {
  // 1) 캐시 먼저. Play 왕복을 기다리는 동안 산 사람에게 광고를 보여주지 않는다
  try {
    if (parseAdFreeCache(await AsyncStorage.getItem(AD_FREE_CACHE_KEY))) usePurchase.setState({ adFree: true });
  } catch {
    // 못 읽으면 안 산 것으로 두고 아래에서 Play 가 정정한다
  }

  if (iap === null) {
    usePurchase.setState({ ready: true });
    return;
  }
  const m = iap;

  // 2) Play 에 묻는다
  try {
    await m.initConnection();

    // 구매는 비동기로 돌아온다. 리스너를 먼저 걸어야 놓치지 않는다
    m.purchaseUpdatedListener((purchase) => {
      void (async () => {
        if (purchase.productId !== REMOVE_ADS_PRODUCT_ID) return;
        if (!ownsRemoveAds([purchase])) return;
        /*
         * 🔴 **finishTransaction 을 반드시 부른다.** 비소비성이라 isConsumable 은 false 다.
         *    안 부르면 Play 가 3일 뒤 자동 환불한다. 돈은 받고 광고는 살아나는 최악이 된다.
         */
        try {
          await m.finishTransaction({ purchase, isConsumable: false });
        } catch {
          // 확인이 실패해도 소유는 소유다. 다음 부팅에 다시 시도된다
        }
        await apply(true);
      })();
    });
    m.purchaseErrorListener(() => usePurchase.setState({ busy: false }));

    await apply(ownsRemoveAds(await m.getAvailablePurchases()));

    // 표시가는 실패해도 된다. 없으면 화면이 가격을 숨긴다
    try {
      const products = await m.fetchProducts({ skus: [REMOVE_ADS_PRODUCT_ID], type: 'in-app' });
      const found = Array.isArray(products) ? products.find((p) => p.id === REMOVE_ADS_PRODUCT_ID) : undefined;
      if (typeof found?.displayPrice === 'string') usePurchase.setState({ price: found.displayPrice });
    } catch {
      // 가격 없이도 구매는 된다
    }
  } catch {
    /*
     * 🔴 **캐시 값을 유지한다.** 오프라인이거나 Play 가 답하지 않을 때 산 사람에게 광고를 되돌려주지 않는다.
     *    안 산 사람은 캐시가 '0' 이라 그대로 광고를 본다.
     */
  } finally {
    usePurchase.setState({ ready: true });
  }
}

export async function buyRemoveAds(): Promise<PurchaseOutcome> {
  if (iap === null) return { ok: false, reason: 'unavailable' };
  if (usePurchase.getState().adFree) return { ok: false, reason: 'already-owned' };
  usePurchase.setState({ busy: true });
  try {
    await iap.requestPurchase({
      request: { google: { skus: [REMOVE_ADS_PRODUCT_ID] } },
      type: 'in-app',
    });
    // 여기서 성공을 단정하지 않는다. 실제 지급은 리스너가 한다. 결제창을 닫는 것과 결제가 끝나는 것은 다른 사건이다
    return { ok: true };
  } catch (error: unknown) {
    const code = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;
    return { ok: false, reason: purchaseFailureOf(code) };
  } finally {
    usePurchase.setState({ busy: false });
  }
}

export async function restoreRemoveAds(): Promise<PurchaseOutcome> {
  if (iap === null) return { ok: false, reason: 'unavailable' };
  usePurchase.setState({ busy: true });
  try {
    const owned = ownsRemoveAds(await iap.getAvailablePurchases());
    await apply(owned);
    return owned ? { ok: true } : { ok: false, reason: 'not-found' };
  } catch {
    return { ok: false, reason: 'error' };
  } finally {
    usePurchase.setState({ busy: false });
  }
}
