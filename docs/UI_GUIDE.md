# UI_GUIDE — 화면을 만드는 법 (토큰 · 공통 부품 · 금지 목록)

> 화면 코드를 쓰기 전에 읽는 문서. **무엇을 새로 그리지 말고 무엇을 가져다 쓰는가**를 적는다.
> 🔴 **같은 모양을 두 화면이 따로 그리면 반드시 한쪽만 고쳐진다.** 이 문서는 그걸 막으려고 있다.
>
> 색·여백·글자 크기의 값은 [`../theme/tokens.ts`](../theme/tokens.ts), 채택·기각된 시안은 [`DESIGN_REVIEW.md`](./DESIGN_REVIEW.md) §3.
> 모든 화면을 `Screen` 으로 감싸는 규칙은 [`README.md`](./README.md) §4.
>
> 작성 2026-09-13 **코드 착수 전**(`CLAUDE.md` §13 ②). 여기 적힌 것과 코드가 다르면 코드를 고친다.

---

## 0. 구현 현황

| 영역 | 상태 |
|---|---|
| 설계(이 문서) | ✅ 2026-09-13 |
| 토큰 `theme/tokens.ts` · `useTheme()` | ✅ 2026-09-08 (Phase 0) |
| 공통 부품 **22개**(§2) | ✅ 2026-09-14. 기존 9 + 새 7 + 연령 게이트 층(`AgeGate`) 1 · 🔄 같은 날 `IconButton` · `MonthCalendar` 을 더하고 `BookCover` 를 지웠다 · 🔄 2026-09-15 차트 부품 셋(`BarChart` · `ActivityGrid` · `RankBars`)을 더했다 · 🔄 2026-09-18 `Select`(설정의 언어)를 더했다. 화면 16개와 기존 부품 5개가 이전을 마쳤다(§7.5) |
| 공통 헬퍼(§3) | ✅ 2026-09-14 |
| 가드 `npm run check:ui`(§6) | ✅ 2026-09-14. `verify` 17번째 |
| 헤더 로고 | 🔄 2026-09-14 — 같은 날 **홈 헤더 자체를 뺐다**(결정 #26). `brand` 토큰도 없앴다 |
| 좌우 여백 | ✅ 2026-09-14 **16 유지**(`DESIGN_REVIEW.md` §3). 첫 답은 현재값을 32 로 잘못 읽고 32 를 권했다 |

---

## 1. 토큰

- 🔴 **화면에 숫자와 색을 직접 쓰지 않는다.** 여백은 `spacing`, 모서리는 `radius`, 색은 `palette`, 글자는 `typography`.
- 🔴 **`fontFamily` 를 쓰지 않는다**(결정 #13). 타이포 토큰은 크기·굵기·행간만 가진다.
- 색은 테마를 따라 바뀐다. **테마와 무관하게 고정인 색은 `tokens.ts` 에 이름을 붙여 둔다.**
  지금 **없다**. 🔄 `coverInk`(책 표지 글자)는 2026-09-14 표지 자리를 지우며 함께 지웠다.

## 2. 공통 부품

**22개** (세는 법: `ls components/*.tsx | wc -l` · `check:ui` ⑦이 이 표와 파일을 대조한다)

| 부품 | 쓰는 자리 | 규칙 |
|---|---|---|
| `Screen` | 모든 화면의 바깥 | 🔴 화면에서 SafeAreaView·ScrollView 를 직접 쓰지 않는다. 키보드 가림도 여기서 처리한다 · 위 여백 = 인셋 + `spacing.lg`(2026-09-14) · 탭 화면은 `tab` 을 넘겨 아래 인셋을 탭 바에 맡긴다 |
| `Header` | 화면 제목 · 뒤로 | 오른쪽 자리(`right`)는 **`IconButton` 만**(추가 · 저장 · 수정 · 삭제 · 취소 · 검색 · 통계 · 2026-09-14). 글자 버튼을 두지 않는다 · 🔴 **탭 화면은 뒤로가기가 없고 홈에는 Header 가 없다**(결정 #26 · 2026-09-14) |
| `AppText` | 🔴 **화면의 모든 글자** | `variant`(타이포 토큰 이름) + `tone`(`text` · `muted` · `accent`). 화면에서 `[typography.x, { color }]` 를 조립하지 않는다 |
| `Button` | 본문 안의 행동 | `primary` 는 화면에 **하나**. `danger` 는 되돌릴 수 없는 동작에만 · 🔄 `size="lg"` 는 홈의 두 버튼만(2026-09-14) |
| `IconButton` | 헤더 오른쪽의 행동(추가 · 저장 · 수정 · 삭제 · 취소 · 검색 · 통계) | Lucide 선 아이콘 22 · 누르는 자리 40 · 🔴 `label` 필수(글자가 없어 스크린리더가 읽을 이름이다) · 색은 글자색 하나 · 🔴 삭제도 확인창을 거친다 |
| `ButtonRow` | 버튼 둘을 같은 폭으로 나란히 | 저장/취소 · 받기/넘어가기 · 카메라/앨범 |
| `Card` | 원문 한 덩어리 · 누르는 목록 행 | 🔴 원문이 아닌 것을 카드에 넣지 않는다(§5) |
| `Chip` | 하나 고르기 · 여러 개 고르기 · 지울 수 있는 태그 | 🔴 칩을 화면에서 `Pressable` 로 다시 그리지 않는다 · 🔄 `quiet` 은 골라도 accent 로 안 채운다(글자색 테두리). **accent 칩 줄 아래 둘째 고르기에만** 쓴다(문장 탭 책 정렬 · 2026-09-15) |
| `ChipRow` | 칩 여러 개를 줄바꿈으로 | 간격은 `spacing.sm` 고정 |
| `Divider` | 구획 · 목록 행 사이 | 1dp 선 한 줄 · 색 `palette.divider`(🔄 2026-09-14 머리카락 선이 너무 희미했다). 여백은 `style` 로 준다 |
| `Field` | 입력 한 칸 | 라벨에 "(선택)"을 붙이지 않는다(`KNOWLEDGE_SYSTEM.md` §1.1) |
| `QuoteRow` | 카드 없이 구분선으로 나눈 문장 목록 | 홈 최근 저장 · 검색. 위 라벨·아래 출처는 **있을 때만** 그린다 |
| `BookLine` | 제목 + 한 줄 설명 | 책 목록 · 책 고르기 · 🔄 표지 자리는 2026-09-14 지웠다(`DESIGN_REVIEW.md` §3) |
| `BookSelect` | 책 연결 | 🔴 목록 안에 `+ 새 책 등록` 이 있다(`KNOWLEDGE_SYSTEM.md` §1.1.1) |
| `Select` | 목록에서 하나 고르기(설정의 언어) | 누르면 아래에서 목록이 올라온다 · 고른 줄에 ✓ · 바깥을 눌러 닫는다. 🔴 `BookSelect` 와 **같은 모양**이다(여는 칸 · 아래 시트) · 🔄 2026-09-18 사용자 지시 *"언어는 select 태그로 선택할 수 있게"* |
| `WeekRow` | 실천 탭의 이번 주 일곱 칸 | 못 한 날은 빈 동그라미. 붉은색 없음 |
| `MonthCalendar` | 실천 상세의 한 달 기록 | 판정은 `monthCells` 가 하고 여기서는 그리기만 · 채운 동그라미 = 한 날 · 누를 수 없는 날은 흐리게 · 붉은색 없음(`PRACTICE_SYSTEM.md` §3.1) |
| `BarChart` | 통계의 세로 막대(저장 · 복습 · 다가올 복습) | 🔴 축 맨 위 값은 깔끔한 수(`niceMax`) · 글자색 한 가지 · 🚫 목표선 · 평균선 · 신호등 색 · 아래 글자는 `null` 로 건너뛴다(`STATS_SYSTEM.md` §4.2) |
| `ActivityGrid` | 통계의 활동 달력 칸 | 진하기 5단계(`activityLevel`) · 🚫 빈 날은 빈 칸이지 실패 표시가 아니다 · 오늘 칸만 테두리 |
| `RankBars` | 분야별 · 책별 상위 몇 개 | 1위 대비 가로 막대 · 🚫 파이 차트 · 순위 번호 · 메달 |
| `AgeGate` | 부팅 연령 확인 모달(앱 전체를 덮는 층) | 🔴 중립 연도 목록 · 벽이 아니다 · 여러 화면이 쓰는 부품이 아니라 **한 곳만 그리는 층**이지만 화면이라 `components/` 에 둔다(`AUTH_SYSTEM.md` §1.6) |
| `Spacer` | 화면 끝 여백 · 큰 구획 사이 빈 공간 | 높이는 `spacing` 이름으로만 |

### 2.1 내비게이션 — 하단 탭 다섯 (결정 #26 · 2026-09-14)

| 탭 | 파일 | 담는 것 |
|---|---|---|
| 홈 | `app/(tabs)/index.tsx` | 오늘의 복습 · 문장 저장 · 최근 저장 |
| 문장 | `app/(tabs)/knowledge.tsx` | 문장 목록(등록순 / 책별) · 위 오른쪽 아이콘 검색 · 통계 · 저장 |
| 책 | `app/(tabs)/books.tsx` | 책 목록 |
| 실천 | `app/(tabs)/practice.tsx` | 오늘의 실천(월~일 칸) · 나머지 실천 |
| 설정 | `app/(tabs)/settings.tsx` | 언어(🔄 2026-09-18 셀렉트) · 알림 · 백업 |

- 상세·입력 화면(`knowledge/[id]` · `books/new` · `review` · `search` …)은 **탭 위에 쌓이는 스택**이고 뒤로가기가 있다.
- 🔄 **아이콘 + 글자**다(2026-09-14 사용자 선택 · `DESIGN_REVIEW.md` §3). Lucide 선 아이콘 24 · 바 높이 64 + 아래 인셋.
  🔄 선택된 탭은 **탭 칸 전체**(아이콘 + 글자)를 `palette.tabIndicator` 로 칠한다(2026-09-15 관리자 수정사항 #4 · ~~아이콘 뒤 56×32 알약~~). 바 안쪽 위아래 8 · 좌우 4 · 칸 높이 **56**(바 72 + 아래 인셋) · 모서리 `radius.md`. 🔴 검수 권고 48 은 에뮬레이터에서 탭 글자 아래가 잘렸다.
  🔄 아이콘은 **탭 바와 헤더 오른쪽(`IconButton`)에만** 쓴다(2026-09-14 사용자 지시). 본문 안의 행동은 글자 버튼이다. 본문까지 번지면 9/9 의 "더하기보다 빼는 쪽"이 무너진다.
- 🔴 **활성 탭은 accent 가 아니라 진한 글자**다. 탭 바는 모든 화면에 붙어 있어 accent 를 쓰면 화면마다 accent 가 둘이 된다(§5).
- ✅ **에뮬레이터 확인(2026-09-15 · AVD `reread` 5574 · Expo Go · ko/en)**. 선택한 탭 칸 전체(아이콘 + 글자)가 칠해진다. 🔧 첫 판(칸 48)은 글자 아래가 잘려 56 으로 고친 뒤 다시 봤다. ⏸ 실기기와 다크 모드는 아직 안 봤다.

## 3. 공통 헬퍼

| 무엇 | 어디 | 쓰는 자리 |
|---|---|---|
| `joinMeta(parts)` | `lib/format.ts` | `책 · 저자 · 쪽` 같은 메타 한 줄. **빈 조각은 버린다.** 전부 비면 `''` 이고, 화면은 그때 줄을 안 그린다 |
| `formatDate(iso, deviceLocale())` | `lib/format.ts` · `lib/i18n.ts` | 날짜 표시. 🔴 로케일은 **기기 설정**이다. UI 언어가 아니다(`CLAUDE.md` §9 · 2026-09-14 사용자 확인) |
| `confirmDestructive({ title, body, action, onConfirm })` | `lib/confirm.ts` | 되돌릴 수 없는 동작의 확인창. 취소 버튼은 여기서 붙는다 |
| `toggled(set, item)` | `lib/set.ts` | 선택 집합에서 하나를 넣거나 뺀다. 입력을 바꾸지 않고 새 집합을 돌려준다 |
| `WEEKDAY_KEYS` | `lib/day.ts` | 요일 i18n 키. 🔴 인덱스는 `isoWeekday - 1`(월=0) |
| `splitTagInput(raw)` | `features/knowledge/compute.ts` | 쉼표로 쓴 태그 입력. 🔴 새 문장 화면과 상세 화면이 **같은 규칙**을 쓴다(§5 of `KNOWLEDGE_SYSTEM.md`) |
| `parseRepeat(rule).kind` | `features/practice/compute.ts` | 반복 주기 라벨. 화면에서 `startsWith('weekly:')` 로 다시 판정하지 않는다 |
| `formatMonth(month, deviceLocale())` | `lib/format.ts` | 달 이름(`2026년 9월`). 로케일 규칙은 `formatDate` 와 같다 |
| `groupByBook(rows)` | `features/knowledge/compute.ts` | 문장 책별 보기. 🔴 `책 없음` 은 맨 아래 · 구획 안은 최신순(`KNOWLEDGE_SYSTEM.md` §3.2) |
| `monthCells` · `calendarBounds` · `addMonths` | `features/practice/compute.ts` · `lib/day.ts` | 실천 기록 달력. 🔴 누를 수 있는지는 주 칸과 같은 `canCheck` 다(`PRACTICE_SYSTEM.md` §3.1) |
| `features/stats/charts.ts` · `formatDayShort` · `formatMonthShort` · `formatYear` | `features/stats/charts.ts` · `lib/format.ts` | 통계 차트의 기간 · 막대 · 칸 · 다가올 복습. 🔴 다가올 복습은 오늘의 복습과 같은 상한으로 흘린다(`STATS_SYSTEM.md` §4.2) |

## 4. 언제 공통으로 빼나

- **두 곳 이상에서 같은 모양이고 같은 뜻이면** `components/` 로 뺀다. 모양만 같고 뜻이 다르면 빼지 않는다.
- **한 화면 안에서만 반복되면** 그 파일 안의 작은 함수로 둔다(설정 화면의 행 · 홈 아래 링크 줄).
- 로직은 **순수하면 `lib/`**, 도메인을 알면 **`features/<도메인>/compute.ts`**. 둘 다 가드가 node 에서 import 한다.
- 🔴 **새 부품을 만들면 §2 표에 적는 것까지가 완료다.** `check:ui` ⑦이 빠진 줄을 잡는다.

## 5. 🚫 UI 금지 목록

| 금지 | 출처 |
|---|---|
| 한 화면에 accent(primary 버튼·강조색)를 **둘 이상** 두기. 없애지 말고 옮긴다 | `DESIGN_REVIEW.md` §3 · 홈 개편 |
| **0 을 강조하기.** `책 0 · 문장 0` · `연속 0일` · `0%` 를 쓰지 않고, 그 줄을 안 그린다 | 기둥 5 · `STATS_SYSTEM.md` §4.1 |
| **카드 남용.** 카드는 원문이다. 메타데이터는 글자, 내 생각은 약한 면, 행동은 버튼 | `DESIGN_REVIEW.md` §3 |
| 복습 4등급에 **신호등 색**(빨강·노랑·초록) | `DESIGN_REVIEW.md` §3 |
| `danger` 색을 실패·미달성 표시에 쓰기 | 기둥 5 · `theme/tokens.ts` |
| 빈 상태에 **할 일처럼 읽히는 문장**(`태그가 없습니다` · `첫 백업을 만들어보세요!`) | 기둥 4·5 |
| 다크 모드에 glow · 추가 카드 | `DESIGN_REVIEW.md` §3 |
| 번들 폰트 · `fontFamily` | 결정 #13 |
| 화면에서 색 코드(`'#...'`) · `StyleSheet.hairlineWidth` · `typography.` 직접 쓰기 | 이 문서 §1·§2 · `check:ui` |

## 6. 가드 `npm run check:ui`

🔴 SELF-TEST 가 먼저다(exit 2). 소스를 읽기 전에 **주석을 지운다.** 주석 속 설명이 위반으로 잡히면 안 되고,
반대로 주석을 지우는 단계가 코드까지 지우면 위반을 놓친다. 그래서 블록·한 줄·JSX 주석과 `https://` 를 전부 양성 대조로 잰다.

| 축 | 무엇 | 범위 |
|---|---|---|
| ① | `typography.` 가 없다 (글자는 `AppText`) | `app/` |
| ② | 색 코드 `'#…'` 가 없다 (색은 토큰) | `app/` · `components/` · `hooks/` |
| ③ | `hairlineWidth` 가 없다 (선은 `Divider`) | `app/` |
| ④ | `'destructive'` 가 없다 (확인창은 `confirmDestructive`) | `app/` |
| ⑤ | `toLocaleDateString(` 가 없다 (날짜는 `formatDate`) | `app/` · `components/` |
| ⑥ | `.split(',')` 가 없다 (태그는 `splitTagInput`) | `app/` |
| ⑦ | §2 표의 부품 이름 ⇄ `components/*.tsx` 파일 | 문서 · 코드 |
| ⑧ | 헬퍼 경계: `joinMeta`(null · undefined · `''` · 전부 빔) · `toggled`(입력 불변) · `WEEKDAY_KEYS`(실제 요일과 대조) | `lib/` |

`splitTagInput` 의 경계는 `check:knowledge` 가 잰다(그 함수가 사는 곳의 가드).

## 7. 2026-09-13 점검 기록

사용자 지시 *"코드 점검하자. 공통화할 디자인이나 코드 있으면 공통화 처리해줄래"*.

### 7.1 찾은 것

| 무엇 | 몇 곳 | 처리 |
|---|---:|---|
| `[typography.x, { color: palette.y }]` 조립 | 약 80 | `AppText` |
| 🔴 책 읽기 상태 칩을 `Pressable` 로 다시 그림 | 2 화면 | `Chip` + `ChipRow` |
| 칩 줄 `flexDirection · flexWrap · gap` | 7 | `ChipRow` |
| 머리카락 구분선 | 4 | `Divider` |
| 같은 폭 버튼 둘 | 4 | `ButtonRow` |
| 구분선 목록의 문장 행 | 3 | `QuoteRow` |
| 표지 + 제목 + 설명 | 2 | `BookLine` |
| 되돌릴 수 없는 동작 확인창 | 5 | `confirmDestructive` |
| 메타 한 줄 `filter(...).join(' · ')` | 7 | `joinMeta` |
| 날짜 표시 | 3 | `formatDate` |
| 태그 입력 나누기 | 2 | `splitTagInput` |
| 선택 집합 토글 | 3 | `toggled` |
| 요일 키 배열 | 2 벌 | `WEEKDAY_KEYS` |
| 반복 주기 라벨 판정 | 2 | `parseRepeat(rule).kind` |
| 표지 글자색 `'#1C1A17'` 직접 씀 | 1 | 토큰 `coverInk` |
| 높이만 주는 빈 `View` 에 쓰이지 않는 `borderRadius` | 1 | 지웠다(`Spacer`) |

### 7.2 🔴 화면이 달라지는 것 (의도한 것만)

- 문장 목록·문장 상세의 출처 줄: 책이 없고 페이지가 **빈 문자열**이면 전에는 **빈 줄**이 생겼다. 이제 줄을 안 그린다.
  원래 규칙(*"출처가 없는 카드는 출처 줄 자체가 없다"* · `KNOWLEDGE_SYSTEM.md` §8)으로 돌아간 것이다.
- 책 목록의 설명 줄이 한 줄로 잘린다(`BookLine`). 책 고르기와 같아졌다.
- 책 고르기 목록의 저자 줄 위에 4px 여백이 생긴다(`BookLine`). 책 목록과 같아졌다.

### 7.3 일부러 안 합친 것

| 무엇 | 왜 |
|---|---|
| 책 상세의 진행률 막대 | 한 곳뿐이다. 두 번째 자리가 생기면 뺀다 |
| 홈 아래 링크 줄 · 설정 화면의 행 | 그 화면 안에서만 반복된다(§4). 파일 안 함수로 뒀다 |
| `Button` · `Chip` · `Field` 안의 글자 | 부품 자신이 토큰의 첫 소비자다. 이들까지 `AppText` 로 감싸면 부품이 부품에 기댄다 |
| 백업 가져오기의 미리보기 창(버튼 셋) | 되돌릴 수 없는 동작이 아니라 **고르는 창**이다. `confirmDestructive` 의 뜻이 아니다 |

### 7.4 🔴 왜 전에는 못 잡았나

`Chip.tsx` 의 주석은 *"책 선택 · 태그 · 읽기 상태가 전부 이걸 쓴다"* 고 적고 있었는데 **읽기 상태는 안 쓰고 있었다.**
두 책 화면이 칩을 손으로 다시 그렸고, 모양이 똑같아서 화면으로는 구분이 안 됐다.
`tsc`·`lint`·가드 열여섯은 **동작**을 재고 **같은 모양이 몇 벌인지**는 원리적으로 안 잰다.

★ **"부품이 있다" 와 "화면이 부품을 쓴다" 는 다른 사실이다.** 순수 함수를 만들어 두고 화면이 안 쓰던
`42p쪽`(`check:knowledge` ④)과 같은 모양이다. 그래서 `check:ui` 는 부품이 있는지가 아니라
**화면에 그 부품을 우회한 흔적이 남았는지**를 잰다(①~⑥).

### 7.5 ✅ 2026-09-13 에 멈추고 2026-09-14 에 끝냈다

9/13 은 사용자 지시 *"여기까지 하고 정리해줄래"* 로 부품·헬퍼까지만 커밋했다(`99411bb`). 9/14 사용자 지시 *"지금 진행해"* 로 나머지를 끝냈다.

| 무엇 | 상태 |
|---|---|
| 이 문서 · README 색인 | ✅ |
| 새 부품 7개 · 헬퍼(`lib/format` · `lib/confirm` · `lib/set` · `WEEKDAY_KEYS` · `splitTagInput` · `coverInk`) | ✅ 파일만 |
| 기존 부품 5개(`BookCover` · `BookSelect` · `Header` · `WeekRow` · `Field`)를 새 부품으로 | ✅ 9/14 |
| 화면 16개를 새 부품·헬퍼로 (§7.1 의 처리 열) | ✅ 9/14 |
| 가드 `check:ui` · `check:knowledge` 에 `splitTagInput` 경계 추가 | ✅ 9/14 |

🔴 **§7.2 의 화면 변화가 이제 앱에 있다.** 같은 날 날짜 표시가 UI 언어에서 **기기 로케일**로 바뀌었다(`CLAUDE.md` §9).
⏸ 화면 확인은 에뮬레이터에서 한다(OCR 은 실기기).
