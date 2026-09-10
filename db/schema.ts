/**
 * 스키마 정본은 `docs/DATABASE.md` §2 다. 이 파일은 그것의 코드 표현이고,
 * 표 이름이 문서와 어긋나면 `npm run check:db` 가 FAIL 한다(문서 §2 의 `### ` 제목과 대조).
 *
 * 🔴 이 파일은 **순수하다** — expo 모듈을 import 하지 않는다.
 *    가드가 node 에서 실물 SQLite 에 이 스키마를 그대로 세워 검사할 수 있는 유일한 이유다.
 *
 * 🔴 Expand-only(§1.3) — `MIGRATIONS` 에 **덧붙이기만** 한다.
 *    컬럼을 바꾸거나 지우지 않고, 내려가는 마이그레이션(down)을 만들지 않는다.
 */

/** 표마다 어떤 규약 칸을 갖는가. 예외 넷은 `docs/DATABASE.md` §1.1 의 표와 같아야 한다. */
export interface TableMeta {
  /** PK 컬럼. `id` 가 없는 표가 둘 있다(§1.1 예외) */
  readonly pk: readonly string[];
  /** 대리 키 `id` 를 헬퍼가 채워 주는가 */
  readonly id: boolean;
  /** `created_at` / `updated_at` 을 갖는가 */
  readonly stamps: boolean;
  /** `deleted_at` 을 갖는가 = tombstone 대상인가 */
  readonly soft: boolean;
}

export const TABLES = {
  books: { pk: ['id'], id: true, stamps: true, soft: true },
  knowledge: { pk: ['id'], id: true, stamps: true, soft: true },
  thoughts: { pk: ['id'], id: true, stamps: true, soft: true },
  ai_analyses: { pk: ['id'], id: true, stamps: true, soft: true },
  recall_questions: { pk: ['id'], id: true, stamps: true, soft: true },
  // 🔴 지식당 1행 — 대리 키를 만들면 같은 지식에 두 행이 생길 수 있다(§1.1 예외)
  review_schedules: { pk: ['knowledge_id'], id: false, stamps: true, soft: true },
  // 🔴 물리 보존 — FSRS optimizer 의 유일한 입력이라 지우지 않는다(§2 · §1.1 예외)
  review_logs: { pk: ['id'], id: true, stamps: false, soft: false },
  practices: { pk: ['id'], id: true, stamps: true, soft: true },
  practice_logs: { pk: ['id'], id: true, stamps: true, soft: true },
  tags: { pk: ['id'], id: true, stamps: true, soft: true },
  // 🔴 연결 표 — 같은 짝이 두 번 생기면 안 된다(§1.1 예외)
  knowledge_tags: { pk: ['knowledge_id', 'tag_id'], id: false, stamps: true, soft: true },
  // 🔴 앱 내부 상태 — 사용자 데이터가 아니고 백업 병합 대상도 아니다(§1.1 예외)
  meta: { pk: ['key'], id: false, stamps: false, soft: false },
} as const satisfies Record<string, TableMeta>;

export type TableName = keyof typeof TABLES;

export const TABLE_NAMES = Object.keys(TABLES) as readonly TableName[];

/**
 * 러너 부트스트랩 — `meta.schema_version` 을 읽으려면 이 표가 **먼저** 있어야 한다.
 * 그래서 `meta` 만 마이그레이션 밖에 있고, 그 대가로 `IF NOT EXISTS` 를 쓴다.
 */
export const META_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);`;

/** v1 — `docs/DATABASE.md` §2 의 11표(`meta` 제외) + §4 의 인덱스 */
const V1 = `
CREATE TABLE books (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  author      TEXT,
  cover_uri   TEXT,
  status      TEXT NOT NULL CHECK (status IN ('wish','reading','done')),
  started_at  TEXT,
  finished_at TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT
);

-- 🔴 book_id 는 nullable — 책을 안 고르고도 저장된다(기둥 1). 책을 지워도 지식은 book_id 만 끊긴다(§3)
CREATE TABLE knowledge (
  id          TEXT PRIMARY KEY,
  book_id     TEXT REFERENCES books(id) ON DELETE SET NULL,
  content     TEXT NOT NULL,
  page        TEXT,
  source_type TEXT NOT NULL CHECK (source_type IN ('manual','ocr','paste','voice')),
  lang        TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT
);
CREATE INDEX idx_k_book    ON knowledge(book_id);
CREATE INDEX idx_k_created ON knowledge(created_at DESC);

