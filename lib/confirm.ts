import { Alert } from 'react-native';

import i18n from '@/lib/i18n';

type Options = {
  title: string;
  body: string;
  /** 확인 버튼 글자(`삭제` · `지우기` · `바꾸기`) */
  action: string;
  onConfirm: () => void;
};

/**
 * 되돌릴 수 없는 동작의 확인창 — `docs/UI_GUIDE.md` §3.
 *
 * 🔴 취소가 **먼저**, 확인은 `destructive` 다. 화면마다 따로 쓰면 한 곳은 빠진다.
 *    실제로 문장·책 삭제에는 확인이 있는데 생각 지우기에만 없던 적이 있다(`app/knowledge/[id].tsx`).
 */
export function confirmDestructive({ title, body, action, onConfirm }: Options): void {
  Alert.alert(title, body, [
    { text: i18n.t('common.cancel'), style: 'cancel' },
    { text: action, style: 'destructive', onPress: onConfirm },
  ]);
}
