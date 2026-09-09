import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Field } from '@/components/Field';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { rate, todayQueue } from '@/features/review/repo';
import { RATINGS, type ReviewRating } from '@/features/review/schedule';
import { useDbQuery } from '@/hooks/useDbQuery';
import { useTheme } from '@/theme';

/**
 * 오늘의 복습 — `docs/REVIEW_SYSTEM.md` §1 · §3 · §5.
 *
 * 🔴 **회상은 채점이 아니다**(기둥 5). 정답 비교를 하지 않고, 점수를 돌려주지 않는다.
 *    사용자가 스스로 고른 넷이 곧 다음 노출 시점의 입력값이다.
 * 🔴 **원문을 가리고 단서를 준다**(§3). 단서가 하나도 없는 카드의 처리는 §3.1 이 정했다.
 * 🚫 남은 개수를 "밀렸습니다"로 크게 말하지 않는다(§2.2).
 */
export default function Review() {
  const { t, i18n } = useTranslation();
  const { palette, spacing, typography } = useTheme();

  // 세션 동안 큐를 고정한다 — 등급을 줄 때마다 다시 읽으면 순서가 흔들린다
  const { data: queue } = useDbQuery(() => todayQueue());
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [answer, setAnswer] = useState('');

  const card = queue[index];

  if (card === undefined) {
    return (
      <Screen>
        <Header title={t('review.title')} back />
        <Text style={[typography.body, { color: palette.textMuted, marginBottom: spacing.xl }]}>
          {queue.length === 0 ? t('review.empty') : t('review.done')}
        </Text>
        {/* 🚫 빈 화면으로 끝내지 않는다(§5) — 홈으로 이어 준다 */}
        <Button label={t('review.backHome')} variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  const onRate = (rating: ReviewRating) => {
    rate(card.knowledge.id, rating, answer);
    setAnswer('');
    setRevealed(false);
    setIndex((i) => i + 1);
  };

  const savedOn = new Date(card.savedAt).toLocaleDateString(i18n.language);

  return (
    <Screen scroll>
      <Header title={t('review.title')} back />

      {/* 단서 — 있는 것부터(§3.1). 저장 시점은 언제나 있다 */}
      <Text style={[typography.caption, { color: palette.textMuted, marginBottom: spacing.md }]}>
        {t('review.savedOn', { date: savedOn })}
      </Text>

      {card.cue.kind !== 'none' && (
        <Card>
          <Text style={[typography.label, { color: palette.textMuted, marginBottom: spacing.xs }]}>
            {t(`review.cue.${card.cue.kind}`)}
          </Text>
          <Text style={[typography.thought, { color: palette.text }]}>{card.cue.text}</Text>
        </Card>
      )}

      {revealed ? (
        <Card>
          <Text style={[typography.quote, { color: palette.text }]}>{card.knowledge.content}</Text>
        </Card>
      ) : (
        <Card>
          <Text style={[typography.body, { color: palette.textMuted }]}>{t('review.prompt')}</Text>
        </Card>
      )}

      {/* 회상 답변 — 🔴 입력은 선택이다. 안 쓰고 넘어갈 수 있다(§8) */}
      {!revealed && (
        <Field
          value={answer}
          onChangeText={setAnswer}
          // 🔴 안내 문구와 같은 말을 쓰지 않는다 — 화면에 같은 문장이 두 번 나오면
          //    무엇을 하라는 것인지 오히려 흐려진다(2026-09-09 화면 확인)
          placeholder={t('review.answer')}
          multiline
          emphasis="thought"
          minHeight={80}
          maxHeight={160}
        />
      )}

      {revealed ? (
        <View style={[styles.ratings, { gap: spacing.sm }]}>
          {RATINGS.map((r) => (
            <Button
              key={r}
              label={t(`review.rating.${r}`)}
              variant="ghost"
              onPress={() => onRate(r)}
              style={styles.rating}
            />
          ))}
        </View>
      ) : (
        <Button label={t('review.reveal')} onPress={() => setRevealed(true)} />
      )}

      <Text style={[typography.caption, { color: palette.textMuted, marginTop: spacing.xl }]}>
        {t('review.count', { count: queue.length - index })}
      </Text>
      <View style={{ height: spacing.xl }} />
      {index > 0 && queue.length - index === 0 && (
        <Button label={t('common.done')} variant="ghost" onPress={() => router.back()} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  ratings: { flexDirection: 'row', flexWrap: 'wrap' },
  rating: { flexGrow: 1, flexBasis: '45%' },
});
