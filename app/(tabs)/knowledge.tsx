import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { getBook } from '@/features/books/repo';
import { listKnowledge } from '@/features/knowledge/repo';
import { useDbQuery } from '@/hooks/useDbQuery';
import { joinMeta } from '@/lib/format';
import { useTheme } from '@/theme';

/** 문장 탭 — 지식 카드 목록(결정 #26 · 위쪽에 검색·통계). 출처가 없는 카드는 **출처 줄 자체가 없다**(`KNOWLEDGE_SYSTEM.md` §8). */
export default function KnowledgeList() {
  const { t } = useTranslation();
  const { spacing } = useTheme();

  const { data } = useDbQuery(() =>
    listKnowledge().map((k) => ({
      ...k,
      bookTitle: k.book_id === null ? null : (getBook(k.book_id)?.title ?? null),
    })),
  );

  return (
    <Screen scroll tab>
      <Header
        title={t('knowledge.list.title')}
        right={
          <View style={[styles.links, { gap: spacing.md }]}>
            {/* 🔴 문장이 하나도 없으면 검색을 안 그린다 — 빈 방으로 가는 문이다(`KNOWLEDGE_SYSTEM.md` §6.6) */}
            {data.length > 0 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('search.title')}
                onPress={() => router.push('/search')}
                hitSlop={12}
              >
                <AppText variant="label" tone="muted">
                  {t('search.title')}
                </AppText>
              </Pressable>
            )}
            {/* 통계 진입점. 🔄 홈 아래 줄에서 옮겼다(결정 #26 · `STATS_SYSTEM.md` §4.1) */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('stats.title')}
              onPress={() => router.push('/stats')}
              hitSlop={12}
            >
              <AppText variant="label" tone="muted">
                {t('stats.title')}
              </AppText>
            </Pressable>
          </View>
        }
      />

      <Button
        label={t('home.cta')}
        onPress={() => router.push('/knowledge/new')}
        style={{ marginBottom: spacing.xl }}
      />

      {data.length === 0 ? (
        <AppText tone="muted">{t('knowledge.list.empty')}</AppText>
      ) : (
        data.map((k) => {
          // 🔴 페이지가 빈 문자열이어도 줄을 안 만든다(`joinMeta` 가 '' 를 준다)
          const source = joinMeta([k.bookTitle, k.page]);
          return (
            <Card key={k.id} onPress={() => router.push(`/knowledge/${k.id}`)}>
              <AppText variant="thought" numberOfLines={4}>
                {k.content}
              </AppText>
              {source !== '' && (
                <AppText variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>
                  {source}
                </AppText>
              )}
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  links: { flexDirection: 'row', alignItems: 'center' },
});
