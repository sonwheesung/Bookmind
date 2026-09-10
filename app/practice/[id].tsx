import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { WeekRow } from '@/components/WeekRow';
import { getKnowledge } from '@/features/knowledge/repo';
import {
  getPractice,
  removePractice,
  resumePractice,
  stopPractice,
  toggleCheck,
} from '@/features/practice/repo';
import { useDbQuery } from '@/hooks/useDbQuery';
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
  const { palette, spacing, typography } = useTheme();

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
        <Text style={[typography.body, { color: palette.textMuted }]}>{t('practice.empty')}</Text>
      </Screen>
    );
  }

  const onToggle = (day: string) => {
    toggleCheck(id, day);
    reload();
  };

  const confirmDelete = () => {
    Alert.alert(t('practice.deleteConfirmTitle'), t('practice.deleteConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          removePractice(id);
          router.back();
        },
      },
    ]);
  };

  return (
    <Screen scroll>
      <Header title={t('practice.title')} back />

      <Text style={[typography.quote, { color: palette.text, marginBottom: spacing.lg }]}>{p.title}</Text>

      <Text style={[typography.caption, { color: palette.textMuted, marginBottom: spacing.xl }]}>
        {[
          t(`practice.repeat.${p.repeatRule.startsWith('weekly:') ? 'weekly' : p.repeatRule}`),
          p.state === 'running' ? null : t(`practice.state.${p.state}`),
        ]
          .filter((v) => v !== null)
          .join(' · ')}
      </Text>

      <WeekRow cells={p.cells} onToggle={onToggle} />

      {/* 🚫 `0일 연속` 을 쓰지 않는다. 그 줄을 안 그린다(§8) */}
      {p.streak > 0 && (
        <Text style={[typography.body, { color: palette.text, marginTop: spacing.lg }]}>
          {t('practice.streak', { count: p.streak })}
        </Text>
      )}

      {/* 🔴 연결이 없으면 아무것도 안 그린다. 없는 것을 결핍으로 보여주지 않는다(§5) */}
      {data.source !== undefined && (
        <View style={{ marginTop: spacing.section }}>
          <Text style={[typography.label, { color: palette.textMuted, marginBottom: spacing.xs }]}>
            {t('practice.fromKnowledge')}
          </Text>
          <Text
            style={[typography.thought, { color: palette.textMuted }]}
            numberOfLines={3}
            onPress={() => router.push(`/knowledge/${data.source?.id ?? ''}`)}
          >
            {data.source.content}
          </Text>
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
