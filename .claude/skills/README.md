# 프로젝트 스킬 색인 (Re:Read)

`C:\project\common\.claude\skills`(범용 방법론)에서 이식했다. 2026-09-08.
**common 이 원본이다** — 범용 규율이 바뀌면 common 을 고치고 여기로 다시 내린다.
반대로 **이 프로젝트에서 새로 겪은 함정**이 다른 프로젝트에도 통하는 보편 규율로 판명되면 common 으로 올린다.
(승계: `C:\project\basketball_story\.claude\skills\README.md` 의 왕복 규약)

🔴 **값을 베끼지 않는다. 정본을 가리킨다.** 스킬에 포트·경로·명령을 박으면 그 문서가 바뀔 때 같이 낡고,
베낀 시점의 규약이 그대로 굳는다(2026-09-08 에뮬레이터 정책 전환에서 7개 프로젝트 11개 파일이 걸렸다).

---

## 이식한 것 (4종)

| 스킬 | 언제 | 이식 형태 |
|---|---|---|
| `reload-docs` | `/compact` 직후 · 새 세션 착수 전 | common 그대로 |
| `doc-consistency` | 문서 여러 개 갱신 후 · Phase 를 닫을 때 | common 그대로 |
| `gap-hunt` | 새 시스템·사건 추가 후 "빠진 반응 없나" | common 그대로 |
| `devils-advocate` | 🔴 **Phase 0 착수 전** · 큰 기획 결정 전 | common 그대로 |
| `check` | `/check` · "수정사항 확인" · 작업을 시작할 때 | `common/FIX_REQUESTS.md` §7.2 · §7.3 원본 복사(2026-09-15). **탭 이름만 `bookmind`** 로 바꿨다. 읽고 알려 주기만 한다 |

⚠ 셋(`reload-docs`·`doc-consistency`·`gap-hunt`)은 2026-09-08 common 현재본과 **byte 동일**이다.
갱신은 재복사로 한다 — 여기서 고치지 않는다.

### 🔴 `devils-advocate` 를 지금 가져온 이유

