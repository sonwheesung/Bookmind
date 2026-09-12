# STORE_LISTING — Play 등록정보와 앱 설정 11항목

> **용도**: 비공개 테스트 트랙을 열기 위해 Play 콘솔이 요구하는 **앱 설정 11항목**의 답을 한 곳에 확정한다.
> 콘솔에 입력하는 사람이 이 문서만 보고 끝낼 수 있어야 한다.
>
> 작성 계기: 2026-09-11 사용자 지시 *"우선 비공개 테스트로 뚫어놓자"*. 프로덕션 전 **12명 × 14일** 요건의
> 시계를 지금 시작해 두자는 판단이고, 14일은 캘린더 시간이라 개발로 줄일 수 없다.
>
> 짝 문서: 테스터 운영은 `C:\project\common\CLOSED_TESTING.md`, 업로드 절차는
> `common/PLAY_RELEASE_AUTOMATION.md`, 지금 무엇이 어느 트랙에 있나는 `common/PLAY_CONSOLE_STATUS.md`.
> 사업자·연락처 값의 단일 출처는 `common/BUSINESS_INFO.md`(**커밋 금지 파일**)이고 여기에 베껴 적지 않는다.

---

## 0. 한 줄

**비공개 테스트는 앱 설정 11항목이 전부 끝나야 열린다.** 2026-09-11 콘솔 실측이고, 지금 **0/11**이다.

---

## 1. 🔴 관문 실측 (2026-09-11 · 읽기 전용 조회)

대시보드 `비공개 테스트` 섹션이 자물쇠와 함께 이렇게 적어 놨다.

```
🔒 비공개 테스트를 시작하려면 앱 설정을 완료하세요.
   비공개 테스트 트랙 설정
     🔒 국가 및 지역 선택
     🔒 테스터 선택
   버전 생성 및 출시
     🔒 새 버전 만들기
```

세 항목이 **전부 잠겨 있다.** 테스터를 고르는 것도, 버전을 올리는 것도 그 앞에서 막힌다.

⚠ **`common/PLAY_RELEASE_AUTOMATION.md` §5.12 가 관문을 좁게 적어 뒀다.** 그 절은 *"스토어 등록정보가
14일 시계의 선행 조건"* 이라고만 말하는데, 실제 화면은 **앱 설정 11항목 전부**를 선행으로 잠근다.
등록정보는 그중 **한 항목**이다. 이 차이는 작업량을 몇 배로 가른다.

🟢 반대로 **내부 테스트는 그 11항목 없이 성립했다.** 우리가 vc1·vc2 를 실제로 그렇게 올렸다.
그래서 "내부 테스트가 됐으니 비공개도 되겠지"가 성립하지 않는다.

---

## 2. 앱 설정 11항목 — 우리 답

