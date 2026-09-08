# ARCHITECTURE — 서버 경계

> Re:Read의 **무엇이 기기에 있고 무엇이 서버에 있는가**의 정본.
> 정책 정본은 [`../CLAUDE.md`](../CLAUDE.md) §6. 이 문서는 그 경계의 근거와 계약을 상세화한다.
> 승계: `C:\project\diary`(조각) `docs/ARCHITECTURE.md` — 서버 3분할 구조와 common_server 연동 규약.

---

## 0. 구현 현황

| 영역 | 상태 | 비고 |
|---|---|---|
| 서버 경계 설계 | ✅ 2026-09-08 | 실물 조사(common_server 스키마 · 조각 서버 스키마) 근거 포함 |
| common_server `reread` 등록 | ❌ | `CLAUDE.md` §15 |
| common_server SDK 복사 | ❌ | |
| Re:Read 서버 `server/` 생성 | ❌ | Phase 8 |
| AI 프록시 라우트 | ❌ | Phase 8 |
| 백업 금고 | ❌ | v1.1 |
| 커뮤니티 | 🚫 | 3차. 설계만 §7 |

---

## 1. 전체 그림

```
┌─ 기기 (expo-sqlite) ───────────────── 정본 ────────────────────────┐
│  books · knowledge · thoughts · ai_analyses · recall_questions      │
│  review_schedules · review_logs · practices · practice_logs · tags  │
│                                                                     │
│  🔴 이것이 사라지면 되찾을 방법이 없다 (v1.1 백업 전까지)            │
└─────────────────────────────────────────────────────────────────────┘
        │                                        │
        │ 계정 · 구독 · 문의 · 공지                │ AI 분석
        │ (지식 본문 없음)                        │ (본문이 지나감 · 저장 안 함)
        ▼                                        ▼
┌─ common_server ────────────────┐    ┌─ Re:Read 서버 (server/) ──────┐
│  https://common-server         │    │  /api/v1/ai/analyze           │
│         .vercel.app            │    │  ai_calls · ai_usage          │
│  app_code: reread              │    │  ai_cooldowns                 │
│                                │    │  (v1.1) vaults · vault_blobs… │
│  공용 · 1배포 N앱               │    │  전용 · Supabase 248xx        │
└────────────────────────────────┘    └───────────────────────────────┘
                                                  │
                                                  ▼
                                            Anthropic API
```

---

## 2. 🔴 왜 지식을 common_server에 넣지 않는가

common_server가 실제로 가진 테이블은 이게 전부다(2026-09-08 실측):

```
apps · app_settings · announcements · tickets · subjects
app_auth_providers · entitlements · purchase_events · subject_active_day
info_sources · info_items
```

**콘텐츠 저장소가 없다.** 그리고 이건 빠뜨린 게 아니라 **"개인정보 최소수집"을 명시적 설계 원칙으로
박아둔 결과**다. 여기에 사용자 본문을 넣으면:

- 형제 앱 **전부**의 처리방침 문안이 바뀐다(1배포 N앱이므로).
- 폭발 반경이 커진다 — common_server가 죽으면 Re:Read 지식까지 같이 죽는다.
- 공용 레포에 Re:Read 도메인 로직이 들어가 형제 앱과 결합된다.

조각이 2026-08-07에 같은 판단을 내렸다(`C:\project\diary\docs\ARCHITECTURE.md` §2).

---

## 3. 🔴 왜 조각(diary) 서버에 편입하지 않는가 (2026-09-08 검토·기각)

조각 서버에는 우리가 원하는 게 이미 다 있다:

```
백업 금고   /api/v1/backup/{reserve,blobs,commit,latest,rebind,delete}
AI 프록시   /api/v1/ai/{report,purge,regenerable}
리퍼        /api/cron/reap
```

**그래도 같은 DB에 넣지 않는다.** 실물을 보고 확인한 네 가지:

### 3.1 앱 스코프가 없다 — 조용한 충돌이 이미 예약돼 있다

조각 서버는 **1앱 전제**로 지어졌다. 모든 테이블이 `subject_id` 하나로 갈라지고
`app` 컬럼이 어디에도 없다. 그리고 여기 지뢰가 있다:

```ts
uniqueIndex('uq_ai_usage_period').on(subjectId, kind, periodKey)
```

같은 사람이 두 앱을 쓰면 `(나, 'monthly', '2026-09')`가 **충돌한다.**
🔴 Re:Read 월간 리포트를 만들면 **조각 월간 리포트가 막힌다.** 크래시가 아니라
"이번 달은 이미 만들었습니다"로 조용히 거부되는 형태라 진단이 오래 걸린다.

편입하려면 거의 전 테이블에 `app` 컬럼 추가 + UNIQUE 재설계다.

### 3.2 폭발 반경이 합쳐진다

조각은 이미 출시된 앱이고 **실사용자 백업**이 들어 있다. 그건 사용자가 잃으면 못 되찾는다.
common_server가 N앱을 감당하는 건 저장하는 게 계정·구독 메타데이터뿐이라 반경이 작아서고,
**금고는 성격이 다르다.** Re:Read 개발 중의 마이그레이션 사고가 조각 사용자 금고에 닿는다.

