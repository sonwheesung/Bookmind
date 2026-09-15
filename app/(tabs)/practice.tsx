import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { IconButton } from '@/components/IconButton';
import { Screen } from '@/components/Screen';
import { WeekRow } from '@/components/WeekRow';
import { parseRepeat } from '@/features/practice/compute';
import { listAll, listToday, toggleCheck, type PracticeCard } from '@/features/practice/repo';
import { useDbQuery } from '@/hooks/useDbQuery';
import { joinMeta } from '@/lib/format';
import { useTheme } from '@/theme';

/**
 * 실천 탭 — `docs/PRACTICE_SYSTEM.md` §3 · §8 · 결정 #26.
 *
 * 🔄 2026-09-14 홈의 "오늘의 실천"(월~일 칸)을 여기로 옮겼다. 위는 오늘 체크할 것, 아래는 나머지다.
 * 🔄 같은 날 실천 만들기를 위 오른쪽 `+` 로 옮겼다(사용자 지시). 지난 기록은 실천 상세의 달력에 있다(§3.1).
 * 🚫 성공률·달성 그래프를 두지 않는다(§4). 실천은 평가 대상이 아니다.
 * 🔴 `종료됨` 은 저장된 값이 아니라 **오늘과 견준 결과**다(§2.1).
 */
export default function PracticeTab() {
  const { t } = useTranslation();
  const { spacing } = useTheme();

  const { data, reload } = useDbQuery(() => ({ today: listToday(), all: listAll() }));

  const todayIds = new Set(data.today.map((p) => p.id));
  // 아직 시작 전인 실천 — 오늘 칸에는 없고 끝난 것도 아니다
  const upcoming = data.all.filter(
    (p) => !todayIds.has(p.id) && p.state !== 'ended' && p.state !== 'stopped',
  );
  const closed = data.all.filter((p) => p.state === 'ended' || p.state === 'stopped');

  const row = (p: PracticeCard) => (
    <Card key={p.id} onPress={() => router.push(`/practice/${p.id}`)}>
      <AppText variant="thought" numberOfLines={3}>
        {p.title}
      </AppText>
      <AppText variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>
        {joinMeta([
          // 🔴 반복 주기 판정은 `parseRepeat` 한 곳이다. 화면에서 문자열로 다시 가르지 않는다
          t(`practice.repeat.${parseRepeat(p.repeatRule).kind}`),
          p.state === 'running' ? null : t(`practice.state.${p.state}`),
          // 🚫 연속일이 0 이면 그 조각을 아예 안 붙인다(§8)
          p.streak > 0 ? t('practice.streak', { count: p.streak }) : null,
        ])}
      </AppText>
    </Card>
  );

  return (
    <Screen scroll tab>
      <Header
        title={t('practice.title')}
        right={<IconButton icon={Plus} label={t('practice.create')} onPress={() => router.push('/practice/new')} />}
      />

      {data.all.length === 0 ? (
        /* 🔴 실천이 0개인 것은 결핍이 아니다(기둥 4). 만들라고 밀지 않는다 */
        <AppText tone="muted">{t('practice.empty')}</AppText>
      ) : (
        <>
          {/* ── 오늘의 실천 ────────────────────────────────────────────
              🔴 **진행 중인 실천이 0개면 이 절을 통째로 안 그린다**(§3). 빈 상자를 두면 할 일 목록이 된다.
              🚫 "오늘 끊깁니다" 류 문구를 붙이지 않는다(§4 · 기둥 5). */}
          {data.today.length > 0 && (
            <View style={{ marginBottom: spacing.section }}>
              <AppText variant="section" style={{ marginBottom: spacing.md }}>
                {t('practice.todayTitle')}
              </AppText>

              {/* 🔄 2026-09-15 관리자 수정사항 #2 · #3 — 실천마다 **카드 하나**로 감싸고, 상세(기록 달력)로 가는
                  **글자 링크**를 아래 오른쪽에 둔다. 제목만 눌리던 때는 눌린다는 표시가 없어 달력을 못 찾았다.
                  🔴 카드 전체를 누르게 하지 않는다. 요일 칸을 누르다 상세로 넘어가면 체크가 안 된다 */}
              {data.today.map((p) => {
                const open = () => router.push(`/practice/${p.id}`);
                return (
                  <Card key={p.id}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={open}
                      hitSlop={spacing.sm}
                      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                    >
                      <AppText variant="thought" numberOfLines={2}>
                        {p.title}
                      </AppText>
                    </Pressable>
                    <View style={{ marginTop: spacing.md }}>
                      <WeekRow
                        cells={p.cells}
                        onToggle={(day) => {
                          // 🔴 `day` 는 누른 칸의 날짜다. "오늘"로 넘기면 아무 날이나 오늘이 된다
                          toggleCheck(p.id, day);
                          reload();
                        }}
                      />
                    </View>
                    <View style={[styles.footer, { marginTop: spacing.md }]}>
                      {/* 🚫 연속일이 0 이면 왼쪽을 비운다(§8). 링크는 늘 오른쪽이다 */}
                      <AppText variant="caption" tone="muted">
                        {p.streak > 0 ? t('practice.streak', { count: p.streak }) : ''}
                      </AppText>
                      {/* 🔴 색은 accent 가 아니라 글자색이다. 오늘의 실천이 여럿이면 링크도 여럿이라 accent 가 화면에 여럿 생긴다 */}
                      <Pressable
                        accessibilityRole="link"
                        onPress={open}
                        hitSlop={spacing.sm}
                        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                      >
                        <AppText variant="label">
                          {t('practice.openHistory')}
                        </AppText>
                      </Pressable>
                    </View>
                  </Card>
                );
              })}
            </View>
          )}

          {upcoming.map(row)}

          {closed.length > 0 && (
            <View style={{ marginTop: spacing.xl }}>
              <AppText variant="section" style={{ marginBottom: spacing.sm }}>
                {t('practice.closedTitle')}
              </AppText>
              {closed.map(row)}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
