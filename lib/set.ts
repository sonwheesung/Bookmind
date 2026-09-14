/**
 * 선택 집합 — `docs/UI_GUIDE.md` §3. 🔴 순수하다.
 *
 * 🔴 **입력을 바꾸지 않고 새 집합을 돌려준다.** React 상태를 제자리에서 바꾸면
 *    참조가 같아 다시 그려지지 않는다. 눌러도 안 바뀐 것처럼 보인다.
 */
export function toggled<T>(set: ReadonlySet<T>, item: T): Set<T> {
  const next = new Set(set);
  if (next.has(item)) next.delete(item);
  else next.add(item);
  return next;
}