CREATE TABLE thoughts (
  id           TEXT PRIMARY KEY,
  knowledge_id TEXT NOT NULL REFERENCES knowledge(id) ON DELETE CASCADE,
  body         TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  deleted_at   TEXT
);
CREATE INDEX idx_t_knowledge ON thoughts(knowledge_id, created_at);

CREATE TABLE ai_analyses (
  id               TEXT PRIMARY KEY,
  knowledge_id     TEXT NOT NULL REFERENCES knowledge(id) ON DELETE CASCADE,
  content_type     TEXT NOT NULL CHECK (content_type IN ('FACT','CONCEPT','OPINION','INSIGHT','ACTION')),
  summary          TEXT NOT NULL,
  key_concept      TEXT,
  topics           TEXT,
  author_claim     TEXT,
  thought_relation TEXT,
  actionability    TEXT NOT NULL CHECK (actionability IN ('none','low','high')),
  lang             TEXT NOT NULL,
  model            TEXT,
  prompt_ver       INTEGER,
  revision         INTEGER NOT NULL,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  deleted_at       TEXT
);
CREATE INDEX idx_aa_knowledge ON ai_analyses(knowledge_id, revision DESC);

-- 🚫 정답 문자열 컬럼이 없다 — 채점하지 않는다(기둥 5)
CREATE TABLE recall_questions (
  id             TEXT PRIMARY KEY,
  knowledge_id   TEXT NOT NULL REFERENCES knowledge(id) ON DELETE CASCADE,
  analysis_id    TEXT NOT NULL REFERENCES ai_analyses(id) ON DELETE CASCADE,
  kind           TEXT NOT NULL CHECK (kind IN ('recall','understand','perspective','experience','apply')),
  question       TEXT NOT NULL,
  expected_point TEXT,
  order_no       INTEGER NOT NULL,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  deleted_at     TEXT
);
CREATE INDEX idx_rq_knowledge ON recall_questions(knowledge_id, order_no);

-- 🔴 stability·difficulty 는 저장하되 어떤 화면에도 노출하지 않는다(CLAUDE.md §5 규칙 8)
CREATE TABLE review_schedules (
  knowledge_id     TEXT PRIMARY KEY REFERENCES knowledge(id) ON DELETE CASCADE,
  due_at           TEXT NOT NULL,
  state            TEXT NOT NULL CHECK (state IN ('new','learning','review','relearning')),
  stability        REAL NOT NULL,
  difficulty       REAL NOT NULL,
  reps             INTEGER NOT NULL DEFAULT 0,
  lapses           INTEGER NOT NULL DEFAULT 0,
  last_reviewed_at TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  deleted_at       TEXT
);
CREATE INDEX idx_rs_due ON review_schedules(due_at);

-- 🔴 deleted_at 이 없다. 물리 보존이고 지식을 지워도 남는다(§2 · §3)
CREATE TABLE review_logs (
  id              TEXT PRIMARY KEY,
  knowledge_id    TEXT NOT NULL,
  question_id     TEXT,
  rating          TEXT NOT NULL CHECK (rating IN ('again','hard','good','easy')),
  answer_text     TEXT,
  elapsed_days    INTEGER,
  scheduled_days  INTEGER,
  reviewed_at     TEXT NOT NULL
);
CREATE INDEX idx_rl_reviewed  ON review_logs(reviewed_at);
CREATE INDEX idx_rl_knowledge ON review_logs(knowledge_id, reviewed_at);

-- 🔴 knowledge_id 는 nullable — 지식이 지워져도 실천은 고아가 되지 않는다(기둥 4 · §3)
CREATE TABLE practices (
  id           TEXT PRIMARY KEY,
  knowledge_id TEXT REFERENCES knowledge(id) ON DELETE SET NULL,
  title        TEXT NOT NULL,
  started_at   TEXT NOT NULL,
  repeat_rule  TEXT NOT NULL,
  ended_at     TEXT,
  active       INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  deleted_at   TEXT
);
CREATE INDEX idx_p_active ON practices(active);