| # | 항목 | 우리 답 | 근거 | 누가 |
|---|---|---|---|---|
| 1 | 개인정보처리방침 설정 | URL `https://vivace-games.com/reread/privacy` | §8. 🔴 **게시가 선행이고, 6번의 선행이기도 하다**(§8.3) | 사용자(배포) |
| 2 | 로그인 세부정보 | **로그인 없음** | `CLAUDE.md` §4 · Phase 7 미착수라 배포본에 계정이 없다 | 세션 |
| 3 | 광고 | **아니오** | 결정 #10. 실측으로 광고 SDK **0개** | 세션 |
| 4 | 콘텐츠 등급 | IARC 설문 → **전체 이용가** 예상 | 사용자 콘텐츠 공유 없음 · 폭력물과 성인물 없음 | 🔴 사용자(설문 제출) |
| 5 | 타겟층 | **13세 이상** | 형제 앱 통일. ⚠ 연령 게이트는 미결정 G 이고 Phase 7 이다 | 사용자 |
| 6 | 데이터 보안 | 🔴 **수집 예**(기기 또는 기타 ID) · 공유 아니요 | §3.1 — ~~수집 없음~~ 은 틀렸다 | 세션 |
| 7 | 정부 앱 | 아니오 | | 사용자 |
| 8 | 금융 기능 | 아니오 | 결제 미구현(Phase 10) | 사용자 |
| 9 | 건강 | 아니오 | | 사용자 |
| 10 | 앱 카테고리 · 연락처 | **교육(Education)** · `support@vivace-games.com` | §7 | 사용자 |
| 11 | 스토어 등록정보 | §5(en-US) · §6(ko) · §7(그래픽) | 기본 언어 en-US(결정 #7) | 세션 초안 → 사용자 입력 |

🔴 **11번이 이미지를 요구한다.** 아이콘 512 · 그래픽 1024×500 · 휴대전화 스크린샷 최소 2장.
셋 중 하나라도 없으면 저장이 안 되고, 저장이 안 되면 트랙이 안 열린다.

---

## 3. 데이터 보안 — 선언의 실측 근거

🔴 **데이터 보안은 코드가 실제로 보내는 것을 적는 칸이다.** 그래서 기억이 아니라 소스를 재고, 잰 값을 여기 남긴다.

| 무엇 | 어떻게 쟀나 | 결과 |
|---|---|---|
| 네트워크 호출 | `app/ features/ lib/ db/ components/ hooks/ theme/` 에서 `fetch`·`XMLHttpRequest`·`WebSocket`·`axios` 전수 | **0건** |
| 분석·광고·크래시 SDK | `package.json` 의존성에서 admob·analytics·sentry·firebase·amplitude·purchases·segment | **0개** |
| 광고 ID(`AD_ID`) | vc2 AAB 매니페스트 실물 | **선언 없음** |

~~**결론: 수집 없음 · 공유 없음.**~~ 🔴 **틀렸다. 2026-09-12 콘솔 입력 직전에 잡았다.**

책과 문장, 생각, 복습, 실천은 전부 `expo-sqlite` 에만 있고 기둥 2 그대로다.
사진도 ML Kit 온디바이스라 기기를 안 떠나고, 인식이 끝나면 임시 파일을 지운다(`features/ocr/repo.ts`).
**하지만 기기를 떠나는 식별자가 하나 있다.**

### 3.1 🔴 `EAS-Client-ID` 는 "기기 또는 기타 ID" 다

Play 의 데이터 유형 정의가 **`Firebase 설치 ID`** 를 예시로 들고 있다. `EAS-Client-ID` 는 그것과 같은 성격이다.
설치할 때 기기에서 무작위로 만들어 앱 저장 영역에 보관하고, **앱을 열 때마다 Expo 로 전송된다**(§4.1).

🔴 **형제 앱 정본이 같은 판단을 이미 적어 뒀다**(`idea_repository/docs/legal/DATA_SAFETY.md`):
> ⚠ Expo 의 무작위 업데이트 토큰은 **"기기 또는 기타 ID" 유형에 해당할 수 있다**

그쪽은 광고 때문에 그 유형이 **이미 선언돼 있어서** 변경이 없었다. 🔴 **우리는 다르다.**
다른 식별자가 하나도 없어서 **이것이 유일한 항목**이고, 그래서 *"수집하지 않는다"* 가 통째로 뒤집힌다.

### 3.2 확정 답

| 질문 | 답 | 근거 |
|---|---|---|
| 필수 사용자 데이터 유형을 수집하거나 공유하나요 | **예** | `EAS-Client-ID` 가 기기를 떠난다 |
| 전송 중 암호화 | **예** | HTTPS 전용(`u.expo.dev`) |
| 데이터 유형 | **기기 또는 기타 ID** | 이것 하나뿐이다 |
| 수집 | **예** | |
| 공유 | **아니요** | Expo 는 **우리를 대신해 처리하는 서비스 제공자**다. Play 는 그 경우를 "공유"에서 제외한다 |
| 목적 | **앱 기능** | 업데이트 배달. 분석도 광고도 아니다 |
| 필수/선택 | **필수** | `checkAutomatically: ON_LOAD` 라 사용자가 끌 수 없다 |
| 임시 처리 | **아니요** | Expo 가 자체 방침에 따라 보관한다. 우리가 "메모리에서만 처리된다"를 보증할 수 없다 |
| 삭제 요청 | **아니요** | 계정이 없어 삭제 창구를 만들 수 없다. 앱을 지우면 토큰이 사라진다(§4.1) |

🟢 **처리방침은 이미 맞게 적혀 있었다.** `PRIVACY.en.md` §4.1 이 이 토큰을 항목까지 나열해 두었고
§7 수탁자 표에 Expo 가 있다. **틀린 것은 이 문서의 결론 한 줄이었다.**

★ **`check:privacy` 가 이걸 못 잡는다.** 그 가드는 *"코드가 보내는 곳이 방침에 적혀 있나"* 를 재는데,
여기서 틀린 것은 **방침이 아니라 그 사실을 Play 양식으로 옮기는 해석**이다.
같은 사실을 세 곳에 적는데(방침·데이터 보안·등록정보) 가드는 두 곳만 잇고 있었다.

⚠ **이 선언은 배포본 기준이라 Phase 7·8 에서 반드시 바뀐다.** 로그인이 붙으면 신원이, AI 가 붙으면
원문이 프록시를 지나간다(결정 #14 의 대가). 그때 **선언과 처리방침을 같이** 고친다.

---

## 4. 🔴 권한 정리 — vc3 에 실어야 하는 것

vc2 AAB 매니페스트를 직접 열어 봤더니 **독서 앱에 없어야 할 권한 둘**이 들어 있었다.

| 권한 | 판정 | 출처 |
|---|---|---|
| `RECORD_AUDIO` | 🔴 **불필요** | 우리 코드와 플러그인, `node_modules` 매니페스트 어디에도 없다. 원격 AAR 에서 왔고 정확한 출처는 확인하지 않았다 |
| `SYSTEM_ALERT_WINDOW` | 🔴 **불필요** | Expo bare 템플릿 기본값. 템플릿 자신이 `OPTIONAL PERMISSIONS, REMOVE WHATEVER YOU DO NOT NEED` 라고 적어 뒀고 우리가 안 지웠다 |
| `READ/WRITE_EXTERNAL_STORAGE` | 🟡 검토 | `expo-file-system`·`expo-image-picker` 가 선언한다. 백업 파일과 사진 고르기에 쓰인다 |
| `CAMERA` | 🟢 필요 | OCR(결정 #20) |
| `POST_NOTIFICATIONS`·`RECEIVE_BOOT_COMPLETED`·`VIBRATE`·`WAKE_LOCK` | 🟢 필요 | 복습 알림(기둥 7) |
| `INTERNET`·`ACCESS_NETWORK_STATE` | 🟢 필요 | OTA(`expo-updates`) |
| `DUMP` | 🟢 무해 | 요청 권한이 아니라 리시버의 보호 속성이다 |
| 런처 배지 계열 14종 | 🟢 무해 | `expo-notifications` 가 배지를 위해 선언한다 |

**왜 지금 중요한가**: 스토어 페이지의 앱 권한 목록은 사용자가 설치 전에 본다.
**독서 앱이 마이크와 다른 앱 위에 표시를 요구하면** 그 자리에서 설치를 접는다.
심사에서 걸리지도 않고 콘솔에 오류로도 안 뜬다. 아무도 안 알려 주는 자리다.

→ `app.json` 에 `android.blockedPermissions` 로 걷어내고, **가드가 AAB 를 직접 열어 재게** 한다(§4.1).

### 4.1 왜 `app.json` 만 검사하면 안 되나

★ 이 저장소가 네 번 배운 문장이 여기에도 그대로 적용된다.
**검사가 재려는 것이 입력에서 이미 참이면 그 검사는 아무것도 안 지킨다.**
`app.json` 에 `blockedPermissions` 가 적혀 있는지만 보는 검사는 적어 뒀다는 것을 잴 뿐이고,
**그 값이 실제 빌드에서 먹었는지**는 안 잰다. 이번 건이 정확히 그 종류다.
`app.json` 의 `android.permissions` 는 `undefined` 였는데도 매니페스트에는 28개가 들어 있었다.

→ 판정은 **AAB 매니페스트**로 한다. `npm run check:aab -- <aab 경로>` 가 권한 집합을 허용 목록과 대조한다.
`verify` 체인에는 넣지 않는다. AAB 가 없는 상태가 정상이기 때문이고, 없는 것을 통과로 세면 그것도 거짓 초록이다.

---

## 5. 등록정보 — 영어 (기본, en-US)

⚠ **아래 문구는 배포본(vc2)이 실제로 하는 것만 말한다.** AI 분석과 회상 질문, 계정, 구독, 클라우드 백업은
아직 없으므로 한 줄도 적지 않는다. 등록정보가 배포본보다 넓으면 그건 심사 반려 사유이고,
무엇보다 사용자가 없는 기능을 기대하고 설치한다.

### 5.1 앱 이름 (≤ 30자)

```
Re:Read
```

### 5.2 짧은 설명 (≤ 80자)

```
Keep one line from a book. Meet it again right before you forget it.
```

### 5.3 자세한 설명 (≤ 4,000자)

```
Read it. Remember it. Live it.

You finish a book and a month later almost nothing is left. Re:Read is built for
that gap. It is not an app for reading more books. It is an app for keeping more
of the one you just read.

SAVE WITHOUT BREAKING YOUR READING
One line is enough. The book, the page, your own thought and tags are all optional,
so saving never turns into paperwork. Type it, paste it, or photograph the page and
tap only the lines you want.

MEET IT AGAIN BEFORE YOU FORGET
Re:Read schedules each note with FSRS, a modern spaced repetition algorithm, and
reminds you locally. Review starts with recall: you try to remember first, then the
original is revealed. You grade how it felt, not whether you were right. There is no
score, no accuracy rate, and no pressure put on your memory.

TURN A FEW OF THEM INTO ACTION
Some lines are worth doing, not just remembering. Write a practice in your own words,
set how often, and check it off on a simple weekly row. Most notes never become
practices, and that is the intended shape.

EVERYTHING STAYS ON YOUR PHONE
No account. No sign-up. No ads. No servers holding your library. Your books, notes,
thoughts, reviews and practices live in a local database on your device, and the app
works completely offline, including text recognition from photos.

Because your data is yours, you can export it to a single file any time and import it
back on another phone. That is free and always will be.

WHAT IS INSIDE
- Books with reading status and page progress
- Notes with source, page, your own thought, and tags
- Text from photos, on device, with line by line selection
- Spaced repetition review with local reminders
- Practices with a weekly check row and streaks
- Search across originals, thoughts and tags
- Statistics for saving, reviewing and practicing
- Export and import your whole library as one file
- English and Korean

WHAT RE:READ IS NOT
It is not a reading tracker that pushes you to finish more books. It is not a quiz app
that grades you. It is not a social feed. It is a quiet place for the few sentences
that were worth stopping for.
```

---

## 6. 등록정보 — 한국어 (ko-KR)

### 6.1 앱 이름 (≤ 30자)

```
Re:Read
```

### 6.2 짧은 설명 (≤ 80자)

```
책에서 건진 한 줄을 저장하고, 잊을 때쯤 다시 만납니다.
```

### 6.3 자세한 설명 (≤ 4,000자)

```
읽고, 기억하고, 살아내기.

책을 덮고 한 달이 지나면 남는 것이 거의 없습니다. Re:Read 는 그 틈을 메우려고 만들었습니다.
책을 더 많이 읽게 하는 앱이 아닙니다. 방금 읽은 한 권에서 얻은 것을 더 오래 남기는 앱입니다.

독서를 끊지 않고 저장합니다
원문 한 줄이면 끝납니다. 책도 페이지도 내 생각도 태그도 전부 선택이라 저장이 일이 되지 않습니다.
직접 쓰거나, 붙여 넣거나, 책장을 찍어서 원하는 줄만 짚으면 됩니다.

잊을 때쯤 다시 만납니다
저장한 문장은 FSRS 간격 반복 알고리즘이 일정을 잡고 기기 알림이 데려옵니다.
복습은 회상으로 시작합니다. 먼저 떠올려 보고 그다음에 원문이 열립니다.
맞았는지가 아니라 어떻게 떠올랐는지를 고르면 됩니다. 점수도, 정답률도, 기억을 압박하는 장치도 없습니다.

그중 몇 개는 실천이 됩니다
기억만으로 끝내기 아까운 문장이 있습니다. 내 문장으로 실천을 적고 주기를 정한 뒤 주간 칸에 체크합니다.
대부분의 문장은 실천이 되지 않고, 그게 의도한 모양입니다.

전부 이 기기 안에 있습니다
계정이 없습니다. 가입도, 광고도, 기록을 들고 있는 서버도 없습니다.
책과 문장, 생각, 복습, 실천이 기기의 로컬 데이터베이스에만 있고 앱은 완전히 오프라인으로 돕니다.
사진에서 글자를 읽는 것도 기기 안에서 처리합니다.

내 데이터니까 언제든 파일 하나로 내보내고 다른 기기에서 다시 불러올 수 있습니다.
이 기능은 무료이고 앞으로도 무료입니다.

들어 있는 것
- 읽기 상태와 페이지 진행률이 있는 책 관리
- 출처와 페이지, 내 생각, 태그가 붙는 문장 카드
- 사진에서 글자 가져오기, 기기 안에서 처리, 줄 단위 선택
- 간격 반복 복습과 기기 알림
- 주간 체크와 연속일이 있는 실천
- 원문과 생각, 태그를 함께 뒤지는 검색
- 저장과 복습, 실천을 보여주는 통계
- 전체를 파일 하나로 내보내기와 가져오기
- 한국어와 영어

Re:Read 가 아닌 것
더 많이 읽으라고 밀어붙이는 독서 기록 앱이 아닙니다. 점수를 매기는 시험 앱이 아닙니다.
소셜 피드도 아닙니다. 멈춰 설 만했던 몇 문장을 위한 조용한 자리입니다.
```

⏸ **두 언어 모두 ChatGPT 검수 대상이다.** 창구는 고정 채팅 `Bookmind` 하나이고(`docs/DESIGN_REVIEW.md`),
🔴 **검수 요청은 사람이 한다**(`common/KOREAN_WRITING.md` §2).

---

## 7. 그래픽 에셋

| 슬롯 | 규격 | 상태 | 비고 |
|---|---|---|---|
| 앱 아이콘 | 512×512 PNG | ✅ `assets/store/play-icon-512.png` | `npm run icons` 가 함께 낸다. 도형은 런처 아이콘과 같은 함수다 |
| 그래픽 이미지 | 1024×500 PNG | ✅ `assets/store/play-feature-1024x500.png` | 브랜드 바탕에 아이콘 도형 |
| 휴대전화 스크린샷 (ko) | 6장 · 1080×1920 | ✅ `assets/store/screenshots/ko/` | 2026-09-11 · 에뮬 `reread`(5574) · Expo Go |
| 휴대전화 스크린샷 (en) | 6장 · 1080×1920 | 🔨 `assets/store/screenshots/en/` | ⚠ `01-home` 에 §7.2 의 흠이 찍혔다 |

### 7.1 스크린샷 — 무엇을 몇 장 찍나

🔴 **비율이 먼저다.** 우리 AVD(pixel_6)는 **1080×2400 = 2.22** 라 Play 상한 **2:1** 을 넘는다.
🚫 그렇다고 `hw.lcd.height` 를 임의로 바꾸지 않는다. `common/EMULATOR_POOL.md` §1.3 이
*"스토어 스크린샷 규격과 얽힌다. 필요하면 사용자에게 알리고 판단을 받는다"* 로 못 박아 뒀다.
→ 형제 앱(LinkMemo)과 같은 방법으로 **1080×1920 캔버스에 합성**한다(`scripts/compose-store-shot.py`).
🔴 **자르지 않는다.** 자르면 레이아웃이 잘리고, 그러면 스크린샷이 앱을 잘못 보여준다.

| # | 화면 | 무엇을 보여주나 |
|---|---|---|
| 1 | 홈 | 오늘의 복습 + 최근 저장. 이 앱의 하루가 여기서 시작한다 |
| 2 | 문장 상세 | 원문 · 출처 · 내 생각 · 태그. 기둥 6(생각이 원문과 동등하다) |
| 3 | 복습 회상 | 🔴 **제품의 급소**(기둥 7). 먼저 떠올리고 그다음 원문이 열린다 |
| 4 | 책 상세 | 진행률과 그 책의 문장들(결정 #17) |
| 5 | 통계 | 🔴 성적표가 아니다. 압박하는 숫자를 안 쓴다(기둥 5) |
| 6 | 실천 | 주간 체크 한 줄. 대부분의 문장은 여기 오지 않는다(기둥 4) |

### 7.2 🔴🔧 영어 스크린샷이 `Streak 1 days` 라고 말한다

스크린샷을 찍다가 찾았다. 영어 문구 셋이 **복수형을 하드코딩**하고 있다.

| 키 | 현재 값 | 1일 때 |
|---|---|---|
| `home.footer.streak` | `Streak {{count}} days` | 🔴 `Streak 1 days` |
| `stats.streakValue` | `{{count}} days` | 🔴 `1 days` |
| `practice` 의 연속일 | `{{count}} days in a row` | 🔴 `1 days in a row` |

🔴 **한국어에는 이 병이 없다.** 한국어는 수에 따라 명사가 안 바뀌어서 `연속 1일` 이 그냥 맞다.
그래서 **기본 언어(en-US)에서만 틀리고**, 우리가 주로 보는 화면에서는 영원히 안 보인다.

⚠ **`check:i18n` 6축이 못 잡는다.** 그 가드는 두 언어의 키가 짝이 맞는지와 보간이 같은지를 보는데,
이 셋은 **양쪽 다 있고 보간도 `{{count}}` 로 같다.** 틀린 것은 값 안의 문법이다.
★ 또 같은 모양이다. 검사가 재는 축에 이 결함이 애초에 안 걸려 있다.

→ 고치는 법은 i18next 복수 규칙(`_one`/`_other`)인데, **한국어는 복수형이 없어서 키가 비대칭이 된다.**
그러면 `check:i18n` 의 누락·잉여 축이 발화한다. 즉 **i18n 설계 결정이 하나 필요하다.**
🔴 **스크린샷 작업의 범위가 아니라서 여기까지만 적고 멈춘다.** 결정 뒤에 고치고 `01-home` 만 다시 찍으면 된다.
🟢 나머지 다섯 장은 이 문구가 안 나온다(홈 하단에만 있다).

🔴 **OCR 화면은 Expo Go 로 못 찍는다.** 네이티브 모듈이라 *"이 빌드에서는 사진 읽기를 쓸 수 없습니다"* 가
뜬다(결정 #20 · 2026-09-11 에뮬에서 그 문구가 정상 동작하는 것까지 확인했다).
→ 릴리스 빌드를 깐 기기에서만 찍을 수 있다. **첫 등록정보에는 넣지 않는다.**

🔴 **그래픽은 프로그램으로 그린다.** 아이콘을 그렇게 만든 이유가 그대로 적용된다(`scripts/make-icons.mjs` 서문).
규격이 서로 다른 이미지를 손으로 만들면 한 장을 고칠 때 나머지가 어긋나고, 그 어긋남은 스토어에서만 보인다.

⏸ 워드마크가 들어간 그래픽은 Phase 11 에서 다시 본다. 지금은 시계를 시작하는 것이 우선이고,
빈약한 글자를 급히 그려 넣는 것보다 도형만 있는 쪽이 낫다.

---

## 8. 법무 URL

| 항목 | 값 | 상태 |
|---|---|---|
| 개인정보처리방침 | `https://vivace-games.com/reread/privacy` | 🔨 **페이지 작성됨 · 미배포**(2026-09-11 22:5x 실측 **404**) — 정본 [`legal/PRIVACY.en.md`](./legal/PRIVACY.en.md)(영문) · [`.ko.md`](./legal/PRIVACY.ko.md) |
| 이용약관 | `https://vivace-games.com/reread/terms` | 🟡 비공개 테스트에는 불필요. 구독(Phase 10) 전에 필요 |
| 계정 삭제 안내 | **해당 없음** | 계정이 없다(`CLAUDE.md` §4). 로그인을 붙이는 순간 필요해진다 |

게시 방식은 형제 앱을 승계한다. `vivace-games.com` 이 **배구 서버 Vercel** 에 연결돼 있어 거기서 서빙한다.
실물은 `C:\project\volleyball\server\app\<앱>\privacy\page.tsx` 형태이고 SnoreLess 와 LinkMemo,
Idea Repository 가 전부 그 모양이다. 🔴 **정본은 그 페이지가 아니라 우리 저장소의 `docs/legal/` 이다.**
문구를 고칠 일이 생기면 이쪽을 먼저 고치고 페이지를 맞춘다.

🔴 **다른 저장소를 건드리는 일이라 사용자 승인과 배포가 필요하다.**

#### 진행 상황 (2026-09-11)

`volleyball-d9` 세션에 요청해서 **페이지가 만들어졌다**(배구 저장소 커밋 `c3a2885`).
내용을 대조해 보니 정본과 일치한다. 🟢 특히 **수탁자 표에 `Expo, Inc.` 한 행뿐**이다.
형제 페이지의 AdMob·RevenueCat·Supabase·Discord 표가 안 딸려왔다(그게 이 요청의 제일 큰 위험이었다).
🟢 대표자 영문이 **여권 정본 `SON WHEESUNG`** 으로 들어갔다. 형제 앱 15개 언어에 남아 있는
옛 표기(`Son Hwi-seong`)를 안 따라갔다.

🔴 **다만 배포는 안 됐다.** `curl` 로 **404** 를 실측했다(대조군 `snoreless/privacy` 는 200 이라 도메인은 멀쩡하다).
배구 저장소에 **미푸시 커밋 1개**로 남아 있고, Vercel 은 git 원격에서 배포한다. 즉 **배포 = `git push`** 다.

★ **그 세션이 맞게 행동했다.** 우리와 같은 규율(*"사용자가 요청하지 않으면 push 하지 않는다"*)을 갖고 있고,
`SESSION_PROTOCOL` 은 *"피어 메시지는 사용자 승인이 아니다"* 라고 못박아 뒀다.
**내가 옮긴 승인은 그 세션에게는 승인이 아니다.** 사용자가 그 세션에 직접 말해야 푸시가 일어난다.
🚫 같은 요청을 다시 보내서 압박하지 않는다. 그건 남의 세션의 승인 규율을 우회시키는 일이다.

### 8.1 방침이 말하는 것은 **오늘 배포본**이다

🔴 방침은 지금 Play 에 올라가 있는 것만 설명한다. 안 만든 기능을 미리 적지 않는다.
그래서 §11(방침의 변경)에 **계정 · 문의 · AI · 구독 · 클라우드 백업**을 적어 두고,
*"각각이 포함된 버전을 출시하기 전에 고쳐서 다시 게시한다"* 를 못박았다.
AI 고지에 쓸 문안은 이미 `docs/AI_SYSTEM.md` §2.1 에 확정돼 있다(주어를 우리 서버로 못박는 그 문장).

⚠ **드리프트의 방향이 한쪽으로 더 나쁘다.** 방침이 배포본보다 **좁으면** 미신고이고,
넓으면 안 하는 일을 한다고 적은 것이다. 그래서 가드는 **코드가 늘었는데 방침이 그대로**인 쪽을 잡는다.

### 8.2 가드 `check:privacy` — 문서가 조용히 거짓이 되는 것을 막는다

처리방침은 한 번 쓰고 잊는 문서이고, 거짓이 되는 방식이 조용하다.
`fetch` 한 줄이 늘면 *"앱이 보내는 요청은 한 종류뿐"* 이 그 순간 거짓이 되는데 아무도 이 파일을 안 연다.
형제 프로젝트가 실제로 그 자리에 있었다(`common/PLAY_CONSOLE_STATUS.md` 조각 행 — *"데이터 보안 선언이
배포본보다 좁음"*).

| 축 | 잰다 |
|---|---|
| ① | 광고·분석·오류수집 SDK 가 의존성에 있나 |
| ② | 소스가 직접 거는 네트워크 호출이 있나 |
| ③ | `app.json` 의 업데이트 URL 이 방침에 적혀 있나 |
| ④ | 푸시 토큰을 등록하나 |
| ⑤ | 두 언어의 절 구성이 대칭인가 |
| ⑥ | 법정 기재사항(사업자등록번호 · 보호책임자 · 연락처 · 시행일) |
| ⑦ | 🔴 **앱이 접속하는 호스트가 전부 방침에 있나** (`app.json` + 소스 문자열) |

🔴 **⑦ 이 본체다.** AI 프록시 URL 이 코드에 생기는 순간 발화한다.
**변이 12종 전부 발화**(가드를 망가뜨리는 6종은 `exit 2`, 앱을 위반 상태로 만드는 6종은 `exit 1`).

#### 🔴🔧 그 가드의 양성 대조가 절반만 재고 있었다

주석 안의 링크를 접속처로 세면 안 된다는 대조를 넣었는데, **한 줄 주석(`//`)만 썼다.**
주석 제거는 블록(`/* */`)과 한 줄 두 단계인데, 블록 단계를 망가뜨리는 변이에 **가드가 침묵했다.**
한 줄 단계가 살아서 대조가 통과해 버린 것이다.

★ **여섯 번째다.** 검사가 안 지나가는 경로를 남기면 그 경로는 안 지켜진다.
→ 대조 입력에 블록 주석을 함께 넣어 고쳤다. 그제서야 발화했다.

---

## 8.3 🔴 데이터 보안이 처리방침 URL 에 물려 있다 (2026-09-12 실측)

데이터 보안 5단계를 전부 채웠는데 마지막에 이렇게 막혔다.

> ⛔ **제출하려면 개인정보처리방침 페이지에서 개인정보처리방침 링크를 제공하세요.**

즉 **11항목이 평평한 목록이 아니다.** 1번(처리방침 URL)이 6번(데이터 보안)의 선행이다.
답은 다 넣었고 `임시보관함에 저장` 으로 남겨 뒀으므로, URL 이 200 이 되면 그 항목만 눌러 제출하면 된다.

★ **관문이 또 한 겹 깊었다.** §1 에서 *"등록정보 하나가 아니라 11항목 전부"* 를 찾았는데,
그 11항목 안에도 순서가 있었다. 🔴 **처리방침 배포가 임계 경로의 맨 앞이다.**

### 8.4 ✅ 배포됨 (2026-09-12)

`volleyball-d8` 세션이 배포했다. 🔴 **경로가 중요하다** — 내 피어 메시지는 두 번 다 승인이 못 됐고,
그 세션이 **대표님께 직접 여쭈어 "네, 지금 푸시하세요"를 받고** 실행했다.
★ 내가 승인을 만들어 주지 않은 것이 맞았다. 정상 경로로 닫혔다.

| 무엇 | 값 |
|---|---|
| URL | `https://vivace-games.com/reread/privacy` → **200** (대조군 `snoreless/privacy` 도 200) |
| 배포 방식 | 커밋 `c3a2885` push = Vercel 자동 배포. 푸시 후 **약 50초** 만에 404 → 200 |
| 라이브 본문 실측 | 🟢 AdMob·RevenueCat·Supabase·Discord **0회** · `SON WHEESUNG` · `749-25-02260` · `RECORD_AUDIO` 고지 있음 |

⚠ **Next.js 는 같은 내용을 렌더 HTML 과 직렬화 데이터에 두 벌 담는다.** 문자열을 세면 2배로 나온다.
`<script>` 를 걷어내도 그렇다. 개수로 판정하지 말고 **있나 없나**로 본다(그쪽 세션도 같은 착시를 겪었다).

🔴 **2026-11 사업장 이전 때 이 페이지의 주소도 고쳐야 한다**(국문·영문 양쪽).
`common/BUSINESS_INFO.md` §1.2 에 걸려 있고, **형제 앱 페이지 전부가 같은 주소를 복제**하고 있어 한 번에 훑어야 한다.

---

## 9. 지금 막고 있는 것

| # | 무엇 | 누가 | 왜 세션이 못 하나 |
|---|---|---|---|
| ~~1~~ | ~~스크린샷~~ | ✅ **닫힘 2026-09-11** | ko 6장 · en 6장(§7.1). ⚠ ~~"우리 AVD 폴더는 비어 있다"~~ 는 **내가 틀린 문장이었다** — `~/.android/avd` 를 봤고, 정본은 AVD 를 `D:\emulators\` 에 두라고 적어 뒀다(`common/EMULATOR_POOL.md` §1.3) |
| 2 | 처리방침 **배포** | 🔴 **사용자** | 🟢 문안도 페이지도 끝났다(§8). 남은 것은 **`volleyball-d9` 세션에 push 를 지시**하는 것 하나다 |
| 3 | 콘텐츠 등급 IARC 설문 | 🔴 **사용자** | 제출 버튼은 사람이 누른다(`common/PLAY_CONSOLE_STATUS.md` §3) |
| 4 | 앱 설정 11항목 저장 | 🔴 **사용자** | 같은 규칙. 관리형 게시가 꺼져 있으면 폼 저장이 곧 게시다 |
| 5 | doply 테스터 41명 연결 | 🔴 **사용자** | 업체 계약. 12명 미만으로 떨어지면 14일 시계가 멈춘다 |
| 6 | 상표 확인 `Re:Read` | 🔴 **사용자** | 등록정보를 공개하면 이름이 대외에 박힌다. 바꾸는 비용이 지금이 가장 싸다 |

🟢 **세션이 끝낸 것**: 11항목의 답 확정(§2) · 데이터 보안 실측 근거(§3) · 권한 결함 발견(§4) ·
등록정보 문구 두 언어(§5·§6) · 아이콘과 그래픽 이미지(§7).

---

*최종 갱신: 2026-09-11 — 신설. 콘솔 실측으로 관문이 앱 설정 11항목 전부임을 확인했고, vc2 AAB 에서 불필요한 권한 둘을 찾았다.*
