import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { parseKnowledgeSort, type KnowledgeSort } from '@/features/knowledge/compute';

/**
 * 문장 목록 정렬 — `docs/KNOWLEDGE_SYSTEM.md` §3.2.
 *
 * 🔴 **기기에 저장한다**(사용자 지시 *"선택한 정렬 방법은 휴대폰내에서 저장해서 사용"*).
 *    백업 파일에는 안 들어간다. 화면 취향이지 지식이 아니다.
 * 🔴 저장된 값이 깨졌거나 모르는 값이면 `recent` 로 돌아간다(`parseKnowledgeSort`).
 */
interface KnowledgeSortState {
  sort: KnowledgeSort;
  setSort: (sort: KnowledgeSort) => void;
}

export const useKnowledgeSortStore = create<KnowledgeSortState>()(
  persist(
    (set) => ({
      sort: 'recent',
      setSort: (sort) => set({ sort }),
    }),
    {
      name: 'reread-knowledge-sort',
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persisted, current) => ({
        ...current,
        sort: parseKnowledgeSort((persisted as { sort?: unknown } | undefined)?.sort),
      }),
    },
  ),
);
