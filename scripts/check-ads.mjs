#!/usr/bin/env node
/**
 * check:ads — 광고 · 광고 제거 회귀 가드 (`docs/MONETIZATION_SYSTEM.md` §A · 결정 #29 · #31)
 *
 * 순수 계층(`features/ads/compute.ts` · `config.ts` · `features/purchase/compute.ts`)을 import 해 판정을 재고,
 * 화면·부팅 파일은 **주석을 뺀 소스**로 배치와 순서를 잰다.
 *
 * 🔴 이 가드가 실제로 막는 것:
 *   ① 연령을 모르는 사람에게 맞춤 광고가 나가는 것 — 되돌릴 수 없다.
 *   ② 광고가 저장·복습 진행·설정 같은 금지 화면으로 새는 것(기둥 1 · 7).
 *   ③ 복습 **시작 전** 전면 · 빈 큐 끝 화면의 전면.
 *   ④ 앱 ID 와 광고 단위 ID 의 테스트/실제 짝이 섞이는 것.
 *   ⑤ 결제 대기(pending)를 지급하는 것 · finishTransaction 누락(3일 뒤 자동 환불).
 *   ⑥ 광고 제거를 산 사람에게 광고를 요청하는 것 · 연령 확인 전에 광고를 부팅하는 것.
 *   ⑦ 🔴 비공개 테스트 동안(ADS_LIVE = false) SDK 가 깨어나는 것 · 스위치와 AD_ID 권한의 짝이 어긋나는 것(§A.6.1).
 *
 * 🔴 SELF-TEST 가 먼저다(exit 2). 검사 실패는 exit 1.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AD_PLACEMENTS,
  INTERSTITIAL_DELAY_MS,
  decideAdRequest,
  shouldLoadAds,
  shouldShowReviewInterstitial,
  adSlot,
} from '../features/ads/compute.ts';
import { ADS_LIVE, RELEASE_APP_ID, RELEASE_IDS, TEST_IDS, adUnitIds, isTestId } from '../features/ads/config.ts';
import { AGE_GATE_VERSION, makeBlockRecord, makeRecord } from '../features/auth/age-gate.ts';
import {
  REMOVE_ADS_PRODUCT_ID,
  ownsRemoveAds,
  parseAdFreeCache,
  purchaseFailureOf,
  serializeAdFreeCache,
} from '../features/purchase/compute.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
/**
 * 주석을 뺀 코드. 설명 속 단어를 코드로 세지 않게 한다(블록 · 한 줄 두 단계).
 * JSX 주석은 블록 단계가 빈 중괄호로 만든다.
 * ⚠ JSX 주석을 중괄호째 지우는 단계를 따로 두지 않는다. 게으른 매칭이 여는 중괄호에서 먼 곳의
 *   `*` `/` `}` 까지 건너가 코드를 통째로 삼켰다(2026-09-21 실측 · 아래 SELF-TEST 가 잰다).
 */
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** `app/` 아래 화면 파일 전부(경로는 `/` 로 맞춘다) */
function screens() {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(join(ROOT, dir))) {
      const rel = `${dir}/${name}`;
      if (statSync(join(ROOT, rel)).isDirectory()) walk(rel);
      else if (/\.tsx?$/.test(name)) out.push(relative(ROOT, join(ROOT, rel)).replace(/\\/g, '/'));
    }
  };
  walk('app');
  return out.sort();
}

