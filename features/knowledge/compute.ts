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
