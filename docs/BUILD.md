# BUILD — 안드로이드 빌드와 실기기 설치

> 2026-09-09 첫 실기기 빌드에서 **실제로 밟은 것만** 적는다. 형제 프로젝트에서 베끼지 않았다.
> 알림의 네이티브 리소스는 [`REVIEW_SYSTEM.md`](./REVIEW_SYSTEM.md) §6.3, 아이콘 결정은
> [`DESIGN_REVIEW.md`](./DESIGN_REVIEW.md) §3.

---

## 0. 🔴 어떤 빌드를 쓸 것인가부터 고른다

여기서 잘못 고르면 나머지가 전부 헛수고가 된다. 2026-09-09 에 그렇게 됐다.

| | 개발 빌드(debug) | **릴리스 빌드(release)** |
|---|---|---|
| JS | PC 의 Metro 에서 **매번 받아온다** | 🟢 **APK 안에 구워져 있다** |
| PC 없이 | ❌ 안 열린다 | 🟢 혼자 돈다 |
| 코드 고치면 | 즉시 반영 | 다시 빌드해야 한다 |
| 쓸 자리 | 화면을 고치며 볼 때 | 🔴 **며칠짜리 관찰**(알림 · Doze · 재부팅) |

🔴 **Phase 4 의 알림 관찰은 릴리스 빌드로 한다.** 며칠 동안 폰을 들고 다녀야 하는데
개발 빌드는 PC 의 Metro 에 묶여 있다. 집을 나서면 앱이 안 열린다.

⚠ 2026-09-09 에 개발 빌드로 시작해 **한 시간 넘게 붙이지 못했다.** 원인을 다 찾지도 못했다.
답은 원인 추적이 아니라 **목적에 맞는 도구로 옮기는 것**이었다.

🟢 `android/app/build.gradle` 의 release 가 **debug 키로 서명**하게 되어 있어
별도 키스토어 없이 릴리스 APK 를 만들 수 있다.
~~⚠ 스토어용 서명 키는 Phase 11 에서 따로 만든다.~~
→ 🔴 **2026-09-10 에 앞당겼다.** 내부 테스트 업로드를 하려면 **업로드 키**가 필요하다(§5).
디버그 키로 서명된 AAB 는 Play 가 받지 않고, **이유를 안 알려준다.**
🟢 폰에 직접 넣는 APK 는 여전히 디버그 키로 충분하다. 두 경로가 나뉘었을 뿐이다.

---

## 1. 사전 조건

```bash
export ANDROID_HOME="C:\Users\user\AppData\Local\Android\Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
```

🔴 **이 셸에 `ANDROID_HOME` 이 없다.** `adb` 를 절대경로로 잘 쓰고 있어서 SDK 가 있다고 착각했는데,
**Gradle 이 보는 환경변수는 비어 있었다.** 안 넣으면 3분 34초를 태우고 이렇게 죽는다:

```
SDK location not found. Define a valid SDK location with an ANDROID_HOME environment variable
```

## 2. 릴리스 APK 만들기

```bash
npx expo prebuild --platform android --no-install
"$PWD/android/gradlew.bat" -p "$PWD/android" app:assembleRelease \
  -x lint -x test --build-cache -PreactNativeArchitectures=arm64-v8a
# → android/app/build/outputs/apk/release/app-release.apk
```

실측(2026-09-09): **5분 39초 · 28MB**. 개발 빌드는 13분 25초 · 48MB 였다.

⚠ `prebuild` 는 **매번 `package.json` 에 `"ios": "expo run:ios"` 를 끼워 넣는다.** 되돌린다 —
iOS 는 ⚠ 미결정 D 이고 이 PC 에서 돌지 않는다. 2026-09-09 하루에만 네 번 되돌렸다.

```bash
git checkout -- package.json      # 🔴 이렇게 되돌린다
```

