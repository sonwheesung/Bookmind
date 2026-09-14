import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { BookLine } from '@/components/BookLine';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { listBooks } from '@/features/books/repo';
import { useDbQuery } from '@/hooks/useDbQuery';
import { joinMeta } from '@/lib/format';
import { useTheme } from '@/theme';

/** 책 목록. ⚠ 빈 상태 문구가 "문장 저장에 책은 필요 없습니다"인 것이 기둥 1 이다. */
export default function BookList() {
  const { t } = useTranslation();
  const { spacing } = useTheme();

  const { data } = useDbQuery(() => listBooks());

  return (
    <Screen scroll tab>
      <Header title={t('books.list.title')} />

      <Button
        label={t('books.new.title')}
        onPress={() => router.push('/books/new')}
        style={{ marginBottom: spacing.xl }}
      />

      {data.length === 0 ? (
        <AppText tone="muted">{t('books.list.empty')}</AppText>
      ) : (
        data.map((b) => (
          <Card key={b.id} onPress={() => router.push(`/books/${b.id}`)}>
            {/* 책 고르기와 **같은 부품**이다(`docs/UI_GUIDE.md` §2) */}
            <BookLine book={b} caption={joinMeta([b.author, t(`books.status.${b.status}`)])} />
          </Card>
        ))
      )}
    </Screen>
  );
}
