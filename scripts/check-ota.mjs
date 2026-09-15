/**
 * check:ota — OTA 설정 드리프트 검사 (`docs/OTA_SYSTEM.md` §9)
 *
 * 🔴 **OTA 의 실패는 조용하다.** 채널 하나가 빠져도, 지문이 드리프트해도, 버전 문자열이 오염돼도
 *    **빌드는 성공하고 발행도 성공한다.** 형제 셋이 그 자리에서 값을 치렀다:
 *      · 배구명가 — fingerprint runtimeVersion 드리프트로 OTA 고아 (두 번)
 *      · 배구명가 — 채널 누락으로 vc13·14 가 이틀 잠복 ("발행 성공, 아무도 못 받음")
 *      · 조각     — 채널 0개인 채로 발행 (`Remote update request not successful`)
 *      · LinkMemo — OTA 가 expoConfig.version 을 덮어 업데이트 게이트가 오염
 *    그래서 사람이 아니라 스크립트가 본다.
 *
 * 🔴 SELF-TEST 내장 — 판정 함수가 살아 있는지 **먼저** 증명한다. 실패하면 **exit 2**(검사 실패는 1).
 *    `docs/I18N_SYSTEM.md` §5.1: 형제의 가드가 정규식에 제어문자가 박혀 19일간 "아무것도 안 본 채"
 *    초록이었다. 개수는 실행량이지 검증량이 아니다.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

/** 앱 소스가 이 값을 직접 읽으면 OTA 매니페스트가 덮는다(§6). */
const VERSION_LEAK = /expoConfig\s*\??\s*\.\s*(version|android\s*\??\s*\.\s*versionCode)/;
const SRC_DIRS = ['app', 'features', 'components', 'lib', 'db', 'hooks', 'theme'];
/** Phase 7 에 신설할 유일한 허용 지점(네이티브 값을 읽는 폴백). */
const ALLOWED = new Set(['lib/app-version.ts']);

// ── 순수 판정 ────────────────────────────────────────────────────────────

/** 축 ①~⑤ — app.json · package.json */
export function judgeConfig(app, deps) {
  const bad = [];

  if (!deps['expo-updates']) {
    bad.push('① expo-updates 가 dependencies 에 없다 — OTA 자체가 안 돈다');
  }

  const u = app.updates;
  if (!u) {
    bad.push('② app.json 에 updates 블록이 없다');
  } else {
    const pid = app.extra?.eas?.projectId;
    if (typeof u.url !== 'string' || !u.url.startsWith('https://u.expo.dev/')) {
      bad.push(`② updates.url 이 이상하다: ${JSON.stringify(u.url)}`);
    } else if (pid && u.url !== `https://u.expo.dev/${pid}`) {
      bad.push(
        `② updates.url 이 extra.eas.projectId(${pid}) 와 다른 프로젝트를 가리킨다 — 남의 번들을 받게 된다`,
      );
    }
    // 🔴 로컬 그래들 빌드는 eas.json 의 channel 을 못 받는다. 여기가 유일한 통로다(§4)
    const ch = u.requestHeaders?.['expo-channel-name'];
    if (ch !== 'production') {
      bad.push(
        `③ requestHeaders["expo-channel-name"] 가 "production" 이 아니다(현재 ${JSON.stringify(ch)}) — ` +
          '로컬 빌드는 eas.json 의 channel 을 못 받으므로 여기가 유일한 통로다. ' +
          '빠지면 발행은 성공하는데 아무도 못 받는다',
      );
    }
    if (u.checkAutomatically !== 'ON_LOAD') {
      bad.push(`④ checkAutomatically 가 ON_LOAD 가 아니다(현재 ${JSON.stringify(u.checkAutomatically)})`);
    }
  }

  const rv = app.runtimeVersion;
  if (typeof rv !== 'string') {
    bad.push(
      `⑤ runtimeVersion 이 고정 문자열이 아니다: ${JSON.stringify(rv)} — ` +
        'fingerprint 정책은 로컬 빌드에서 드리프트한다. 폐기했다(OTA_SYSTEM §3)',
    );
  } else if (rv === app.version) {
    bad.push(
      `⑤ runtimeVersion("${rv}") 을 version("${app.version}") 과 같게 맞췄다 — ` +
        'runtimeVersion 은 네이티브 세대 번호이고 앱 버전과 무관하다. ' +
        '맞추는 순간 기존 빌드가 전부 OTA 고아가 된다(OTA_SYSTEM §3)',
    );
  } else if (/^\d+\.\d+\.\d+$/.test(rv)) {
    bad.push(
      `⑤ runtimeVersion("${rv}") 이 앱 버전 모양이다. 언젠가 앱 버전과 같아진다(정식 출시 1.0.0 이 그 자리였다). ` +
        'native-N 으로 쓴다(결정 #27 · OTA_SYSTEM §3.1)',
    );
  }

  // ⑧ 버전 이름. 비공개 테스트 동안은 0.1.<versionCode> 다(결정 #27). 정식(1.0.0 이상)은 건너뛴다
  const code = app.android?.versionCode;
  if (typeof app.version === 'string' && app.version.startsWith('0.') && app.version !== `0.1.${code}`) {
    bad.push(
      `⑧ 테스트 기간 버전 이름 "${app.version}" 이 0.1.${code}(versionCode) 가 아니다. ` +
        'versionCode 를 올릴 때 이름도 같이 올린다(결정 #27 · BUILD §7.1)',
    );
  }
  return bad;
}

