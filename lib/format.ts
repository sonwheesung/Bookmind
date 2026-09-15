/**
 * 표시용 문자열 — `docs/UI_GUIDE.md` §3.
 *
 * 🔴 순수하다. expo 도 i18n 도 모른다(가드 `check:ui` 가 node 에서 그대로 import 한다).
 */

/**
 * 메타 한 줄(`책 · 저자 · 쪽`). **빈 조각은 버린다.**
 *
 * 🔴 전부 비면 `''` 를 돌려준다. 화면은 그때 줄 자체를 안 그린다.
 *    빈 글자 줄을 그리면 여백만 남아 "뭔가 빠진 카드"로 보인다(`KNOWLEDGE_SYSTEM.md` §8).
 */
export function joinMeta(parts: readonly (string | null | undefined)[]): string {
  return parts.filter((v): v is string => v != null && v !== '').join(' · ');
}

/** 날짜 표시. 🔴 로케일은 **기기 로케일**(`deviceLocale()`)을 넘긴다. UI 언어가 아니다(`CLAUDE.md` §9) */
export function formatDate(iso: string, lang: string): string {
  return new Date(iso).toLocaleDateString(lang);
}

/** 달 표시(`2026년 9월` · `September 2026`). 🔴 로케일은 **기기 로케일**이다(`formatDate` 와 같다) */
export function formatMonth(month: string, lang: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(y ?? Number.NaN, (m ?? Number.NaN) - 1, 1).toLocaleDateString(lang, { year: 'numeric', month: 'long' });
}

/** 짧은 날짜(`9월 14일` · `Sep 14`). 🔴 로케일은 기기 로케일이다 */
export function formatDayShort(day: string, lang: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y ?? Number.NaN, (m ?? Number.NaN) - 1, d ?? Number.NaN).toLocaleDateString(lang, {
    month: 'short',
    day: 'numeric',
  });
}

/** 짧은 달 이름(`9월` · `Sep`). 🔴 로케일은 기기 로케일이다 */
export function formatMonthShort(month: string, lang: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(y ?? Number.NaN, (m ?? Number.NaN) - 1, 1).toLocaleDateString(lang, { month: 'short' });
}

/** 해(`2026년` · `2026`). 🔴 로케일은 기기 로케일이다 */
export function formatYear(year: string, lang: string): string {
  return new Date(Number(year), 0, 1).toLocaleDateString(lang, { year: 'numeric' });
}