const usesBanner = (src) => /<AdBanner\b/.test(code(src));
const usesInterstitial = (src) => /\buseInterstitialAd\s*\(/.test(code(src));
/** 배너가 전부 `footer` 자리에 있는가(스크롤 안에 끼면 글 사이에 광고가 선다) */
const bannersInFooter = (src) => {
  const c = code(src);
  const all = (c.match(/<AdBanner\b/g) ?? []).length;
  const footer = (c.match(/footer=\{\s*<AdBanner\s*\/>\s*\}/g) ?? []).length;
  return all > 0 && all === footer;
};

// ── 🔴 SELF-TEST ─────────────────────────────────────────────────────
function selfTest() {
  const fail = (m) => {
    console.error(`SELF-TEST FAIL: ${m}`);
    process.exit(2);
  };
  const now = Date.UTC(2026, 8, 21);
  // 판정이 **갈라지는가**. 늘 같은 값을 돌려주는 함수를 먼저 배제한다
  const a = decideAdRequest(makeRecord(16, now), null, 16, now);
  const b = decideAdRequest(null, null, 16, now);
  if (a.personalized === b.personalized) fail('맞춤 판정이 갈라지지 않는다');
  if (ownsRemoveAds([{ productId: REMOVE_ADS_PRODUCT_ID }]) === ownsRemoveAds([])) fail('소유 판정이 갈라지지 않는다');
  if (shouldShowReviewInterstitial(1, false) === shouldShowReviewInterstitial(0, false)) fail('전면 판정이 갈라지지 않는다');
  // 🔴 주석 제거가 코드를 삼키지 않는가. 주석 뒤의 코드가 살아남아야 한다
  if (!code('interface S {\n  /** a */\n  x: 1;\n}\n} catch {\n  /* b */\n} finally { ready(); }').includes('x: 1')) {
    fail('주석 제거가 코드를 삼킨다');
  }
  // 주석 제거 두 단계를 **각각** 지나가게 한다(블록 · 한 줄 · 블록의 JSX 모양)
  if (usesBanner('/* <AdBanner /> */')) fail('블록 주석 속 배너를 코드로 센다');
  if (usesBanner('// <AdBanner />')) fail('한 줄 주석 속 배너를 코드로 센다');
  if (usesBanner('{/* <AdBanner /> */}')) fail('JSX 주석 속 배너를 코드로 센다');
  if (!usesBanner('<Screen footer={<AdBanner />}>')) fail('배너 탐지가 실제 배너를 못 잡는다');
  if (!usesInterstitial('const x = useInterstitialAd();')) fail('전면 탐지가 실제 호출을 못 잡는다');
  if (bannersInFooter('<View><AdBanner /></View>')) fail('스크롤 안 배너를 발판으로 센다');
  if (!bannersInFooter('<Screen footer={<AdBanner />}>')) fail('발판 배너를 못 알아본다');
}
selfTest();

let pass = 0;
const fails = [];
const ok = (cond, what) => (cond ? pass++ : fails.push(what));

const NOW = Date.UTC(2026, 8, 21, 12);
const DAY = 24 * 60 * 60 * 1000;

// ── ① 맞춤 광고 판정(§A.2) ──────────────────────────────────────────────────
{
  const passRec = makeRecord(16, NOW - DAY);
  const blockRec = makeBlockRecord(16, NOW - DAY);
  const same = (x, p, u) => x.personalized === p && x.underAge === u;

  ok(same(decideAdRequest(passRec, null, 16, NOW), true, false), '① 통과 기록인데 맞춤이 안 열린다');
  ok(same(decideAdRequest(null, blockRec, 16, NOW), false, true), '① 🔴 미달인데 맞춤이 열리거나 미성년 표시가 없다');
  ok(same(decideAdRequest(null, null, 16, NOW), false, false), '① 🔴 기록이 없는데(모른다) 맞춤이 열린다');
  ok(same(decideAdRequest(undefined, undefined, 16, NOW), false, false), '① undefined 기록에서 맞춤이 열린다');
  ok(same(decideAdRequest(passRec, blockRec, 16, NOW), true, false), '① 통과가 미달보다 우선하지 않는다');
  // 규칙 버전이 오른 통과 기록은 "모른다"다
  ok(
    same(decideAdRequest({ ...passRec, version: AGE_GATE_VERSION + 1 }, null, 16, NOW), false, false),
    '① 🔴 낡은 규칙 버전의 통과로 맞춤이 열린다',
  );
  ok(
    same(decideAdRequest({ passedAt: Number.NaN, threshold: 16, version: AGE_GATE_VERSION }, null, 16, NOW), false, false),
    '① 깨진 통과 기록(NaN)으로 맞춤이 열린다',
  );
  // 유예가 끝난 미달은 미성년 표시를 풀지만 맞춤은 여전히 닫혀 있다(모른다)
  const oldBlock = makeBlockRecord(16, NOW - 400 * DAY);
  ok(same(decideAdRequest(null, oldBlock, 16, NOW), false, false), '① 유예가 끝난 미달이 모른다로 안 떨어진다');
  // 기준이 바뀐 미달 기록은 지금 기준에 대해 말해 주지 않는다
  ok(same(decideAdRequest(null, blockRec, 14, NOW), false, false), '① 다른 기준의 미달이 지금 기준으로 쓰인다');
}

// ── ② 광고 요청 여부 ────────────────────────────────────────────────────────
ok(shouldLoadAds({ ready: true, adFree: false }) === true, '② 준비됐고 안 샀는데 광고를 안 부른다');
ok(shouldLoadAds({ ready: true, adFree: true }) === false, '② 🔴 광고 제거를 샀는데 광고를 부른다');
ok(shouldLoadAds({ ready: false, adFree: false }) === false, '② 🔴 초기화 전에 광고를 부른다');
ok(shouldLoadAds({ ready: false, adFree: true }) === false, '② 준비 전 · 산 사람에게 광고를 부른다');

// ── ③ 복습 끝 전면(§A.3) ────────────────────────────────────────────────────
ok(INTERSTITIAL_DELAY_MS === 500, `③ 전면 지연이 500ms 가 아니다(${INTERSTITIAL_DELAY_MS})`);
ok(shouldShowReviewInterstitial(0, false) === false, '③ 🔴 한 장도 안 넘긴 끝 화면(빈 큐)에 전면이 뜬다');
ok(shouldShowReviewInterstitial(1, false) === true, '③ 한 장 넘긴 끝 화면에 전면이 안 뜬다');
ok(shouldShowReviewInterstitial(12, false) === true, '③ 여러 장 넘긴 끝 화면에 전면이 안 뜬다');
ok(shouldShowReviewInterstitial(3, true) === false, '③ 🔴 한 세션에 전면이 두 번 뜬다');
for (const bad of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
  ok(shouldShowReviewInterstitial(bad, false) === false, `③ 이상한 장 수(${bad})에 전면이 뜬다`);
}

// ── ④ 배치 — 화면 파일과 대조(§A.3) ─────────────────────────────────────────
const files = screens();
const bannerFiles = files.filter((f) => usesBanner(read(f)));
const interFiles = files.filter((f) => usesInterstitial(read(f)));
const eq = (x, y) => JSON.stringify([...x].sort()) === JSON.stringify([...y].sort());
ok(files.length > 10, `④ 화면 파일을 거의 못 찾았다(${files.length}) — 탐색이 고장 났다`);
ok(eq(bannerFiles, AD_PLACEMENTS.banner), `④ 🔴 배너 화면이 배치표와 다르다: ${bannerFiles.join(', ') || '없음'}`);
ok(eq(interFiles, AD_PLACEMENTS.interstitial), `④ 🔴 전면 화면이 배치표와 다르다: ${interFiles.join(', ') || '없음'}`);
for (const f of AD_PLACEMENTS.banner) {
  ok(files.includes(f), `④ 배치표의 화면이 없다: ${f}`);
  ok(bannersInFooter(read(f)), `④ 🔴 ${f} 의 배너가 발판(footer) 밖에 있다`);
}
// 금지 화면은 명시해서 한 번 더 잰다. 배치표가 틀리게 늘어나도 여기서 걸린다
for (const f of ['app/knowledge/new.tsx', 'app/(tabs)/settings.tsx', 'app/backup.tsx', 'app/(tabs)/practice.tsx']) {
  if (files.includes(f)) ok(!usesBanner(read(f)) && !usesInterstitial(read(f)), `④ 🔴 금지 화면에 광고가 있다: ${f}`);
}
{
  const review = code(read('app/review.tsx'));
  ok(review.includes('shouldShowReviewInterstitial(index'), '④ 🔴 복습 끝 전면이 넘긴 장 수로 판정하지 않는다');
  ok(review.includes('INTERSTITIAL_DELAY_MS'), '④ 복습 끝 전면이 지연 상수를 안 쓴다');
  // 전면은 끝 화면에서만 — 판정이 `finished` 를 거쳐야 한다
  ok(/if \(!finished \|\|/.test(review), '④ 🔴 전면이 끝 화면이 아닐 때도 판정에 들어간다(복습 도중·시작 전)');
}

// ── ⑤ ID 짝(§A.4) ───────────────────────────────────────────────────────────
{
  const app = JSON.parse(read('app.json'));
  const plugin = app.expo.plugins.find((p) => Array.isArray(p) && p[0] === 'react-native-google-mobile-ads');
  const appId = plugin?.[1]?.androidAppId;
  ok(typeof appId === 'string' && /^ca-app-pub-\d+~\d+$/.test(appId), `⑤ app.json androidAppId 가 없거나 모양이 틀렸다(${appId})`);
  ok(app.expo.plugins.includes('expo-iap'), '⑤ app.json 에 expo-iap 플러그인이 없다');
  const release = [RELEASE_IDS.banner, RELEASE_IDS.interstitial];
  for (const id of release) ok(/^ca-app-pub-\d+\/\d+$/.test(id), `⑤ 광고 단위 ID 모양이 틀렸다(${id})`);
  const kinds = new Set([appId, ...release].map((id) => (typeof id === 'string' ? isTestId(id) : 'x')));
  ok(kinds.size === 1, '⑤ 🔴 앱 ID 와 광고 단위 ID 가 테스트/실제로 섞였다');
  ok(Object.values(TEST_IDS).every(isTestId), '⑤ 테스트 ID 표에 실제 ID 가 섞였다');
  ok(adUnitIds(true).banner === TEST_IDS.banner && adUnitIds(true).interstitial === TEST_IDS.interstitial, '⑤ 🔴 개발 빌드가 테스트 ID 를 안 쓴다');
  ok(!isTestId('ca-app-pub-1234567890123456/1234567890'), '⑤ 테스트 ID 판정이 실제 ID 를 테스트로 본다');
  // ⚠ 실제 ID 를 받기 전에는 두 표의 값이 같아 값으로는 갈라지지 않는다. 그래서 갈림길을 소스로도 잰다
  ok(/return dev \? TEST_IDS : RELEASE_IDS;/.test(code(read('features/ads/config.ts'))), '⑤ 🔴 개발 빌드 갈림길(dev ? TEST_IDS) 이 사라졌다');
}

// ── ⑥ 광고 제거 판정(§A.5) ──────────────────────────────────────────────────
{
  const id = REMOVE_ADS_PRODUCT_ID;
  ok(id === 'remove_ads', `⑥ 상품 ID 가 바뀌었다(${id}) — Play 콘솔과 어긋난다`);
  ok(ownsRemoveAds([{ productId: id, purchaseState: 'purchased' }]), '⑥ 구매됨을 소유로 안 본다');
  ok(ownsRemoveAds([{ productId: id }]), '⑥ 상태가 없는 구매를 소유로 안 본다');
  ok(!ownsRemoveAds([{ productId: id, purchaseState: 'pending' }]), '⑥ 🔴 결제 대기(pending)를 지급한다');
  ok(!ownsRemoveAds([{ productId: 'other', purchaseState: 'purchased' }]), '⑥ 🔴 다른 상품으로 광고가 사라진다');
  ok(ownsRemoveAds([{ productId: 'other' }, { productId: id }]), '⑥ 목록 뒤쪽의 구매를 못 찾는다');
  for (const bad of [null, undefined, {}, 'remove_ads', [null], [1], [{ productId: id, purchaseState: 'unknown' }]]) {
    ok(!ownsRemoveAds(bad), `⑥ 이상한 목록(${JSON.stringify(bad)})을 소유로 본다`);
  }
  ok(parseAdFreeCache('1') && !parseAdFreeCache('0') && !parseAdFreeCache(null) && !parseAdFreeCache('true'), '⑥ 캐시 판정이 "1" 만 산 것으로 보지 않는다');
  ok(parseAdFreeCache(serializeAdFreeCache(true)) && !parseAdFreeCache(serializeAdFreeCache(false)), '⑥ 캐시 왕복이 깨진다');
  ok(purchaseFailureOf('user-cancelled') === 'cancelled', '⑥ 취소를 취소로 안 본다');
  ok(purchaseFailureOf('already-owned') === 'already-owned', '⑥ 이미 산 것을 알아보지 못한다');
  ok(purchaseFailureOf('network-error') === 'error' && purchaseFailureOf(undefined) === 'error', '⑥ 모르는 오류가 오류로 안 떨어진다');

  const store = code(read('features/purchase/store.ts'));
  ok(/finishTransaction\(\{\s*purchase,\s*isConsumable:\s*false\s*\}\)/.test(store), '⑥ 🔴 finishTransaction(isConsumable: false) 가 없다 — 3일 뒤 자동 환불된다');
  ok(store.includes('ownsRemoveAds(await m.getAvailablePurchases())'), '⑥ 부팅이 Play 에 다시 묻지 않는다');
  // 🔴 소유를 끄는 것은 Play 의 답(ownsRemoveAds)뿐이다. 코드가 직접 false 를 쓰면 산 사람에게 광고가 돌아온다
  ok(!/apply\(\s*false\s*\)/.test(store), '⑥ 🔴 코드가 광고 제거를 직접 끈다(apply(false))');
  // 🔴 Play 조회 실패가 캐시를 덮으면 오프라인에서 산 사람에게 광고가 돌아온다
  const catchBody = store.match(/\}\s*catch\s*\{\s*\}\s*finally\s*\{\s*usePurchase\.setState\(\{ ready: true \}\)/);
  ok(catchBody !== null, '⑥ 🔴 Play 조회 실패 경로가 캐시를 건드린다(빈 catch 가 아니다)');
}

// ── ⑦ 부팅 순서(§A.1) ───────────────────────────────────────────────────────
{
  const layout = code(read('app/_layout.tsx'));
  const ask = layout.indexOf('await requestAgeVerification()');
  const ads = layout.indexOf('await startAds()');
  ok(ask >= 0 && ads > ask, '⑦ 🔴 광고 부팅이 연령 확인보다 먼저다(또는 기다리지 않는다)');
  ok((layout.match(/startAds\(/g) ?? []).length === 1, '⑦ 🔴 광고 부팅이 두 곳 이상에서 불린다(연령 확인 전 경로가 생긴다)');
  ok(layout.includes('startPurchases()'), '⑦ 부팅이 광고 제거 캐시를 먼저 읽지 않는다');

  const ads2 = code(read('features/ads/store.ts'));
  const waitBuy = ads2.indexOf('await startPurchases()');
  const adFreeExit = ads2.indexOf('usePurchase.getState().adFree');
  const init = ads2.indexOf('.initialize()');
  ok(waitBuy >= 0 && adFreeExit > waitBuy && init > adFreeExit, '⑦ 🔴 산 사람 판정 전에 광고 SDK 를 깨운다');
  ok(ads2.includes('decideAdRequest('), '⑦ 광고 부팅이 맞춤 판정을 안 거친다');
  // 동의 요청과 요청 설정 **두 곳 모두**에 실려야 한다. 다른 값을 쓰는 자리가 있으면 안 된다
  const tags = ads2.match(/tagForUnderAgeOfConsent:\s*[^,}\s]+/g) ?? [];
  ok(
    tags.length === 2 && tags.every((x) => /request\.underAge$/.test(x)),
    `⑦ 🔴 미성년 표시가 동의·요청 설정 두 곳에 그대로 안 실린다(${tags.join(' / ')})`,
  );

  const gate = { 'components/AdBanner.tsx': 'adSlot({ live: ADS_LIVE, ready, adFree })', 'hooks/useInterstitialAd.ts': 'shouldLoadAds({ ready, adFree })' };
  for (const f of ['components/AdBanner.tsx', 'hooks/useInterstitialAd.ts']) {
    const c = code(read(f));
    ok(c.includes(gate[f]), `⑦ 🔴 ${f} 가 산 사람·준비 전 판정을 안 거친다`);
    ok(/requestNonPersonalizedAdsOnly:\s*!(request\.)?personalized/.test(c), `⑦ 🔴 ${f} 가 비맞춤 표시를 요청에 안 싣는다`);
  }
}

// ── ⑧ 비공개 테스트 동안 광고 끔(§A.6.1) ────────────────────────────────────
{
  const same = (x, y) => x === y;
  ok(same(adSlot({ live: false, ready: false, adFree: false }), 'placeholder'), '⑧ 🔴 스위치가 꺼졌는데 빈 영역을 안 그린다');
  ok(same(adSlot({ live: false, ready: true, adFree: false }), 'placeholder'), '⑧ 🔴 스위치가 꺼졌는데 준비됐다고 광고를 그린다');
  ok(same(adSlot({ live: false, ready: false, adFree: true }), 'none'), '⑧ 광고 제거를 샀는데 빈 영역을 그린다');
  ok(same(adSlot({ live: true, ready: true, adFree: false }), 'ad'), '⑧ 켜졌고 준비됐는데 광고가 아니다');
  ok(same(adSlot({ live: true, ready: false, adFree: false }), 'none'), '⑧ 준비 전에 광고 자리를 그린다');
  ok(same(adSlot({ live: true, ready: true, adFree: true }), 'none'), '⑧ 🔴 광고 제거를 샀는데 광고를 그린다');

  const app = JSON.parse(read('app.json'));
  const blocked = (app.expo.android?.blockedPermissions ?? []).includes('com.google.android.gms.permission.AD_ID');
  ok(ADS_LIVE ? !blocked : blocked, `⑧ 🔴 스위치(${ADS_LIVE})와 AD_ID 막음(${blocked})의 짝이 어긋났다. 꺼져 있으면 막고, 켜져 있으면 풀어야 한다`);
  const plugin = app.expo.plugins.find((x) => Array.isArray(x) && x[0] === 'react-native-google-mobile-ads');
  ok(plugin?.[1]?.androidAppId === RELEASE_APP_ID, '⑧ app.json androidAppId 가 config 의 RELEASE_APP_ID 와 다르다');

  const store = code(read('features/ads/store.ts'));
  const off = store.indexOf('if (!ADS_LIVE) return;');
  ok(off >= 0 && off < store.indexOf('await startPurchases()') && off < store.indexOf('.initialize()'), '⑧ 🔴 스위치가 꺼졌는데 광고 부팅이 SDK 까지 간다');
  const settings = code(read('app/(tabs)/settings.tsx'));
  ok(/ADS_LIVE && group\(t\('ads\.title'\)\)/.test(settings), '⑧ 스위치가 꺼졌는데 설정에 광고 구역이 보인다');
}

// ── 결과 ────────────────────────────────────────────────────────────────────
if (fails.length > 0) {
  console.error('\ncheck:ads 실패:\n');
  for (const f of fails.slice(0, 20)) console.error(`  ✗ ${f}`);
  if (fails.length > 20) console.error(`  … 외 ${fails.length - 20}건`);
  process.exit(1);
}
console.log(
  `\ncheck:ads OK — ${pass}개 검사 통과 ` +
    `(맞춤 판정 · 요청 여부 · 복습 끝 전면 · 배치 ${files.length}화면 대조 · ID 짝 · 광고 제거 · 부팅 순서)` +
    `\n  SELF-TEST 통과(판정이 갈라지는가 · 주석 제거 두 단계 · 배너/전면 탐지 양성 대조)\n`,
);
