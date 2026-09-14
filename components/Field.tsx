import { StyleSheet, TextInput, View, type KeyboardTypeOptions } from 'react-native';

import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme';

type Props = {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  /** 원문 입력처럼 오래 읽는 텍스트는 quote 타이포를 쓴다 */
  emphasis?: 'quote' | 'thought' | 'body';
  autoFocus?: boolean;
  minHeight?: number;
  /**
   * 🔴 입력칸이 내용만큼 무한히 자라면 **저장 버튼이 화면 밖으로 밀린다.**
   * 한 챕터를 붙여넣는 것은 허용해야 하지만(§8), 그때 저장 동선이 막히면 기둥 1 위반이다.
   * 상한을 넘으면 칸 안에서 스크롤된다.
   */
  maxHeight?: number;
  /** 숫자만 받는 칸(페이지 수 등)에 쓴다 */
  keyboardType?: KeyboardTypeOptions;
};

/**
 * 입력 한 칸. 🔴 라벨에 "(선택)"을 붙이지 않는다 — 필수는 원문 하나뿐이므로
 * 나머지가 선택인 것이 기본값이고, 매 칸에 표시하면 오히려 필수처럼 읽힌다
 * (`docs/KNOWLEDGE_SYSTEM.md` §1.1).
 */
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  emphasis = 'body',
  autoFocus = false,
  minHeight,
  maxHeight,
  keyboardType,
}: Props) {
  const { palette, radius, spacing, typography } = useTheme();

  return (
    <View style={{ marginBottom: spacing.lg }}>
      {label !== undefined && (
        <AppText variant="label" tone="muted" style={{ marginBottom: spacing.xs }}>
          {label}
        </AppText>
      )}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.textMuted}
        multiline={multiline}
        autoFocus={autoFocus}
        {...(keyboardType === undefined ? {} : { keyboardType })}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[
          typography[emphasis],
          styles.input,
          {
            color: palette.text,
            backgroundColor: palette.surface,
            borderColor: palette.border,
            borderRadius: radius.md,
            padding: spacing.md,
            ...(minHeight === undefined ? {} : { minHeight }),
            ...(maxHeight === undefined ? {} : { maxHeight }),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1 },
});
