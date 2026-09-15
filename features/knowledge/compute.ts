/**
 * 지식 카드 표시 계산 — `docs/KNOWLEDGE_SYSTEM.md` §3.
 *
 * 🔴 순수하다. expo 도 DB 도 모른다(가드가 node 에서 그대로 돌린다).
 * 🔴 `@/` 별칭을 쓰지 않는다(가드가 이 파일을 직접 import 한다).
 */

/**
 * 페이지에 `쪽`(ko) · `p.`(en) 을 씌워도 되나 — **숫자로만 이루어졌을 때만** 씌운다.
 *
 * 🔴 **왜 판정이 필요한가**(2026-09-11 실기기에서 드러났다):
 *    `DATABASE.md` §2 는 `page` 를 **자유 텍스트**로 정해 뒀다(`"123p"` · `"3장"`).
 *    그런데 홈 화면이 그 값에 접사를 **무조건** 붙이고 있었다.
 *
 * ```
 * 42     →  42쪽    ✅        p.42     ✅
 * 42p    →  42p쪽   🔴        p.42p    🔴
 * 3장    →  3장쪽   🔴        p.3장    🔴
 * ```
 *
 * 🚫 **입력을 숫자로 막는 쪽으로 고치지 않는다.** `"3장"` 을 쓰게 두는 것이 설계 의도이고
 *    (동양 고전은 쪽이 아니라 장으로 센다), 막으면 저장 흐름에 규칙이 하나 는다(기둥 1).
 * → 그래서 **입력이 아니라 표시**를 고친다. 숫자가 아니면 사용자가 쓴 그대로 보여준다.
 */
export function canAffixPageUnit(page: string): boolean {
  const t = page.trim();
  if (t === '') return false;
  return /^[0-9]+$/.test(t);
}

/**
 * 화면에 그릴 페이지 문자열.
 *
 * `affix` 는 i18n 이 만든 것을 받는다(ko 는 뒤에, en 은 앞에 붙으므로 **자리를 우리가 정하지 않는다**).
 * 🔴 숫자가 아니면 `affix` 를 버리고 **원문 그대로** 돌려준다.
 */
export function displayPage(page: string | null, affix: (p: string) => string): string | null {
  if (page === null) return null;
  const t = page.trim();
  if (t === '') return null;
  return canAffixPageUnit(t) ? affix(t) : t;
}

/**
 * 태그 입력 칸(`철학, 습관`)을 이름 목록으로.
 *
 * 🔴 **새 문장 화면과 상세 화면이 같은 함수를 쓴다.** 화면마다 규칙이 다르면
 *    사용자는 저장 화면에서 배운 것을 상세에서 다시 배워야 한다(`docs/UI_GUIDE.md` §3).
 * ⚠ 같은 이름이 두 번 있어도 여기서 거르지 않는다. 두 화면에 있던 동작을 그대로 옮겼다.
 */
export function splitTagInput(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

// ── 문장 목록 정렬 (§3.2 · 2026-09-14) ─────────────────────────────────

export const KNOWLEDGE_SORTS = ['recent', 'book'] as const;
export type KnowledgeSort = (typeof KNOWLEDGE_SORTS)[number];

/** 기기에 저장된 정렬 값을 읽는다. 🔴 깨졌거나 모르는 값이면 `recent`(지금까지의 목록) */
export function parseKnowledgeSort(v: unknown): KnowledgeSort {
  return (KNOWLEDGE_SORTS as readonly unknown[]).includes(v) ? (v as KnowledgeSort) : 'recent';
}

export interface GroupableKnowledge {
  readonly book_id: string | null;
  /** 책을 못 찾으면(지워졌으면) `null` */
  readonly bookTitle: string | null;
  readonly created_at: string;
}

export interface BookGroup<T> {
  /** `null` 이면 `책 없음` 구획이다 */
  readonly bookId: string | null;
  readonly title: string | null;
  readonly items: readonly T[];
}

// ── 책별 보기의 책 순서 (§3.2.1 · 2026-09-15) ─────────────────────────

export const BOOK_ORDERS = ['recent', 'title', 'count'] as const;
export type BookOrder = (typeof BOOK_ORDERS)[number];

/** 기기에 저장된 책 순서를 읽는다. 🔴 깨졌거나 모르는 값이면 `recent`(지금까지의 순서) */
export function parseBookOrder(v: unknown): BookOrder {
  return (BOOK_ORDERS as readonly unknown[]).includes(v) ? (v as BookOrder) : 'recent';
}

/**
 * 책별 보기(§3.2).
 *
 * 🔴 구획 안은 **최신순**이다. 책 순서를 바꿔도 구획 안은 그대로다.
 * 🔴 구획 순서는 `order` 로 고른다(§3.2.1). 기본 `recent` 는 그 책에 마지막으로 저장한 시각(§4.0 과 같은 규칙).
 *    `title` 은 제목 가나다 · `count` 는 문장 많은 순이고, 둘 다 **같으면 `recent` 순서**를 따른다.
 * 🔴 `책 없음` 은 순서와 상관없이 **맨 아래**다. 제목을 못 찾는 책의 문장도 그리로 간다(이름 없는 구획을 만들지 않는다).
 * 🔴 입력을 바꾸지 않는다.
 */
export function groupByBook<T extends GroupableKnowledge>(
  rows: readonly T[],
  order: BookOrder = 'recent',
): BookGroup<T>[] {
  const sorted = [...rows].sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));

  const books = new Map<string, { title: string; items: T[] }>();
  const loose: T[] = [];
  for (const k of sorted) {
    const title = k.bookTitle?.trim() ?? '';
    if (k.book_id === null || title === '') {
      loose.push(k);
      continue;
    }
    const group = books.get(k.book_id);
    if (group === undefined) books.set(k.book_id, { title: k.bookTitle ?? title, items: [k] });
    else group.items.push(k);
  }

  // 🔴 Map 은 넣은 순서를 지킨다. 문장을 최신순으로 넣었으니 여기까지가 `recent` 순서다
  const out: BookGroup<T>[] = [...books].map(([bookId, g]) => ({ bookId, title: g.title, items: g.items }));
  // 🔴 `sort` 는 안정 정렬이다. 같은 제목 · 같은 개수는 위의 `recent` 순서를 그대로 둔다
  if (order === 'title') {
    out.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? '', undefined, { sensitivity: 'base', numeric: true }));
  } else if (order === 'count') {
    out.sort((a, b) => b.items.length - a.items.length);
  }
  if (loose.length > 0) out.push({ bookId: null, title: null, items: loose });
  return out;
}