/** 축 ⑥ — 소스가 expoConfig.version 을 직접 읽나 */
export function judgeSources(files) {
  const offenders = files.filter((f) => !ALLOWED.has(f.rel) && VERSION_LEAK.test(f.src));
  if (offenders.length === 0) return [];
  return [
    `⑥ expoConfig.version/versionCode 를 직접 읽는 파일 ${offenders.length}개: ` +
      `${offenders.map((f) => f.rel).join(', ')} — OTA 가 그 값을 덮는다. ` +
      'lib/app-version.ts(네이티브 값)를 통로로 쓴다(OTA_SYSTEM §6)',
  ];
}

/** 축 ⑦ — prebuild 가 네이티브에 실제로 옮겼나 */
export function judgeNative(manifest, strings, expect) {
  const bad = [];
  if (!manifest.includes('EXPO_UPDATE_URL')) {
    bad.push('⑦ AndroidManifest 에 EXPO_UPDATE_URL 이 없다 — prebuild 가 안 옮겼다');
  } else if (!manifest.includes(expect.url)) {
    bad.push(`⑦ AndroidManifest 의 EXPO_UPDATE_URL 이 app.json 과 다르다 (기대 ${expect.url})`);
  }
  if (!manifest.includes('expo-channel-name')) {
    bad.push('🔴 ⑦ AndroidManifest 에 채널 헤더가 없다 — 발행해도 아무도 못 받는다(§4)');
  }
  // 🔴 꺾쇠까지 붙여 대조한다. 그냥 includes 면 `native-1` 이 `native-10` 안에 들어맞는다(2026-09-15)
  if (strings !== null && !strings.includes(`>${expect.runtimeVersion}<`)) {
    bad.push(
      `⑦ strings.xml 의 expo_runtime_version 이 app.json(${expect.runtimeVersion}) 과 다르다 — ` +
        '어긋나면 오류 없이 업데이트만 안 간다',
    );
  }
  return bad;
}

// ── 🔴 SELF-TEST — 판정 함수가 살아 있는지 먼저 증명한다 ──────────────────

