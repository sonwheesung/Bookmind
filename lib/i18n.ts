import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '@/locales/en.json';
import ko from '@/locales/ko.json';

/**
 * 🔴 기본 언어는 `en` 이다 (결정 #7 — 글로벌 동시 출시).
 * 한국은 여러 출시 국가 중 하나이지 기준 시장이 아니다.
 *
 * ⚠ 여기는 **UI 언어** 축 하나만 다룬다. 이 앱에는 언어가 셋이다
 * (`docs/I18N_SYSTEM.md` §3): UI 언어 · 원문 언어(카드마다) · AI 응답 언어(설정 전역).
 * 섞으면 반드시 틀린다.
 */
export const SUPPORTED = ['en', 'ko'] as const;
export type Lang = (typeof SUPPORTED)[number];
export const FALLBACK: Lang = 'en';

export function resolveDeviceLang(): Lang {
  const tags = Localization.getLocales();
  for (const t of tags) {
    const code = t.languageCode;
    if (code && (SUPPORTED as readonly string[]).includes(code)) return code as Lang;
  }
  return FALLBACK;
}

/**
 * 날짜·숫자 표시용 **기기 로케일**(`en-US` · `ko-KR`).
 *
 * 🔴 UI 언어가 아니다(`CLAUDE.md` §9 · 2026-09-14 사용자 확인). UI 를 영어로 골라도 기기가 한국어면
 *    날짜는 한국식이다. 그 전에는 화면들이 `i18n.language` 를 넘겨 문서와 어긋나 있었다.
 */
export function deviceLocale(): string {
  return Localization.getLocales()[0]?.languageTag ?? FALLBACK;
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ko: { translation: ko },
  },
  lng: resolveDeviceLang(),
  fallbackLng: FALLBACK,
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
