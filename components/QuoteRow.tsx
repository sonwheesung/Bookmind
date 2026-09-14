import { Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Divider } from '@/components/Divider';
import { useTheme } from '@/theme';

type Props = {
  content: string;
  onPress: () => void;
  /** 문장 위 한 줄(검색의 "어느 축에서 맞았나") */
  label?: string;
  /** 문장 아래 출처. 🚫 비어 있으면 줄을 만들지 않는다 */
  source?: string | null;
  /** 위에 구분선을 긋는다. 목록의 첫 행은 안 긋는다 */
  divided?: boolean;
};

/**
 * 카드 없이 구분선으로 나눈 문장 한 행 — `docs/UI_GUIDE.md` §2.
 *
 * 🔴 카드가 아니다. 그래도 **행 전체가 터치 영역**이다. 시각적으로 카드가 아닌 것과
 *    기능적으로 목록인 것은 다른 축이다(`DESIGN_REVIEW.md` §3 홈 개편).
 */
export function QuoteRow({ content, onPress, label, source, divided = false }: Props) {
  const { spacing } = useTheme();

  return (
    <View>
      {divided && <Divider />}
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => ({ paddingVertical: spacing.lg, opacity: pressed ? 0.6 : 1 })}
      >
        {label !== undefined && (
          <AppText variant="label" tone="muted" style={{ marginBottom: spacing.xs }}>
            {label}
          </AppText>
        )}
        <AppText variant="quote" numberOfLines={3}>
          {content}
        </AppText>
        {source != null && source !== '' && (
          <AppText variant="caption" tone="muted" numberOfLines={1} style={{ marginTop: spacing.xs }}>
            {source}
          </AppText>
        )}
      </Pressable>
    </View>
  );
}
