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
별도 키스토어 없이 릴리스 APK 를 만들 수 있다. ⚠ 스토어용 서명 키는 Phase 11 에서 따로 만든다.

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

⚠ `android/` 는 CNG 산출물이라 커밋하지 않고, 확인이 끝나면 지운다. 남기면 `app.json` 과 어긋난 채
다음 세션을 속인다. 🚫 지울 때 Gradle 데몬이 `.dex` 를 물고 있으면 그냥 둔다 —
**`gradlew --stop` 을 쓰지 않는다. 형제 프로젝트의 빌드까지 죽인다.**

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

*최종 갱신: 2026-09-09 — 첫 실기기 빌드. 개발 빌드로 한 시간을 쓰고 릴리스로 옮겨 5분에 끝났다.*