### 3.3 탈퇴 파기가 얽힌다

파기는 `subject_id` 기준인데 **"어느 앱의 데이터인가" 구분이 지금 코드에 없다.**
같은 사람이 두 앱을 쓰면 "조각 탈퇴"가 Re:Read 금고를 지운다.
처리방침 보관기간·파기 범위도 두 앱 몫으로 다시 써야 한다.

### 3.4 AI 축이 안 맞는다

조각의 AI는 `kind(weekly/monthly/yearly)` + `periodKey`의 **기간 축**이고,
Re:Read의 주력은 **지식 카드 1건 분석**이라 기간 축이 아니다. 겹치는 건 월간 리포트(v1.2)뿐이다.

### 3.5 → 결론: 서버는 따로, 코드는 복사 승계

이 계보가 이미 쓰는 방식이다(`common/DOC_SYSTEM.md` §7 "승계를 명시한다",
조각 `ARCHITECTURE.md` §5 "SDK는 **복사해서** 쓴다").

백업 금고 스키마(`vaults · vault_grants · generations · generation_parts · vault_blobs`)는
**도메인을 하나도 모른다** — "일기"라는 단어가 스키마에 없다. v1.1에 거의 그대로 온다.
복사의 실제 값은 코드가 아니라 **주석에 박힌 함정**이다:

- 멱등 — 재시도가 두 번 과금되지 않게
- `seq+1`만 수용 — 세대 건너뛰기 방지
- `auth_hash`를 `vault_id`와 **다른 값**으로 — 같으면 "이름을 아는 사람이 곧 주인"이 된다
- 3년 무접근 리퍼 — 탈퇴 없이 앱만 지운 사용자의 금고를 정리하는 유일한 근거
- 구독 만료 유예 90일 — 만료는 이벤트로 오지 않으므로 스냅샷을 우리가 센다

**추가 비용**: Supabase 무료 프로젝트 1개 + Vercel 프로젝트 1개 = 사실상 0원.
늘어나는 건 "관리할 서버 하나"인데 코드가 복사본이라 관리법이 같다.

---

## 4. 신원 — common_server가 단일 진실

**로그인은 common_server가 담당한다. Re:Read 서버는 토큰을 검증만 한다.**

```
① 앱 → 구글 로그인 SDK → ID 토큰
② 앱 → common_server /api/v1/auth/login  → 검증 · subject 생성/조회 → 서명 토큰
③ 앱 → Re:Read 서버 /api/v1/ai/analyze   → 토큰 검증 → subject_id 획득
④ Re:Read 서버 → common_server /api/v1/entitlements → Premium 여부
```

- 🔴 **Re:Read 서버는 `subjects`를 FK로 걸지 않는다.** 다른 DB다. `subject_id`를 외래 식별자로만 든다.
- 구독 여부의 진실은 common_server 엔타이틀먼트다. 매 요청 조회하지 않도록 **짧은 캐시**를 둔다
  (조각 방식 승계 — 캐시 TTL은 Phase 10에서 실측 후 확정).
- 🔴 **common_server는 Expand-only 규약**이다 — 기존 컬럼을 바꾸거나 지우지 않고 덧붙인다.

---

## 5. common_server 연동 계약

### 5.1 반드시 지킬 것 (핸드오프 규약 승계)

1. **SDK는 복사해서 쓴다.** `C:\project\common_server\client\{index.ts,types.ts}` → `lib/common-server/`.
   monorepo·npm 패키지를 쓰지 않는다(앱 5~6개 규모에선 오버헤드가 이득보다 크다).
2. 복사본 상단에 **복사 출처와 날짜**를 주석으로 남긴다. **수정 금지 — 갱신은 재복사.**
3. SDK는 **절대 throw하지 않고 실패를 타입으로 반환한다.**
4. 앱 등록: `node tools/seed.ts reread "Re:Read"` (common_server 쪽에서 실행).
   등록 전에는 `bootstrap?app=reread`가 **404**이고 로그인이 성립하지 않는다.

### 5.2 부팅 계약

**GET `/api/v1/bootstrap?app=reread`** — 앱 부팅 시 1회. 점검·버전 게이트·공지를 한 번에.

- `maintenance.active` → 차단 화면(출구 있는 형태)
- `version.min` → 강제 업데이트 · `version.latest` → 소프트 안내
- `announcements[]` → 공지 목록 + 배지

🔴 **실패해도 앱은 통과시킨다.** bootstrap이 죽었다고 저장·복습이 막히면 기둥 2가 깨진다.

### 5.3 나가는 것의 전부

| 무엇 | 어디로 | 무엇이 담기나 |
|---|---|---|
| bootstrap 조회 | common_server | 앱 코드 · 버전 · 무작위 기기 식별자 |
| 하트비트 | common_server | 활성 집계용. 콘텐츠 없음 |
| 문의 본문 | common_server | 사용자가 직접 쓴 문의 내용 |
| 로그인 | common_server | 구글 ID 토큰 |
| **AI 분석 요청** | **Re:Read 서버 → Anthropic** | 🔴 **지식 카드 원문 + 내 생각**(§6) |
| 구독 | RevenueCat · 스토어 | |

