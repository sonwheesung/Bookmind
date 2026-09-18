import { router, useLocalSearchParams } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { IconButton } from '@/components/IconButton';
import { MonthCalendar } from '@/components/MonthCalendar';
import { Screen } from '@/components/Screen';
import { getKnowledge } from '@/features/knowledge/repo';
import { calendarBounds, parseRepeat } from '@/features/practice/compute';
import {
  getPractice,
  practiceMonth,
  removePractice,
  resumePractice,
  stopPractice,
  todayKey,
  toggleCheck,
} from '@/features/practice/repo';
import { useDbQuery } from '@/hooks/useDbQuery';
import { addMonths } from '@/lib/day';
import { confirmDestructive } from '@/lib/confirm';
import { joinMeta } from '@/lib/format';
import { useTheme } from '@/theme';

/**
 * 실천 상세 — `docs/PRACTICE_SYSTEM.md` §3 · §3.1 · §8.
 *
 * 🔄 2026-09-14 이번 주 일곱 칸을 **한 달 달력**으로 바꿨다(사용자 *"이때까지 실천했던 기록은 어떻게 되는거야?"*).
 *    지난 날도 누르면 체크된다(사용자 선택). 이번 주 칸은 실천 탭에 그대로 있다.
 * 🔄 같은 날 삭제를 위 오른쪽 휴지통으로 옮겼다(사용자 지시). 그만두기는 삭제가 아니라 본문에 남는다.
 * 🚫 성공률·달성 그래프가 없다(§4). 있는 것은 **달력과 연속일**뿐이다.
 * 🔴 연결이 끊긴 실천에는 "관련 지식 없음" 을 쓰지 않고 **아무것도 안 그린다**(§5).
 */
export default function PracticeDetail() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;
  const { t } = useTranslation();
  const { spacing } = useTheme();
  // 🔴 고른 달이 없으면 마지막 달(이번 달 · 종료했으면 종료한 달)을 보여준다
  const [month, setMonth] = useState<string | null>(null);

  const { data, reload } = useDbQuery(() => {
    const p = getPractice(id);
    return {
      p,
      source: p?.knowledgeId == null ? undefined : getKnowledge(p.knowledgeId),
    };
  });

  const p = data.p;
  if (p === undefined) {
    return (
      <Screen>
        <Header title={t('practice.title')} back />
        <AppText tone="muted">{t('practice.empty')}</AppText>
      </Screen>
    );
  }

  const today = todayKey();
  // 🔴 달 넘기기 범위는 `calendarBounds` 한 곳이다. 앞쪽 12개월(더 이른 기록이 있으면 그 달) · 마지막 달보다 뒤로 안 간다(§3.1 · §3.2)
  const bounds = calendarBounds(p.startedDay, p.endedDay, today, p.firstDoneDay);
  const shown = month === null || month < bounds.first || month > bounds.last ? bounds.last : month;
  const cells = practiceMonth(id, shown, today);

  const onToggle = (day: string) => {
    toggleCheck(id, day);
    reload();
  };

  const confirmDelete = () =>
    confirmDestructive({
      title: t('practice.deleteConfirmTitle'),
      body: t('practice.deleteConfirmBody'),
      action: t('common.delete'),
      onConfirm: () => {
        removePractice(id);
        router.back();
      },
    });

  return (
    <Screen scroll>
      <Header
        title={t('practice.title')}
        back
        right={<IconButton icon={Trash2} label={t('common.delete')} onPress={confirmDelete} />}
      />

      <AppText variant="quote" style={{ marginBottom: spacing.lg }}>
        {p.title}
      </AppText>

      <AppText variant="caption" tone="muted" style={{ marginBottom: spacing.xl }}>
        {joinMeta([
          // 🔴 반복 주기 판정은 `parseRepeat` 한 곳이다. 화면에서 문자열로 다시 가르지 않는다
          t(`practice.repeat.${parseRepeat(p.repeatRule).kind}`),
          p.state === 'running' ? null : t(`practice.state.${p.state}`),
        ])}
      </AppText>

      <MonthCalendar
        month={shown}
        cells={cells}
        canPrev={shown > bounds.first}
        canNext={shown < bounds.last}
        onPrev={() => setMonth(addMonths(shown, -1))}
        onNext={() => setMonth(addMonths(shown, 1))}
        onToggle={onToggle}
      />

      {/* 🚫 `0일 연속` 을 쓰지 않는다. 그 줄을 안 그린다(§8) */}
      {p.streak > 0 && (
        <AppText style={{ marginTop: spacing.lg }}>{t('practice.streak', { count: p.streak })}</AppText>
      )}

      {/* 🔴 연결이 없으면 아무것도 안 그린다. 없는 것을 결핍으로 보여주지 않는다(§5) */}
      {data.source !== undefined && (
        <View style={{ marginTop: spacing.section }}>
          <AppText variant="label" tone="muted" style={{ marginBottom: spacing.xs }}>
            {t('practice.fromKnowledge')}
          </AppText>
          <AppText
            variant="thought"
            tone="muted"
            numberOfLines={3}
            onPress={() => router.push(`/knowledge/${data.source?.id ?? ''}`)}
          >
            {data.source.content}
          </AppText>
        </View>
      )}

      {/* 🔴 그만두기는 삭제가 아니다. 기록은 남고 목록에서 접힌다(§2.1) */}
      <Button
        label={p.state === 'stopped' ? t('practice.resume') : t('practice.stop')}
        variant="ghost"
        onPress={() => {
          if (p.state === 'stopped') resumePractice(id);
          else stopPractice(id);
          reload();
        }}
        style={{ marginTop: spacing.section, marginBottom: spacing.xl }}
      />
    </Screen>
  );
}
