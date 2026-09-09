import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * 마지막 내보내기 시각 — `docs/BACKUP_SYSTEM.md` §3 · §5.
 *
 * 🔴 뜻은 **"공유 시트를 열었다"** 까지다. OS 는 사용자가 저장했는지 취소했는지 알려주지 않는다 —
 *    그래서 화면에도 *"마지막 내보내기"* 라고만 쓰고 🚫 *"백업됨"* 이라고 쓰지 않는다.
 *    거짓이 될 수 있는 문구를 화면에 두지 않는 것이 이 앱의 정직 규칙이다.
 *
 * ⚠ 자동 백업·알림은 없다(§1). 이 날짜 하나가 사용자가 스스로 챙기게 하는 유일한 장치다.
 */
interface BackupState {
  lastExportedAt: string | null;
  markExported: (iso: string) => void;
}

export const useBackupStore = create<BackupState>()(
  persist(
    (set) => ({
      lastExportedAt: null,
      markExported: (iso) => set({ lastExportedAt: iso }),
    }),
    {
      name: 'reread-backup',
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persisted, current) => {
        const p = persisted as Partial<BackupState> | undefined;
        return {
          ...current,
          lastExportedAt: typeof p?.lastExportedAt === 'string' ? p.lastExportedAt : null,
        };
      },
    },
  ),
);
