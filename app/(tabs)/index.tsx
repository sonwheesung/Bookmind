import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AdBanner } from '@/components/AdBanner';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Divider } from '@/components/Divider';
import { QuoteRow } from '@/components/QuoteRow';
import { Screen } from '@/components/Screen';
import { displayPage } from '@/features/knowledge/compute';
import { listRecent } from '@/features/knowledge/repo';
import { dueCount } from '@/features/review/repo';
import { useDbQuery } from '@/hooks/useDbQuery';
import { joinMeta } from '@/lib/format';
import { useTheme } from '@/theme';

/**
 * 홈 탭 — "오늘 무엇을 하면 되는가"(`docs/KNOWLEDGE_SYSTEM.md` §7 · 결정 #26).
 *
 * 🔄 **2026-09-14 하단 탭으로 나눴다**(사용자 지시 *"홈 화면에 다 몰려있어서 쫌 보기 힘들다"*).
 *    홈에 남은 것은 둘이다: Today(복습 · 저장) / Recent.
 *    오늘의 실천은 실천 탭으로, 책·문장·통계·실천 링크 줄과 헤더의 검색·설정은 탭으로 옮겼다.
 *    🚫 앱 이름 헤더도 없다(같은 날 사용자 지시).
 *
 * 🔴 **화면에 accent 는 언제나 정확히 하나다.** 복습할 것이 있으면 복습 버튼이,
 *    없으면 저장 버튼이 그 하나가 된다. 색을 없애는 게 아니라 옮긴다.
 *    ⚠ 저장 버튼의 **위치와 크기는 그대로**라 기둥 7("다시 열었을 때의 핵심 행동은 복습")도 안 깨지고,
 *    저장이 1탭 거리라는 기둥 1도 그대로다.
 */
export default function Home() {
  const { t } = useTranslation();
  const { spacing } = useTheme();

  const { data } = useDbQuery(() => ({
    recent: listRecent(3),
    due: dueCount(),
  }));

  const hasDue = data.due > 0;

  return (
    <Screen scroll tab footer={<AdBanner />}>
      {/* ── Today ─────────────────────────────────────────────────────
          🚫 태그라인·저장 힌트를 여기 두지 않는다. 둘 다 처음 한 번 읽으면 끝인데
             매일 가장 좋은 자리를 먹고 있었다(저장 힌트는 저장 화면에 그대로 있다). */}
      <View style={{ marginBottom: spacing.section }}>
        <AppText variant="section" style={{ marginBottom: spacing.sm }}>
          {t('home.today.title')}
        </AppText>

        {data.due > 0 ? (
          <Button
            label={t('home.today.action', { count: data.due })}
            onPress={() => router.push('/review')}
            size="lg"
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
          // 🔄 2026-09-14 두 버튼을 조금 높였다(사용자 지시 · `DESIGN_REVIEW.md` §3)
          size="lg"
          onPress={() => router.push('/knowledge/new')}
        />
      </View>

      <Divider style={{ marginBottom: spacing.section }} />

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
    </Screen>
  );
}
