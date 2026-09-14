import { View } from 'react-native';

import { useTheme, type Theme } from '@/theme';

/** 높이만 있는 빈 공간 — `docs/UI_GUIDE.md` §2. 🔴 높이는 `spacing` 이름으로만 준다 */
export function Spacer({ size }: { size: keyof Theme['spacing'] }) {
  const { spacing } = useTheme();
  return <View style={{ height: spacing[size] }} />;
}
