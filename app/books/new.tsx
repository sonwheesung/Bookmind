import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Chip } from '@/components/Chip';
import { ChipRow } from '@/components/ChipRow';
import { Field } from '@/components/Field';
import { Header } from '@/components/Header';
import { IconButton } from '@/components/IconButton';
import { Screen } from '@/components/Screen';
import { parsePages } from '@/features/books/progress';
import { createBook } from '@/features/books/repo';
import { BOOK_STATUSES, type BookStatus } from '@/features/types';
import { useTheme } from '@/theme';

/**
 * 책 등록 — 제목 하나면 된다. ⚠ ISBN 검색·표지는 MVP 제외(§0).
 * 🔄 2026-09-14 저장을 위 오른쪽 ✓ 로 옮겼다(사용자 지시).
 */
export default function NewBook() {
  const { t } = useTranslation();
  const { spacing } = useTheme();

  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [status, setStatus] = useState<BookStatus>('reading');
  const [totalPages, setTotalPages] = useState('');
  const [readPages, setReadPages] = useState('');

  const canSave = title.trim() !== '';

  const save = () => {
    if (!canSave) return;
    createBook({
      title,
      author,
      status,
      totalPages: parsePages(totalPages),
      readPages: parsePages(readPages),
    });
    router.back();
  };

  return (
    <Screen scroll>
      <Header
        title={t('books.new.title')}
        back
        right={<IconButton icon={Check} label={t('books.new.action')} onPress={save} disabled={!canSave} />}
      />

      <Field label={t('books.field.title')} value={title} onChangeText={setTitle} autoFocus emphasis="body" />
      <Field label={t('books.field.author')} value={author} onChangeText={setAuthor} />
      {/* ⚠ 둘 다 선택이다. 모르면 비워 두고, 그러면 진행률 줄이 아예 안 뜬다(§4.4) */}
      <Field
        label={t('books.field.totalPages')}
        value={totalPages}
        onChangeText={setTotalPages}
        keyboardType="number-pad"
      />
      <Field
        label={t('books.field.readPages')}
        value={readPages}
        onChangeText={setReadPages}
        keyboardType="number-pad"
      />

      <AppText variant="label" tone="muted" style={{ marginBottom: spacing.xs }}>
        {t('books.field.status')}
      </AppText>
      {/* 🔴 칩을 손으로 다시 그리지 않는다(`docs/UI_GUIDE.md` §7.4 — 여기와 책 상세가 그랬다) */}
      <ChipRow style={{ marginBottom: spacing.xl }}>
        {BOOK_STATUSES.map((s) => (
          <Chip key={s} label={t(`books.status.${s}`)} active={s === status} onPress={() => setStatus(s)} />
        ))}
      </ChipRow>
    </Screen>
  );
}
