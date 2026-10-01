/**
 * 법무 문서의 게시 주소 (`docs/STORE_LISTING.md` §8).
 *
 * 🔴 **정본은 이 주소가 아니라 `docs/legal/PRIVACY.*.md` · `TERMS.*.md` 다.**
 *    문구를 고칠 일이 생기면 그 파일을 먼저 고치고 페이지를 맞춘다. 페이지는 배구 저장소가 서빙한다.
 *
 * 🔴 **설정에 둘 다 두는 것이 요건이다** — 처리방침만 두면 유료 상품이 있는 앱에서 모자라고,
 *    `common/GLOBAL_DATA_COMPLIANCE.md` §7 은 처리방침을 **앱 안에서 닿게** 하라고 적어 뒀다.
 *    v1.0 에는 로그인 화면이 없으므로 그 자리는 설정 하나다.
 *
 * ⚠ 여기를 여는 것은 `Linking.openURL` 이다 — 앱이 그 호스트에 **직접 접속하지 않는다.**
 *    기기의 브라우저가 연다. 그래서 처리방침의 "앱이 보내는 요청" 절이 늘지 않는다.
 *
 * ⚠ 이 값은 공개 주소라 저장소에 둔다(`check:public` 대상이 아니다).
 */
export const PRIVACY_URL = 'https://vivace-games.com/reread/privacy';
export const TERMS_URL = 'https://vivace-games.com/reread/terms';