🚫 **줄만 지우지 말 것.** 2026-09-10 에 그 줄을 손으로 지웠다가 앞 줄의 **쉼표가 남아**
`package.json` 이 깨졌고, 빌드가 25초 만에 이렇게 죽었다.

```
* Where: Settings file 'android\settings.gradle' line: 29
> Process 'command 'cmd'' finished with non-zero exit value 1
```

🔴 **이 메시지는 원인을 하나도 안 알려준다.** gradle 은 자기가 부른 명령의 종료 코드만 옮긴다.
진짜 이유는 그 명령을 직접 돌려야 나온다.

```bash
npx expo-modules-autolinking react-native-config --platform android --json
# → SyntaxError: Expected double-quoted property name in JSON at position 2005
```

★ **gradle 이 "명령이 1 로 죽었다"고 하면 그 명령을 손으로 돌려 본다.** 25초를 태우고
settings.gradle 을 들여다보는 대신 한 줄로 끝난다.

⚠ `android/` 는 CNG 산출물이라 커밋하지 않고, 확인이 끝나면 지운다. 남기면 `app.json` 과 어긋난 채
다음 세션을 속인다. 🚫 지울 때 Gradle 데몬이 `.dex` 를 물고 있으면 그냥 둔다 —
**`gradlew --stop` 을 쓰지 않는다. 형제 프로젝트의 빌드까지 죽인다.**

## 2.1 🔧 라우트를 더했는데 `tsc` 가 계속 빨갛다 (2026-09-10)

증상: `app/` 에 화면을 추가하고 `router.push('/practice')` 를 쓰면 tsc 가
*"Argument of type '/practice' is not assignable"* 를 낸다. 파일은 분명히 있다.

원인: expo-router 의 타입 생성이 **증분으로 틀리게 갱신된다.** 실제로 나온 값은 이랬다.

```
`/practice/index`   ← 🔴 index.tsx 를 접지 않았다
`/practice/new`
`/practice/[id]`
```

같은 구조인 `app/books/` 는 `/books` 로 멀쩡히 접혀 있었다. 차이는 하나뿐이다.
**Metro 가 이미 떠 있는 동안 파일이 생겼는가.**

고치는 법:

```bash
# Metro 를 멈추고
rm -f .expo/types/router.d.ts
npx expo start --port 8091      # 지운 자리에 처음부터 다시 만든다
```

🚫 **`tsc` 를 의심하지 말 것.** 우리는 여기서 두 번 헤맸다(검색·통계 때 한 번, 실천 때 또 한 번).
🔴 `.expo/types/router.d.ts` 는 **산출물이지 소스가 아니다.** 이상하면 지우고 다시 만든다.

## 3. 폰에 넣기 (무선 디버깅)

```bash
adb mdns services                      # adb-XXXX  _adb-tls-connect._tcp  192.168.0.22:PORT
adb -s <기기> install <apk 경로>
```

- 페어링이 한 번 돼 있으면 폰에서 **무선 디버깅을 켜기만** 하면 자동으로 잡힌다.
- ⚠ **폰이 잠들면 끊기고 포트가 바뀐다.** 설치 중에는 화면을 켜 둔다.
- 🔴 debug 와 release 는 **서명이 달라 덮어쓰기가 안 된다.** 먼저 `adb uninstall` 한다.
- 🚫 잠금 화면은 우리가 풀지 않는다. 앱 실행 확인은 사용자에게 넘긴다.

## 4. 🔴 Metro 가 200 을 준다고 쓸 수 있는 게 아니다

개발 빌드로 볼 때만 해당한다. 상세는 [`README.md`](./README.md) §3.2.

```bash
# 🚫 이것만 보고 "Metro OK" 라고 하지 않는다
curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8091/status

# ✅ 로그에 감시자 오류가 없는지 + 실제로 번들이 나오는지
grep -c "Failed to start watch mode" <metro 로그>
curl -H "expo-platform: android" -H "accept: multipart/mixed" http://127.0.0.1:8091/   # 매니페스트
```

