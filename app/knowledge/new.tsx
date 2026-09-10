import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { BookSelect } from '@/components/BookSelect';
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

  // 🔴 사진에서 온 텍스트를 받는다(`docs/KNOWLEDGE_SYSTEM.md` §2.2).
  //    저장 규칙을 스캔 화면에 복사하지 않고 **여기 한 벌만** 둔다
  const params = useLocalSearchParams<{ text?: string; source?: string }>();
  const fromOcr = params.source === 'ocr';

  const [content, setContent] = useState(params.text ?? '');
  const [bookId, setBookId] = useState<string | null>(null);
  const [page, setPage] = useState('');
  const [thought, setThought] = useState('');
  const [tags, setTags] = useState('');

  const canSave = content.trim() !== '';
  // 🔴 저장은 화면을 떠나므로, 두 번 눌리면 같은 문장이 두 건 생긴다.
  //    상태가 아니라 ref 다 — 리렌더를 기다리는 사이에 두 번째 탭이 들어온다.
  const saving = useRef(false);

  const onSave = () => {
    if (!canSave || saving.current) return;
    saving.current = true;
    saveKnowledge({
      content,
      bookId,
      page,
      thought,
      tagNames: tags
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s !== ''),
      sourceType: fromOcr ? 'ocr' : 'manual',
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
        maxHeight={260}
      />

      {/* 🔴 원문이 비어 있을 때만 그린다. 이미 쓰고 있는 사람에게 다른 입력 수단을 권하면
          그건 도움이 아니라 방해다(기둥 1). 사진에서 온 텍스트가 이미 들어와 있어도 안 그린다. */}
      {content === '' && (
        <Button
          label={t('ocr.entry')}
          variant="ghost"
          onPress={() => router.push('/knowledge/scan')}
          style={{ marginBottom: spacing.lg }}
        />
      )}

      <Text style={[typography.label, { color: palette.textMuted, marginBottom: spacing.xs }]}>
        {t('knowledge.field.book')}
      </Text>
      {/* 🔴 칩이 아니라 목록이다(§1.1.1). 요점은 폭이 아니라 **`+ 새 책 등록`이 그 안에 있다**는 것이다.
          책이 0권일 때 칩만 있으면 이 화면에서 책을 만들 길이 없었다 */}
      <BookSelect
        books={books}
        value={bookId}
        onChange={setBookId}
        onCreate={() => router.push('/books/new')}
      />

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
