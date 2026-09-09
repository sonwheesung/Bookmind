# Re:Read — 문서 색인

> 🔴 **이 파일이 문서 색인이자 구현 현황의 정본이다.** 새 `*_SYSTEM.md`를 추가하면 반드시 아래
> 목록과 구현 현황표에 함께 등록한다([`DOC_DISCIPLINE.md`](./DOC_DISCIPLINE.md) 부록).
> 다른 세션이 **이 파일만 읽고도 전체를 돌릴 수 있어야 한다.**
>
> 설계 원칙·기둥·MVP 범위·결정 로그는 루트 [`../CLAUDE.md`](../CLAUDE.md).

---

## 1. 문서 목록

**12개** (세는 법: `ls docs/*.md | wc -l`)

| 문서 | 범위 | 상태 |
|---|---|---|
| [`../CLAUDE.md`](../CLAUDE.md) | 설계 정본 — 기둥 7개 · MVP 범위 · 서버 경계 · 스택 · 결정 로그 **16건**(세는 법: `grep -c "^\*\*#" CLAUDE.md`) · 미결정 **7건**(세는 법: `grep -c "^\| [A-H] \|" CLAUDE.md` — 닫힌 것은 `~~F~~` 로 취소선 처리되어 자동으로 빠진다) | ✅ 2026-09-08 |
| [`PLAN.md`](./PLAN.md) | 착수 순서 Phase 0~12 · 완료 기준 · 진행 현황 | ✅ 2026-09-08 |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | 서버 경계 — 3분할 구조 · common_server 계약 · AI 프록시 · **조각 서버 편입을 기각한 근거** | ✅ 2026-09-08 |
| [`DATABASE.md`](./DATABASE.md) | 로컬 스키마 v1 (expo-sqlite **12테이블**) · UUID/tombstone 규약 · 삭제 규칙 · 조회 패턴 · 구현 위치(§6) | ✅ 2026-09-09 |
| [`KNOWLEDGE_SYSTEM.md`](./KNOWLEDGE_SYSTEM.md) | 책 · 수집(입력/OCR) · 지식 카드 · 내 생각 · 태그 · 검색 · 홈 | ✅ 2026-09-08 |
| [`REVIEW_SYSTEM.md`](./REVIEW_SYSTEM.md) | 🔴 **제품의 급소** — FSRS · 두 층의 복습 · 회상 질문 5종 · 오늘의 복습 · 알림 | ✅ 2026-09-08 |
| [`AI_SYSTEM.md`](./AI_SYSTEM.md) | 분석 · 질문 생성 · 프록시 무저장 · 콘텐츠 유형 5종 · 비용 방어 · 고지 문안 | ✅ 2026-09-08 |
| [`PRACTICE_SYSTEM.md`](./PRACTICE_SYSTEM.md) | 실천 생성(사용자 확정) · 체크 · 연속일 · **지식과의 분리** | ✅ 2026-09-08 |
| [`MONETIZATION_SYSTEM.md`](./MONETIZATION_SYSTEM.md) | 구독 단독(광고 없음) · 티어 · 해지 후 동작 · 엔타이틀먼트 · 법적 의무 | ✅ 2026-09-08 |
| [`I18N_SYSTEM.md`](./I18N_SYSTEM.md) | 글로벌 · en 기본 + ko · **세 개의 언어 축** · 키 규약 · 가드 | ✅ 2026-09-08 |
| [`DOC_DISCIPLINE.md`](./DOC_DISCIPLINE.md) | 문서 작업법 (`common/DOC_SYSTEM.md` 의 프로젝트판) | ✅ 2026-09-08 |
| [`ORIGINAL_BRIEF.md`](./ORIGINAL_BRIEF.md) | 🔴 **원본 기획서 원문 — 정본이 아니다** | ✅ 2026-09-08 |
| [`../.claude/skills/README.md`](../.claude/skills/README.md) | 스킬 색인 — 이식 4종 · Phase 별 도입 예정 11종 · 안 가져오는 것과 이유 | ✅ 2026-09-08 |

### 아직 없는 문서 (필요해지는 시점)

