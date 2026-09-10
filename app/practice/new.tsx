import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Field } from '@/components/Field';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { getKnowledge } from '@/features/knowledge/repo';
import { createPractice, todayKey } from '@/features/practice/repo';
import { useTheme } from '@/theme';

const WEEK = [1, 2, 3, 4, 5, 6, 7] as const;
const WEEK_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

/**
 * 실천 만들기 — `docs/PRACTICE_SYSTEM.md` §1 · §2.
 *
 * 🔴 **사용자가 [만들기] 를 눌러야 생긴다**(기둥 3). AI 제안이 들어와도 문장은 고칠 수 있고,
 *    고치지 않고 그대로 눌러도 그것은 **사용자의 결정**이다.
 * 🔴 원문과 실천은 **다른 문장이어도 된다**(기획서 §12). 그래서 원문을 미리 채우지 않고
 *    출처로만 보여준다. 채워 두면 사용자가 그 문장을 고치는 대신 그냥 저장한다.
 */
export default function NewPractice() {
  const params = useLocalSearchParams<{ knowledgeId?: string }>();
  const knowledgeId = params.knowledgeId ?? null;
  const { t } = useTranslation();
  const { palette, spacing, typography } = useTheme();

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

  const toggleDay = (n: number) =>
    setDays((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });

  return (
    <Screen scroll>
      <Header title={t('practice.create')} back />

      {source !== undefined && (
        /* 출처만 보여준다. 🔴 실천 문장에 원문을 미리 채우지 않는다 */
        <View style={{ marginBottom: spacing.lg }}>
          <Text style={[typography.label, { color: palette.textMuted, marginBottom: spacing.xs }]}>
            {t('practice.fromKnowledge')}
          </Text>
          <Text style={[typography.quote, { color: palette.textMuted }]} numberOfLines={3}>
            {source.content}
          </Text>
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

      <Text style={[typography.label, { color: palette.textMuted, marginBottom: spacing.sm }]}>
        {t('practice.repeatLabel')}
      </Text>
      <View style={[styles.chips, { gap: spacing.sm, marginBottom: spacing.lg }]}>
        {(['daily', 'weekdays', 'weekly'] as const).map((k) => (
          <Chip key={k} label={t(`practice.repeat.${k}`)} active={kind === k} onPress={() => setKind(k)} />
        ))}
      </View>

      {kind === 'weekly' && (
        <View style={[styles.chips, { gap: spacing.sm, marginBottom: spacing.lg }]}>
          {WEEK.map((n, i) => (
            <Chip
              key={n}
              label={t(`practice.weekday.${WEEK_KEYS[i] ?? 'mon'}`)}
              active={days.has(n)}
              onPress={() => toggleDay(n)}
            />
          ))}
        </View>
      )}

      {/* 시작일은 오늘이다(§2 기본값). 🚫 날짜 고르기를 v1 에 넣지 않는다.
          "매월 셋째 화요일" 로 가는 길의 첫 걸음이고, 우리는 습관 앱이 아니다 */}
      <Text style={[typography.caption, { color: palette.textMuted, marginBottom: spacing.xl }]}>
        {t('practice.startsToday')}
      </Text>

      <Button label={t('practice.createAction')} onPress={save} disabled={!canSave} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
});
