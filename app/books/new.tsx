import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { createBook } from '@/features/books/repo';
import { BOOK_STATUSES, type BookStatus } from '@/features/types';
import { useTheme } from '@/theme';

/** 책 등록 — 제목 하나면 된다. ⚠ ISBN 검색·표지는 MVP 제외(§0). */
export default function NewBook() {
  const { t } = useTranslation();
  const { palette, radius, spacing, typography } = useTheme();

  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [status, setStatus] = useState<BookStatus>('reading');

  const canSave = title.trim() !== '';

  return (
    <Screen scroll>
      <Header title={t('books.new.title')} back />

      <Field label={t('books.field.title')} value={title} onChangeText={setTitle} autoFocus emphasis="body" />
      <Field label={t('books.field.author')} value={author} onChangeText={setAuthor} />

      <Text style={[typography.label, { color: palette.textMuted, marginBottom: spacing.xs }]}>
        {t('books.field.status')}
      </Text>
      <View style={[styles.chips, { gap: spacing.sm, marginBottom: spacing.xl }]}>
        {BOOK_STATUSES.map((s) => {
          const active = s === status;
          return (
            <Pressable
              key={s}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setStatus(s)}
              style={{
                backgroundColor: active ? palette.accent : palette.surface,
                borderColor: active ? palette.accent : palette.border,
                borderWidth: 1,
                borderRadius: radius.full,
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.md,
              }}
            >
              <Text style={[typography.label, { color: active ? palette.onAccent : palette.text }]}>
                {t(`books.status.${s}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Button
        label={t('books.new.action')}
        disabled={!canSave}
        onPress={() => {
          createBook({ title, author, status });
          router.back();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
});
