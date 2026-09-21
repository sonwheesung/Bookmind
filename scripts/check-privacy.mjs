#!/usr/bin/env node
/**
 * 처리방침 가드 — `docs/legal/PRIVACY.{en,ko}.md` 가 **배포본과 같은 말을 하는지** 잰다.
 *
 * 🔴 **왜 필요한가**: 처리방침은 한 번 쓰고 잊는 문서이고, 거짓이 되는 방식이 조용하다.
 *    코드가 네트워크 호출을 하나 더 갖는 순간 *"앱이 보내는 요청은 한 종류뿐"* 이 거짓이 되는데,
 *    그때 아무도 이 파일을 열지 않는다. 형제 프로젝트가 실제로 그 자리에 있었다
 *    (`common/PLAY_CONSOLE_STATUS.md` 조각 행 — *"데이터 보안 선언이 배포본보다 좁음"*).
 *
 * 🔴 **드리프트의 방향이 한쪽으로 위험하다.** 방침이 배포본보다 **좁으면** 그건 미신고이고,
 *    넓으면 안 하는 일을 한다고 적은 것이다. 둘 다 틀리지만 전자가 법적으로 더 나쁘다.
 *    그래서 축 ①②④⑦ 은 전부 **"코드가 늘었는데 방침이 그대로"** 를 잡는 방향으로 세웠다.
 *
 * ★ 이 저장소가 다섯 번 배운 문장을 여기서도 지킨다.
 *   **검사가 재려는 것이 입력에서 이미 참이면 그 검사는 아무것도 안 지킨다.**
 *   그래서 SELF-TEST 는 판정 함수에 **위반하는 입력**을 직접 먹여서 발화를 확인한다.
 *
 * 종료 코드: **2 = 자체 검사 실패** · **1 = 검사 실패** · 0 = 통과
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

// ── 소스 수집 ─────────────────────────────────────────────────────────
const SRC_DIRS = ['app', 'features', 'lib', 'db', 'components', 'hooks', 'theme'];

function sourceFiles() {
  const out = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(join(ROOT, dir));
    } catch {
      return;
    }
    for (const e of entries) {
      const rel = `${dir}/${e}`;
      if (statSync(join(ROOT, rel)).isDirectory()) walk(rel);
      else if (['.ts', '.tsx'].includes(extname(e))) out.push(rel);
    }
  };
  SRC_DIRS.forEach(walk);
  return out;
}

// ── 판정 함수 (SELF-TEST 가 직접 먹인다) ──────────────────────────────

/** 광고·분석·오류수집 SDK 이름 */
export function trackingDeps(deps) {
  return Object.keys(deps).filter((k) =>
    /admob|google-mobile-ads|analytics|sentry|firebase|amplitude|mixpanel|segment|appsflyer|adjust|bugsnag|crashlytics/i.test(
      k,
    ),
  );
}

/** 소스에서 직접 거는 네트워크 호출 */
export function networkCallSites(files) {
  return files.filter((f) => /\b(fetch|XMLHttpRequest|WebSocket|axios)\s*\(/.test(f.text)).map((f) => f.path);
}

/** 푸시 토큰 등록 (있으면 서버에 기기가 등록된다) */
export function pushTokenSites(files) {
  return files.filter((f) => /getExpoPushToken|getDevicePushToken/.test(f.text)).map((f) => f.path);
}

/**
 * 앱이 접속하는 원격 호스트 전부.
 * 🔴 `app.json` 과 소스의 문자열 리터럴을 함께 본다. 한쪽만 보면 새 서버가 샌다.
 */
export function remoteHosts(appJsonText, files) {
  const hosts = new Set();
  const add = (text) => {
    for (const m of text.matchAll(/https:\/\/([a-z0-9.-]+)/gi)) {
      const h = m[1].toLowerCase();
      if (h === 'localhost' || h.endsWith('.local')) continue;
      hosts.add(h);
    }
  };
  add(appJsonText);
  // 🔴 주석은 뺀다. 문서 링크를 접속처로 세면 오탐이 나고, 오탐이 나는 가드는 꺼진다.
  for (const f of files) {
    add(f.text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''));
  }
  return [...hosts].sort();
}

/**
 * 광고·분석 SDK 마다 방침이 반드시 적어야 하는 말(2026-09-21 · 결정 #29 · #31).
 * 🔴 **표에 없는 SDK 는 곧 실패다.** 새 광고·분석 SDK 를 넣으면 여기와 방침을 함께 고쳐야 통과한다.
 */
export const SDK_DISCLOSURES = {
  'react-native-google-mobile-ads': {
    en: ['Google LLC (AdMob', 'Advertising ID', 'User Messaging Platform', 'non-personalised'],
    ko: ['Google LLC (AdMob', '광고 식별자', 'User Messaging Platform', '맞춤이 아닌 광고'],
  },
};