실측: 감시자가 죽어도 `status` 는 200 이었다. 그리고 **첫 번들은 232초**가 걸렸다(메모리가 빠듯할 때).
🟢 `--max-workers 2` 로 올리면 감시자 시작 실패가 재현되지 않았다.

⏸ **개발 빌드가 끝내 안 붙은 이유는 아직 모른다.** 네트워크(폰→PC TCP 통함) · Metro(번들 7.2MB 정상 생성) ·
앱 저장 상태(`pm clear` 후에도 동일)를 전부 배제했는데도 스플래시에서 멈췄다.
화면을 고치며 볼 일이 생기면 그때 마저 본다.

---

## 5. 🔴 업로드 키스토어 — 잃으면 되돌릴 수 없다

| | |
|---|---|
| 키스토어 | `C:/project/secrets/reread-upload.jks` |
| 값 | `C:/project/secrets/reread-upload.env` (`KEYSTORE_PATH`·`STORE_PASSWORD`·`KEY_ALIAS`·`KEY_PASSWORD`) |
| 별칭 | `reread-upload` · RSA 2048 · 만료 **10000일**(2054-01-26) |
| **SHA1**(공개값) | `44:0E:B4:48:4B:95:84:A8:84:E0:3C:5B:9A:75:B2:99:8E:DB:C4:1C` |

🔴 **지문을 적어 두는 이유**: 굽고 나서 `keytool -printcert` 결과를 이 값과 **대조**하면
디버그 키로 떨어진 것을 그 자리에서 잡는다(§5.1). 지문은 공개값이라 적어도 되고,
🚫 **비밀번호는 여기에 적지 않는다**(`common/SOCIAL_LOGIN.md` 머리말 규율. 경로와 env 이름만 적는다).

🔴 **저장소 밖에 둔다.** 형제 방식 승계(`secrets/jogak-upload.jks`) ·
`common/COMMIT_CONVENTION.md` §8 이 `*.jks` 를 커밋 금지로 못박았다.
🔴 **`common/BUILD_ARTIFACTS.md` §4**: 산출물은 다시 빌드하면 되지만 **서명 키는 못 되찾는다.**
잃으면 그 앱을 **영구히 업데이트할 수 없다.** 외장 단독 보관도 금지다.

### 5.1 🔴 `prebuild` 가 서명 블록을 지운다 — 그래서 config plugin 이다

`android/` 는 CNG 산출물이라 빌드마다 다시 만들어진다(§2). 손으로 넣은 서명 설정은 **그때 사라지고**,
그 상태로 구우면 **디버그 키로 서명된 AAB 가 조용히 성공한다.**
LinkMemo 가 정확히 그것을 밟았고(`common/R8_OBFUSCATION.md` §2-C) `jarsigner -verify` 는 **통과했다.**
서명이 있기는 하니까. Play 업로드에서야 드러난다.

→ `plugins/with-upload-signing.js` (조각 `with-upload-signing.js` 승계). 값은 `process.env` 로 받는다.

```bash
set -a; . /c/project/secrets/reread-upload.env; set +a
REREAD_UPLOAD_STORE_FILE="$KEYSTORE_PATH" \
REREAD_UPLOAD_STORE_PASSWORD="$STORE_PASSWORD" \
REREAD_UPLOAD_KEY_ALIAS="$KEY_ALIAS" \
REREAD_UPLOAD_KEY_PASSWORD="$KEY_PASSWORD" \
npx expo prebuild --platform android --no-install
```

⚠ **값이 없으면 디버그 키로 떨어진다.** `assembleDebug` 가 비밀 없이도 돌아야 하기 때문이다.
그래서 AAB 를 굽고 나면 **서명 주체를 반드시 눈으로 확인한다**(§6).

## 6. AAB 만들기 (내부 테스트 업로드용)

