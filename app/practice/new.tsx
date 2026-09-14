import { router, useLocalSearchParams } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Chip } from '@/components/Chip';
import { ChipRow } from '@/components/ChipRow';
import { Field } from '@/components/Field';
import { Header } from '@/components/Header';
import { IconButton } from '@/components/IconButton';
import { Screen } from '@/components/Screen';
import { getKnowledge } from '@/features/knowledge/repo';
import { createPractice, todayKey } from '@/features/practice/repo';
import { WEEKDAY_KEYS } from '@/lib/day';
import { toggled } from '@/lib/set';
import { useTheme } from '@/theme';

/**
 * 실천 만들기 — `docs/PRACTICE_SYSTEM.md` §1 · §2.
 *
 * 🔴 **사용자가 [만들기](위 오른쪽 ✓)를 눌러야 생긴다**(기둥 3). AI 제안이 들어와도 문장은 고칠 수 있고,
 *    고치지 않고 그대로 눌러도 그것은 **사용자의 결정**이다.
 * 🔴 원문과 실천은 **다른 문장이어도 된다**(기획서 §12). 그래서 원문을 미리 채우지 않고
 *    출처로만 보여준다. 채워 두면 사용자가 그 문장을 고치는 대신 그냥 저장한다.
 * 🔄 2026-09-14 만들기 버튼을 위 오른쪽 ✓ 로 옮겼다(사용자 지시).
 */
export default function NewPractice() {
  const params = useLocalSearchParams<{ knowledgeId?: string }>();
  const knowledgeId = params.knowledgeId ?? null;
  const { t } = useTranslation();
  const { spacing } = useTheme();

  const source = knowledgeId === null ? undefined : getKnowledge(knowledgeId);

  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'daily' | 'weekdays' | 'weekly'>('daily');
  const [days, setDays] = useState<ReadonlySet<number>>(new Set([1, 3, 5]));

  const rule = kind === 'weekly' ? `weekly:${[...days].sort((a, b) => a - b).join(',')}` : kind;
  const canSave = title.trim() !== '' && (kind !== 'weekly' || days.size > 0);

  const save = () => {
    if (!canSave) return;
    createPractice({
      title,
      repeatRule: rule,
      startedDay: todayKey(),
      knowledgeId,
    });
    router.back();
  };

  const toggleDay = (n: number) => setDays((prev) => toggled(prev, n));

  return (
    <Screen scroll>
      <Header
        title={t('practice.create')}
        back
        right={<IconButton icon={Check} label={t('practice.createAction')} onPress={save} disabled={!canSave} />}
      />

      {source !== undefined && (
        /* 출처만 보여준다. 🔴 실천 문장에 원문을 미리 채우지 않는다 */
        <View style={{ marginBottom: spacing.lg }}>
          <AppText variant="label" tone="muted" style={{ marginBottom: spacing.xs }}>
            {t('practice.fromKnowledge')}
          </AppText>
          <AppText variant="quote" tone="muted" numberOfLines={3}>
            {source.content}
          </AppText>
        </View>
      )}

      <Field
        label={t('practice.titleLabel')}
        value={title}
        onChangeText={setTitle}
        placeholder={t('practice.titlePlaceholder')}
        emphasis="thought"
        multiline
        minHeight={88}
        maxHeight={200}
        autoFocus
      />

      <AppText variant="label" tone="muted" style={{ marginBottom: spacing.sm }}>
        {t('practice.repeatLabel')}
      </AppText>
      <ChipRow style={{ marginBottom: spacing.lg }}>
        {(['daily', 'weekdays', 'weekly'] as const).map((k) => (
          <Chip key={k} label={t(`practice.repeat.${k}`)} active={kind === k} onPress={() => setKind(k)} />
        ))}
      </ChipRow>

      {/* 🔴 ISO 요일 번호는 인덱스 + 1 이다(월=1). `weekly:1,3,5` 가 월·수·금이 된다 */}
      {kind === 'weekly' && (
        <ChipRow style={{ marginBottom: spacing.lg }}>
          {WEEKDAY_KEYS.map((key, i) => (
            <Chip
              key={key}
              label={t(`practice.weekday.${key}`)}
              active={days.has(i + 1)}
              onPress={() => toggleDay(i + 1)}
            />
          ))}
        </ChipRow>
      )}

      {/* 시작일은 오늘이다(§2 기본값). 🚫 날짜 고르기를 v1 에 넣지 않는다.
          "매월 셋째 화요일" 로 가는 길의 첫 걸음이고, 우리는 습관 앱이 아니다 */}
      <AppText variant="caption" tone="muted" style={{ marginBottom: spacing.xl }}>
        {t('practice.startsToday')}
      </AppText>
    </Screen>
  );
}
