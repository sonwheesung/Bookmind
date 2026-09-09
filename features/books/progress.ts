/**
 * 독서 진행률 — `docs/KNOWLEDGE_SYSTEM.md` §4.4 (결정 #17).
 *
 * 🔴 **비율은 저장하지 않는다.** 두 값에서 매번 계산한다(`DATABASE.md` §4) —
 *    저장하면 두 값과 어긋나는 순간이 오고, 그때 어느 쪽이 맞는지 판정할 수 없다.
 *
 * 🔴 순수하다(가드가 node 에서 잰다). `@/` 별칭을 쓰지 않는다.
 */

export interface Pages {
  readonly total_pages: number | null;
  readonly read_pages: number | null;
}

/**
 * 0~1 사이의 비율. **모르면 `null`** 이다.
 *
 * ⚠ `null` 과 `0` 은 다르다 — 0 은 "안 읽었다"이고 null 은 "총 쪽수를 모른다"다.
 *   화면은 null 이면 진행률 줄을 **아예 그리지 않는다**(0% 로 보여주지 않는다).
 */
export function progressRatio(p: Pages): number | null {
  const total = p.total_pages;
  const read = p.read_pages;
  if (total === null || !Number.isFinite(total) || total <= 0) return null;
  if (read === null || !Number.isFinite(read) || read < 0) return null;
  // ⚠ 읽은 쪽이 총 쪽보다 크면 100% 로 자른다. 입력은 막지 않는다 —
  //   개정판·전자책에서 쪽수가 어긋나는 일이 실제로 있다(§4.4)
  return Math.min(read / total, 1);
}

/** 화면에 쓰는 정수 퍼센트. 모르면 null */
export function progressPercent(p: Pages): number | null {
  const r = progressRatio(p);
  return r === null ? null : Math.round(r * 100);
}

/** 사용자가 친 문자열을 페이지 값으로 바꾼다. 빈 값·숫자가 아니면 `null`(=모름) */
export function parsePages(input: string): number | null {
  const t = input.trim();
  if (t === '') return null;
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}