```bash
rm -rf android
# ① prebuild — 위 §5.1 의 env 를 준 채로
# ② AAB
"$PWD/android/gradlew.bat" -p "$PWD/android" app:bundleRelease -x lint -x test --build-cache
# → android/app/build/outputs/bundle/release/app-release.aab
```

⚠ **APK 는 `-PreactNativeArchitectures=arm64-v8a` 로 좁혀도 되지만 AAB 는 좁히지 않는다.**
스토어에 올리는 것이라 4개 ABI 가 다 들어가야 한다.

### 🔴 그래서 AAB 는 APK 보다 훨씬 오래 걸린다 — 멈춘 것이 아니다

§0 의 실측 *"릴리스 5분 39초"* 는 **APK · ABI 한 개**(`arm64-v8a`) 값이다. AAB 는 네이티브를 **4벌**
굽는다(arm64-v8a · armeabi-v7a · x86 · x86_64). 첫 빌드는 gradle 캐시도 비어 있다.

```
2026-09-10 첫 AAB 실측:  BUILD SUCCESSFUL in 20m 1s · 53.4MB · ABI 4벌
                         (§0 의 APK·1벌 5분 39초와 나란히 놓지 않는다)
찌꺼기:                  android/ 1.8G  (build 1.6G · .cxx 142M · .gradle 17M)
```

⚠ **그 15분 동안 화면에 아무것도 안 나왔다.** `bash scripts/build-aab.sh | tail -60` 으로 불러서
파이프가 출력을 끝까지 물고 있었기 때문이다. **멈춘 것으로 오진하기 쉽다.**
→ 🔴 **파이프로 감싸지 말고 그대로 돌린다.** 진행을 봐야 한다면 `tee` 를 쓴다:

```bash
bash scripts/build-aab.sh 2>&1 | tee /tmp/aab.log     # ✅ 흘러나온다
bash scripts/build-aab.sh 2>&1 | tail -60             # 🚫 끝날 때까지 0바이트
```

**살아 있는지 판정하는 법.** 출력이 없어도 이 둘로 갈린다:

```bash
find android/app/build -newermt '-2 minutes' | wc -l      # 0 이면 멈춘 것이다
tasklist | grep -c java.exe                                # ⚠ 형제 빌드가 섞여 있을 수 있다
```

**굽고 나서 반드시 세 줄.** 어긋나도 오류가 안 나고 조용히 실패하는 축들이다:

```bash
AAB=android/app/build/outputs/bundle/release/app-release.aab
keytool -printcert -jarfile "$AAB" | grep -E 'SHA1|소유자|Owner'      # 🔴 업로드 키인가 (디버그 키가 아닌가)
unzip -p "$AAB" base/manifest/AndroidManifest.xml | grep -a expo-channel-name   # 🔴 OTA 채널
unzip -p "$AAB" base/manifest/AndroidManifest.xml | grep -a EXPO_UPDATE_URL     # 🔴 OTA URL
```

🔴 **AAB 는 `keytool -printcert -jarfile`, APK 는 `apksigner verify --print-certs`** 다.
APK 에 `jarsigner`·`keytool` 을 쓰면 *"jar is unsigned"* 가 **정상 출력**이라 오진한다
(`common/R8_OBFUSCATION.md` §4 · LinkMemo 실측).

## 6.1 vc2 실측 — 네이티브가 하나 늘면 얼마나 커지나 (2026-09-10)