-- date 는 로컬 날짜(YYYY-MM-DD). 🔴 UNIQUE 는 tombstone 을 되살려 지킨다(§1.4)
CREATE TABLE practice_logs (
  id          TEXT PRIMARY KEY,
  practice_id TEXT NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  date        TEXT NOT NULL,
  done_at     TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT
);
CREATE UNIQUE INDEX idx_pl_practice_date ON practice_logs(practice_id, date);

CREATE TABLE tags (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL COLLATE NOCASE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE UNIQUE INDEX idx_tags_name ON tags(name);

CREATE TABLE knowledge_tags (
  knowledge_id TEXT NOT NULL REFERENCES knowledge(id) ON DELETE CASCADE,
  tag_id       TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  deleted_at   TEXT,
  PRIMARY KEY (knowledge_id, tag_id)
);
CREATE INDEX idx_kt_tag ON knowledge_tags(tag_id);
`;

/**
 * v2 — 독서 진행률(결정 #17 · 2026-09-09).
 *
 * 🔴 **Expand-only 의 첫 실전이다**(§1.3). 컬럼을 덧붙이기만 하고 기존 행은 NULL 로 남는다 —
 *    데이터를 옮기지도, 되돌리지도 않는다. `DATABASE.md` §2 가 *"넣을 때 컬럼을 덧붙인다"* 고
 *    미리 적어 둔 그 자리라서 두 줄로 끝났다.
 * 🚫 비율(%)은 컬럼으로 두지 않는다 — 두 값에서 매번 계산한다(§4 · 파생값은 저장하지 않는다).
 */
const V2 = `
ALTER TABLE books ADD COLUMN total_pages INTEGER;
ALTER TABLE books ADD COLUMN read_pages  INTEGER;
`;

/**
 * v3 — FSRS 학습 단계 보존 (2026-09-09 · 🔴 결함 수정).
 *
 * 🔴 `ts-fsrs` 의 카드에는 **지금 몇 번째 학습 단계인가**(`learning_steps`)가 들어 있는데
 *    우리 표에 그 칸이 없어서 매 복습마다 0 으로 리셋됐다. 증상: [기억났다]만 누르면
 *    카드가 `learning` 에서 **영원히 졸업하지 못하고 간격이 10분에 고정**된다 —
 *    "잊을 때쯤 다시 만난다"(기둥 7)가 반대로 도는 상태였다.
 * ⚠ 기존 행은 0 으로 시작한다. 되돌릴 값이 없으므로 그게 맞다(Expand-only).
 */
const V3 = `
ALTER TABLE review_schedules ADD COLUMN learning_steps INTEGER NOT NULL DEFAULT 0;
`;

/**
 * v4 — 책 표지 자리표시자 색 (2026-09-09 · `DESIGN_REVIEW.md` §3).
 *
 * 🔴 **색을 저장하는 이유**: 랜덤이면 앱을 다시 열 때마다 바뀐다.
 *    사용자에게 *"Atomic Habits = 파란 A"* 라는 시각적 기억이 생기므로 **등록할 때 한 번 배정**한다.
 * ⚠ 기존 행은 NULL 이고, 화면은 그때 제목에서 안정적으로 골라 쓴다(§표지 없음 처리).
 * 🚫 이미지 에셋이 아니다 — 색 문자열 하나다. PNG·SVG·외부 API 전부 필요 없다.
 */
const V4 = `
ALTER TABLE books ADD COLUMN cover_color TEXT;
`;

/**
 * v5 — 실천 제안에 [넘어가기]를 누른 시각 (2026-09-10 · `PRACTICE_SYSTEM.md` §1.1).
 *
 * 🔴 **규칙은 2026-09-08 부터 문서에 있었는데 적을 칸이 없었다.** Phase 9 착수 전 대조에서 나왔다.
 *    규칙만 있고 저장할 자리가 없으면 그 규칙은 코드에서 조용히 사라진다.
 * 🔴 표가 아니라 **컬럼**인 이유: 카드 한 장에 하나뿐이고, 카드가 지워지면 함께 지워져야 하고,
 *    백업에서 카드가 돌아오면 그 결정도 함께 돌아와야 한다. 컬럼이면 셋이 공짜로 성립한다.
 */
const V5 = `
ALTER TABLE knowledge ADD COLUMN practice_skipped_at TEXT;
`;

export const MIGRATIONS: readonly string[] = [V1, V2, V3, V4, V5];

/** 시드 없음 — 태그·카테고리를 우리가 정하지 않는다(`docs/PLAN.md` Phase 1). */