**이 목록에 없는 것은 기기 밖으로 나가지 않는다.**

---

## 6. 🔴 AI 처리 경로 — 지나가되 저장하지 않는다

상세는 [`AI_SYSTEM.md`](./AI_SYSTEM.md). 여기서는 경계만.

```
앱                          Re:Read 서버                    Anthropic
──                          ────────────                    ─────────
지식 카드 1건 (로컬 평문)
  │ POST /api/v1/ai/analyze
  │   { requestId, lang, content, thought?, bookTitle? }
  ▼
                       토큰 검증 → subject_id
                       Premium 게이트
                       월 캡 · 쿨다운 확인
                       프롬프트 조립
                             │  messages  ────────────────▶
                             ◀────────────  { 분석 · 질문 5종 }
                       refusal 확인
                       성공했을 때만 캡 +1
  ◀ { analysis, questions[], usage }
  ▼
ai_analyses · recall_questions 로컬 저장
```

### 6.1 무저장을 규율이 아니라 구조로

🔴 가장 흔한 유출 경로는 **에러 로깅에 본문이 섞여 들어가는 것**이다(조각 실증). 그래서:

- `reportError(error, context)`에 **요청 본문을 절대 넘기지 않는다.** 에러 코드와 `requestId`만.
- 프록시 라우트는 `content`·`thought`를 지역 변수 밖으로 내보내지 않는다. **응답에 에코하지 않는다.**
- 저장하는 것은 **카운터와 토큰 수뿐**이다. 그건 메타데이터이고, 저장한다고 고지한다.

### 6.2 고지 문구 — 백업과 정반대다

| | 참인 문장 | 거짓인 문장 |
|---|---|---|
| AI | "**저장하지 않습니다**" | ~~"볼 수 없습니다"~~ (평문이 프록시를 지나간다) |
| 백업(v1.1) | "우리는 **읽지 못합니다**" | ~~"아무것도 저장하지 않습니다"~~ (암호문·메타데이터는 저장한다) |

🔴 **i18n 키도 `ai.notice.*` / `backup.notice.*`로 분리해 재사용을 막는다**(조각 승계).
한 화면에 섞지 않는다.

---

## 7. 커뮤니티 (3차) — 로컬 정본과 충돌하지 않는다

지금 적어 두는 이유는 **#1(로컬 정본) 결정이 커뮤니티를 막지 않는다는 것을 기록하기 위해서**다.
3차 착수 시 `COMMUNITY_SYSTEM.md`로 옮긴다.

- **opt-in 게시 모델**: 사용자가 [공유] 를 누른 항목만 서버로 올라간다. 전체 동기화가 아니다.
- 게시물은 **개인 지식 카드와 별도 테이블**이다. 게시물을 지워도 개인 카드는 남는다.
- 단위는 사용자가 아니라 **책과 문장**이다(기획서 §26).
- 🔴 게시 시점에 **원문 인용 범위**를 정해야 한다 — 저작권. 3차 착수 전 법무 확인 필요.

---

## 8. 실패 모드 — 무엇이 죽으면 무엇이 멈추나

| 죽는 것 | 멈추는 것 | 멀쩡한 것 |
|---|---|---|
| common_server | 로그인 · 구독 확인 · 문의 · 공지 | **저장 · 복습 · 실천 · 통계 전부** |
| Re:Read 서버 | AI 분석(신규) | 저장 · 복습(기존 질문) · 실천 · 통계 |
| Anthropic API | AI 분석(신규) | 위와 같음 |
| 네트워크 전체 | 위 전부 | **앱의 핵심 경험 전부** |

🔴 **오프라인에서 저장·복습·실천이 완전히 동작해야 한다.** 이게 로컬 정본을 택한 이유이고,
Phase 3·11 검증에 "비행기 모드 전 화면 통과"를 넣는 근거다.

---

## 9. 자원 할당 (정본은 `common/DEV_ALLOCATION.md`)

| Metro | 서버 | Supabase (api/db/studio) |
|---:|---:|---|
| **8091** | **3500** | **248xx** (24821/24822/24823) |

- ⚠ **포트를 반드시 명시**한다. 지정하지 않으면 Metro 기본값 8081로 모여 My Word와 충돌한다.
- 🔴 `supabase init`은 `project_id`를 **디렉터리 이름**으로 잡는다. 우리 설정이 `server/` 안에 있으면
  배구명가·농구명가와 **똑같이 `"server"`** 가 되어 남의 스택에 붙는다. `project_id`를 명시적으로
  `reread`로 지정한다(`DEV_ALLOCATION.md` §0 실제 사고 #1).
- 에뮬레이터: **전용 AVD `reread` · 포트 5574 · 저장은 외장 `D:\emulators\reread`**
  (2026-09-08 정책 변경 — ~~공용 풀 클레임~~ 폐지). 절차와 **7.8배 속도 대가**는
  [`README.md`](./README.md) §3 · 정본은 `common/EMULATOR_POOL.md`.
