import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { WeekRow } from '@/components/WeekRow';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { listRecent } from '@/features/knowledge/repo';
import { listToday, toggleCheck } from '@/features/practice/repo';
import { dueCount } from '@/features/review/repo';
import { loadStats } from '@/features/stats/repo';
import { useDbQuery } from '@/hooks/useDbQuery';
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
  const { palette, spacing, typography } = useTheme();

  // 🔴 `loadStats()` 가 책·문장 수를 이미 센다. 같은 것을 두 번 세지 않는다(`STATS_SYSTEM.md` §2)
  const { data, reload } = useDbQuery(() => ({
    recent: listRecent(3),
    stats: loadStats(),
    due: dueCount(),
    practices: listToday(),
  }));

  const { books, knowledge, streak } = data.stats;
  const hasDue = data.due > 0;
  const divider = { height: StyleSheet.hairlineWidth, backgroundColor: palette.border };
  const meta = [typography.caption, { color: palette.textMuted }];

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
                <Text style={[typography.label, { color: palette.textMuted }]}>{t('search.title')}</Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('settings.title')}
              onPress={() => router.push('/settings')}
              hitSlop={12}
            >
              <Text style={[typography.label, { color: palette.textMuted }]}>{t('settings.title')}</Text>
            </Pressable>
          </View>
        }
      />

      {/* ── Today ─────────────────────────────────────────────────────
          🚫 태그라인·저장 힌트를 여기 두지 않는다. 둘 다 처음 한 번 읽으면 끝인데
             매일 가장 좋은 자리를 먹고 있었다(저장 힌트는 저장 화면에 그대로 있다). */}
      <View style={{ marginBottom: spacing.section }}>
        <Text style={[typography.section, { color: palette.text, marginBottom: spacing.sm }]}>
          {t('home.today.title')}
        </Text>

        {hasDue ? (
          <Button
            label={t('home.today.action', { count: data.due })}
            onPress={() => router.push('/review')}
            style={{ marginBottom: spacing.md }}
          />
        ) : (
          /* 🚫 0 을 강조하지 않는다. 중립적인 문장 하나로 끝낸다(기둥 5) */
          <Text style={[typography.thought, { color: palette.textMuted, marginBottom: spacing.lg }]}>
            {t('home.today.empty')}
          </Text>
        )}

        <Button
          label={t('home.cta')}
          variant={hasDue ? 'ghost' : 'primary'}
          onPress={() => router.push('/knowledge/new')}
        />
      </View>

      <View style={[divider, { marginBottom: spacing.section }]} />

      {/* ── 오늘의 실천 ────────────────────────────────────────────────
          🔴 **실천이 0개면 이 영역을 통째로 안 그린다**(`PRACTICE_SYSTEM.md` §3).
             안 만든 것이 정상이다(기둥 4). 빈 상자를 두면 그때부터 그건 할 일 목록이 된다.
          🚫 "오늘 끊깁니다" 류 문구를 붙이지 않는다(§4 · 기둥 5). */}
      {data.practices.length > 0 && (
        <View style={{ marginBottom: spacing.section }}>
          <Pressable accessibilityRole="button" onPress={() => router.push('/practice')} hitSlop={8}>
            <Text style={[typography.section, { color: palette.text, marginBottom: spacing.md }]}>
              {t('practice.todayTitle')}
            </Text>
          </Pressable>

          {data.practices.map((p, i) => (
            <View key={p.id} style={{ marginTop: i > 0 ? spacing.xl : 0 }}>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push(`/practice/${p.id}`)}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                <Text style={[typography.thought, { color: palette.text }]} numberOfLines={2}>
                  {p.title}
                </Text>
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
                <Text style={[...meta, { marginTop: spacing.sm }]}>
                  {t('practice.streak', { count: p.streak })}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}

      {data.practices.length > 0 && <View style={[divider, { marginBottom: spacing.section }]} />}

      {/* ── Recent ────────────────────────────────────────────────────
          🔴 카드가 아니다. 그래도 **항목 전체가 터치 영역**이다 —
             시각적으로 카드가 아닌 것과 기능적으로 목록인 것은 다른 축이다. */}
      <Text style={[typography.section, { color: palette.text, marginBottom: spacing.xs }]}>
        {t('home.recent.title')}
      </Text>

      {data.recent.length === 0 ? (
        <Text style={[typography.body, { color: palette.textMuted, marginTop: spacing.sm }]}>
          {t('home.recent.empty')}
        </Text>
      ) : (
        data.recent.map((k, i) => {
          // 🚫 출처가 없으면 빈 줄을 만들지 않는다
          const source = [
            k.bookTitle,
            k.bookAuthor,
            k.page === null ? null : t('knowledge.pageShort', { page: k.page }),
          ]
            .filter((v) => v !== null && v !== '')
            .join(' · ');
          return (
            <View key={k.id}>
              {i > 0 && <View style={divider} />}
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push(`/knowledge/${k.id}`)}
                style={({ pressed }) => ({ paddingVertical: spacing.lg, opacity: pressed ? 0.6 : 1 })}
              >
                <Text style={[typography.quote, { color: palette.text }]} numberOfLines={3}>
                  {k.content}
                </Text>
                {source !== '' && (
                  <Text style={[...meta, { marginTop: spacing.xs }]} numberOfLines={1}>
                    {source}
                  </Text>
                )}
              </Pressable>
            </View>
          );
        })
      )}

      {/* ── Meta ──────────────────────────────────────────────────────
          🔴 상자를 걷어내되 **누를 수 있게** 남긴다. 시안은 정보로만 두자고 했는데,
             그러면 홈에서 책 목록·문장 목록으로 가는 유일한 길이 사라진다(§3 수정 채택).
          🚫 신규 사용자에게 `책 0 · 문장 0` 을 보여주지 않는다 — 성취 대시보드가 된다. */}
      {(books > 0 || knowledge > 0) && (
        <View style={[styles.metaRow, { marginTop: spacing.xl }]}>
          <Pressable onPress={() => router.push('/books')} hitSlop={10}>
            <Text style={meta}>{t('home.meta.books', { count: books })}</Text>
          </Pressable>
          <Text style={[...meta, { marginHorizontal: spacing.sm }]}>·</Text>
          <Pressable onPress={() => router.push('/knowledge')} hitSlop={10}>
            <Text style={meta}>{t('home.meta.knowledge', { count: knowledge })}</Text>
          </Pressable>
          <Text style={[...meta, { marginHorizontal: spacing.sm }]}>·</Text>
          {/* 🔴 연속일이 0 이면 `연속 0일` 이 아니라 `통계` 다(`STATS_SYSTEM.md` §4.1).
              0 을 적어 두면 다음에 "오늘 하면 1일!" 이 붙고, 그건 기둥 5 가 막는 그것이다. */}
          <Pressable accessibilityLabel={t('stats.title')} onPress={() => router.push('/stats')} hitSlop={10}>
            <Text style={meta}>
              {streak > 0 ? t('home.meta.streak', { count: streak }) : t('stats.title')}
            </Text>
          </Pressable>
          <Text style={[...meta, { marginHorizontal: spacing.sm }]}>·</Text>
          {/* 🔴 실천이 0개여도 이 줄은 남는다(`PRACTICE_SYSTEM.md` §7 "홈에서 직접 생성 경로").
              위쪽 `오늘의 실천` 블록은 0개면 사라지므로, 안 두면 만들 길이 지식 카드 하나뿐이 된다.
              🚫 조용한 글자 하나다. 만들라고 권하는 문구를 붙이지 않는다(§4). */}
          <Pressable
            accessibilityLabel={t('practice.title')}
            onPress={() => router.push('/practice')}
            hitSlop={10}
          >
            <Text style={meta}>{t('practice.title')}</Text>
          </Pressable>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
});
