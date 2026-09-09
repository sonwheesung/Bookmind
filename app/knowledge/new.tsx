import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { listBooks } from '@/features/books/repo';
import { saveKnowledge } from '@/features/knowledge/repo';
import { useDbQuery } from '@/hooks/useDbQuery';
import { useTheme } from '@/theme';

/**
 * 빠른 저장 — 🔴 **필수는 원문 하나다**(`docs/KNOWLEDGE_SYSTEM.md` §1.1, 기둥 1).
 *
 * 그래서 이 화면에서:
 *  · 저장 버튼은 **원문이 있으면 열린다.** 책·페이지·생각·태그는 비어도 된다
 *  · 책 선택은 칩 한 줄이고 기본값이 `책 없음`이다 — 고르라고 요구하지 않는다
 *  · 🚫 중복 문장 검사를 넣지 않는다(§8) — 흐름을 끊는 것이 더 나쁘다
 */
export default function NewKnowledge() {
  const { t } = useTranslation();
  const { palette, radius, spacing, typography } = useTheme();

  const { data: books } = useDbQuery(() => listBooks());

  const [content, setContent] = useState('');
  const [bookId, setBookId] = useState<string | null>(null);
  const [page, setPage] = useState('');
  const [thought, setThought] = useState('');
  const [tags, setTags] = useState('');

  const canSave = content.trim() !== '';

  const onSave = () => {
    if (!canSave) return;
    saveKnowledge({
      content,
      bookId,
      page,
      thought,
      tagNames: tags
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s !== ''),
    });
    router.back();
  };

  return (
    <Screen scroll hasHeader={false}>
      <Header title={t('knowledge.new.title')} back />

      <Field
        label={t('knowledge.field.passage')}
        value={content}
        onChangeText={setContent}
        placeholder={t('knowledge.save.placeholder')}
        multiline
        emphasis="quote"
        autoFocus
        minHeight={140}
      />

      <Text style={[typography.label, { color: palette.textMuted, marginBottom: spacing.xs }]}>
        {t('knowledge.field.book')}
      </Text>
      <View style={[styles.chips, { gap: spacing.sm, marginBottom: spacing.lg }]}>
        <Chip label={t('knowledge.book.none')} active={bookId === null} onPress={() => setBookId(null)} />
        {books.map((b) => (
          <Chip key={b.id} label={b.title} active={bookId === b.id} onPress={() => setBookId(b.id)} />
        ))}
      </View>

      <Field label={t('knowledge.field.page')} value={page} onChangeText={setPage} />

      <Field
        label={t('knowledge.field.thought')}
        value={thought}
        onChangeText={setThought}
        placeholder={t('knowledge.thoughts.placeholder')}
        multiline
        emphasis="thought"
        minHeight={90}
      />

      <Field
        label={t('knowledge.field.tags')}
        value={tags}
        onChangeText={setTags}
        placeholder={t('knowledge.field.tagsHint')}
      />

      <Button label={t('knowledge.save.action')} onPress={onSave} disabled={!canSave} />
      <View style={{ height: spacing.xxl }} />

      <Text style={[typography.caption, { color: palette.textMuted, marginTop: spacing.md }]}>
        {t('knowledge.save.hint')}
      </Text>
      <View style={{ height: spacing.xl, borderRadius: radius.sm }} />
    </Screen>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { palette, radius, spacing, typography } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        backgroundColor: active ? palette.accent : palette.surface,
        borderColor: active ? palette.accent : palette.border,
        borderWidth: 1,
        borderRadius: radius.full,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
      }}
    >
      <Text style={[typography.label, { color: active ? palette.onAccent : palette.text }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
});
