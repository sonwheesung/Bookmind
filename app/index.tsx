import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Divider } from '@/components/Divider';
import { Header } from '@/components/Header';
import { QuoteRow } from '@/components/QuoteRow';
import { Screen } from '@/components/Screen';
import { WeekRow } from '@/components/WeekRow';
import { displayPage } from '@/features/knowledge/compute';
import { listRecent } from '@/features/knowledge/repo';
import { listToday, toggleCheck } from '@/features/practice/repo';
import { dueCount } from '@/features/review/repo';
import { loadStats } from '@/features/stats/repo';
import { useDbQuery } from '@/hooks/useDbQuery';
import { joinMeta } from '@/lib/format';
import { useTheme } from '@/theme';

/**
 * 홈 — "오늘 무엇을 하면 되는가"(`docs/KNOWLEDGE_SYSTEM.md` §7).
 *
 * 🔴 **2026-09-09 개편**(`docs/DESIGN_REVIEW.md` §3). 고친 것은 요소 수가 아니라 **위계**다.
 *    이전에는 블록 9개가 전부 같은 무게였고 둥근 테두리 상자가 6개라
 *    무엇이 버튼이고 무엇이 내용인지 구분이 안 됐다. 지금은 네 영역이다:
 *    Header / Today / Recent / Meta.
 *
 * 🔴 **화면에 accent 는 언제나 정확히 하나다.** 복습할 것이 있으면 복습 버튼이,
 *    없으면 저장 버튼이 그 하나가 된다. 색을 없애는 게 아니라 옮긴다.
 *    ⚠ 저장 버튼의 **위치와 크기는 그대로**라 기둥 7("다시 열었을 때의 핵심 행동은 복습")도 안 깨지고,
 *    저장이 1탭 거리라는 기둥 1도 그대로다.
 */