| | vc1 | vc2 | 차이 |
|---|---:|---:|---|
| 빌드 시간 | 20m 01s | **14m 49s** | 캐시가 있어 더 빨랐다 |
| AAB 크기 | 53.4MB | **71.2MB** | 🔴 **+17.8MB** — ML Kit 모델 다섯(라틴·한국어·일본어·중국어·데바나가리) |
| versionCode | 1 | 2 | |
| version | 0.1.0 | 0.2.0 | runtimeVersion 은 `1.0.0` 고정(결정 #18) |

🔴 **AAB 는 ABI 를 네 벌 굽는다**(arm64-v8a · armeabi-v7a · x86 · x86_64).
APK 를 `-PreactNativeArchitectures` 로 한 벌만 구울 때와 시간 감각이 다르다.
에뮬레이터 확인용 APK 는 `x86_64` 한 벌이면 되고, 그게 훨씬 빠르다.

⚠ `-x lint` 로는 **`lintVitalRelease` 가 안 빠진다.** 이름이 다른 별개 태스크이고,
릴리스에서만 도는데 캐시가 없으면 몇 분을 먹는다. 로그가 거기서 멈춰 보여도 정상이다.

⚠ 오래 붙잡는 구간 셋을 적어 둔다. 처음 보면 멎은 줄 안다.
`buildCMakeRelWithDebInfo[<abi>]`(ABI 마다) · `lintVitalAnalyzeRelease` · `checkReleaseDuplicateClasses`.
🔴 판정은 **로그 파일의 수정 시각**으로 한다(`find <log> -newermt '-5 minutes'`).
줄 수는 안 늘어도 파일은 갱신되고 있을 수 있다.

## 6.2 vc3 — 권한을 걷어내는 빌드 (2026-09-12)

🔴 **이 빌드의 존재 이유는 기능이 아니라 약속이다.** vc2 매니페스트에 앱이 쓰지 않는 권한 둘이
들어 있었고(`RECORD_AUDIO` · `SYSTEM_ALERT_WINDOW`), 2026-09-11 에 게시한 처리방침이
*"다음 버전에서 제거한다"* 를 이용자에게 적어 뒀다(`docs/legal/PRIVACY.en.md` §5).
**그 문장을 참으로 만드는 것이 vc3 다.**

| 무엇 | 값 |
|---|---|
| versionCode | 2 → **3** |
| version | 0.2.0 → **0.3.0** |
| runtimeVersion | `1.0.0` 고정(결정 #18 — 안 바꾼다) |
| 네이티브 변경 | `android.blockedPermissions` 둘. 🔴 **OTA 로 못 내보내는 유일한 축**이라 빌드가 필요하다 |
| JS 변경 | 2026-09-11 에 만든 것 전부(결정 #22 OCR 줄 선택 · 페이지 접사 수정 등). 이미 OTA 로도 나가 있다 |

### 실측 (2026-09-12)

| | vc2 | vc3 | |
|---|---:|---:|---|
| 빌드 시간 | 14m 49s | **4m 34s** | 🟢 캐시가 살아 있었다. 네이티브 변경이 매니페스트 한 줄이라 CMake 가 다시 안 돌았다 |
| AAB 크기 | 71.2MB | **71.2MB** | 차이 **+3,190 바이트**. 권한 둘을 빼는 것은 크기를 안 바꾼다 |
| **권한 수** | **30** | 🟢 **28** | `RECORD_AUDIO` · `SYSTEM_ALERT_WINDOW` 가 빠졌다 |
| versionCode | 2 | **3** | `android/app/build.gradle` 에서 눈으로 확인 |
| version | 0.2.0 | **0.3.0** | 병합 매니페스트에서 확인 |
| 서명 | 업로드 키 | **업로드 키** | SHA1 `44:0E:B4:48:…` 일치 |

🔴 **판정은 `app.json` 이 아니라 AAB 매니페스트로 했다.** `RECORD_AUDIO` 와 `SYSTEM_ALERT_WINDOW`
문자열이 **실제로 없는 것**까지 확인했다. 설정에 `blockedPermissions` 를 적어 둔 것과
그 값이 빌드에서 먹은 것은 다른 사실이다.

### 🔴 게이트를 하나 늘렸다

`scripts/build-aab.sh` 마지막에 **`check:aab`** 를 붙였다. AAB 의 권한 집합을 허용 목록과 대조하고,
목록 밖이면 **빌드를 죽인다.**

이 스크립트의 서문이 적어 둔 이유가 그대로 적용된다. *"글로 적은 절차는 언젠가 빠지기 때문"* 이다.
권한은 우리가 직접 쓰지 않아도 **라이브러리와 템플릿이 병합해서** 늘어난다. 다음에 네이티브 모듈을
하나 더 넣는 순간 같은 일이 조용히 일어나고, 그때 이 게이트가 없으면 **또 스토어 페이지에서만 보인다.**

⚠ **`prebuild` 가 `android/` 를 통째로 다시 만든다.** 그래서 `app.json` 의 `versionCode` 가
네이티브에 안 들어가는 함정(`common/CLOSED_TESTING.md` 말미)은 이 스크립트에서는 성립하지 않는다.
🔴 다만 **손으로 gradle 을 돌리면 그 함정이 되살아난다.** 스크립트를 거치지 않는 경로를 만들지 않는다.

## 7. 내부 테스트 업로드

### 7.0.1 🔴 거짓 초록을 **두 번째로** 확인했다 (2026-09-10 저녁)

vc2 를 올리려다 같은 자리에서 막혔다. 이번에는 **의도한 대로** 막힌 것이라 값이 더 크다.

```
npm run check:play-access   → 🎯 Re:Read  edits.insert  200      (초록)
npx eas-cli submit          → ✖ The service account is missing the
                                 necessary permissions to submit the app
```

🔴 오후에 업로드를 끝내고 `앱을 테스트 트랙으로 출시` 권한을 회수했는데(권한 5 → 4),
진단은 **여전히 200 이다.** 이 계정은 RevenueCat 용이라 읽기 권한이 상시이기 때문이다.

★ **진단이 초록인 것과 올릴 수 있는 것은 다른 사실이다.** 같은 날 오전에 한 번,
저녁에 또 한 번 같은 자리에서 확인했다. `check:play-access` 를 `verify` 에 넣지 않은 이유가 이것이다.

업로드가 필요할 때의 순서는 넷이고, **마지막 하나를 빠뜨리지 않는다**.

```
① 권한 켜기(콘솔) → ② eas submit → ③ 콘솔에서 게시 → ④ 🔴 권한 회수
```

⚠ ②가 통과해도 `releaseStatus: draft` 라 **테스터 폰에는 아직 안 간다.** ③이 있어야 한다.


✅ **2026-09-10 실제로 밟았다.** 아래는 그때 잰 것이다.

| | |
|---|---|
| Play 앱 | **Re:Read** · 앱 ID `4973508670760124973` · `com.vivacegames.reread` |
| 기본 언어 | **en-US**(결정 #7). 🔴 조각이 `ko-KR` 로 둬서 번역 없는 나라가 한국어를 보던 자리다 |
| 유형 | 앱 · **무료**(구독은 인앱 결제다). ⚠ 게시 후에는 무료를 유료로 못 바꾼다 |
| 올라간 것 | `internal` 트랙 · versionCode 1 · sha1 `6725fa38…` |
| **게시** | ✅ **2026-09-10 16:14** · `활성` · *내부 테스터에게 제공됨* · **검토되지 않음** |
| 테스터 | 기존 목록 **`사장님 검증 전용`**(2명) 연결. 🔴 doply(41명)는 안 붙였다. 내부 테스트는 우리만 있으면 된다 |
| 참여 링크 | `https://play.google.com/apps/internaltest/<내부 테스트 ID>` |
| 크기 | AAB 53.4MB → **신규 설치 18.7MB**(기기별 분할). 다운로드 11초 |
| 프로덕션 | **릴리스 0건**(확인함). 아무것도 새지 않았다 |

🔴 **폰에는 `com.vivacegames.reread (unreviewed)` 로 뜬다.** `Re:Read` 가 아니다.
앱 설정이 끝나고 앱 검토가 끝날 때까지 **임시 이름**이 표시된다(콘솔이 직접 그렇게 안내한다).
고장이 아니다. 이름은 Phase 11 의 스토어 등록정보와 함께 붙는다.

⚠ **게시 시점에 경고 1개가 있었다**: *"이 App Bundle 유형과 연결된 가독화 파일이 없습니다."*
R8 을 아직 안 켜서 mapping 파일이 없다는 뜻이고(Phase 11 · `common/R8_OBFUSCATION.md`)
**게시를 막지 않는다.** R8 을 켜면 gradle 이 AAB 안에 자동으로 넣는다.

🔴 **선행 조건 셋. 하나라도 없으면 `eas submit` 이 죽는다.**

| # | 무엇 | 누가 |
|---|---|---|
| ① | Play Console 에 앱 생성 | 🔴 **사용자**(약관 선언 두 개에 체크한다) |
| ② | 서비스 계정에 **그 앱을 추가**하고 `앱을 테스트 트랙으로 출시` 권한 | 콘솔 |
| ③ | 내부 테스트 트랙에 테스터 목록 | 게시할 때 |

### 7.0 🔴 세 상태를 가르는 진단 — `npm run check:play-access`

콘솔을 안 열고도 **어디서 막혔는지**를 한 줄로 가른다. 2026-09-10 에 이 구분이 실제로 값을 했다.

```
404 Package not found  →  콘솔에 앱이 없다
403 caller has no perm →  앱은 있는데 서비스 계정에 안 딸려 왔다
200                    →  닿는다 (⚠ 아래)
```

실측 진행이 정확히 `404 → 403 → 200` 이었고, 대조군(조각·LinkMemo 200 · 일부러 넣은 없는 앱 404)이
**키 문제가 아님을 같이 증명**했다. 하나만 보면 그 구분이 안 된다.

⚠ 🔴 **200 을 "업로드 된다"로 읽지 마라.** 우리 서비스 계정은 RevenueCat 용이라 읽기 권한이 상시다.
`앱을 테스트 트랙으로 출시` 는 **별개 권한**이고 이 검사에 안 보인다.
**2026-09-10 에 권한을 회수한 뒤에도 이 검사는 200 을 유지했다** (조각이 속았던 거짓 초록을 우리도 재현했다).
→ 업로드 가능 여부의 판정은 **`eas submit` 이 통과하는 것뿐**이다.

🔴 **②를 빠뜨리면 증상이 권한 회수와 똑같은 `403 PERMISSION_DENIED` 다.**
`common/PLAY_RELEASE_AUTOMATION.md` §4: *"새 앱은 목록에 아예 없다. 먼저 `애플리케이션 추가` 로 넣는다.
계정이 이미 다른 앱 넷을 갖고 있어도 새 앱은 안 딸려 온다."*

```bash
npx eas-cli submit --platform android --profile internal \
  --path android/app/build/outputs/bundle/release/app-release.aab --non-interactive
```

### 7.3 게시 절차 (2026-09-10 실측)

```
테스터 탭 → 이메일 목록 체크 → 저장            (진행률 1/3 → 2/3)
출시 탭 → 버전 수정 → 출시 노트 → 다음         (1단계)
미리보기 및 확인 → 경고를 읽는다 → 저장 및 출시  (2단계 · 🔴 즉시 게시된다)
```

🔴 **출시 노트의 닫는 태그는 자기 줄에 있어야 한다.** 한 줄에 붙여 쓰면
*"2행: en-US의 태그가 닫히지 않았습니다"* 로 거부되고 **`다음` 버튼이 비활성**이 된다.
⚠ 그때 판정은 글자 수가 아니라 **오류 문구**로 한다(`PLAY_RELEASE_AUTOMATION.md` §5.15).

```
<en-US>
First internal build. Save a passage, recall it later, and get a daily reminder.
</en-US>
```

⚠ **2단계의 버튼은 `저장 및 출시` 이고 하단에 *"변경사항이 Google Play에 즉시 게시됩니다"* 라고 적혀 있다.**
내부 테스트는 검토를 안 타므로 **되돌릴 창이 없다.** 누르기 전에 경고를 읽는다.

- 🔴 **`releaseStatus: "draft"` 로 올린다.** `completed` 는 **스토어 등록정보가 다 채워져야** 통과하고,
  비어 있으면 *"The app is missing the required metadata"* 로 죽는다(같은 문서 §5.11).
  등록정보는 Phase 11 항목이므로 **번들만 트랙에 넣어 두고 게시는 콘솔에서** 한다.
- 🔴 **`프로덕션으로 출시` 권한은 주지 않는다.** 테스트 트랙 셋은 권한 하나로 다 열린다(같은 문서 §3).
- 🔴 **끝나면 권한을 회수한다.** 되돌릴 때가 켤 때보다 위험하다.
  이미 켜진 칸을 끄는 것이라 **틀리면 끄는 대신 켠다**(같은 문서 §5.13, 세 번 재현됐다).
  체크박스는 누른 뒤 **확대해서 상태를 읽는다.**
  ✅ 2026-09-10 회수 완료. 권한 수가 **5 → 4** 로 준 것을 화면에서 확인했다.

### 7.2 🔴 2026-09-10 에 밟은 함정 (다음에 또 만난다)

| 무엇 | |
|---|---|
| 드롭다운이 **클릭 사이에 스크롤한다** | `애플리케이션 추가` 목록에서 실제로 목록이 밀렸다. ref 클릭도 못 막는다. **검색으로 하나만 남기거나, 누른 뒤 확대해서 읽는다** |
| 폼 값이 **안 들어간 적이 있다** | 검색창에 친 글자가 한 번 통째로 안 들어갔다(목록이 그대로였다). §5.15 그대로다 |
| 스크린샷이 **타임아웃한다** | 콘솔이 무거워 렌더러가 멈춘 것처럼 보인다. `get_page_text` 같은 가벼운 호출은 그때도 됐다. **페이지를 새로고침하면 돌아온다** |
| 창이 **408×107 로 쪼그라들었다** | 그 상태의 스크린샷을 화면으로 읽으면 오판한다. 크기를 되돌리고 다시 본다 |

🟢 **저장이 2단계인 것이 매번 살렸다.** `적용` → `변경사항 저장` → `예` 를 다 누르기 전에는
아무것도 안 바뀐다. 중간에 끊겼을 때 `check:play-access` 로 재 보면 **403 그대로**였다.
§5.1 이 **함정**으로 적어 둔 성질이 여기서는 **안전장치**로 작동한다.

⚠ **`versionCode` 는 매번 올린다.** Play 가 같은 값을 거부하고, 로컬 빌드는 `app.json` 값을 그대로 쓴다.
🔴 `app.json` 만 고치고 구우면 **옛 값이 나간다.** `prebuild` 가 `build.gradle` 로 옮기는 값이라
`prebuild` 를 먼저 돌리고 눈으로 확인한다(`common/CLOSED_TESTING.md` 마지막 절, 조각 실측).

### 7.1 왜 `1.0.0` 이 아니라 `0.1.0` 인가

`common/PRE_LAUNCH_CHECK.md` §4: **정식 출시본은 `1.0.0`, 비공개 테스트까지는 `0.x` 가 정직하다.**
판정 기준은 *"낯선 사람이 돈을 낼 수 있는가"* 이고 지금은 아니다.
⚠ 조각이 `0.2.6` 으로 프로덕션에 나가 세 번의 릴리스를 지나쳤다. **프로덕션 승격 때 올린다.**

---

*최종 갱신: 2026-09-10. 업로드 키스토어(§5)·AAB(§6)·내부 테스트 업로드(§7) 신설.
§0 의 "서명 키는 Phase 11" 을 앞당긴 이유를 그 자리에 적었다.
이전: 2026-09-09. 첫 실기기 빌드. 개발 빌드로 한 시간을 쓰고 릴리스로 옮겨 5분에 끝났다.*
