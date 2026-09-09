import { StyleSheet, Text, TextInput, View } from 'react-native';

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
}: Props) {
  const { palette, radius, spacing, typography } = useTheme();

  return (
    <View style={{ marginBottom: spacing.lg }}>
      {label !== undefined && (
        <Text style={[typography.label, { color: palette.textMuted, marginBottom: spacing.xs }]}>
          {label}
        </Text>
      )}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.textMuted}
        multiline={multiline}
        autoFocus={autoFocus}
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
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1 },
});