export default function Home() {
  const { t } = useTranslation();
  const { spacing } = useTheme();

  // 🔴 `loadStats()` 가 책·문장 수를 이미 센다. 같은 것을 두 번 세지 않는다(`STATS_SYSTEM.md` §2)
  const { data, reload } = useDbQuery(() => ({
    recent: listRecent(3),
    stats: loadStats(),
    due: dueCount(),
    practices: listToday(),
  }));

  const { books, knowledge, streak } = data.stats;
  const hasDue = data.due > 0;

  // 홈 아래 조용한 링크 줄의 조각. 🔴 이 화면에서만 반복되므로 파일 안에 둔다(`docs/UI_GUIDE.md` §4)
  const metaLink = (label: string, onPress: () => void, accessibilityLabel?: string) => (
    <Pressable accessibilityLabel={accessibilityLabel} onPress={onPress} hitSlop={10}>
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
    </Pressable>
  );
  const dot = () => (
    <AppText variant="caption" tone="muted" style={{ marginHorizontal: spacing.sm }}>
      ·
    </AppText>
  );

  return (
    <Screen scroll>
      <Header
        title={t('app.name')}
        right={
          <View style={[styles.metaRow, { gap: spacing.md }]}>
            {/* 🔴 문장이 하나도 없으면 검색을 안 그린다 — 빈 방으로 가는 문이다
                (`KNOWLEDGE_SYSTEM.md` §6.6) */}
            {knowledge > 0 && (
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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('settings.title')}
              onPress={() => router.push('/settings')}
              hitSlop={12}
            >
              <AppText variant="label" tone="muted">
                {t('settings.title')}
              </AppText>
            </Pressable>
          </View>
        }
      />

      {/* ── Today ─────────────────────────────────────────────────────
          🚫 태그라인·저장 힌트를 여기 두지 않는다. 둘 다 처음 한 번 읽으면 끝인데
             매일 가장 좋은 자리를 먹고 있었다(저장 힌트는 저장 화면에 그대로 있다). */}
      <View style={{ marginBottom: spacing.section }}>
        <AppText variant="section" style={{ marginBottom: spacing.sm }}>
          {t('home.today.title')}
        </AppText>

        {hasDue ? (
          <Button
            label={t('home.today.action', { count: data.due })}
            onPress={() => router.push('/review')}
            style={{ marginBottom: spacing.md }}
          />
        ) : (
          /* 🚫 0 을 강조하지 않는다. 중립적인 문장 하나로 끝낸다(기둥 5) */
          <AppText variant="thought" tone="muted" style={{ marginBottom: spacing.lg }}>
            {t('home.today.empty')}
          </AppText>
        )}

        <Button
          label={t('home.cta')}
          variant={hasDue ? 'ghost' : 'primary'}
          onPress={() => router.push('/knowledge/new')}
        />
      </View>

      <Divider style={{ marginBottom: spacing.section }} />

      {/* ── 오늘의 실천 ────────────────────────────────────────────────
          🔴 **실천이 0개면 이 영역을 통째로 안 그린다**(`PRACTICE_SYSTEM.md` §3).
             안 만든 것이 정상이다(기둥 4). 빈 상자를 두면 그때부터 그건 할 일 목록이 된다.
          🚫 "오늘 끊깁니다" 류 문구를 붙이지 않는다(§4 · 기둥 5). */}
      {data.practices.length > 0 && (
        <View style={{ marginBottom: spacing.section }}>
          <Pressable accessibilityRole="button" onPress={() => router.push('/practice')} hitSlop={8}>
            <AppText variant="section" style={{ marginBottom: spacing.md }}>
              {t('practice.todayTitle')}
            </AppText>
          </Pressable>

          {data.practices.map((p, i) => (
            <View key={p.id} style={{ marginTop: i > 0 ? spacing.xl : 0 }}>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push(`/practice/${p.id}`)}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                <AppText variant="thought" numberOfLines={2}>
                  {p.title}
                </AppText>
              </Pressable>
              <View style={{ marginTop: spacing.sm }}>
                <WeekRow
                  cells={p.cells}
                  onToggle={(day) => {
                    // 🔴 `day` 는 누른 칸의 날짜다. "오늘"로 넘기면 아무 날이나 오늘이 된다
                    toggleCheck(p.id, day);
                    reload();
                  }}
                />
              </View>
              {p.streak > 0 && (
                <AppText variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>
                  {t('practice.streak', { count: p.streak })}
                </AppText>
              )}
            </View>
          ))}
        </View>
      )}

      {data.practices.length > 0 && <Divider style={{ marginBottom: spacing.section }} />}

      {/* ── Recent ────────────────────────────────────────────────────
          🔴 카드가 아니다. 그래도 **항목 전체가 터치 영역**이다 —
             시각적으로 카드가 아닌 것과 기능적으로 목록인 것은 다른 축이다. */}
      <AppText variant="section" style={{ marginBottom: spacing.xs }}>
        {t('home.recent.title')}
      </AppText>

      {data.recent.length === 0 ? (
        <AppText tone="muted" style={{ marginTop: spacing.sm }}>
          {t('home.recent.empty')}
        </AppText>
      ) : (
        data.recent.map((k, i) => {
          // 🚫 출처가 없으면 빈 줄을 만들지 않는다(`joinMeta` 가 '' 를 주고 `QuoteRow` 가 안 그린다)
          const source = joinMeta([
            k.bookTitle,
            k.bookAuthor,
            // 🔴 숫자일 때만 `쪽`·`p.` 을 씌운다. `3장` 에 씌우면 `3장쪽` 이 된다(§3 · compute.ts)
            displayPage(k.page, (p) => t('knowledge.pageShort', { page: p })),
          ]);
          return (
            <QuoteRow
              key={k.id}
              divided={i > 0}
              content={k.content}
              source={source}
              onPress={() => router.push(`/knowledge/${k.id}`)}
            />
          );
        })
      )}

      {/* ── Meta ──────────────────────────────────────────────────────
          🔴 상자를 걷어내되 **누를 수 있게** 남긴다. 시안은 정보로만 두자고 했는데,
             그러면 홈에서 책 목록·문장 목록으로 가는 유일한 길이 사라진다(§3 수정 채택).
          🚫 신규 사용자에게 `책 0 · 문장 0` 을 보여주지 않는다 — 성취 대시보드가 된다. */}
      {(books > 0 || knowledge > 0) && (
        <View style={[styles.metaRow, { marginTop: spacing.xl }]}>
          {metaLink(t('home.meta.books', { count: books }), () => router.push('/books'))}
          {dot()}
          {metaLink(t('home.meta.knowledge', { count: knowledge }), () => router.push('/knowledge'))}
          {dot()}
          {/* 🔴 연속일이 0 이면 `연속 0일` 이 아니라 `통계` 다(`STATS_SYSTEM.md` §4.1).
              0 을 적어 두면 다음에 "오늘 하면 1일!" 이 붙고, 그건 기둥 5 가 막는 그것이다. */}
          {metaLink(
            streak > 0 ? t('home.meta.streak', { count: streak }) : t('stats.title'),
            () => router.push('/stats'),
            t('stats.title'),
          )}
          {dot()}
          {/* 🔴 실천이 0개여도 이 줄은 남는다(`PRACTICE_SYSTEM.md` §7 "홈에서 직접 생성 경로").
              위쪽 `오늘의 실천` 블록은 0개면 사라지므로, 안 두면 만들 길이 지식 카드 하나뿐이 된다.
              🚫 조용한 글자 하나다. 만들라고 권하는 문구를 붙이지 않는다(§4). */}
          {metaLink(t('practice.title'), () => router.push('/practice'), t('practice.title'))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
});
