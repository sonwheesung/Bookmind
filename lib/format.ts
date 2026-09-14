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

/** 날짜 표시. 로케일은 부르는 쪽이 정한다(지금 화면들은 UI 언어를 넘긴다) */
export function formatDate(iso: string, lang: string): string {
  return new Date(iso).toLocaleDateString(lang);
}
