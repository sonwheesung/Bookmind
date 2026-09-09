import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { countBooks } from '@/features/books/repo';
import { countKnowledge, listKnowledge } from '@/features/knowledge/repo';
import { dueCount } from '@/features/review/repo';
import { useDbQuery } from '@/hooks/useDbQuery';
import { useTheme } from '@/theme';

/**
 * 홈 — "오늘 무엇을 하면 되는가"(`docs/KNOWLEDGE_SYSTEM.md` §7).
 *
 * 🔴 홈은 책장이 아니다. 그리고 저장은 **1탭 거리**여야 한다(§1.2) —
 *    그래서 저장 버튼이 목록보다 위에 있고, 책을 거치지 않는다.
 * ⏸ 맨 위의 "오늘의 복습"은 Phase 3 에서 실제 큐가 들어온다.
 */
export default function Home() {
  const { t } = useTranslation();
  const { palette, spacing, typography } = useTheme();

  const { data } = useDbQuery(() => ({
    recent: listKnowledge(3),
    books: countBooks(),
    knowledge: countKnowledge(),
    due: dueCount(),
  }));

  return (
    <Screen scroll>
      <Header
        title={t('app.name')}
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('settings.title')}
            onPress={() => router.push('/settings')}
            hitSlop={12}
          >
            <Text style={[typography.label, { color: palette.textMuted }]}>{t('settings.title')}</Text>
          </Pressable>
        }
      />
      <Text style={[typography.caption, { color: palette.textMuted, marginBottom: spacing.xl }]}>
        {t('app.tagline')}
      </Text>

      {/* 🔴 저장은 1탭 거리를 지키되 **색을 낮춘다**(DESIGN_REVIEW §3).
          위치는 기능 우선순위, 색·크기는 제품 우선순위 — 다시 열었을 때의 핵심 행동은 복습이다 */}
      <Button label={t('home.cta')} variant="ghost" onPress={() => router.push('/knowledge/new')} />
      <Text
        style={[
          typography.caption,
          { color: palette.textMuted, marginTop: spacing.sm, marginBottom: spacing.xl },
        ]}
      >
        {t('knowledge.save.hint')}
      </Text>

      {/* 🔴 홈의 맨 위는 "오늘 무엇을 하면 되는가"다(§7).
          🚫 0건일 때 숫자를 강조하지 않는다 — 중립적인 문장 하나로 끝낸다(DESIGN_REVIEW §3) */}
      <Text style={[typography.label, { color: palette.textMuted, marginBottom: spacing.sm }]}>
        {t('home.today.title')}
      </Text>
      {data.due === 0 ? (
        <Text style={[typography.body, { color: palette.textMuted, marginBottom: spacing.xl }]}>
          {t('home.today.empty')}
        </Text>
      ) : (
        <Card>
          <Text style={[typography.body, { color: palette.text }]}>
            {t('home.today.count', { count: data.due })}
          </Text>
          <Button
            label={t('review.start')}
            onPress={() => router.push('/review')}
            style={{ marginTop: spacing.md }}
          />
        </Card>
      )}

      {/* 🚫 신규 사용자에게 `책 0 · 문장 0` 을 보여주지 않는다 — 성취 대시보드가 된다 */}
      {(data.books > 0 || data.knowledge > 0) && (
        <View style={[styles.row, { gap: spacing.md, marginBottom: spacing.xl }]}>
          <Button
            label={t('home.stats.books', { count: data.books })}
            variant="ghost"
            onPress={() => router.push('/books')}
            style={styles.grow}
          />
          <Button
            label={t('home.stats.knowledge', { count: data.knowledge })}
            variant="ghost"
            onPress={() => router.push('/knowledge')}
            style={styles.grow}
          />
        </View>
      )}

      <Text style={[typography.label, { color: palette.textMuted, marginBottom: spacing.sm }]}>
        {t('home.recent.title')}
      </Text>
      {data.recent.length === 0 ? (
        <Text style={[typography.body, { color: palette.textMuted }]}>{t('home.recent.empty')}</Text>
      ) : (
        data.recent.map((k) => (
          <Card key={k.id} onPress={() => router.push(`/knowledge/${k.id}`)}>
            <Text style={[typography.thought, { color: palette.text }]} numberOfLines={3}>
              {k.content}
            </Text>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  grow: { flex: 1 },
});
