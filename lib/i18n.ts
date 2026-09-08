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