/** 의존성에 있는데 방침이 필요한 말을 안 적은 SDK. 표에 없는 SDK 는 전부 여기로 떨어진다 */
export function undisclosedSdks(tracking, en, ko) {
  return tracking.filter((dep) => {
    const need = SDK_DISCLOSURES[dep];
    if (need === undefined) return true;
    return need.en.some((w) => !en.includes(w)) || need.ko.some((w) => !ko.includes(w));
  });
}

/** 두 언어의 `## ` 헤딩 수 */
export function sectionCount(md) {
  return (md.match(/^## /gm) ?? []).length;
}

/** 법정 기재사항이 들어 있나 */
export function missingLegalFields(md, fields) {
  return fields.filter((f) => !md.includes(f));
}

// ── SELF-TEST ─────────────────────────────────────────────────────────
function selfTest() {
  const fail = (m) => {
    console.error(`  ✗ SELF-TEST: ${m}`);
    process.exit(2);
  };
  const F = (path, text) => ({ path, text });

  if (trackingDeps({ react: '1' }).length !== 0) fail('깨끗한 의존성을 오탐했다');
  if (trackingDeps({ '@sentry/react-native': '1' }).length !== 1) fail('sentry 를 안 잡았다');
  if (trackingDeps({ 'react-native-google-mobile-ads': '1' }).length !== 1) fail('광고 SDK 를 안 잡았다');
  // 🔴 표에 없는 SDK 와 말이 빠진 방침을 **각각** 잡는가. 둘 다 지나가게 해야 두 경로가 지켜진다
  const ads = 'react-native-google-mobile-ads';
  const full = (lang) => SDK_DISCLOSURES[ads][lang].join(' ');
  if (undisclosedSdks([ads], full('en'), full('ko')).length !== 0) fail('다 적은 방침을 오탐했다');
  if (undisclosedSdks([ads], full('en'), '').length !== 1) fail('ko 에 빠진 고지를 안 잡았다');
  if (undisclosedSdks([ads], '', full('ko')).length !== 1) fail('en 에 빠진 고지를 안 잡았다');
  if (undisclosedSdks(['@sentry/react-native'], full('en'), full('ko')).length !== 1) fail('표에 없는 SDK 를 통과시켰다');

  if (networkCallSites([F('a.ts', 'const x = 1;')]).length !== 0) fail('네트워크 없는 파일을 오탐했다');
  if (networkCallSites([F('a.ts', 'await fetch(url)')]).length !== 1) fail('fetch 를 안 잡았다');
  if (networkCallSites([F('a.ts', 'axios(url)')]).length !== 1) fail('axios 를 안 잡았다');

  if (pushTokenSites([F('a.ts', 'scheduleNotificationAsync()')]).length !== 0) fail('로컬 알림을 오탐했다');
  if (pushTokenSites([F('a.ts', 'Notifications.getExpoPushTokenAsync()')]).length !== 1) {
    fail('푸시 토큰 등록을 안 잡았다');
  }

  // 🔴 양성 대조 — 주석 안의 링크는 접속처가 아니다.
  //    ⚠ **주석 제거는 두 단계다**(블록 `/* */` 와 한 줄 `//`). 처음에는 한 줄 주석만 대조에 넣었는데,
  //    그러면 **블록 주석 단계를 망가뜨리는 변이가 침묵한다**(2026-09-11 변이 주입으로 실제로 확인).
  //    ★ 검사가 안 지나가는 경로를 남기면 그 경로는 안 지켜진다. 그래서 둘 다 넣는다.
  const hosts = remoteHosts('{"url":"https://u.expo.dev/x"}', [
    F(
      'a.ts',
      '/* 설계 근거: https://block-comment.example/spec */\n' +
        '// see https://line-comment.example/docs\n' +
        'const u = "https://api.reread.app/v1";',
    ),
  ]);
  if (!hosts.includes('u.expo.dev')) fail('app.json 의 호스트를 못 읽었다');
  if (!hosts.includes('api.reread.app')) fail('소스의 호스트를 못 읽었다');
  if (hosts.includes('line-comment.example')) fail('한 줄 주석 안의 링크를 접속처로 셌다');
  if (hosts.includes('block-comment.example')) fail('블록 주석 안의 링크를 접속처로 셌다');

  if (sectionCount('## a\n## b\n### c') !== 2) fail('절 수를 잘못 셌다');
  if (missingLegalFields('사업자등록번호 749', ['749']).length !== 0) fail('있는 항목을 없다고 했다');
  if (missingLegalFields('내용', ['749']).length !== 1) fail('빠진 항목을 안 잡았다');
}

selfTest();

// ── 실행 ──────────────────────────────────────────────────────────────
const en = read('docs/legal/PRIVACY.en.md');
const ko = read('docs/legal/PRIVACY.ko.md');
const pkg = JSON.parse(read('package.json'));
const appJsonText = read('app.json');
const files = sourceFiles().map((p) => ({ path: p, text: read(p) }));

const problems = [];

// ① 광고·분석 SDK 가 있으면 방침이 그것을 적었어야 한다
//    🔄 2026-09-21 광고를 넣었다(결정 #29). 그전에는 "없어야 한다"였다. 이제는 **적었어야 한다**이고,
//    표(SDK_DISCLOSURES)에 없는 SDK 는 적었는지 잴 수 없으므로 실패다.
const tracking = trackingDeps({ ...pkg.dependencies, ...pkg.devDependencies });
const undisclosed1 = undisclosedSdks(tracking, en, ko);
if (undisclosed1.length > 0) {
  problems.push(
    `① 의존성의 광고·분석 SDK 를 방침이 적지 않았다: ${undisclosed1.join(', ')}\n` +
      '    방침 §4(나가는 것) · §7(수탁자)을 먼저 고치고 SDK_DISCLOSURES 에 필요한 말을 적는다.',
  );
}

// ①-b 광고 제거 결제(expo-iap)가 있으면 방침이 Google Play 결제를 적었어야 한다
if ('expo-iap' in (pkg.dependencies ?? {})) {
  if (!en.includes('payment is handled by Google Play') || !ko.includes('결제는 **Google Play 가 처리합니다.**')) {
    problems.push('①-b 인앱 결제(expo-iap)를 쓰는데 방침에 Google Play 결제 고지(§4.3)가 없다.');
  }
}

// ② 앱 코드가 직접 거는 네트워크 호출은 0건이어야 한다
const netSites = networkCallSites(files);
if (netSites.length > 0) {
  problems.push(
    `② 방침은 요청이 업데이트 확인 한 종류뿐이라고 적었는데 소스가 직접 호출한다: ${netSites.join(', ')}\n` +
      '    §4 를 먼저 고치고 수탁자 표에 받는 곳을 추가한다.',
  );
}

// ③ 실제 업데이트 URL 의 호스트가 방침에 적혀 있어야 한다
const updatesUrl = JSON.parse(appJsonText).expo?.updates?.url ?? '';
const updatesHost = updatesUrl.replace(/^https:\/\//, '').split('/')[0];
if (!updatesHost) {
  problems.push('③ `app.json` 에 업데이트 URL 이 없다. 방침 §4.1 이 근거를 잃는다.');
} else if (!en.includes('EAS Update') || !ko.includes('EAS Update')) {
  problems.push('③ 업데이트 서비스를 쓰는데 방침에 `EAS Update` 가 없다.');
}

// ④ 푸시 토큰을 등록하지 않는다고 적었으면 실제로 없어야 한다
const push = pushTokenSites(files);
if (push.length > 0) {
  problems.push(
    `④ 방침은 푸시 토큰을 등록하지 않는다고 적었는데 등록한다: ${push.join(', ')}\n` +
      '    §4.2 를 고치고 알림 서버를 수탁자 표에 넣는다.',
  );
}

// ⑤ 두 언어의 절 구성이 같아야 한다
if (sectionCount(en) !== sectionCount(ko)) {
  problems.push(`⑤ 절 수가 다르다. en ${sectionCount(en)} · ko ${sectionCount(ko)}`);
}

// ⑥ 법정 기재사항
const KO_FIELDS = ['749-25-02260', '개인정보 보호책임자', 'support@vivace-games.com', '시행일'];
const EN_FIELDS = ['749-25-02260', 'Privacy officer', 'support@vivace-games.com', 'Effective date'];
const mk = missingLegalFields(ko, KO_FIELDS);
const me = missingLegalFields(en, EN_FIELDS);
if (mk.length) problems.push(`⑥ ko 에 법정 기재사항이 빠졌다: ${mk.join(', ')}`);
if (me.length) problems.push(`⑥ en 에 법정 기재사항이 빠졌다: ${me.join(', ')}`);

// ⑦ 🔴 앱이 접속하는 호스트가 전부 방침에 적혀 있어야 한다
const hosts = remoteHosts(appJsonText, files);
const undisclosed = hosts.filter((h) => !en.includes(h) && !en.includes(h.split('.').slice(-2).join('.')));
if (undisclosed.length > 0) {
  problems.push(
    `⑦ 방침에 없는 접속처가 코드에 있다: ${undisclosed.join(', ')}\n` +
      '    🔴 이 방향의 드리프트가 가장 나쁘다. 안 적은 곳으로 데이터가 나가는 것이다.',
  );
}

if (problems.length > 0) {
  console.error(`check:privacy FAIL (${problems.length})`);
  for (const p of problems) console.error('  ' + p);
  process.exit(1);
}

console.log(
  `check:privacy OK — 7축 · 접속처 ${hosts.length}곳(${hosts.join(' · ')}) · ` +
    `광고/분석 SDK ${tracking.length}(고지됨) · 네트워크 호출 0 · 절 ${sectionCount(en)}개 대칭 · SELF-TEST 통과`,
);
