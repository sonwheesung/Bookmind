import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { parseStatsPeriod, type StatsPeriod } from '@/features/stats/charts';

/**
 * 통계 기간(주 · 월 · 년) — `docs/STATS_SYSTEM.md` §4.2.
 *
 * 🔴 기기에 저장한다. 문장 정렬과 같은 성격이다(화면 취향이지 지식이 아니라 백업에 안 넣는다).
 * 🔴 저장된 값이 깨졌거나 모르는 값이면 `week` 로 돌아간다(`parseStatsPeriod`).
 */
interface StatsPeriodState {
  period: StatsPeriod;
  setPeriod: (period: StatsPeriod) => void;
}

export const useStatsPeriodStore = create<StatsPeriodState>()(
  persist(
    (set) => ({
      period: 'week',
      setPeriod: (period) => set({ period }),
    }),
    {
      name: 'reread-stats-period',
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persisted, current) => ({
        ...current,
        period: parseStatsPeriod((persisted as { period?: unknown } | undefined)?.period),
      }),
    },
  ),
);
