# DATABASE — 로컬 스키마 (expo-sqlite)

> 🔴 **여기가 사용자 데이터의 정본이다**(`../CLAUDE.md` §6, 결정 #1).
> 서버에는 지식이 없다. 이 파일이 곧 제품의 데이터 전부다.
> 승계: `C:\project\idea_repository\docs\DATABASE.md`(expo-sqlite 규약) + 조각(마이그레이션 규율).

---

## 0. 구현 현황

| 영역 | 상태 | 비고 |
|---|---|---|
| 스키마 v1 설계 | ✅ 2026-09-08 | **12테이블** (세는 법: `sed -n '/^## 2. 스키마/,/^## 3./p' docs/DATABASE.md \| grep -c "^### "`) |
| 마이그레이션 러너 | ✅ 2026-09-09 | Phase 1 — `db/migrate.ts`(순수 · `meta.schema_version` · Expand-only) |
| 테이붔 생성 | ✅ 2026-09-09 | Phase 1 — `db/schema.ts` v1. **12표 · 인덱스 12종** 실찍 |
| 조회·삭제 헬퍼 | ✅ 2026-09-09 | Phase 1 — `db/sql.ts`(`deleted_at` 강제) · `db/cascade.ts`(§3 삭제 귀칙) |
| 가드 `npm run check:db` | ✅ 2026-09-09 | 실물 SQLite 에 스키마를 세워 잴다 — §6 |
| 시드(기본 태그 등) | 🚫 | 시드 없음 — 사용자가 만든다 |

---

## 1. 🔴 불변 규약

### 1.1 모든 테이블은 UUID PK + `updated_at` + `deleted_at`

```sql
id          TEXT PRIMARY KEY,     -- UUID v4. 🚫 자동증가 정수 금지
created_at  TEXT NOT NULL,        -- ISO 8601 UTC
updated_at  TEXT NOT NULL,        -- ISO 8601 UTC
deleted_at  TEXT                  -- NULL = 살아 있음. tombstone
```

**왜**(결정 #8, 2026-09-08):

- **백업 병합**에서 정수 ID는 반드시 충돌한다. 기기 A의 `#7`과 기기 B의 `#7`은 다른 지식이다.
- **삭제를 물리 삭제로 하면 백업 복원이 지운 것을 되살린다.** tombstone이 없으면 "지웠는데 돌아왔다"가 난다.
- 지금 하면 0원, 나중에 하면 마이그레이션이다.
- 🔴 반례가 형제에 있다: My Word는 단일 글로벌 정수 카운터(`@my_word_next_id`)를 써서 정확히 이 지점이 막혀 있다.

⚠ **조회는 전부 `WHERE deleted_at IS NULL`을 건다.** 이걸 빠뜨리면 지운 것이 복습 큐에 되살아난다 —
빈 화면이 아니라 **틀린 화면**이라 눈치채기 어렵다. 헬퍼로 강제한다.

#### 🔴 예외는 넷뿐이다 — 여기 없으면 예외가 아니다

| 표 | 무엇이 다른가 | 왜 |
|---|---|---|
| `review_logs` | 🚫 `deleted_at`·`updated_at` 없음 | **물리 보존**(§2). 지우지 않으므로 tombstone 이 필요 없다 |
| `review_schedules` | 🚫 `id` 없음 — PK 가 `knowledge_id` | 지식당 1행. 대리 키를 만들면 같은 지식에 두 행이 생길 수 있다 |
| `knowledge_tags` | 🚫 `id` 없음 — PK 가 `(knowledge_id, tag_id)` | 연결 표. 같은 짝이 두 번 생기면 안 된다 |
| `meta` | 🚫 넷 다 없음 — `key`/`value` 뿐 | 앱 내부 상태다. 사용자 데이터가 아니고 백업 병합 대상도 아니다 |

🔴 **나머지 여덟 표는 예외 없이 네 칸을 다 가진다.**
`ai_analyses`·`recall_questions`·`practice_logs`·`tags` 는 초안(2026-09-08)에서 `created_at` 만 갖고 있었는데,
**§3 삭제 규칙은 그 표들을 tombstone 하라고 적고 있었다** — 지울 칸이 없는 표를 지우라고 적어 둔 것이다.
2026-09-09 Phase 1 착수 대조에서 잡아 네 칸으로 맞췄다. ⚠ `id` 가 없는 두 표도 **`deleted_at` 은 가진다** —
없는 것은 대리 키뿐이다.

### 1.4 🔴 UNIQUE 와 tombstone 이 부딪히는 자리 — **되살린다**

tombstone 은 행을 남기므로 UNIQUE 제약과 정면으로 부딪힌다. 두 곳이 실제로 걸린다:

| 표 | 제약 | 부딪히는 상황 |
|---|---|---|
| `tags` | `name` UNIQUE (NOCASE) | 태그를 지우고 **같은 이름을 다시** 만든다 |
| `practice_logs` | `(practice_id, date)` UNIQUE | 체크 → 해제 → **같은 날 다시 체크**(`PRACTICE_SYSTEM.md` §6 — 해제를 허용한다) |

🔴 **규칙: 새 행을 만들지 않고 tombstone 을 되살린다**(`deleted_at = NULL` · `updated_at` 갱신).

- 🚫 **UNIQUE 에 `deleted_at` 을 넣어 우회하지 않는다.** 같은 이름의 죽은 행이 무한히 쌓이고 백업이 그만큼 커진다.
- 🚫 **물리 삭제로 도망가지 않는다.** 그러면 §1.1 의 이유(복원이 지운 것을 되살린다)가 그대로 돌아온다.
- 되살리기는 **헬퍼 한 곳**에 둔다 — 호출부가 `INSERT` 를 직접 쓰면 UNIQUE 위반으로 죽는다.

### 1.2 시간은 UTC ISO 8601로 저장, 표시할 때만 로케일

단 **"하루"의 경계는 기기 로컬 자정 고정**이다(복습 큐가 시간대 이동에 흔들리면 안 된다).
`review_schedules.due_at`은 UTC 시각이지만, "오늘의 복습"은 로컬 자정 기준으로 센다.

### 1.3 마이그레이션은 Expand-only

- 컬럼을 **바꾸거나 지우지 않는다.** 덧붙인다.
- **v3 (2026-09-09)** — `review_schedules.learning_steps`. 🔴 결함 수정(`REVIEW_SYSTEM.md` §1.2).
- **v5 (2026-09-10)** — `knowledge.practice_skipped_at`. 🔴 **적을 칸이 없던 규칙을 닫는다**(`PRACTICE_SYSTEM.md` §1.1).
- **v4 (2026-09-09)** — `books.cover_color`. 표지 자리표시자 색을 **고정**하기 위해 저장한다.
- **v2 (2026-09-09)** — `books.total_pages` · `books.read_pages`(결정 #17).
  🟢 **Expand-only 러너의 첫 실전이었다.** `ALTER TABLE ... ADD COLUMN` 두 줄이고 기존 행은 NULL 로 남는다 —
  되돌릴 일도, 데이터를 옮길 일도 없었다. 규약이 값을 한 자리다.
- `meta.schema_version`을 올리고, 러너는 버전 순서대로 한 번씩만 적용한다.
- 🔴 **내려가는 마이그레이션(down)을 만들지 않는다.** 로컬 DB에는 롤백할 백업이 없다(v1.1 전까지).

---

## 2. 스키마 v1

### books

| 컬럼 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `id` | TEXT | O | UUID |
| `title` | TEXT | O | 책 제목 |
| `author` | TEXT | | 저자 |
| `cover_uri` | TEXT | | 로컬 파일 URI. 🚫 원격 URL 저장 금지(오프라인에서 깨진다) |
| `status` | TEXT | O | `wish` \| `reading` \| `done` |
| `started_at` | TEXT | | 독서 시작일 |
| `finished_at` | TEXT | | 독서 완료일 |
| `total_pages` | INTEGER | | 🔴 v2 추가(결정 #17). 책의 전체 쪽수 |
| `cover_color` | TEXT | | 🔴 v4 추가. 표지 자리표시자 색. **등록할 때 한 번 배정해 고정**한다 |
| `read_pages` | INTEGER | | 🔴 v2 추가. 지금까지 읽은 쪽수 |
| `created_at` / `updated_at` / `deleted_at` | TEXT | | §1.1 |

🔴 **독서 진행률(%)은 저장하지 않는다.** `read_pages / total_pages` 로 **매번 계산한다**(§4) —
저장하면 두 값과 어긋나는 순간이 반드시 오고, 그때 어느 쪽이 맞는지 판정할 수 없다.

⚠ ~~"독서 진행률(%)은 v1에 없다(MVP 제외). 넣을 때 컬럼을 덧붙인다."~~
→ 🟢 **2026-09-09 에 그 "넣을 때"가 왔다**(결정 #17). 적어 둔 대로 **컬럼을 덧붙였다** —
설계를 바꾼 것이 아니라 예고한 확장이라 마이그레이션 v2 두 줄로 끝났다.
⚠ 둘 다 nullable 이다. **제목만으로 책이 성립한다**는 규칙은 그대로다.

### knowledge

지식 카드. 🔴 **`content` 하나만 있으면 성립한다**(기둥 1).

| 컬럼 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `id` | TEXT | O | UUID |
| `book_id` | TEXT | | 🔴 **nullable** — 책을 안 고르고도 저장된다 |
| `content` | TEXT | O | 원문. **책 언어 그대로** 보관(§I18N) |
| `page` | TEXT | | 페이지. 정수가 아니라 TEXT("123p", "3장") |
| `source_type` | TEXT | O | `manual` \| `ocr` \| `paste` \| (2차)`voice` |
| `lang` | TEXT | | 원문 언어(BCP-47). 미상이면 NULL |
| `practice_skipped_at` | TEXT | | 🔴 v5 추가. 실천 제안에 **[넘어가기]를 누른 시각**. NULL 이면 아직 안 물어봤거나 만들었다는 뜻이다(`PRACTICE_SYSTEM.md` §1.1) |
| `created_at` / `updated_at` / `deleted_at` | TEXT | | |

### thoughts

내 생각. **1:N** — 시간이 지나며 같은 지식에 생각이 덧붙는 것이 제품 컨셉이다(기획서 §3).

| 컬럼 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `id` | TEXT | O | |
| `knowledge_id` | TEXT | O | |
| `body` | TEXT | O | |
| `created_at` / `updated_at` / `deleted_at` | TEXT | | |

### ai_analyses

AI 분석 결과. 지식당 최신 1건을 쓰되 **재분석 이력을 남긴다**(리비전 방식, 조각 승계).

| 컬럼 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `id` | TEXT | O | |
| `knowledge_id` | TEXT | O | |
| `content_type` | TEXT | O | `FACT` \| `CONCEPT` \| `OPINION` \| `INSIGHT` \| `ACTION` |
| `summary` | TEXT | O | 내용 요약 |
| `key_concept` | TEXT | | 핵심 개념 |
| `topics` | TEXT | | 관련 주제. JSON 배열 문자열 |
| `author_claim` | TEXT | | 저자의 주장 |
| `thought_relation` | TEXT | | 사용자의 생각과의 관계 |
| `actionability` | TEXT | O | `none` \| `low` \| `high` |
| `lang` | TEXT | O | 분석을 쓴 언어 |
| `model` | TEXT | | |
| `prompt_ver` | INTEGER | | 🔴 프롬프트를 고친 뒤 품질 비교의 유일한 축 |
| `revision` | INTEGER | O | 1부터 |
| `created_at` / `updated_at` / `deleted_at` | TEXT | | §1.1 |

### recall_questions

🔴 **저장 시 1회 생성해 로컬에 보관한다**(결정 #4). 복습마다 AI를 부르지 않는다.

| 컬럼 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `id` | TEXT | O | |
| `knowledge_id` | TEXT | O | |
| `analysis_id` | TEXT | O | 어느 분석이 만든 질문인가 |
| `kind` | TEXT | O | `recall` \| `understand` \| `perspective` \| `experience` \| `apply` |
| `question` | TEXT | O | |
| `expected_point` | TEXT | | 정답이 아니라 **"이런 걸 떠올렸으면 좋겠다"** 의 요지 |
| `order_no` | INTEGER | O | |
| `created_at` / `updated_at` / `deleted_at` | TEXT | | §1.1 |

🚫 **정답 문자열 컬럼이 없다.** 채점하지 않기 때문이다(기둥 5, §5 규칙 4).

### review_schedules

FSRS 카드 상태. **지식당 1행**(PK = `knowledge_id`).

| 컬럼 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `knowledge_id` | TEXT | O | PK |
| `due_at` | TEXT | O | 다음 노출 시각(UTC) |
| `state` | TEXT | O | `new` \| `learning` \| `review` \| `relearning` |
| `stability` | REAL | O | FSRS |
| `difficulty` | REAL | O | FSRS |
| `reps` | INTEGER | O | |
| `lapses` | INTEGER | O | |
| `last_reviewed_at` | TEXT | | |
| `created_at` / `updated_at` / `deleted_at` | TEXT | | §1.1 — 🔴 `id` 만 없다 |

⚠ `due_at`에 인덱스를 건다 — "오늘의 복습"이 매 부팅마다 도는 유일한 쿼리다.

### review_logs

| 컬럼 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `id` | TEXT | O | |
| `knowledge_id` | TEXT | O | |
| `question_id` | TEXT | | 기본 복습(원문 가리기)이면 NULL |
| `rating` | TEXT | O | `again` \| `hard` \| `good` \| `easy` (FSRS 등급) |
| `answer_text` | TEXT | | 사용자가 적은 회상 답변. **자산이다 — 지우지 않는다** |
| `elapsed_days` / `scheduled_days` | INTEGER | | FSRS 재계산·optimizer 입력 |
| `reviewed_at` | TEXT | O | |

🔴 **`review_logs`는 tombstone을 쓰지 않고 물리 보존한다.** FSRS optimizer(v1.2 개인화)의
유일한 입력이고, 지우면 되돌릴 수 없다. 지식을 지워도 로그는 남긴다.

### practices

🔴 **`active` 는 사용자의 스위치이지 만료 표시가 아니다**(2026-09-10 확정 · `PRACTICE_SYSTEM.md` §2.1).
"그만두기"를 누르면 0 이 된다. **종료일이 지났는지는 `ended_at` 으로 매번 판정한다.**
날짜가 지났다고 컬럼을 고쳐 놓으면 그건 저장된 파생값이고, §4 가 금지하는 그것이다.


🔴 **`knowledge`와 분리한다**(기둥 4, 기획서 §29).

| 컬럼 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `id` | TEXT | O | |
| `knowledge_id` | TEXT | | 🔴 **nullable** — 지식이 지워져도 실천은 고아가 되지 않는다 |
| `title` | TEXT | O | **사용자가 확정한 문장**(기둥 3) |
| `started_at` | TEXT | O | |
| `repeat_rule` | TEXT | O | `daily` \| `weekdays` \| `weekly:1,3,5` |
| `ended_at` | TEXT | | |
| `active` | INTEGER | O | 0/1 |
| `created_at` / `updated_at` / `deleted_at` | TEXT | | |

### practice_logs

| 컬럼 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `id` | TEXT | O | |
| `practice_id` | TEXT | O | |
| `date` | TEXT | O | `YYYY-MM-DD` **로컬 날짜** |
| `done_at` | TEXT | O | 체크한 시각(UTC) |
| `created_at` / `updated_at` / `deleted_at` | TEXT | | §1.1 — 체크 해제가 tombstone 이다(§1.4) |

⚠ UNIQUE `(practice_id, date)` — 하루에 두 번 체크되지 않게. 🔴 해제했다 다시 체크하면 **되살린다**(§1.4).

### tags

`id` TEXT PK · `name` TEXT (UNIQUE, 대소문자 무시) · `created_at` / `updated_at` / `deleted_at`(§1.1)

⚠ 지운 태그와 **같은 이름을 다시 만들면 되살린다**(§1.4).

### knowledge_tags

`knowledge_id` TEXT · `tag_id` TEXT · PK `(knowledge_id, tag_id)` · `created_at` / `updated_at` / `deleted_at`(§1.1)

⚠ 지식 삭제 시 **고아 태그를 정리**한다(참조 0이면 삭제) — Idea Repository 승계.

### meta

| `key` TEXT PK · `value` TEXT | `schema_version` 등 |

🔴 **마이그레이션 버전의 정본은 `meta.schema_version` 하나다**(§1.3). SQLite 의 `PRAGMA user_version` 을 **함께 쓰지 않는다** — 한 사실을 두 곳에서 관리하면 어느 쪽이 맞는지 판정할 수 없게 된다(형제 Idea Repository 는 `user_version` 쪽을 골랐다).
⚠ `meta` 는 러너가 **자기 부트스트랩으로** 만든다 — 버전을 읽으려면 이 표가 먼저 있어야 하기 때문이다.

---

## 3. 관계

```
books (1) ──── (N) knowledge
                    │
                    ├── (N) thoughts
                    ├── (N) ai_analyses ──── (N) recall_questions
                    ├── (1) review_schedules
                    ├── (N) review_logs          ← 물리 보존
                    ├── (N) knowledge_tags ── tags
                    └── (0..N) practices ──── (N) practice_logs
                                   ▲
                            🔴 nullable 연결
```

### 삭제 규칙

| 지우는 것 | 함께 지우는 것 | 남기는 것 |
|---|---|---|
| 책 | ❌ 아무것도 — 🔴 **지식은 `book_id`만 NULL로 끊는다** | 지식 전부 |
| 지식 | thoughts · ai_analyses · recall_questions · review_schedules · knowledge_tags (tombstone) | **review_logs** · **practices**(`knowledge_id` NULL로 끊음) |
| 실천 | practice_logs (tombstone) | 지식 |

🔴 **책을 지웠다고 지식을 지우지 않는다.** 지식은 책보다 오래 남는 것이 이 제품의 전제다.
My Word는 카테고리 삭제 시 단어를 캐스케이드 삭제하는데, 우리는 그러지 않는다.

---

## 4. 주요 조회 패턴

| 화면 | 쿼리 | 인덱스 |
|---|---|---|
| 오늘의 복습 | `review_schedules WHERE due_at <= ? ORDER BY due_at` | `idx_rs_due` |
| 오늘의 실천 | `practices WHERE active=1 AND deleted_at IS NULL` + 오늘 로그 LEFT JOIN | `idx_pl_practice_date` |
| 책 상세 집계 | 지식 수 · 생각 수 · 복습 완료 수 · 실천 수 | `idx_k_book` |
| 최근 저장 | `knowledge ORDER BY created_at DESC LIMIT n` | `idx_k_created` |
| 검색 | `content` · `thoughts.body` · `tags.name` LIKE | — (v1은 LIKE, FTS는 2차) |
| 통계 기억률 | `review_logs` 중 `rating != 'again'` 비율 | `idx_rl_reviewed` |

⚠ **기억률은 파생값이다.** 저장하지 않고 매번 계산한다 — 저장하면 반드시 늙는다.

---

## 5. 백업과의 관계 (v1.1)

- 백업은 **이 DB 전체의 스냅샷을 클라이언트에서 암호화**해 서버 금고에 올린다.
- 🔴 그래서 §1.1의 UUID PK + tombstone이 **백업의 전제조건**이다. 이게 없으면 병합이 불가능하다.
- 서버는 복호화할 수 없다 → 고지 문구는 **"읽지 못합니다"**(AI의 "저장하지 않습니다"와 다르다.
  [`ARCHITECTURE.md`](./ARCHITECTURE.md) §6.2).

---

## 6. 구현 위치와 가드 (2026-09-09 Phase 1)

| 파일 | 무엇 | expo 의짐 |
|---|---|---|
| `db/schema.ts` | 표·인덱스 DDL · `MIGRATIONS` · 표별 관록(§1.1 예외 넷) | 🟢 **없다** |
| `db/migrate.ts` | 러너 — `meta.schema_version` 을 보고 버전 순서대로 1회심 | 🟢 없다 |
| `db/sql.ts` | 쿼리 바더 — `deleted_at IS NULL` 을 **붙이고**, 관약 칸을 직접 쓰면 마을린다 | 🟢 없다 |
| `db/cascade.ts` | §3 삭제 귀칙 — 단계 목록만 만들고 실행하지 않는다 | 🟢 없다 |
| `db/index.ts` | 위 넷을 expo-sqlite 에 물리는 엉은 층 · 트랜잭션 | 🔴 여기만 |

🔴 **이 분할이 가드의 전제다.** 상위 넷이 순수해서
`scripts/check-db.mjs` 가 node 의 `node:sqlite` 에 **진짜 스키마를 세워** 재다 —
에뮬레이튰도 실기기도 필요 없다. 그리고 **앱과 가드가 같은 러너를 돌린다** —
가드가 러너를 베컴 만들면 검사하는 것이 러너가 아니라 사본이다.

재는 것(2026-09-09 실찍): 표 12 · 인덱스 12 · 마이그레이션 2회 연속 실행 멱등 ·
tombstone 이 조회에서 사라지고 행은 남는가 · §3 삭제 귀칙 셋(지식·책·실천) ·
§1.4 되살리기 · 고아 태그 정리 · `AUTOINCREMENT` 0건 · 다운그레이드 거부.

⚠ **`node:sqlite` 는 experimental 이다**(Node 22). 사라지면 `better-sqlite3` 로 갈아끔는다 —
가드만 바뀌면 되고 `db/` 는 안 바뀜다. 그것도 이 분할의 이유다.
