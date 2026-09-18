import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme';

export interface SelectOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

type Props<T extends string> = {
  /** 시트 제목이자 스크린리더가 읽는 이름 */
  title: string;
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
};

/**
 * 목록에서 하나 고르기 — `docs/UI_GUIDE.md` §2.
 *
 * 🔴 `BookSelect` 와 **같은 모양**이다(여는 칸 · 아래에서 올라오는 목록 · 고른 줄에 ✓).
 *    화면마다 고르는 방법이 다르면 사용자는 둘을 따로 배운다.
 * 🔄 2026-09-18 설정의 언어가 첫 사용처다(사용자 지시 *"언어는 select 태그로 선택할 수 있게"*).
 */
export function Select<T extends string>({ title, value, options, onChange }: Props<T>) {
  const { t } = useTranslation();
  const { palette, radius, spacing } = useTheme();
  const [open, setOpen] = useState(false);

  const selected = options.find((o) => o.value === value);
  const label = selected?.label ?? '';

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}: ${label}`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
          {
            backgroundColor: palette.surface,
            borderColor: palette.border,
            borderRadius: radius.md,
            padding: spacing.md,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <AppText style={styles.grow} numberOfLines={1}>
          {label}
        </AppText>
        <AppText variant="caption" tone="muted">
          ▾
        </AppText>
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        {/* 바깥을 눌러 닫는다. 🔴 닫는 길이 하나뿐이면 갇힌 것처럼 느껴진다 */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
          onPress={() => setOpen(false)}
          style={[styles.backdrop, { backgroundColor: palette.backdrop }]}
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: palette.bg,
              borderColor: palette.border,
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
            },
          ]}
        >
          <AppText variant="section" style={{ padding: spacing.lg, paddingBottom: spacing.sm }}>
            {title}
          </AppText>

          <ScrollView>
            {options.map((o) => {
              const checked = o.value === value;
              return (
                <Pressable
                  key={o.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: checked }}
                  onPress={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.row,
                    {
                      paddingVertical: spacing.lg,
                      paddingHorizontal: spacing.lg,
                      gap: spacing.md,
                      opacity: pressed ? 0.6 : 1,
                    },
                  ]}
                >
                  <AppText style={styles.grow}>{o.label}</AppText>
                  {checked && <AppText tone="accent">✓</AppText>}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { borderWidth: 1, flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '70%', borderWidth: 1 },
});