| 문서 | 언제 | 상태 |
|---|---|---|
| `UI_GUIDE.md` | 첫 화면 전(Phase 0~2) — 토큰 · 공통 컴포넌트 · **UI 금지 목록** | ❌ |
| `EDGE_CASES.md` | 첫 버그. 각 `*_SYSTEM.md` 말미의 엣지 케이스 표를 EC-NNN으로 이관 | ❌ |
| `BACKUP_SYSTEM.md` | Phase 12 (v1.1) | ❌ |
| `LEGAL_SYSTEM.md` | Phase 11 — 처리방침 · 약관 · Play 데이터 보안 | ❌ |
| `STORE_LISTING.md` | Phase 11 | ❌ |
| `BUILD.md` | 첫 릴리스 빌드 | ❌ |
| `OTA_SYSTEM.md` | OTA 도입 시 | ❌ |
| `POLISH_BACKLOG.md` | 첫 "이건 아닌데 지금은 넘어간다" | ❌ |
| `COMMUNITY_SYSTEM.md` | 3차 | 🚫 |

---

## 2. 구현 현황

**2026-09-09 문서 체계 + Phase 0 + Phase 1 완료.** 아래 표가 착수 순서의 기준이 된다.
Phase 정의는 [`PLAN.md`](./PLAN.md).

### 앱

