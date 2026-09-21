/**
 * 광고 단위 ID (`docs/MONETIZATION_SYSTEM.md` §A.4)
 *
 * ✅ 2026-09-21 AdMob 에 Re:Read 앱과 광고 단위 둘을 만들었다. 릴리스는 아래 실제 ID 를 쓴다.
 * 🔴 **비공개 테스트 동안은 `ADS_LIVE = false` 다**(`docs/MONETIZATION_SYSTEM.md` §A.6.1). 어느 ID 로도 요청하지 않는다.
 * 🔴 `app.json` 의 `androidAppId` 와 **둘 다 테스트이거나 둘 다 실제**여야 한다(가드 `check:ads` 가 잰다).
 *    실제 ID 를 받으면 이 파일과 `app.json` 두 곳을 한 커밋에 바꾼다.
 *
 * ⚠ 이 파일은 RN 을 import 하지 않는다. 가드가 node 에서 읽는다.
 */

/**
 * 🔴 광고 스위치. 출시 전까지 `false` 다(사용자 지시 *"출시 전까지 광고는 On 하지말고"*).
 * 꺼져 있으면 SDK 를 깨우지 않고 배너 자리에 빈 영역만 그린다.
 * 켤 때는 `app.json` 의 `blockedPermissions` 에서 `AD_ID` 를 **같은 커밋에** 뺀다(가드 `check:ads` ⑧).
 */
export const ADS_LIVE = false;

/** 실제 AdMob 앱 ID. `app.json` 의 `androidAppId` 와 같아야 한다 */
export const RELEASE_APP_ID = 'ca-app-pub-2731473780180274~9518651929';

/** Google 이 공개한 테스트 ID. 개발 빌드는 늘 이것을 쓴다 */
export const TEST_IDS = {
  app: 'ca-app-pub-3940256099942544~3347511713',
  banner: 'ca-app-pub-3940256099942544/9214589741',
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
} as const;

/** 릴리스에서 쓸 ID(2026-09-21 AdMob · reread_banner_bottom · reread_interstitial_review_end) */
export const RELEASE_IDS = {
  banner: 'ca-app-pub-2731473780180274/8971857014',
  interstitial: 'ca-app-pub-2731473780180274/9204711174',
} as const;

export function adUnitIds(dev: boolean): { readonly banner: string; readonly interstitial: string } {
  return dev ? TEST_IDS : RELEASE_IDS;
}

/** Google 테스트 퍼블리셔인가. 앱 ID 와 단위 ID 의 짝을 재는 데 쓴다 */
export function isTestId(id: string): boolean {
  return id.startsWith('ca-app-pub-3940256099942544');
}
