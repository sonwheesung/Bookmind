import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { DEFAULT_REMINDER_TIME, REMINDER_TIMES, parseTime } from '@/features/review/notify';

/**
 * 복습 알림 설정 — `docs/REVIEW_SYSTEM.md` §6.2.
 *
 * 🔴 **기본값은 꺼짐**이다. 설치하자마자 알림을 켜는 앱이 되지 않는다(기둥 1·5).
 *    켜는 순간 권한을 묻고, 거절해도 다시 조르지 않는다.
 */
interface ReminderState {
  enabled: boolean;
  time: string;
  setEnabled: (v: boolean) => void;
  setTime: (v: string) => void;
}

function safeTime(v: unknown): string {
  return typeof v === 'string' && parseTime(v) !== null && REMINDER_TIMES.includes(v)
    ? v
    : DEFAULT_REMINDER_TIME;
}

export const useReminderStore = create<ReminderState>()(
  persist(
    (set) => ({
      enabled: false,
      time: DEFAULT_REMINDER_TIME,
      setEnabled: (v) => set({ enabled: v }),
      setTime: (v) => set({ time: safeTime(v) }),
    }),
    {
      name: 'reread-reminder',
      storage: createJSONStorage(() => AsyncStorage),
      /** 🔴 저장된 값이 깨져 있어도 앱은 떠야 한다. 시각이 이상하면 기본값으로 돌린다 */
      merge: (persisted, current) => {
        const p = persisted as Partial<ReminderState> | undefined;
        return {
          ...current,
          enabled: p?.enabled === true,
          time: safeTime(p?.time),
        };
      },
    },
  ),
);
