/**
 * 책 표지 색 — `docs/DESIGN_REVIEW.md` §3 (2026-09-09 채택).
 *
 * 🔄 2026-09-14 **화면의 표지 자리는 지웠다**(사용자 선택). 등록할 때 색을 정해 DB 에 두는 것만 남겼다.
 *    2차의 표지 등록이 이 컬럼을 쓴다(Expand-only 라 컬럼을 지우지 않는다).
 *
 * 🔴 **이미지가 아니다.** 색 하나 + 제목 첫 글자다 — PNG·SVG·외부 API 가 전부 필요 없다.
 *    ISBN·표지 자동 등록은 국가별 도서 API 가 갈라져 글로벌에서 비싸 2차로 미뤘고(MVP 제외),
 *    그 자리를 빈 회색 상자로 두면 시안보다 나빠진다 — 초기 사용자의 책은 대부분 표지가 없다.
 *
 * 🔴 순수하다(가드가 잰다). `@/` 별칭을 쓰지 않는다.
 */

/** 저채도 여섯 색. 🚫 의미를 부여하지 않는다 — 장식이다(`DESIGN_REVIEW.md` §3 색상 항목). */
export const COVER_COLORS: readonly string[] = [
  '#DCE6EC',
  '#E7DED2',
  '#DDE5D8',
  '#E8DDE1',
  '#DDDCE7',
  '#E6E0D2',
];

/**
 * 등록할 때 한 번 배정한다.
 * 🔴 랜덤이면 앱을 열 때마다 바뀌어 *"Atomic Habits = 파란 A"* 라는 기억이 안 생긴다.
 *    그래서 제목에서 **결정론적으로** 고르고, 그 값을 DB 에 저장한다(마이그레이션 v4).
 */
export function pickCoverColor(title: string): string {
  let hash = 0;
  for (const ch of title.trim()) hash = (hash * 31 + ch.codePointAt(0)!) % 100_000;
  return COVER_COLORS[hash % COVER_COLORS.length]!;
}

