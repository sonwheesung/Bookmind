# OTA_SYSTEM — JS 무선 업데이트 (expo-updates)

> 스토어 심사 없이 **JS 번들만** 교체하는 경로. 네이티브는 못 바꾼다.
>
> 🔴 **함정은 전부 형제 앱이 이미 값을 치른 것이다.** 배구명가가 `runtimeVersion` 지문 드리프트로
> 두 번, 채널 누락으로 이틀을 잠복했고, LinkMemo 가 버전 문자열 오염을 구조로 막았고,
> 조각이 채널 0개인 채로 발행해 아무도 못 받았다. 이 문서는 그 넷을 **처음부터 피하려고** 있다.
>
> 설계 정본은 [`../CLAUDE.md`](../CLAUDE.md) §14 결정 #18. 빌드·서명은 [`BUILD.md`](./BUILD.md).
> 승계: `link_memo/docs/OTA_UPDATE.md`(문서 골격·가드) · `diary/plugins/with-upload-signing.js`(서명).
>
> 작성 2026-09-10 **코드 착수 전**(§13 ②). 여기 적힌 것과 코드가 다르면 코드를 고친다.

---

## 0. 구현 현황

| 영역 | 상태 |
|---|---|
| 문서(이 문서 · `CLAUDE.md` 결정 #18 · `README.md` 색인·검증 루틴) | ✅ 2026-09-10 |
| EAS 프로젝트 | ✅ 2026-09-10 `8785afeb-e523-40c5-9b42-20593214aba6` (`@shs00925/reread`) |
| `expo-updates` `~29.0.20` · `app.json` `updates` 블록 | ✅ 2026-09-10 |
| 채널 `production` 생성 | ✅ 2026-09-10 (채널 + 브랜치 둘 다) |
| 가드 `npm run check:ota` (7축) | ✅ 2026-09-10 — 변이 **10종 전부 발화**(§9) |
| **AAB 에 실제로 구워졌나** | ✅ 2026-09-10 — vc1 AAB 의 병합 매니페스트에서 채널·URL·`runtimeVersion` 확인(§10.1) |
| **내부 테스트 트랙에 올라감** | ✅ **2026-09-10 16:14 게시** · `활성` · 내부 테스터에게 제공됨 · vc1 |
| **OTA 가 닿을 기기가 생겼나** | ✅ 🔴 **이제 OTA 가 실제로 존재한다**(§1). 폰에 설치되는 순간부터 유효하다 |
| 첫 페이로드 발행 | ✅ **2026-09-11** · 사용자 지시. 그룹 `b667a089` · runtime 1.0.0 · android · 커밋 `549a85d` |
| 기기 전달 확인 | ⏸ 🔴 **아직 눈으로 못 봤다.** 채널 매핑까지는 확인했다(§7.2) |
| 처리방침에 Expo 수탁자 행 | ❌ Phase 11 (§8) |

---

## 1. 🔴 왜 **첫 업로드에** 넣는가 (결정 #18)

`expo-updates` 는 **네이티브 모듈**이다. 그래서 **OTA 로 OTA 를 켤 수 없다.**

```
지금 빌드에 안 넣는다  →  그 빌드가 깔린 기기는 영원히 OTA 를 못 받는다
                          닿는 길은 스토어 업데이트뿐이다
```

형제 둘이 그 대가를 실제로 치렀다. LinkMemo 는 vc11 부터 OTA 가 살아서 **vc10 잔류자에게는
지금도 안 닿는다.** 조각은 2026-09-09 vc21 에 와서야 탈출구가 생겼고, 그 전 빌드를 받은 사람은
`백업 켜기` 결함을 스토어 업데이트로만 고칠 수 있었다.

🟢 **우리는 아직 사용자가 0 이므로 그 대가를 0 으로 치를 수 있다.** 첫 업로드에 넣으면
"OTA 없는 세대"가 아예 안 생긴다. 이 창은 **한 번만 열린다.**

### 1.1 순서를 앞당긴 근거 (Phase 11 항목을 Phase 4 에서 한다)

[`PLAN.md`](./PLAN.md) 는 스토어 관련 작업을 **Phase 11** 에 뒀다. 지금 하는 이유는 둘이다.

| 왜 | |
|---|---|
| 🔴 위 §1 | OTA 는 **나중에 하면 소급이 안 된다.** 미루는 비용이 다른 항목과 성질이 다르다 |
| 🟢 Phase 4 가 요구하는 것 | 알림의 남은 축은 **실기기 다일차 관찰**이다(`REVIEW_SYSTEM.md` §6.1). 내부 테스트 트랙에 올려 두면 폰에 설치가 붙고, 관찰 중에 발견한 JS 결함을 **재빌드 없이** 고칠 수 있다 |

🚫 **앞당기는 것은 이 둘뿐이다.** 스토어 등록정보·법무 문서·연령 게이트·R8 은 **Phase 11 에 그대로 남는다**
(§8 · `PLAN.md` Phase 11). 내부 테스트는 **테스터가 우리뿐**이라 그것들 없이 성립한다
(`common/CLOSED_TESTING.md` §3).

---

## 2. 🔴 무엇을 못 바꾸나

OTA 는 **JS 번들과 에셋만** 바꾼다. 아래는 전부 **AAB 재빌드**다.

- 네이티브 모듈 추가·제거·버전 변경 (`expo-sqlite` · `expo-notifications` · `expo-crypto` …)
- `app.json` 에서 네이티브에 굽히는 값 (권한 · 플러그인 설정 · 패키지명 · 아이콘 · 알림 아이콘·색)
- `versionCode` · `versionName`

⚠ **네이티브를 바꿨는데 `runtimeVersion` 을 안 올리고 OTA 를 쏘면**, 옛 바이너리에 새 네이티브를
전제한 JS 가 배달돼 **크래시한다.** 네이티브를 건드렸으면 §3 의 범프가 의무다.

🔴 **우리 앱에서 특히 조심할 자리**: 알림 아이콘·색은 `expo-notifications` 플러그인 옵션이라
네이티브 리소스로 구워진다(`REVIEW_SYSTEM.md` §6.3.1). **OTA 로 아이콘을 못 고친다.**

---

## 3. 🔴 `runtimeVersion` 은 **고정 문자열**이다 (fingerprint 정책 금지)

```jsonc
"runtimeVersion": "1.0.0"
```

배구명가가 `fingerprint` 정책으로 **두 번** 데였다(LinkMemo `OTA_UPDATE.md` §2 승계).

1. 빌드 뒤 `.gitignore` 한 줄과 CRLF 변경만으로 지문이 드리프트해 **OTA 가 고아**가 됐다.
2. 로컬 그래들 빌드는 `prebuild` 가 `android/` 를 새로 만들며 지문이 또 달라졌다.

🔴 **우리도 그 조건에 정확히 들어간다.** `android/` 는 CNG 산출물이라 커밋하지 않고
빌드마다 `prebuild` 로 다시 만든다(`BUILD.md` §2). 그래서 **고정 문자열 + 수동 범프**로 간다.

- `"1.0.0"` 은 **네이티브 세대 번호**이고 `version`(지금 `0.1.0`)과 **아무 관계가 없다.**
- 🚫 **둘이 달라 보인다고 맞추지 마라.** 맞추는 순간 기존 빌드가 전부 OTA 고아가 된다.
  가드가 이 실수를 FAIL 로 막는다(§9).
- 범프하는 때는 **네이티브 모듈이 바뀔 때뿐**이다. `version` 을 올릴 때가 아니다.

---

## 4. 🔴 채널은 **`production` 하나**다 (로컬 빌드에는 통로가 하나뿐이다)

```jsonc
"updates": {
  "url": "https://u.expo.dev/8785afeb-e523-40c5-9b42-20593214aba6",
  "checkAutomatically": "ON_LOAD",
  "requestHeaders": { "expo-channel-name": "production" }
}
```

🔴 **`eas.json` 의 `build.*.channel` 은 EAS Build 전용이다.** 우리는 로컬에서 굽기 때문에 그 값이
AAB 에 안 들어간다. 채널은 **`app.json` 의 `requestHeaders` 로만** 들어간다.
이게 빠지면 기기가 채널을 안 보내고, **발행은 성공으로 보이는데 아무도 못 받는다**
(배구명가 vc13·14 에서 이틀 잠복 · 조각은 채널 0개인 채로 발행했다).

### 왜 트랙 이름(`internal`)을 안 쓰나

채널을 트랙에 맞추면 **트랙을 승격할 때마다 재빌드**가 된다. Play 는 같은 AAB 를 내부 테스트에서
프로덕션으로 그냥 올릴 수 있는데, 채널이 `internal` 로 구워져 있으면 그 AAB 가 프로덕션에서
엉뚱한 채널을 요청한다. 형제 둘(조각·LinkMemo)이 `production` 하나로 고정한 이유가 이것으로 보인다.

⚠ **대가**: 지금 쏘는 실험적 OTA 가 나중 프로덕션 사용자와 **같은 채널**을 쓴다.
지금은 테스터가 우리뿐이라 위험이 0 이다.
🔴 **재검토 시점 = 실사용자가 생기는 Phase 11.** 그때 `preview` 채널을 가진 별도 빌드를 둘지 정한다
(조각이 `eas.json` 에 채널 넷을 둔 자리다). **미루는 것이지 안 하는 것이 아니다.**

---

## 5. 언제 적용되나 — **콜드 스타트 전용**

- 네이티브가 `ON_LOAD` 로 **백그라운드에서 받아 두고**, **다음 앱 실행**에 적용한다.
- 🔴 **백그라운드에서 앱을 꺼내 쓰는 것으로는 안 받는다.** 안내 문구는
  *"앱을 완전히 종료했다가 다시 실행"* 이다. *"앱을 열면 됩니다"* 는 틀린 안내다.
- 보장선은 **콜드 2회**다. 1회로 끝날 때가 많지만 네이티브 다운로드와 JS 확인이 경쟁하므로 보장이 아니다.

🚫 **JS 에서 강제로 받아 재시작하는 UI 를 만들지 않는다.** 기둥 1(독서를 방해하지 않는다)과
부딪히고, 저장 화면에서 앱이 튀는 것이 얻는 것보다 나쁘다. **조용히 받아 두고 다음에 적용**한다.

---

## 6. 🔴 OTA 가 `expoConfig.version` 을 덮는다

OTA 매니페스트는 `version` 과 `versionCode` 를 함께 실어 온다. 그래서 앱 코드가 그 값을 직접 읽으면
**네이티브가 `0.1.0` 인 기기가 자기를 `0.2.0` 이라고 보고한다.**

LinkMemo 가 정확히 그 자리에서 데였다. 소프트·강제 업데이트 게이트의 입력이 오염돼
*"최신 버전을 올려도 그 기기엔 안내가 영영 안 뜨는"* 상태가 됐다.

🔴 **그 게이트는 우리 Phase 7 항목이다**(`PLAN.md` Phase 7 · bootstrap `version.min`·`latest`).
즉 **아직 안 만든 기능이 이미 이 함정 위에 서 있다.**

→ **지금 막는다. 규율이 아니라 가드로.**

| | |
|---|---|
| 🚫 금지 | 앱 코드가 `Constants.expoConfig.version` · `expoConfig.android.versionCode` 를 읽는 것 |
| ✅ 유일한 통로 | `lib/app-version.ts` (**Phase 7 에 신설**) 가 네이티브 `versionName`·`versionCode` 를 읽는다 |
| 가드 | `check:ota` 가 소스를 훑어 위반 파일이 있으면 FAIL (§9) |

⚠ **`expo-application` 을 지금 설치하지 않는다.** 읽는 코드가 **0건**이고(2026-09-10 실측),
Phase 7 에 로그인·common_server SDK 로 네이티브 모듈이 무더기로 붙으며 `runtimeVersion` 범프가
어차피 그때 온다. **그때 함께 넣는 것이 싸다.** 지금 세우는 것은 **가드뿐**이고,
가드가 있으므로 그 사이에 위반이 조용히 들어올 수 없다.

---

## 7. 배포 절차

> 🔴 **OTA 발행은 사용자가 지시할 때만 한다.** 검증이 전부 통과해도 임의로 쏘지 않는다
> (`CLAUDE.md` §13 의 push 규율과 같다).

```bash
npm run verify && npm run check:ota
npx eas-cli update --channel production --platform android --message "<무엇을 고쳤는지>"
```

- 🔴 **`--platform android` 를 반드시 준다.** 기본값이 `all` 이라 web 번들링을 타는데,
  네이티브 전용 모듈을 import 하면 그 자리에서 죽는다(조각 실측).
- 🔴 **`eas channel:create production` 을 한 번 해 둔다.** 브랜치와 채널은 다른 것이고
  `eas update` 는 브랜치만 만든다. 채널이 없으면 앱 로그가
  `Remote update request not successful` 이 되고 **발행은 성공하는데 아무도 못 받는다**(조각 실측).

### 7.1 전달 확인 — `exit 0` 은 **게시**까지만 증명한다

```
① 앱을 완전히 종료한다 (최근 앱에서 밀어 닫기)
② 다시 연다                ← 여기서 새 번들이 적용된다
③ 안 바뀌었으면 ①②를 한 번 더  ← 보장선은 콜드 2회다(§5)
```

🔴 **우리 앱은 원격 관측이 0 이다.** 서버가 없으므로 *"닿았나"* 를 데이터로 물을 수 없고,
**화면에서 눈으로 보는 것이 유일한 판정**이다. 그래서 발행하는 변경에는
**화면에서 알아볼 수 있는 것을 하나 넣는다**(문구 변경 한 줄이라도).
⚠ 이건 형제 앱보다 우리가 **불리한 축**이다. 조각·LinkMemo 는 하트비트로 판정했다.

### 7.2 첫 페이로드 실측 (2026-09-11)

| 무엇 | 값 |
|---|---|
| 그룹 | `b667a089-cdb0-4269-84e1-9baf834d0b64` · android · runtime **1.0.0** |
| 담은 것 | OCR 줄 선택 화면(결정 #22) · 페이지 표시 `42p쪽` 수정 |
| 커밋 | `549a85d` |
| 채널 | `eas channel:view production` → **Active** · 우리 그룹을 가리킨다 |

🟢 **네이티브가 하나도 안 늘어서 OTA 로 갈 수 있었다.** ML Kit 과 image-picker 는 vc2 에 이미 있고
오늘 바꾼 것은 전부 JS 다. AAB 15분과 Play 권한을 켰다 끄는 일, 그리고 **되돌릴 창 없는 게시**가
통째로 없어졌다. 🔴 **결정 #18 로 OTA 를 첫 빌드에 심어 둔 값이 여기서 처음 나왔다.**

🟢 **마커가 저절로 생겼다.** 같은 날 넣은 시드에 페이지가 `42p` 인 카드가 있어서,
홈의 최근 저장이 **`42p쪽` → `42p`** 로 바뀌는지만 보면 전달이 판정된다.
★ §7.1 이 *"알아볼 수 있는 것을 하나 넣는다"* 고 적어 둔 그것을 **고른 것이 아니라 얻은** 셈이다.

⏸ **전달은 아직 눈으로 못 봤다.** `am force-stop` 후 콜드 2회를 돌렸지만 그때마다 폰에
알림 그늘이 내려와 있었다(사용자가 쓰는 중). 🔴 **릴리스 빌드는 `__DEV__` 가 false 라 로그로도 못 본다**
(`common/R8_OBFUSCATION.md` §4). 남은 판정은 **홈 화면 한 줄**이다.

---

## 8. 🔴 새 수탁자가 생긴다 — 처리방침을 같이 고친다

OTA 를 켜면 기기가 앱 실행마다 **Expo, Inc.(미국) `u.expo.dev`** 와 통신한다.
Expo 는 기기 OS 와 "이 기기가 최신 업데이트를 받았는지" 판별용 무작위 토큰을 받는다.
**새 수탁자이자 국외 이전**이라 처리방침 고지 대상이다.

🔴 **우리 처리방침은 아직 없다**(`CLAUDE.md` §15 ❌ · Phase 11).
지금 성립하는 근거는 `common/CLOSED_TESTING.md` §3 이다.

> *"법무 고지는 프로덕션 이용자 기준으로 계산한다. 비공개 테스트 중 이용자는 사실상 사용자 본인뿐이라
> 고지 기간 미달 같은 문제는 프로덕션 전에 맞춰 두면 된다."*

⚠ **그 근거는 내부 테스트에서만 참이다.** 그래서 [`PLAN.md`](./PLAN.md) Phase 11 완료 기준에
**행을 추가했다.** 처리방침·데이터 보안 선언에 `Expo, Inc.(미국 · 업데이트 배달)` 수탁자.
🔴 LinkMemo 는 이것을 **형제 세션이 알려줘서** 발견했다. 우리는 미리 적어 둔다.

🟢 **데이터 보안 양식에 새 항목이 늘지는 않는다.** 무작위 토큰이라 수집 항목이 아니고,
늘어나는 것은 **수탁자 표의 한 줄**이다. 다만 그 판정은 Phase 11 에 원문으로 다시 확인한다.

---

## 9. 가드 — `npm run check:ota`

🔴 **OTA 의 실패는 조용하다.** 채널 하나가 빠져도, 지문이 드리프트해도, 버전 문자열이 오염돼도
**빌드는 성공하고 발행도 성공한다.** 그래서 사람이 아니라 스크립트가 본다.

| 축 | 무엇을 잰다 |
|---|---|
| ① 설치 | `expo-updates` 가 `dependencies` 에 있나 |
| ② URL | `updates.url` 이 `https://u.expo.dev/<projectId>` 이고 **`extra.eas.projectId` 와 같은가** |
| 🔴 ③ 채널 | `requestHeaders["expo-channel-name"] === "production"` (로컬 빌드의 **유일한 통로**) |
| ④ 적용 시점 | `checkAutomatically === "ON_LOAD"` |
| 🔴 ⑤ runtimeVersion | **고정 문자열**인가(정책 객체 금지) · **`version` 과 같지 않은가**(같으면 고아가 된다) |
| 🔴 ⑥ 버전 오염 | 앱 소스가 `expoConfig.version`·`versionCode` 를 직접 읽지 않나(§6) |
| ⑦ 네이티브 반영 | 빌드된 AAB 매니페스트에 `EXPO_UPDATE_URL` 과 채널 헤더가 실제로 들어갔나(§10) |
| SELF-TEST | 판정 함수가 살아 있는가를 **먼저** 증명한다(exit 2) |

⚠ ⑦ 은 `android/` 가 있을 때만 돈다(없으면 건너뛰고 **그렇다고 말한다**). 없는 것을 통과로 적지 않는다.

### 변이 주입 실측 (2026-09-10 · **10종 전부 발화**)

| 변이 | 발화 |
|---|---|
| 채널 헤더 제거(app.json) | ③ 유일한 통로가 끊겼다 |
| 채널 오타(`internal`) | ③ |
| `checkAutomatically` 변경 | ④ |
| `projectId` 불일치 | ② 남의 번들을 받게 된다 |
| fingerprint 정책 | ⑤ 고정 문자열이 아니다 |
| `runtimeVersion == version` | ⑤ 기존 빌드가 고아가 된다 |
| 소스에 `expoConfig.version` 심기 | ⑥ |
| 🔴 **채널 헤더 제거(네이티브 매니페스트)** | ⑦ *"발행해도 아무도 못 받는다"* |
| `EXPO_UPDATE_URL` 제거 / 남의 프로젝트 URL | ⑦ 두 갈래 각각 |
| `strings.xml` runtimeVersion 드리프트 | ⑦ |
| 🔴 **판정 함수를 죽인다**(`judgeSources` 가 빈 배열) | **exit 2**(SELF-TEST 가 먼저 잡는다) |

🔴 **⑦ 네 갈래는 `android/` 가 있는 동안만 잴 수 있어서 그 자리에서 함께 쟀다.**
`android/` 는 확인 뒤 지우므로(`BUILD.md` §2) **다음 빌드까지 기회가 없다.** 미루면 안 재게 된다.

---

## 10. 네이티브에 실제로 들어갔는지 확인

`app.json` 을 고친 것과 **AAB 에 들어간 것**은 다른 축이다. 값은 `prebuild` 가 옮기고,
어긋나도 **오류가 안 난다. 그냥 업데이트가 안 갈 뿐이다.**

```bash
unzip -p <aab> base/manifest/AndroidManifest.xml | grep -a "expo-channel-name"
unzip -p <aab> base/manifest/AndroidManifest.xml | grep -a "EXPO_UPDATE_URL"
```

🔴 **`android/` 를 지우고 `prebuild` 를 다시 돌려야** 매니페스트에 설정이 들어간다.
`expo-updates` 는 네이티브 모듈이라 기존 `android/` 에는 배선이 없다.

### 10.1 실측 — `prebuild` 가 넣는 것 여섯 (2026-09-10)

```
expo.modules.updates.ENABLED                                = true
expo.modules.updates.EXPO_RUNTIME_VERSION                   = @string/expo_runtime_version  → 1.0.0
expo.modules.updates.EXPO_UPDATES_CHECK_ON_LAUNCH           = ALWAYS      ← checkAutomatically: ON_LOAD
expo.modules.updates.EXPO_UPDATES_LAUNCH_WAIT_MS            = 0           ← 부팅을 막지 않는다(§5)
expo.modules.updates.EXPO_UPDATE_URL                        = https://u.expo.dev/8785afeb-…
🔴 …UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY               = {"expo-channel-name":"production"}
```

⚠ **마지막 줄의 따옴표가 XML 이스케이프(`&quot;`) 되어 있다.** 그래서 사람이 손으로
`grep '"expo-channel-name":"production"'` 을 걸면 **0건이 나오고, 그것을 "채널이 없다"로 읽는다.**
2026-09-10 에 실제로 한 번 그렇게 읽었다.

```bash
✅ grep -c 'expo-channel-name' <manifest>          # 이스케이프와 무관하다
🚫 grep '"expo-channel-name":"production"'          # 항상 0건. 없는 문제를 만들어낸다
```

🟢 **가드는 처음부터 맞게 짰다.** `includes('expo-channel-name')` 로 본다. 틀린 것은 즉석 grep 이었다.
★ `README.md` §3.2 의 *"검사가 죽으면 없는 문제를 만들어내기도 한다"* 의 같은 얼굴이다.

---

## 11. 제외 · 후보

- 🚫 JS 강제 재시작 UI(§5) · 🚫 fingerprint runtimeVersion(§3) · 🚫 트랙별 채널(§4).
- 후보(결정 없음): `preview` 채널 분리(Phase 11 재검토) · 업데이트 실패 관측.

---

*최종 갱신: 2026-09-10. 문서 신설(코드 착수 전). 형제 셋의 함정 넷을 처음부터 피하는 것이 이 문서의 목적이다.*
