import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BookLine } from '@/components/BookLine';
import { Divider } from '@/components/Divider';
import type { BookRow } from '@/features/types';
import { useTheme } from '@/theme';

type Props = {
  books: readonly BookRow[];
  value: string | null;
  onChange: (bookId: string | null) => void;
  /** 목록 맨 아래의 `+ 새 책 등록`. 🔴 없으면 막다른 길이 된다(§1.1.1) */
  onCreate: () => void;
};

/**
 * 책 고르기 — `docs/KNOWLEDGE_SYSTEM.md` §1.1.1.
 *
 * 🔴 **칩에서 목록으로 바꾼 이유는 두 가지인데, 무거운 쪽은 "책을 만들 길이 없다"였다.**
 *    책이 0권이면 칩은 `책 없음` 하나뿐이고, 저장 화면에 온 사람은 `/books` 까지 안 간다.
 *    그래서 `+ 새 책 등록`이 **목록 안에** 있다.
 * 🔴 기본값은 여전히 `책 없음` 이다. 고르라고 요구하지 않는다(기둥 1).
 * 🚫 검색창을 지금 넣지 않는다. 스무 권까지는 목록이 더 빠르다.
 */
export function BookSelect({ books, value, onChange, onCreate }: Props) {
  const { t } = useTranslation();
  const { palette, radius, spacing } = useTheme();
  const [open, setOpen] = useState(false);

  const selected = books.find((b) => b.id === value);
  const label = selected?.title ?? t('knowledge.book.none');

  const row = (key: string, content: React.ReactNode, onPress: () => void, checked = false) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      accessibilityState={{ selected: checked }}
      onPress={onPress}
      style={({ pressed }) => ({
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.lg,
        opacity: pressed ? 0.6 : 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
      })}
    >
      <View style={styles.grow}>{content}</View>
      {checked && <AppText tone="accent">✓</AppText>}
    </Pressable>
  );

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('knowledge.field.book')}: ${label}`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
          {
            backgroundColor: palette.surface,
            borderColor: palette.border,
            borderRadius: radius.md,
            padding: spacing.md,
            marginBottom: spacing.lg,
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
            {t('knowledge.field.book')}
          </AppText>

          <ScrollView>
            {row(
              'none',
              <AppText>{t('knowledge.book.none')}</AppText>,
              () => {
                onChange(null);
                setOpen(false);
              },
              value === null,
            )}

            {books.map((b) =>
              row(
                b.id,
                <BookLine book={b} caption={b.author} />,
                () => {
                  onChange(b.id);
                  setOpen(false);
                },
                value === b.id,
              ),
            )}
          </ScrollView>

          {/* 🔴 이 줄이 이 컴포넌트의 존재 이유다. 여기가 없으면 책을 만들 길이 없다 */}
          <Divider />
          {row('create', <AppText tone="accent">{t('knowledge.book.create')}</AppText>, () => {
            setOpen(false);
            onCreate();
          })}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { borderWidth: 1, flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '70%', borderWidth: 1 },
});
