import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { getBook } from '@/features/books/repo';
import { listKnowledge } from '@/features/knowledge/repo';
import { useDbQuery } from '@/hooks/useDbQuery';
import { useTheme } from '@/theme';

/** 지식 카드 목록. 출처가 없는 카드는 **출처 줄 자체가 없다**(`KNOWLEDGE_SYSTEM.md` §8). */
export default function KnowledgeList() {
  const { t } = useTranslation();
  const { palette, spacing, typography } = useTheme();

  const { data } = useDbQuery(() =>
    listKnowledge().map((k) => ({
      ...k,
      bookTitle: k.book_id === null ? null : (getBook(k.book_id)?.title ?? null),
    })),
  );

  return (
    <Screen scroll>
      <Header title={t('knowledge.list.title')} back />

      <Button
        label={t('home.cta')}
        onPress={() => router.push('/knowledge/new')}
        style={{ marginBottom: spacing.xl }}
      />

      {data.length === 0 ? (
        <Text style={[typography.body, { color: palette.textMuted }]}>{t('knowledge.list.empty')}</Text>
      ) : (
        data.map((k) => (
          <Card key={k.id} onPress={() => router.push(`/knowledge/${k.id}`)}>
            <Text style={[typography.thought, { color: palette.text }]} numberOfLines={4}>
              {k.content}
            </Text>
            {(k.bookTitle !== null || k.page !== null) && (
              <Text style={[typography.caption, { color: palette.textMuted, marginTop: spacing.sm }]}>
                {[k.bookTitle, k.page].filter((v) => v !== null && v !== '').join(' · ')}
              </Text>
            )}
          </Card>
        ))
      )}
    </Screen>
  );
}
