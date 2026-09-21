import { StyleSheet, View } from 'react-native';

import { shouldLoadAds } from '@/features/ads/compute';
import { adUnitIds } from '@/features/ads/config';
import { adsSdk } from '@/features/ads/sdk';
import { useAds } from '@/features/ads/store';
import { usePurchase } from '@/features/purchase/store';
import { useTheme } from '@/theme';

/**
 * 하단 고정 배너(적응형) — `docs/MONETIZATION_SYSTEM.md` §A.3 · My Word `AdBanner` 승계.
 *
 * 🔴 **`Screen` 의 `footer` 자리에만 둔다.** 스크롤 안에 넣으면 글 사이에 광고가 끼고, 기둥 1 과 부딪힌다.
 * 🔴 둘 곳은 `AD_PLACEMENTS.banner` 네 화면뿐이다. 가드가 나머지 화면에 이 부품이 없는지 잰다.
 * 🔴 광고 제거를 샀거나 준비 전이면 **아무것도 그리지 않는다**(요청도 안 한다).
 */
export function AdBanner() {
  const { palette } = useTheme();
  const ready = useAds((s) => s.ready);
  const request = useAds((s) => s.request);
  const adFree = usePurchase((s) => s.adFree);

  if (adsSdk === null || !shouldLoadAds({ ready, adFree })) return null;
  const { BannerAd, BannerAdSize } = adsSdk;

  return (
    // ⚠ 배경색을 박지 않는다. 테마 배경을 따라야 다크에서 밝은 띠가 안 생긴다(My Word 실측)
    <View style={[styles.wrap, { backgroundColor: palette.bg }]}>
      <BannerAd
        unitId={adUnitIds(__DEV__).banner}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: !request.personalized }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
});