| 영역 | 상태 | 비고 |
|---|---|---|
| Expo 부트 (SDK 54 · expo-router · TS strict · **Metro 8091**) | ✅ | Phase 0. 🔴 포트 미지정 시 8081로 모여 My Word와 충돌 |
| 테마 토큰 · 타이포 | ✅ | Phase 0. 🔴 **시스템 폰트**(결정 #13) — `assets/fonts/` 없음. 사용자가 저장하는 책 문장의 언어를 우리가 못 정하므로 번들 폰트는 두부(□)를 만든다 |
| i18n 골격 (`en`·`ko`) + `check:i18n` | ✅ | Phase 0. 🔴 첫날에 세운다 |
| 로컬 DB v1 (12테이블) | ✅ | Phase 1(2026-09-09). 러너 · UUID/tombstone 헬퍼 · 삭제 규칙 · `check:db` 가 실물 SQLite 에 세워 잰다 · [`DATABASE.md`](./DATABASE.md) §6 |
| 빠른 저장 (직접 입력 · 붙여넣기) | ✅ | Phase 2(2026-09-09). 🔴 필수 입력은 `content` 하나 — 홈에서 1탭 |
| 책 등록 · 목록 · 상세 | ✅ | Phase 2(2026-09-09). 파생 집계 4종 · 🔴 삭제해도 지식은 남는다 |
| 지식 카드 · 내 생각(1:N) · 태그 | ✅ | Phase 2(2026-09-09). 에뮬 E2E 로 CRUD 전 구간 확인 |
| 언어 설정 화면 (`en`·`ko`) | ✅ | 🔴 **Phase 6 에서 당겼다**(2026-09-09) — 안 보는 언어는 깨진다. `I18N_SYSTEM.md` §2.1 |
| 복습 v1 — FSRS · 기본 복습 · 오늘의 복습 · 홈 | ❌ | Phase 3. 🔴 AI 없이 성립하는지의 시험대 |
| 로컬 알림 | ❌ | Phase 4. 🔴 **실기기 다일차 검증이 완료 기준** |
| OCR | ❌ | Phase 5. ⚠ 미결정 C · 🔴 온디바이스 |
| 검색 · 통계 | ❌ | Phase 6 |
| 공지 · 점검 · 버전 게이트 · 문의 | ❌ | Phase 7 (common_server) |
| 구글 로그인 · 탈퇴 | ❌ | Phase 7. 🔴 같은 커밋에 |
| AI 분석 · 회상 질문 | ❌ | Phase 8 (Premium) |
| 실천 | ❌ | Phase 9 (Premium) |
| 구독 (RevenueCat · 무료 한도) | ❌ | Phase 10. ⚠ 미결정 A · B |
| 백업 / 복원 | ❌ | Phase 12 (v1.1). 🔴 출시 직후 최우선 |
| 광고 | 🚫 | 안 한다 — `MONETIZATION_SYSTEM.md` §1 |
| ISBN 검색 · 음성 입력 · 독서 진행률 | 🚫 | MVP 제외. 2차 |
| 커뮤니티 | 🚫 | 3차 · `ARCHITECTURE.md` §7 |

### 서버 · 외부 (Re:Read 코드 밖 선행 작업)

| 영역 | 상태 | 비고 |
|---|---|---|
| common_server `apps`에 `reread` 등록 | ❌ | `node tools/seed.ts reread "Re:Read"` (common_server에서) |
| common_server SDK 복사 → `lib/common-server/` | ❌ | **복사**해 쓴다. 수정 금지 · 갱신은 재복사 |
| Discord 문의 웹훅 env | ❌ | `DISCORD_TICKET_WEBHOOK_URL_REREAD` + 재배포 |
| Supabase 프로젝트 | ❌ | 🔴 `project_id`를 **`reread`로 명시** — 디렉터리명(`server`)이면 형제 스택에 붙는다 |
| Vercel 프로젝트 (Re:Read 서버) | ❌ | |
| Anthropic API 키 | ❌ | 🔴 서버 env에만 |
| RevenueCat + 스토어 상품(월/연) | ❌ | Phase 10 |
| Google Sign-In OAuth 클라이언트 | ❌ | Play 서명 키 SHA-1 필요 |
| Play 콘솔 앱 · 비공개 테스트 | ❌ | 테스터 요건 `common/CLOSED_TESTING.md` |
| 처리방침 · 약관 게시 (EN · KO) | ❌ | Phase 11 |
| 상표 확인 "Re:Read" | ❓ | 🔴 **사용자 확인 필요** — 스토어 등록 전에 |
| `common/DEV_ALLOCATION.md` Re:Read 행 | ❌ | Metro 8091 · 서버 3500 · Supabase 248xx |

✅ 완료 / 🔨 진행 중 / ❌ 미착수 / ⏸ 보류 / 🚫 안 하기로 결정 / ❓ 모름(확인 필요)

---

## 3. 검증 루틴

> 🔴 **여기가 검증 명령의 유일한 권위 목록이다.** 다른 문서나 스킬에 복사하지 않는다 —
> 복사하면 드리프트해서 새 가드가 누락된다. **새 가드를 만들면 여기에 추가하는 것까지가 완료다.**

✅ **Phase 0 에서 만들었다(2026-09-08).** 한 방 실행은 `npm run verify`.

```bash
npm install
npm run verify        # ← 커밋 전 이것 하나. 아래 여섯을 순서대로 돌린다

npm run typecheck     # tsc --noEmit · strict · noUncheckedIndexedAccess
npm run lint          # expo lint
npm run check:i18n    # ① 키 누락 ② 잉여 ③ 보간 일치 ④ 비한국어 파일 한글 잔존
npm run check:chars   # 🔴 제어문자 — CR 은 grep 이 못 봐서 바이트로 읽는다(아래 §)
npm run check:docs    # 문서에 박힌 개수 ⇄ 실제 세기 대조
npm run check:db      # 🔴 로컬 스키마·삭제 규칙 — 실물 SQLite(node:sqlite)에 세워서 잰다

npm run format:check  # prettier (코드만 — 마크다운은 .prettierignore 로 제외)
```

⚠ **`typecheck` 는 생성된 라우트 타입에 기댄다**(`app.json` `typedRoutes: true` → `.expo/types/router.d.ts`).
`.expo/` 는 gitignore 라 **새로 받은 저장소에서는 그 파일이 없다** — 그 상태로 typecheck 를 돌리면
`router.push('/books')` 같은 줄이 전부 빨갛게 뜬다. **코드가 깨진 것이 아니다.**
→ `npx expo start` 를 한 번 띄우면(또는 `npx expo export`) 재생성된다. Expo CLI 에 typegen 단독 명령이 없다(SDK 54 실측).

🔴 **가드 셋 전부에 `SELF-TEST` 가 내장돼 있다.** 매 실행마다 판정 함수가 살아 있는지 먼저 증명하고,
실패하면 **exit 2** 로 죽는다(검사 실패는 exit 1). 형제가 19일간 초록이었던 사고(§ 아래)가
"변이가 안 잡힌다"가 아니라 **"아무것도 안 본다"** 였기 때문이다.

**변이 주입 실측(2026-09-08 · 6종 전부 FAIL 발화 확인)**

| 변이 | 결과 |
|---|---|
| ko 키 삭제 | `① 누락 ko: review.reveal` ✅ |
| 보간 `{{count}}` → `{{n}}` | `③ 보간 en={count} ko={n}` ✅ |
| en 값에 한글 | `④ 한글 en: common.done` ✅ |
| 파일에 `0x08` 주입 | `1건, offset 12 (0x08)` ✅ |
| 문서 개수 조작(12→11) | `문서 11 ≠ 실제 12` ✅ |
| 🔴 **앵커 제거**(문구 변경) | `앵커를 못 찾았다` ✅ — 조용히 통과하지 않는다 |

**`check:db` 변이 주입 실측(2026-09-09 · 9종 전부 발화)**

| 변이 | 결과 |
|---|---|
| `deleted_at` 필터 제거 | **exit 2** — SELF-TEST 가 먼저 잡는다 ✅ |
| tombstone → 물리 삭제 | `tombstone 이 물리 삭제됐다` ✅ |
| 실천 연결 해제 단계 삭제 | `실천의 지식 연결이 안 끊겼다` ✅ |
| 고아 태그 `NOT EXISTS` 제거 | `다른 지식이 아직 쓰는 태그를 지웠다` ✅ |
| 인덱스 `idx_rs_due` 제거 | `인덱스 idx_rs_due 가 없다` ✅ |
| 표 하나 제거 | `스키마 단계가 예외로 죽었다: no such table` ✅ |
| 마이그레이션 버전 기록 누락 | `멱등 단계가 예외로 죽었다: table books already exists` ✅ |
| UUID → `AUTOINCREMENT` | `AUTOINCREMENT 가 db/ 에 1건` ✅ |
| 다운그레이드 검사 제거 | `DB 가 코드보다 앞선 상태인데 러너가 그냥 진행한다` ✅ |

🔴 **셋은 처음에 `exit 1` 이 나는데 이유를 못 읽었다** — 스키마가 깨진 변이에서 예외로 죽어
앞 단계가 모아 둔 실패 목록이 화면에 안 나왔다. 단계마다 `try/catch` 로 감싸 고쳤다.
**변이를 안 주입했으면 몰랐을 결함이다** — 통과만 보면 이런 것이 안 보인다.


**앞으로 붙는 것**

```bash
# Phase 8부터
npm run check:shared           # 앱 ⇄ 서버 공유 타입 드리프트 (AI 스키마)
# Phase 10부터
npm run check:release-env      # 🔴 로컬 릴리스 빌드에 개발용 env 가 박히는 것 방지
```

**번들 컴파일 확인**(구현 완료 선언 전 필수) — Metro 기동 상태에서
```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  "http://localhost:8091/node_modules/expo-router/entry.bundle?platform=android&dev=true"
```
2026-09-08 실측: **200 · 1.66MB · 40초**(`--no-dev --minify`).
⚠ 200 만으로는 부족하다 — **번들 안에 우리 문자열이 실제로 들어갔는지** 함께 본다.
minify 가 한글을 `\uXXXX` 로 이스케이프하므로 리터럴 grep 은 **MISS 가 나온다**(그것 때문에 한 번 오진했다).

### 🔴 제어문자가 정규식을 조용히 무력화한다 (2026-09-08 · 전 프로젝트 공유)

파이썬 heredoc·sed 로 파일을 쓰면 `\b`·`\v`·`\1` 이 **제어문자 `0x08`·`0x0b`·`0x01` 로 박힌다.**
화면에 안 보이고, 정규식이면 **에러 없이 아무것도 매칭하지 않고 통과한다.**

형제 `idea_repository/scripts/check-i18n.mjs` 가 이것 때문에 **19일간 FAIL 불가 상태로 초록**이었다
(`/\bt\(/` → `/<0x08>t\(/` → 항상 0건). 🔴 검사 **개수**로는 안 잡힌다 — 개수는 실행량이지 검증량이 아니다.
이 세션도 같은 날 밟았다(`D:\emulators\reread` 의 `\r` 이 CR 로 박혔다).

- 🔴 **정규식·이스케이프가 든 파일은 heredoc/sed 가 아니라 Write 도구로 쓴다.**
  스크립트로 조립해야 하면 `chr(92)` 로 백슬래시를 만든다.
- 🔴 **스크립트로 파일을 고칠 때는 인코딩을 파일 열기 *전에* 끝낸다** (2026-09-08 실사고, §3.1).
  `io.open(p,'w').write(s)` 는 **청크로 인코딩하며 쓴다** — 중간에 실패하면 **이미 잘린 파일이 남는다.**
  `data = s.encode('utf-8')` 로 먼저 인코딩하고, 임시 파일에 쓴 뒤 `os.replace` 로 바꾼다.
  그리고 **비-git 경로(`C:\project\common`)를 고치기 전에는 반드시 사본을 뜬다**
  (`common/DOC_SYSTEM.md` §6.1 — 되돌릴 수단이 없다).
- ⚠ **파이썬에서 이모지는 `\U0001F534`** 다. `\ud83d\udd34`(UTF-16 서로게이트 쌍)는
  lone surrogate 두 개이고 **utf-8 로 인코딩되지 않는다.**
- 🔴 가드를 만들면 변이 주입에 **양성 대조**(정규식이 실제로 0건이 아닌 무언가를 수집하는가)를 포함한다.
  상세는 [`I18N_SYSTEM.md`](./I18N_SYSTEM.md) §5.1.

#### 🔴 grep 은 이 환경에서 CR 을 **볼 수 없다** (2026-09-08 실측 · 두 번 틀린 끝에)

이 절은 **두 번 틀렸다가 실측으로 바로잡은 것**이라 과정을 남긴다. 결론만 읽으면 또 틀린다.

```
1차: [\x00-\x08\x0b\x0c\x0e-\x1f]              → CR 이 허용 범위. 이 세션이 밟은 CR 을 못 잡는다
2차: … |\x0d(?!$)  ("줄 끝이 아닌 CR")           → 4케이스 통과. 🔴 그런데 케이스가 부족했다
3차: 🔴 grep 은 CR 을 아예 못 본다 — 패턴 문제가 아니었다
```

2차 패턴은 **CRLF 파일 안에 박힌 줄 중간 CR** 이라는 결정적 케이스를 안 만들었다. 만들어 보니 놓쳤고,
`od` 로 파헤치니 원인이 패턴이 아니었다 — **Git Bash(MSYS)의 GNU grep 3.0 이 CR 을 통째로 지운다.**

```
파일:        path: D:\emulators<0x0d>reread<0x0d><0x0a>   (CR 4개)
grep -oP '\x0d' … | wc -l  →  0        ← grep 에게 CR 은 존재하지 않는다
grep -n '' 을 od 로:  path: D:\emulatorsreread            ← CR 이 사라진 채로 넘어온다
```

🔴 **그래서 `\x0d` 가 든 어떤 grep 패턴도 이 환경에서는 발화할 수 없다.** 죽은 코드이고,
더 나쁘게는 **"CR 도 보고 있다"는 거짓 안심**을 준다. 그래서 위 명령에서 CR 축을 뺐다.

**CR 축은 바이트 판독기(Node/Python)로만 닫힌다.** 규칙:

> **CR 은 바로 뒤에 LF 가 올 때만 정상이다.** 그 외(줄 중간 · lone-CR)는 결함.
> 🔴 CR 을 통째로 금지하면 안 된다 — 이 레포는 `core.autocrlf=true` 라 체크아웃하면
> `.md` 가 전부 CRLF 가 된다. 전부 금지하면 **가드가 온통 오탐이 되어 꺼진다.**
> 꺼진 가드는 죽은 가드보다 나쁘다(다음 사람이 "원래 시끄러운 것"으로 배운다).

바이트 판독기로 6케이스 검증했다(**6/6**):

| 입력 | 바이트 판독기 | grep |
|---|---|---|
| 정상 CRLF 파일 | 통과 ✅ | 통과 |
| 깨끗한 LF 파일 | 통과 ✅ | 통과 |
| **CRLF 파일 + 줄 중간 CR** | **잡힘 ✅** | 🔴 **놓침** |
| LF 파일 + 줄 중간 CR | 잡힘 ✅ | 🔴 놓침 |
| lone-CR 개행 | 잡힘 ✅ | — |
| `0x08` 이 든 정규식 | 잡힘 ✅ | 잡힘 |

→ Phase 0 에서 `check:chars` 를 만든다. 참조 구현 `idea_repository/scripts/check-chars.mjs`
(허용을 TAB·LF·CR 셋으로 정확히 끊어 농구명가의 `9~13 통짜 허용` 구멍을 피했고, 판정 함수
자가 검증 샘플에 `0x08`·`0x0b` 를 둘 다 넣었다). 🔴 **베낄 때 CR 위치 규칙을 더한다** —
그 구현은 CR 을 무조건 허용하므로 위 3·4번 케이스를 놓친다.

⚠ `--exclude-dir` 로 **스캔 자체를 제외**한다. `| grep -v node_modules` 는 다 스캔한 뒤
출력만 거르는 것이라 전체 트리에서 120초를 넘긴다(My Word 실측).

🔴 **교훈은 패턴이 아니다**: 2차 판은 "4케이스 통과"로 초록이었고 그 초록이 틀렸다.
**케이스가 현실을 안 덮으면 통과는 아무 뜻이 없다** — 양성 대조도 케이스가 있어야 의미가 있다.

#### 🔴 3.1 같은 계열의 실사고 — 공용 문서를 0바이트로 날렸다 (2026-09-08)

`common/ACCOUNT_LIFECYCLE.md` 에 우리 행을 추가하는 파이썬 스크립트가 **파일을 0바이트로 잘랐다.**

```
원인: 이모지를 '🔴'(UTF-16 서로게이트 쌍)로 썼다 → 파이썬에선 lone surrogate 두 개
      io.open(p,'w',encoding='utf-8').write(s) 가 청크로 인코딩하며 쓰다가
      position 10063 에서 UnicodeEncodeError → 🔴 그 시점까지 쓴 내용도 날아가고 0바이트가 남았다
```

- 🔴 **"실패했으니 원본은 그대로겠지"가 틀렸다.** 쓰기는 이미 시작돼 있었다.
  `diff` 로 사본과 대조해서야 손상을 알았다 — 에러 메시지만 보면 안전해 보인다.
- 🟢 **`DOC_SYSTEM.md` §6.1 의 "고치기 전에 사본을 뜬다"가 그대로 값을 했다.**
  `common` 은 git 레포가 아니라 사본이 유일한 복구 수단이었다(20,408 바이트 완전 복구).
- → 처방은 위 규칙 두 개다: **인코딩 먼저 · 원자적 교체**. 그리고 **사본**.

**번들 컴파일 확인**(구현 완료 선언 전 필수): Metro 기동 상태에서
```bash
curl -s -o /dev/null -w "%{http_code}" "http://localhost:8091/node_modules/expo-router/entry.bundle?platform=android&dev=true"
# 200 이면 런타임 모듈 에러 없이 번들 생성
```

### 실행 환경 주의 (형제 실증 승계)

- 🔴 **Metro 포트 8091을 반드시 명시**한다(`package.json` scripts). 지정하지 않으면 기본값 8081로
  모여 My Word와 충돌한다 — `common/DEV_ALLOCATION.md` §1.
- ⚠ **Metro 재시작은 PowerShell `Stop-Process`로.** git-bash `kill`은 Windows 프로세스에 조용히 실패한다.
- ⚠ **형제 Metro가 떠 있을 때 `--clear` 금지** — 공유 metro-cache가 ENOTEMPTY로 깨진다.
- 🚫 **`taskkill //IM java.exe` 를 쓰지 않는다.** 형제 프로젝트의 gradle 빌드·에뮬레이터·IDE를
  전부 죽인다(2026-09-01 실제 사고: 다른 프로젝트 빌드 2회 손실).
  `gradlew --stop` 도 데몬이 사용자 단위 공용이라 같은 문제가 있다.
### 에뮬레이터 (정본은 `common/EMULATOR_POOL.md` — 2026-09-08 정책 변경)

~~공용 2대를 클레임해 빌려 쓴다~~ → **프로젝트별 전용 AVD · 저장은 외장 `D:`**(2026-09-08 사용자 결정).

```bash
export ANDROID_AVD_HOME='D:\emulators\reread'   # 🔴 이 한 줄을 빼면 기본값 C: 로 간다
mkdir -p "/d/emulators/reread"
avdmanager create avd -n reread -k "system-images;android-35;google_apis;x86_64" -d pixel_6
emulator -avd reread -port 5574 -no-snapshot -no-snapshot-save -no-boot-anim -gpu auto
```

- **Re:Read AVD = `reread` · 포트 5574**(`common/DEV_ALLOCATION.md` §3에 예약). ❌ 아직 미생성.
- 🔴 **`-port` 를 빼면 조용히 5554로 가서 남의 에뮬을 덮는다.**
- 🔴 **외장은 7.8배 느리다** — 콜드 부팅 259초(내장 33초) · Expo Go 설치 94초(내장 6초).
  실패가 아니라 느린 것이다. **재시작이 5회 넘을 작업이면 에뮬을 켜 둔 채 Metro만 재시작**하고
  딥링크로 화면에 직행한다(`EMULATOR_POOL.md` §2.1).
- ⚠ `expo start --android` 는 실기기가 붙어 있으면 그쪽으로 간다(`ANDROID_SERIAL` 무시).
- ⚠ RN 화면은 uiautomator 텍스트가 0으로 나올 수 있다 — 로드 판정은 `screencap` 으로.
- ⚠ 포트로 AVD를 식별하지 않는다. `emu avd name` 으로 묻는다.

---

## 4. 아키텍처 원칙

- 🔴 **사용자 데이터의 진실은 기기다.** 서버가 죽어도 저장·복습·실천은 완전히 동작해야 한다
  (`../CLAUDE.md` 기둥 2 · `ARCHITECTURE.md` §8).
- 🔴 **어떤 서버에도 지식을 저장하지 않는다.** 나가는 것은 bootstrap 조회 · 하트비트 · 문의 본문 ·
  로그인 토큰 · **AI 분석 요청(지나가되 저장 안 함)** 이 전부다(`ARCHITECTURE.md` §5.3).
- **공통 기능(계정·구독·문의·공지)은 common_server, AI는 Re:Read 전용 `server/`.**
  🔴 조각 서버에 편입하지 않는 근거는 `ARCHITECTURE.md` §3.
- 의존 방향: `app/`(라우트) → `features/` → `db/`·`lib/`·`theme/`. **역방향 import 금지.**
- **모든 화면은 `components/Screen`으로 감싼다** — 화면에서 SafeAreaView·ScrollView를 직접 쓰지 않는다.
  세이프에어리어와 키보드 가림을 한 곳에서 처리한다(조각 승계).
- **저장 흐름에 필수 입력을 추가하지 않는다**(기둥 1). 필수는 `content` 하나뿐이다.
- **모든 로컬 레코드는 UUID PK + `updated_at` + `deleted_at`.** 정수 자동증가 ID 금지(결정 #8).
- **조회는 항상 `deleted_at IS NULL`.** 헬퍼로 강제한다 — 빠뜨리면 빈 화면이 아니라 **틀린 화면**이 된다.
- **파생값(기억률·연속일·집계)은 저장하지 않고 매번 센다.** 저장하면 반드시 늙는다.
- `any` 금지, `strict` 유지.
