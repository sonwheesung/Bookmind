import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import i18n, { resolveDeviceLang, SUPPORTED, type Lang } from '@/lib/i18n';

/**
 * UI 언어 — `docs/I18N_SYSTEM.md` §2 · §2.1. Idea Repository `lib/language.ts` 승계.
 *
 * 🔴 상태는 언제나 `en|ko` **둘 중 하나**다. 🚫 "시스템 자동"을 세 번째 상태로 두지 않는다 —
 *    형제가 2026-08-27 에 제거했다(상태가 셋이 되면 마이그레이션과 버그가 는다).
 *    첫 실행에 기기 언어로 **한 번** 정해지고, 그 뒤로는 사용자 선택이 이긴다.
 *
 * ⚠ 이건 세 언어 축 중 **UI 언어 하나**다(§3). 원문 언어는 카드마다, AI 응답 언어는 Phase 8.
 */

/**
 * 🔴 언어 이름은 **그 언어 자신의 표기(autonym)** 이고 번역하지 않는다(§2.2).
 *    그래서 locale 파일이 아니라 여기 있다 — `en.json` 에 `한국어` 를 넣으면
 *    `check:i18n` ④(비한국어 파일 한글 잔존)가 **정당하게** FAIL 한다.
 */
export const LANGUAGE_NAMES: Record<Lang, string> = {
  en: 'English',
  ko: '한국어',
};

interface LanguageState {
  language: Lang;
  setLanguage: (lang: Lang) => void;
}

function isSupported(v: unknown): v is Lang {
  return typeof v === 'string' && (SUPPORTED as readonly string[]).includes(v);
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: resolveDeviceLang(),
      setLanguage: (lang) => {
        set({ language: lang });
        void i18n.changeLanguage(lang);
      },
    }),
    {
      name: 'reread-language',
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persisted, current) => {
        const p = persisted as Partial<LanguageState> | undefined;
        return { ...current, language: isSupported(p?.language) ? p.language : current.language };
      },
      /**
       * 저장된 선택을 부팅 시 적용한다. i18n 초기값은 기기 언어라 같으면 아무 일도 안 한다.
       * ⚠ 다르면 **한 프레임 깜빡인다** — 복원이 비동기이기 때문이다(§2.1).
       *   🚫 이걸 없애려고 스플래시로 부팅을 막지 않는다. 복원이 실패하면 흰 화면이 되는 쪽이 더 나쁘다.
       */
      onRehydrateStorage: () => (state) => {
        if (state && state.language !== i18n.language) void i18n.changeLanguage(state.language);
      },
    },
  ),
);
