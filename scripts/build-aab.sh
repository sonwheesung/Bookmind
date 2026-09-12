#!/usr/bin/env bash
# 내부 테스트 업로드용 AAB 를 굽는다. 절차 정본은 docs/BUILD.md §5~§6.
#
# 🔴 이 스크립트가 있는 이유는 편의가 아니라 **글로 적은 절차는 언젠가 빠지기 때문**이다.
#    LinkMemo 가 서명 복구를 문서에만 적어 뒀다가 다음 세션이 손으로 다시 했고,
#    그 사이 디버그 키로 서명된 AAB 가 Play 에 거부되는 경로가 열려 있었다
#    (common/R8_OBFUSCATION.md §2-C). 그래서 **게이트를 코드에 둔다.**
set -euo pipefail
cd "$(dirname "$0")/.."

KEY_ENV=/c/project/secrets/reread-upload.env
ANDROID_SDK="C:\\Users\\user\\AppData\\Local\\Android\\Sdk"

# ── ① 선행 조건 ────────────────────────────────────────────────────────────
[ -f "$KEY_ENV" ] || { echo "🔴 업로드 키 env 가 없다: $KEY_ENV (docs/BUILD.md §5)"; exit 1; }
set -a; . "$KEY_ENV"; set +a
[ -f "$KEYSTORE_PATH" ] || { echo "🔴 키스토어가 없다: $KEYSTORE_PATH"; exit 1; }

# 🔴 ANDROID_HOME 이 이 셸에 없다. adb 를 절대경로로 쓰고 있어서 있다고 착각하기 쉽다 —
#    Gradle 이 보는 환경변수는 비어 있고, 안 넣으면 3분 34초를 태우고 SDK location not found 로 죽는다.
export ANDROID_HOME="${ANDROID_HOME:-$ANDROID_SDK}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"

echo "▶ 검증 먼저 (verify + check:ota)"
npm run --silent verify

# ── ② prebuild — 서명·OTA 값을 네이티브로 옮긴다 ──────────────────────────
echo "▶ prebuild (android/ 를 새로 만든다)"
rm -rf android
REREAD_UPLOAD_STORE_FILE="$KEYSTORE_PATH" \
REREAD_UPLOAD_STORE_PASSWORD="$STORE_PASSWORD" \
REREAD_UPLOAD_KEY_ALIAS="$KEY_ALIAS" \
REREAD_UPLOAD_KEY_PASSWORD="$KEY_PASSWORD" \
  npx expo prebuild --platform android --no-install

# ⚠ prebuild 는 매번 package.json 에 "ios": "expo run:ios" 를 끼워 넣는다. 되돌린다 —
#   iOS 는 미결정 D 이고 이 PC 에서 돌지 않는다(docs/BUILD.md §2).
if node -e "process.exit(require('./package.json').scripts.ios?0:1)"; then
  node -e "
    const fs=require('fs'); const p=JSON.parse(fs.readFileSync('package.json','utf8'));
    delete p.scripts.ios; fs.writeFileSync('package.json', JSON.stringify(p,null,2)+'\n');
  "
  echo '  ↩ package.json 의 "ios" 스크립트를 되돌렸다'
fi

# ── ③ 🔴 게이트 — 실물을 보고 아니면 빌드를 죽인다 ────────────────────────
echo "▶ 게이트: 서명·OTA 가 android/ 에 실제로 들어갔나"
grep -q '^REREAD_UPLOAD_STORE_FILE=' android/gradle.properties \
  || { echo "🔴 gradle.properties 에 업로드 키가 없다 — 디버그 키로 서명된다"; exit 1; }
grep -q 'signingConfigs.upload' android/app/build.gradle \
  || { echo "🔴 release 가 upload 서명을 안 쓴다 — 플러그인 앵커가 깨졌다"; exit 1; }
npm run --silent check:ota   # 이제 축 ⑦(네이티브 반영)까지 잰다

# ── ④ AAB ─────────────────────────────────────────────────────────────────
echo "▶ bundleRelease (ABI 를 좁히지 않는다 — 스토어용이다)"
"$PWD/android/gradlew.bat" -p "$PWD/android" app:bundleRelease -x lint -x test --build-cache

AAB=android/app/build/outputs/bundle/release/app-release.aab
[ -f "$AAB" ] || { echo "🔴 AAB 가 안 만들어졌다"; exit 1; }

# ── ⑤ 🔴 서명 주체를 눈으로 — 값이 없으면 디버그 키로 조용히 떨어진다 ──────
echo ""
echo "▶ 서명 확인 (AAB 는 keytool, APK 는 apksigner — 섞으면 오진한다)"
KT=$(ls "$JAVA_HOME/bin/keytool.exe" 2>/dev/null || command -v keytool)
"$KT" -printcert -jarfile "$AAB" | grep -E 'SHA1:|Owner:|소유자:' | head -3
echo "  기대 SHA1: 44:0E:B4:48:4B:95:84:A8:84:E0:3C:5B:9A:75:B2:99:8E:DB:C4:1C"
echo ""
echo "▶ OTA 배선 확인 (AAB 안의 병합 매니페스트)"
unzip -p "$AAB" base/manifest/AndroidManifest.xml | grep -ao 'expo-channel-name' | head -1
unzip -p "$AAB" base/manifest/AndroidManifest.xml | grep -ao 'https://u.expo.dev/[a-z0-9-]*' | head -1

# ── ⑥ 🔴 권한 게이트 — 소스를 재는 가드가 원리적으로 못 보는 축 ───────────
#    vc2 에 `RECORD_AUDIO` 와 `SYSTEM_ALERT_WINDOW` 가 들어 있었다(2026-09-11 발견).
#    `app.json` 의 `android.permissions` 는 `undefined` 인데 실제 권한은 **30개**였다 —
#    라이브러리 매니페스트와 Expo 템플릿이 병합된 결과는 **산출물에만** 있다.
#    🔴 처리방침이 "다음 버전에서 제거한다"고 이용자에게 약속한 상태다. 그 약속을 여기서 지킨다.
#    `docs/STORE_LISTING.md` §4 · `docs/legal/PRIVACY.en.md` §5
echo ""
echo "▶ 권한 게이트 (허용 목록 밖이면 빌드를 죽인다)"
npm run --silent check:aab -- "$AAB"
echo ""
ls -la "$AAB"
echo ""
echo "✅ AAB 준비됐다. 업로드는 docs/BUILD.md §7 — 🔴 콘솔 선행 조건 셋을 먼저 확인한다."