function selfTest() {
  const fail = (m) => {
    console.error(`SELF-TEST FAIL: ${m}`);
    process.exit(2);
  };
  const good = {
    version: '0.1.1',
    runtimeVersion: 'native-1',
    android: { versionCode: 1 },
    updates: {
      url: 'https://u.expo.dev/AAA',
      checkAutomatically: 'ON_LOAD',
      requestHeaders: { 'expo-channel-name': 'production' },
    },
    extra: { eas: { projectId: 'AAA' } },
  };
  const deps = { 'expo-updates': '~29.0.0' };

  // ① 정상은 통과해야 한다 — 이게 없으면 가드가 항상 FAIL 하는 것도 못 본다
  if (judgeConfig(good, deps).length !== 0) fail('정상 설정을 통과시키지 못한다');

  // ② 갈래마다 실제로 잡는가
  const mut = [
    ['expo-updates 누락', { ...good }, {}],
    ['채널 누락', { ...good, updates: { ...good.updates, requestHeaders: {} } }, deps],
    ['채널 오타', { ...good, updates: { ...good.updates, requestHeaders: { 'expo-channel-name': 'internal' } } }, deps],
    ['ON_LOAD 아님', { ...good, updates: { ...good.updates, checkAutomatically: 'ON_ERROR_RECOVERY' } }, deps],
    ['projectId 불일치', { ...good, extra: { eas: { projectId: 'BBB' } } }, deps],
    ['fingerprint 정책', { ...good, runtimeVersion: { policy: 'fingerprint' } }, deps],
    ['runtimeVersion == version', { ...good, runtimeVersion: '0.1.1' }, deps],
    ['runtimeVersion 이 앱 버전 모양', { ...good, runtimeVersion: '2.0.0' }, deps],
    ['테스트 이름 n ≠ versionCode', { ...good, version: '0.1.5' }, deps],
    ['테스트 이름 옛 모양', { ...good, version: '0.7.0', android: { versionCode: 7 } }, deps],
    ['versionCode 없음', { ...good, android: {} }, deps],
  ];
  for (const [what, app, d] of mut) {
    if (judgeConfig(app, d).length === 0) fail(`변이를 못 잡는다 — ${what}`);
  }
  // 🔴 양성 대조: 정식 출시 이름(1.0.0 이상)은 테스트 이름 규칙에 걸리지 않는다
  if (judgeConfig({ ...good, version: '1.0.0', android: { versionCode: 9 } }, deps).length !== 0) {
    fail('정식 출시 이름을 테스트 규칙으로 막는다');
  }

  // ③ 🔴 양성 대조 — 소스 스캔 정규식이 **실제로 무언가를 수집하는가**
  //    (0건이 "없다"인지 "안 본다"인지를 가르는 유일한 검사다)
  const leak = [{ rel: 'app/x.ts', src: 'const v = Constants.expoConfig?.version;' }];
  if (judgeSources(leak).length === 0) fail('소스 스캔이 위반을 못 잡는다 — 정규식이 죽었을 수 있다');
  if (judgeSources([{ rel: 'lib/app-version.ts', src: 'Constants.expoConfig?.version' }]).length !== 0) {
    fail('허용 지점(lib/app-version.ts)까지 잡는다');
  }
  if (judgeSources([{ rel: 'app/y.ts', src: 'const v = APP_VERSION;' }]).length !== 0) {
    fail('멀쩡한 파일을 잡는다 — 오탐');
  }

  // ④ 네이티브 판정
  const exp = { url: 'https://u.expo.dev/AAA', runtimeVersion: 'native-1' };
  const rvXml = (v) => `<string name="expo_runtime_version">${v}</string>`;
  if (judgeNative('EXPO_UPDATE_URL https://u.expo.dev/AAA expo-channel-name', rvXml('native-1'), exp).length !== 0) {
    fail('정상 매니페스트를 통과시키지 못한다');
  }
  if (judgeNative('EXPO_UPDATE_URL https://u.expo.dev/AAA', rvXml('native-1'), exp).length === 0) {
    fail('채널 헤더 누락을 못 잡는다');
  }
  if (judgeNative('EXPO_UPDATE_URL https://u.expo.dev/AAA expo-channel-name', rvXml('native-10'), exp).length === 0) {
    fail('🔴 native-10 을 native-1 로 읽는다(부분 문자열 대조)');
  }
}

// ── 본검사 ───────────────────────────────────────────────────────────────

selfTest();

const app = JSON.parse(read('app.json')).expo;
const deps = JSON.parse(read('package.json')).dependencies ?? {};
const failures = [...judgeConfig(app, deps)];

const files = [];
for (const dir of SRC_DIRS) {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) continue;
  for (const f of readdirSync(abs, { recursive: true, encoding: 'utf8' })) {
    if (!/\.(ts|tsx)$/.test(String(f))) continue;
    const rel = `${dir}/${String(f).replaceAll('\\', '/')}`;
    files.push({ rel, src: readFileSync(join(abs, f), 'utf8') });
  }
}
failures.push(...judgeSources(files));

const MANIFEST = 'android/app/src/main/AndroidManifest.xml';
const STRINGS = 'android/app/src/main/res/values/strings.xml';
let nativeNote = '⏸ android/ 가 없어 축 ⑦(네이티브 반영)은 안 쟀다 — 빌드 전이면 정상이다';
if (existsSync(join(ROOT, MANIFEST))) {
  const strings = existsSync(join(ROOT, STRINGS)) ? read(STRINGS) : null;
  failures.push(
    ...judgeNative(read(MANIFEST), strings, {
      url: app.updates?.url ?? '',
      runtimeVersion: String(app.runtimeVersion ?? ''),
    }),
  );
  nativeNote = '✅ 축 ⑦ 네이티브 반영까지 쟀다';
}

if (failures.length > 0) {
  console.error(`\ncheck:ota 실패 ${failures.length}건:\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error('');
  process.exit(1);
}
console.log(
  `\ncheck:ota OK — runtimeVersion ${app.runtimeVersion} · 채널 production · ${app.updates.url}` +
    `\n  소스 ${files.length}개 스캔 · SELF-TEST 통과\n  ${nativeNote}\n`,
);