지금 이 프로젝트는 **코드가 0줄이고 문서만 있다.** 그런데 기획서를 `CLAUDE.md` 로 옮기면서
**기둥 7개를 세우고 기획서를 4곳 뒤집었고**(§14 #3·#5·#6·#10), 미결정이 7건 남아 있다.
그 판단들은 전부 **이 세션이 내린 것**이고, 만든 세션은 자기 설계를 변호하게 되어 있어
**구조적으로 스스로 평가하지 못한다.** 코드를 쓰기 시작하면 되돌리는 비용이 급격히 오른다.

→ Phase 0 착수 전에 한 번 돌리는 것을 권한다. 특히 볼 것:
사업성(구독 단독·광고 없음이 성립하나) · 사용자 이탈(백업 없이 v1.0 을 내는 것) ·
설계 정합(로컬 정본과 3차 커뮤니티가 정말 안 부딪히나) · 실행 현실성(Phase 0~12 가 과한가).

---

## 이식하지 않은 것 — 전역에 이미 있다 (중복 금지)

`~/.claude/skills` 에 등록된 것은 여기서 다시 만들지 않는다:
`ui-design-reference` · `store-iap-setup` · `payment-security-compliance` ·
`play-store-launch-checklist` · `play-store-assets` · `privacy-*` · `ship` · `qa` · `investigate` ·
`review` · `code-review` · `browse` · `design-review` 등.

⚠ 특히 **결제·법규는 전역 스킬이 정본**이다. 이 폴더에 결제 관련 스킬을 만들지 않는다.

---

## 🔴 아직 안 가져온 것 — **코드가 생긴 뒤** 가져온다

지금 가져오면 **스킬이 존재하지 않는 명령·문서를 가리켜 거짓말을 한다**(`DOC_SYSTEM.md` §8.4).
가져올 때는 **그 시점의 common 현재본**을 쓴다 — 오래된 사본을 들고 있는 것이 가장 나쁘다.

| 후보 | 언제 | 왜 지금은 아닌가 |
|---|---|---|
| `test` | **Phase 0** | 4계층 게이트가 `npm run` 스크립트를 전제한다. `package.json` 이 없다 |
| `safety-zone` | **Phase 0~2** | 모든 화면을 `<SafetyZone>` 으로 감싸는 규율. 화면이 0개다. `components/Screen` 을 만들 때 같이 |
| `i18n-layout-audit` | **Phase 0 이후** | 🔴 글로벌 출시라 중요도가 높다. 번역 *길이* 때문에 라벨이 잘리는 결함은 커버리지 가드가 못 잡고 **눈으로만** 잡힌다. 화면이 있어야 돈다 |
| `emulator-test` | **Phase 2** | AVD `reread`(5574) 미생성. 🔴 common 판이 2026-09-08 새 정책으로 갱신됐으니 **그때 최신본**을 가져온다 |
| `wireless-debug` | **Phase 4** | 🔴 알림 **실기기 다일차 검증**이 Phase 4 완료 기준이다(에뮬로 대체 불가). 그때 필요해진다 |
| `responsive-media` | **Phase 2·5** | 책 표지 · OCR 촬영 화면이 생길 때 |
| `independent-verify` | **Phase 3 이후** | 🔴 필요성은 이미 증명됐다(아래). 다만 원본이 `docs/TEST_METHODOLOGY.md`·`STATS_PROTOCOL.md`·`tools/_iv_*.ts`·`npm test` 를 전제하는데 **넷 다 없다.** 그대로 베끼면 없는 문서 4개를 가리킨다 |
| `dev-stack` | **Phase 8** | 서버(`server/`)·Supabase 가 생긴 뒤. 포트는 `common/DEV_ALLOCATION.md` 를 가리키게 한다 |
| `security-audit` | **Phase 8** | 🔴 AI 프록시(무저장)·엔타이틀먼트 게이트를 만진 뒤 · 릴리스 전. Expo+serverless+Supabase 조합에 정확히 맞는다 |
| `copy-polish` | **Phase 11** | 문구가 대량으로 생긴 뒤. 글로벌이라 값이 크다 |
| `spec-audit` | **Phase 11+** | "배터리는 초록인데 불안할 때" 발견 모드 감사. 배터리가 아직 없다 |

### 🔴 `independent-verify` 는 필요성이 이미 증명됐다 — 미루는 것이지 안 하는 게 아니다

2026-09-08, 코드가 0줄인 상태에서 **이 스킬이 막았어야 할 실패가 실제로 났다**:

> 제어문자 가드를 만들고 **4케이스로 초록**을 받아 형제 세션에 전파까지 했는데,
> 결정적 케이스(CRLF 파일 안의 줄 중간 CR)를 안 만들었다. 만들어 보니 놓쳤고,
> 원인은 패턴이 아니라 **grep 이 CR 을 아예 못 본다**는 것이었다.
> ★ 내가 만든 가드를 내가 만든 케이스로 검증해서 **같이 틀렸다** — 이 스킬 서문의 "허위 오라클" 그 자체다.
> 상세: [`../../docs/README.md`](../../docs/README.md) §3

→ Phase 3(복습 v1)을 닫을 때가 첫 적용 시점이다. **"AI 없이도 복습이 성립하는가"** 는
이 세션이 스스로 판정하면 안 되는 종류의 주장이다(`docs/PLAN.md` Phase 3 완료 기준).

---

## 🚫 안 가져오는 것

| 스킬 | 왜 |
|---|---|
| `balance-sim` | 게임 수치 튜닝용. 우리에게 튜닝할 공식이 없다 — 복습 간격은 `ts-fsrs` 가 정하고, 개인화(v1.2)는 optimizer 가 실측 로그로 한다(§REVIEW_SYSTEM §2) |
| `sim-league` · `engine-regression` · `engine-verify` · `fuzz-game` · `edge-swarm` | 배구명가 게임 엔진 전용. 그 도메인(FA·드래프트·시즌)에 붙어 있어 그대로 가져오면 스킬이 거짓말을 한다 |
| `review-plan` | 설계 비평. `devils-advocate` 와 겹치고, 우리는 `CLAUDE.md` §13 표준 작업 순서가 그 자리를 맡는다. 🔴 다시 열 조건: **한 결정이 여러 시스템을 동시에 흔드는 일**이 잦아지면 |
| `verify-cases` · `analyze-cases` | 케이스 레지스트리 역할. 우리는 `docs/EDGE_CASES.md`(Phase 2 신설 예정)가 그 자리다 — 중복 |
| `deploy-prod` · `release-build` | 배구명가 배포 절차에 붙어 있다. 우리 절차는 Phase 11 에 `BUILD.md` 로 쓴다 |
| `info-scan` · `inquiry-reply` | common_server 운영 쪽 스킬 |

---

## 부록 — 스킬을 가져올 때 체크리스트

```
[ ] common 의 **현재본**인가 (오래된 사본을 들고 있지 않은가)
[ ] 포트·경로·AVD·패키지명 같은 고유값이 박혀 있지 않은가 — 있으면 정본을 가리키게 고친다
[ ] 스킬이 인용한 명령·문서가 **실재하나** (없으면 아직 이르다)
[ ] 이 README 표를 갱신했나 (이식한 것 / 안 가져온 것)
[ ] 검증 명령이 늘었으면 docs/README.md §3 에 추가했나
```
