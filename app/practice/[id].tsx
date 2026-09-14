import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { WeekRow } from '@/components/WeekRow';
import { getKnowledge } from '@/features/knowledge/repo';
import { parseRepeat } from '@/features/practice/compute';
import {
  getPractice,
  removePractice,
  resumePractice,
  stopPractice,
  toggleCheck,
} from '@/features/practice/repo';
import { useDbQuery } from '@/hooks/useDbQuery';
import { confirmDestructive } from '@/lib/confirm';
import { joinMeta } from '@/lib/format';
import { useTheme } from '@/theme';

/**
 * 실천 상세 — `docs/PRACTICE_SYSTEM.md` §3 · §8.
 *
 * 🚫 성공률·달성 그래프가 없다(§4). 있는 것은 **이번 주 일곱 칸과 연속일**뿐이다.
 * 🔴 연결이 끊긴 실천에는 "관련 지식 없음" 을 쓰지 않고 **아무것도 안 그린다**(§5).
 */
export default function PracticeDetail() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;
  const { t } = useTranslation();
  const { spacing } = useTheme();

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
      <Header title={t('practice.title')} back />

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

      <WeekRow cells={p.cells} onToggle={onToggle} />

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

      <View style={{ marginTop: spacing.section, gap: spacing.md }}>
        {/* 🔴 그만두기는 삭제가 아니다. 기록은 남고 목록에서 접힌다(§2.1) */}
        <Button
          label={p.state === 'stopped' ? t('practice.resume') : t('practice.stop')}
          variant="ghost"
          onPress={() => {
            if (p.state === 'stopped') resumePractice(id);
            else stopPractice(id);
            reload();
          }}
        />
        <Button label={t('common.delete')} variant="danger" onPress={confirmDelete} />
      </View>
    </Screen>
  );
}
