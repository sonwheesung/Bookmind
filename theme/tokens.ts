/**
 * 디자인 토큰.
 *
 * 🔴 폰트 파일이 없다 (결정 #13 — `CLAUDE.md` §14).
 * 이 앱의 본문은 **사용자가 저장한 책 문장**이고 우리는 그 언어를 정할 수 없다.
 * 일본어·중국어·러시아어 책을 저장하면 번들 폰트에 그 글자가 없어 네모(□)가 된다.
 * 기기의 시스템 폰트만이 그 기기가 가진 글자 전부를 쓴다.
 * → `fontFamily` 를 지정하지 않는다. `expo-font` 도 설치하지 않는다.
 *    타이포 토큰은 **굵기·크기·행간**만 정의한다.
 */

/** 4px 배수. 화면에서 raw 숫자를 쓰지 않는다 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  /** 홈의 영역 사이. 🔴 `xl`(24)로는 구획이 안 갈라졌다(`DESIGN_REVIEW.md` §3, 2026-09-09) */
  section: 28,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  full: 999,
} as const;

/**
 * 🔴 `fontFamily` 가 없는 것이 의도다. 추가하지 말 것.
 * 크기는 기기 글꼴 크기 설정을 타므로 절대값이 아니라 기준값이다.
 */
export const typography = {
  /** 책 원문 — 이 앱에서 가장 오래 읽히는 텍스트 */
  quote: { fontSize: 18, lineHeight: 28, fontWeight: '400' },
  /** 내 생각 — 원문과 동등하게 둔다 (기둥 6) */
  thought: { fontSize: 16, lineHeight: 26, fontWeight: '400' },
  title: { fontSize: 22, lineHeight: 30, fontWeight: '700' },
  /** 화면 안의 구획 제목. 🔴 이게 `label`(13·muted)이라 구획이 안 보였다(2026-09-09) */
  section: { fontSize: 18, lineHeight: 26, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
} as const;

type Palette = {
  bg: string;
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  onAccent: string;
  /** 되돌릴 수 없는 동작에만 — 🚫 미달성·실패 표시에 쓰지 않는다 (기둥 5) */
  danger: string;
};

export const lightPalette: Palette = {
  bg: '#FBFAF7',
  surface: '#FFFFFF',
  border: '#E7E3DA',
  text: '#1C1A17',
  textMuted: '#6E6960',
  accent: '#3A5A73',
  onAccent: '#FFFFFF',
  danger: '#A8422F',
};

export const darkPalette: Palette = {
  bg: '#16150F',
  surface: '#211F19',
  border: '#38352C',
  text: '#F2EFE7',
  textMuted: '#A09A8D',
  accent: '#8FB3CC',
  onAccent: '#16150F',
  danger: '#E0836E',
};

export type { Palette };
