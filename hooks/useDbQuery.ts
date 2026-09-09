import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

/**
 * 로컬 DB 읽기 — expo-sqlite 의 동기 API 라서 로딩 상태가 없다.
 *
 * 🔴 **화면에 돌아올 때마다 다시 읽는다.** 저장·삭제가 다른 화면에서 일어나므로
 *    포커스 복귀 시 다시 읽지 않으면 지운 것이 목록에 남아 보인다 —
 *    `DATABASE.md` §1.1 이 말하는 "빈 화면이 아니라 틀린 화면"이 UI 층에서 재현되는 자리다.
 */
export function useDbQuery<T>(read: () => T): { data: T; reload: () => void } {
  // 렌더마다 새 화살표 함수가 오므로 ref 로 최신 것만 들고, reload 는 고정한다
  // (안 그러면 useFocusEffect 가 매 렌더 돌아 무한 루프가 된다)
  const readRef = useRef(read);
  readRef.current = read;

  const [data, setData] = useState<T>(read);
  const reload = useCallback(() => setData(readRef.current()), []);

  useFocusEffect(reload);

  return { data, reload };
}
