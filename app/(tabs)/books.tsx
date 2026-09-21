import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { AdBanner } from '@/components/AdBanner';
import { AppText } from '@/components/AppText';
import { BookLine } from '@/components/BookLine';
import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { IconButton } from '@/components/IconButton';
import { Screen } from '@/components/Screen';
import { listBooks } from '@/features/books/repo';
import { useDbQuery } from '@/hooks/useDbQuery';
import { joinMeta } from '@/lib/format';

/**
 * 책 목록. ⚠ 빈 상태 문구가 "문장 저장에 책은 필요 없습니다"인 것이 기둥 1 이다.
 * 🔄 2026-09-14 책 추가를 위 오른쪽 `+` 로 옮겼다(사용자 지시).
 */
export default function BookList() {
  const { t } = useTranslation();

  const { data } = useDbQuery(() => listBooks());

  return (
    <Screen scroll tab footer={<AdBanner />}>
      <Header
        title={t('books.list.title')}
        right={<IconButton icon={Plus} label={t('books.new.title')} onPress={() => router.push('/books/new')} />}
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
