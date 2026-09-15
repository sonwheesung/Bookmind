import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  parseBookOrder,
  parseKnowledgeSort,
  type BookOrder,
  type KnowledgeSort,
} from '@/features/knowledge/compute';

/**
 * 문장 목록 정렬 — `docs/KNOWLEDGE_SYSTEM.md` §3.2 · §3.2.1.
 *
 * 🔴 **기기에 저장한다**(사용자 지시 *"선택한 정렬 방법은 휴대폰내에서 저장해서 사용"*).
 *    백업 파일에는 안 들어간다. 화면 취향이지 지식이 아니다.
 * 🔴 저장된 값이 깨졌거나 모르는 값이면 `recent` 로 돌아간다(`parseKnowledgeSort` · `parseBookOrder`).
 * 🔄 2026-09-15 책별 보기의 **책 순서**를 같은 저장소에 더했다. 이전 기기에는 값이 없어서 `recent` 로 읽힌다.
 */
interface KnowledgeSortState {
  sort: KnowledgeSort;
  bookOrder: BookOrder;
  setSort: (sort: KnowledgeSort) => void;
  setBookOrder: (bookOrder: BookOrder) => void;
}

export const useKnowledgeSortStore = create<KnowledgeSortState>()(
  persist(
    (set) => ({
      sort: 'recent',
      bookOrder: 'recent',
      setSort: (sort) => set({ sort }),
      setBookOrder: (bookOrder) => set({ bookOrder }),
    }),
    {
      name: 'reread-knowledge-sort',
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persisted, current) => {
        const p = persisted as { sort?: unknown; bookOrder?: unknown } | undefined;
        return {
          ...current,
          sort: parseKnowledgeSort(p?.sort),
          bookOrder: parseBookOrder(p?.bookOrder),
        };
      },
    },
  ),
);
