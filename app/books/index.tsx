import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { BookCover } from '@/components/BookCover';
import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { listBooks } from '@/features/books/repo';
import { useDbQuery } from '@/hooks/useDbQuery';
import { useTheme } from '@/theme';

/** 책 목록. ⚠ 빈 상태 문구가 "문장 저장에 책은 필요 없습니다"인 것이 기둥 1 이다. */
export default function BookList() {
  const { t } = useTranslation();
  const { palette, spacing, typography } = useTheme();

  const { data } = useDbQuery(() => listBooks());

  return (
    <Screen scroll>
      <Header title={t('books.list.title')} back />

      <Button
        label={t('books.new.title')}
        onPress={() => router.push('/books/new')}
        style={{ marginBottom: spacing.xl }}
      />

      {data.length === 0 ? (
        <Text style={[typography.body, { color: palette.textMuted }]}>{t('books.list.empty')}</Text>
      ) : (
        data.map((b) => (
          <Card key={b.id} onPress={() => router.push(`/books/${b.id}`)}>
            <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
              <BookCover book={b} size="sm" />
              <View style={{ flex: 1 }}>
                <Text style={[typography.body, { color: palette.text }]} numberOfLines={2}>
                  {b.title}
                </Text>
                <Text style={[typography.caption, { color: palette.textMuted, marginTop: spacing.xs }]}>
                  {[b.author, t(`books.status.${b.status}`)].filter((v) => v != null && v !== '').join(' · ')}
                </Text>
              </View>
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}
