/**
 * 광고 단위 ID (`docs/MONETIZATION_SYSTEM.md` §A.4)
 *
 * 🔴 **AdMob 에 Re:Read 앱과 광고 단위를 아직 만들지 않았다.** 그래서 지금은 릴리스도 Google 테스트 ID 다.
 *    광고가 "테스트 광고"로 뜨고 수익이 0 이다. 정책 위반은 아니다.
 * 🔴 `app.json` 의 `androidAppId` 와 **둘 다 테스트이거나 둘 다 실제**여야 한다(가드 `check:ads` 가 잰다).
 *    실제 ID 를 받으면 이 파일과 `app.json` 두 곳을 한 커밋에 바꾼다.
 *
 * ⚠ 이 파일은 RN 을 import 하지 않는다. 가드가 node 에서 읽는다.
 */

/** Google 이 공개한 테스트 ID. 개발 빌드는 늘 이것을 쓴다 */
export const TEST_IDS = {
  app: 'ca-app-pub-3940256099942544~3347511713',
  banner: 'ca-app-pub-3940256099942544/9214589741',
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
} as const;

/** 릴리스에서 쓸 ID. ⏭ AdMob 단위를 만들면 여기를 바꾼다 */
export const RELEASE_IDS = {
  banner: TEST_IDS.banner,
  interstitial: TEST_IDS.interstitial,
} as const;

export function adUnitIds(dev: boolean): { readonly banner: string; readonly interstitial: string } {
  return dev ? TEST_IDS : RELEASE_IDS;
}

/** Google 테스트 퍼블리셔인가. 앱 ID 와 단위 ID 의 짝을 재는 데 쓴다 */
export function isTestId(id: string): boolean {
  return id.startsWith('ca-app-pub-3940256099942544');
}
