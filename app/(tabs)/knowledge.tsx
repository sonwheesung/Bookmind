import { router } from 'expo-router';
import { ChartColumn, Plus, Search } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AdBanner } from '@/components/AdBanner';
import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { ChipRow } from '@/components/ChipRow';
import { Header } from '@/components/Header';
import { IconButton } from '@/components/IconButton';
import { Screen } from '@/components/Screen';
import { getBook } from '@/features/books/repo';
import { BOOK_ORDERS, groupByBook } from '@/features/knowledge/compute';
import { listKnowledge } from '@/features/knowledge/repo';
import { useKnowledgeSortStore } from '@/features/settings/knowledge-sort';
import { useDbQuery } from '@/hooks/useDbQuery';
import { joinMeta } from '@/lib/format';
import { useTheme } from '@/theme';

/**
 * 문장 탭 — 지식 카드 목록(결정 #26). 출처가 없는 카드는 **출처 줄 자체가 없다**(`KNOWLEDGE_SYSTEM.md` §8).
 *
 * 🔄 2026-09-14 검색 · 통계 · 저장을 위 오른쪽 아이콘으로 옮겼다(사용자 지시).
 * 🔄 같은 날 **등록순 / 책별** 고르기를 넣었다. 고른 값은 기기에 남는다(§3.2).
 */
export default function KnowledgeList() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const sort = useKnowledgeSortStore((s) => s.sort);
  const setSort = useKnowledgeSortStore((s) => s.setSort);
  const bookOrder = useKnowledgeSortStore((s) => s.bookOrder);
  const setBookOrder = useKnowledgeSortStore((s) => s.setBookOrder);

  const { data } = useDbQuery(() =>
    listKnowledge().map((k) => ({
      ...k,
      bookTitle: k.book_id === null ? null : (getBook(k.book_id)?.title ?? null),
    })),
  );

  type Item = (typeof data)[number];
  const card = (k: Item, withBook: boolean) => {
    // 🔴 페이지가 빈 문자열이어도 줄을 안 만든다(`joinMeta` 가 '' 를 준다).
    //    책별 보기에서는 구획 제목이 책이라 카드에 책 이름을 또 쓰지 않는다
    const source = joinMeta([withBook ? k.bookTitle : null, k.page]);
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
  };

  return (
    <Screen scroll tab footer={<AdBanner />}>
      <Header
        title={t('knowledge.list.title')}
        right={
          <>
            {/* 🔴 문장이 하나도 없으면 검색을 안 그린다 — 빈 방으로 가는 문이다(`KNOWLEDGE_SYSTEM.md` §6.6) */}
            {data.length > 0 && (
              <IconButton icon={Search} label={t('search.title')} onPress={() => router.push('/search')} />
            )}
            {/* 통계 진입점(결정 #26 · `STATS_SYSTEM.md` §4.1) */}
            <IconButton icon={ChartColumn} label={t('stats.title')} onPress={() => router.push('/stats')} />
            <IconButton icon={Plus} label={t('home.cta')} onPress={() => router.push('/knowledge/new')} />
          </>
        }
      />

      {data.length === 0 ? (
        <AppText tone="muted">{t('knowledge.list.empty')}</AppText>
      ) : (
        <>
          {/* 🔴 문장이 0개면 고르기를 안 그린다(고를 것이 없다 · §3.2) */}
          <ChipRow style={{ marginBottom: spacing.lg }}>
            <Chip
              label={t('knowledge.list.sort.recent')}
              active={sort === 'recent'}
              onPress={() => setSort('recent')}
            />
            <Chip label={t('knowledge.list.sort.book')} active={sort === 'book'} onPress={() => setSort('book')} />
          </ChipRow>

          {/* 🔄 2026-09-15 관리자 수정사항 #1 — 책별일 때만 **책 정렬** 을 고른다(§3.2.1).
              🔴 조용한 칩이다. 위 줄의 선택이 이미 accent 라 둘이 되지 않게 한다 */}
          {sort === 'book' && (
            <View style={[styles.orderRow, { gap: spacing.sm, marginTop: -spacing.sm, marginBottom: spacing.lg }]}>
              <AppText variant="label" tone="muted">
                {t('knowledge.list.bookOrder.label')}
              </AppText>
              <ChipRow style={styles.orderChips}>
                {BOOK_ORDERS.map((o) => (
                  <Chip
                    key={o}
                    quiet
                    label={t(`knowledge.list.bookOrder.${o}`)}
                    active={bookOrder === o}
                    onPress={() => setBookOrder(o)}
                  />
                ))}
              </ChipRow>
            </View>
          )}

          {sort === 'book'
            ? // 🔴 묶는 규칙은 `groupByBook` 한 곳이다. `책 없음` 은 맨 아래, 구획 안은 최신순이다
              groupByBook(data, bookOrder).map((g, i) => (
                <View key={g.bookId ?? 'none'} style={{ marginTop: i > 0 ? spacing.lg : 0 }}>
                  <AppText variant="label" style={{ marginBottom: spacing.sm }}>
                    {joinMeta([g.title ?? t('knowledge.book.none'), String(g.items.length)])}
                  </AppText>
                  {g.items.map((k) => card(k, false))}
                </View>
              ))
            : data.map((k) => card(k, true))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  /** 라벨과 칩을 한 줄에. 칩이 넘치면 칩만 줄바꿈된다 */
  orderRow: { flexDirection: 'row', alignItems: 'center' },
  orderChips: { flex: 1 },
});
