const { withAppBuildGradle, withGradleProperties } = require('expo/config-plugins');

/**
 * 릴리스 AAB 를 **업로드 키**로 서명하도록 `android/` 에 배선한다.
 *
 * 🔴 **왜 플러그인인가 — `prebuild` 가 손으로 넣은 것을 지운다.**
 *   `android/` 는 CNG 산출물이라(`docs/BUILD.md` §2) 네이티브 모듈이 하나만 늘어도 `prebuild` 가
 *   다시 만들며 `build.gradle` 과 `gradle.properties` 를 **함께 날린다.** 그러면 다음 릴리스가
 *   **디버그 키로 조용히 서명되고**, `jarsigner -verify` 는 통과한다(서명이 있기는 하니까).
 *   Play 업로드에서야 드러나는데 그때는 이미 빌드 시간을 태운 뒤다.
 *   LinkMemo 가 정확히 이것을 밟았다(`common/R8_OBFUSCATION.md` §2-C).
 *
 * 승계: `C:\project\diary\plugins\with-upload-signing.js` (앵커 두 개와 CRLF 함정까지 그대로).
 *
 * 값은 저장소에 두지 않는다. `process.env` 로 받는다(`C:/project/secrets/reread-upload.env`).
 *
 *   set -a; . /c/project/secrets/reread-upload.env; set +a
 *   REREAD_UPLOAD_STORE_FILE="$KEYSTORE_PATH" \
 *   REREAD_UPLOAD_STORE_PASSWORD="$STORE_PASSWORD" \
 *   REREAD_UPLOAD_KEY_ALIAS="$KEY_ALIAS" \
 *   REREAD_UPLOAD_KEY_PASSWORD="$KEY_PASSWORD" \
 *   npx expo prebuild --platform android --no-install
 *
 * ⚠ **값이 없으면 디버그 키로 떨어진다.** `assembleDebug` 가 비밀 없이도 돌아야 하기 때문이다.
 *   그래서 AAB 를 구운 뒤 **서명 주체를 눈으로 확인한다**(`docs/BUILD.md` §6 의 세 줄).
 */

const KEYS = [
  'REREAD_UPLOAD_STORE_FILE',
  'REREAD_UPLOAD_STORE_PASSWORD',
  'REREAD_UPLOAD_KEY_ALIAS',
  'REREAD_UPLOAD_KEY_PASSWORD',
];

/**
 * `findProperty` 로 읽고 없으면 디버그 키로 떨어진다.
 * gradle 설정 단계에서 던지면 `assembleDebug` 까지 함께 죽어 개발이 막힌다.
 */
const SIGNING_BLOCK = `
        upload {
            storeFile file(findProperty('REREAD_UPLOAD_STORE_FILE') ?: 'debug.keystore')
            storePassword findProperty('REREAD_UPLOAD_STORE_PASSWORD') ?: 'android'
            keyAlias findProperty('REREAD_UPLOAD_KEY_ALIAS') ?: 'androiddebugkey'
            keyPassword findProperty('REREAD_UPLOAD_KEY_PASSWORD') ?: 'android'
        }
`;

function patchBuildGradle(contents) {
  if (contents.includes('REREAD_UPLOAD_STORE_FILE')) {
    return contents; // 이미 적용됨 — prebuild 를 두 번 돌려도 중복되지 않는다
  }

  /*
   * `signingConfigs {` 바로 뒤에 끼워 넣는다. gradle 은 블록 안 순서를 안 따지므로
   * debug 블록의 끝을 정확히 찾을 필요가 없다. **앵커가 짧을수록 템플릿 변화에 덜 깨진다.**
   *
   * ⚠ **줄바꿈이 CRLF 다.** `\{\n` 으로 잡으면 사이의 `\r` 때문에 조용히 안 맞는다(조각 실측).
   */
  const anchor = /(signingConfigs\s*\{[\r\n]+)/;
  if (!anchor.test(contents)) {
    throw new Error(
      'with-upload-signing: build.gradle 에서 signingConfigs 를 못 찾았다. ' +
        'RN 템플릿이 바뀌었을 수 있다 — 이 플러그인을 먼저 고친다.',
    );
  }
  let next = contents.replace(anchor, `$1${SIGNING_BLOCK}`);

  /*
   * release 가 debug 키로 서명되던 기본값을 upload 로 바꾼다.
   *
   * ⚠ **`release\s*\{\s*signingConfig` 로 잡으면 안 된다.** RN 템플릿이 `release {` 바로 뒤에
   *   주석 두 줄을 넣는데 `\s*` 가 그걸 못 넘는다(조각이 2026-08-24 에 깨졌다):
   *
   *     release {
   *         // Caution! In production, you need to generate your own keystore file.
   *         signingConfig signingConfigs.debug
   *
   *   그래서 `buildTypes → release → 그 뒤 첫 signingConfig` 로 잡는다. 게으른 매칭이라
   *   앞선 `debug { signingConfig ... }` 를 건너뛰고 release 블록 안에서 멈춘다.
   *
   * ⚠ 앵커가 깨지면 **던진다.** 조용히 넘어가면 디버그 키로 서명된 AAB 가 나오고,
   *   Play 는 이유를 안 알려준다.
   */
  const releaseSigning =
    /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?signingConfig\s+)signingConfigs\.debug/;
  if (!releaseSigning.test(next)) {
    throw new Error(
      'with-upload-signing: release 의 signingConfig 를 못 찾았다. 서명이 안 바뀌면 ' +
        'Play 가 업로드를 거부한다 — 조용히 넘어가지 않는다.',
    );
  }
  next = next.replace(releaseSigning, '$1signingConfigs.upload');
  return next;
}

module.exports = function withUploadSigning(config) {
  config = withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error('with-upload-signing: build.gradle 이 groovy 가 아니다');
    }
    cfg.modResults.contents = patchBuildGradle(cfg.modResults.contents);
    return cfg;
  });

  config = withGradleProperties(config, (cfg) => {
    /*
     * ⚠ `process.env[key]` 로 돌리지 않는다. `expo/no-dynamic-env-var` 가 막는다.
     *   네 줄을 적는 편이 예외를 만드는 것보다 싸고, 키를 늘릴 때 여기도 고쳐야 한다는 것이
     *   오히려 안전장치다.
     */
    const env = {
      REREAD_UPLOAD_STORE_FILE: process.env.REREAD_UPLOAD_STORE_FILE,
      REREAD_UPLOAD_STORE_PASSWORD: process.env.REREAD_UPLOAD_STORE_PASSWORD,
      REREAD_UPLOAD_KEY_ALIAS: process.env.REREAD_UPLOAD_KEY_ALIAS,
      REREAD_UPLOAD_KEY_PASSWORD: process.env.REREAD_UPLOAD_KEY_PASSWORD,
    };
    for (const key of KEYS) {
      const value = env[key];
      if (value === undefined || value === '') continue;
      const existing = cfg.modResults.find((item) => item.type === 'property' && item.key === key);
      if (existing !== undefined) {
        existing.value = value;
      } else {
        cfg.modResults.push({ type: 'property', key, value });
      }
    }
    return cfg;
  });

  return config;
};
