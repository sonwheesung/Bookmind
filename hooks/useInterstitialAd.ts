import { useCallback, useEffect, useRef } from 'react';

import { shouldLoadAds } from '@/features/ads/compute';
import { adUnitIds } from '@/features/ads/config';
import { adsSdk } from '@/features/ads/sdk';
import { useAds } from '@/features/ads/store';
import { usePurchase } from '@/features/purchase/store';

type Interstitial = ReturnType<NonNullable<typeof adsSdk>['InterstitialAd']['createForAdRequest']>;

/**
 * 전면 광고 — `docs/MONETIZATION_SYSTEM.md` §A.3 · My Word `useInterstitialAd` 승계.
 *
 * 🔴 쓰는 곳은 `AD_PLACEMENTS.interstitial`(복습 끝) 하나다. 가드가 잰다.
 * 🔴 광고 제거를 샀으면 **미리 불러오는 것부터 하지 않는다.** 보여주지 않을 광고를 요청하지 않는다.
 */
export function useInterstitialAd(): { show: () => boolean } {
  const ready = useAds((s) => s.ready);
  const personalized = useAds((s) => s.request.personalized);
  const adFree = usePurchase((s) => s.adFree);
  const adRef = useRef<Interstitial | null>(null);
  const loadedRef = useRef(false);
  const enabled = adsSdk !== null && shouldLoadAds({ ready, adFree });

  useEffect(() => {
    if (!enabled || adsSdk === null) return;
    const { InterstitialAd, AdEventType } = adsSdk;
    const ad = InterstitialAd.createForAdRequest(adUnitIds(__DEV__).interstitial, {
      requestNonPersonalizedAdsOnly: !personalized,
    });
    const offLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
      loadedRef.current = true;
    });
    const offClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
      loadedRef.current = false;
    });
    adRef.current = ad;
    ad.load();
    return () => {
      offLoaded();
      offClosed();
      // 구매 직후 이 훅이 다시 돌면 이미 실린 광고가 남는다. 참조를 끊는다
      adRef.current = null;
      loadedRef.current = false;
    };
  }, [enabled, personalized]);

  /** 실제로 띄웠으면 `true`. 아직 안 실렸으면 조용히 넘어간다(기다리게 하지 않는다) */
  const show = useCallback((): boolean => {
    if (!enabled || adRef.current === null || !loadedRef.current) return false;
    void adRef.current.show();
    return true;
  }, [enabled]);

  return { show };
}
