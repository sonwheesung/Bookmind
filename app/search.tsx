import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Field } from '@/components/Field';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { listRecent } from '@/features/knowledge/repo';
import { searchKnowledge, type MatchAxis } from '@/features/search/repo';
import { useDbQuery } from '@/hooks/useDbQuery';
import { useTheme } from '@/theme';

/** 디바운스 350ms — `docs/KNOWLEDGE_SYSTEM.md` §6. 한 글자마다 조회하면 목록이 떨린다 */
const DEBOUNCE_MS = 350;

/**
 * 검색 — `docs/KNOWLEDGE_SYSTEM.md` §6.6.
 *
 * 🔴 **결과 단위는 언제나 지식 카드다**(§6.1). 태그를 쳐도 태그 목록이 아니라 카드가 나온다.
 * 🔴 **어느 축에서 맞았는지 함께 보여준다.** 원문에 없는 말로 카드가 나오면 사용자는
 *    "왜 이게 나왔지"부터 해석하게 된다. 그건 검색이 아니라 수수께끼다.
 * 🔴 와일드카드 이스케이프는 이 파일에 없다. `features/search/sql.ts` 가 하고 가드가 잰다(§6.2).
 */
export default function SearchScreen() {
  const { t } = useTranslation();
  const { palette, spacing, typography } = useTheme();

  const [term, setTerm] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const id = setTimeout(() => setQuery(term), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [term]);

  const hits = useMemo(() => searchKnowledge(query), [query]);

  // 빈 검색어 자리는 빈 화면이 아니라 최근 저장이다(§6.4)
  const { data: recent } = useDbQuery(() => listRecent(5));

  const searching = query.trim() !== '';
  const divider = { height: StyleSheet.hairlineWidth, backgroundColor: palette.border };
  const meta = [typography.caption, { color: palette.textMuted }];

  const axisLabel = (axes: readonly MatchAxis[]): string =>
    axes.map((a) => t(`search.axis.${a}`)).join(' · ');

  return (
    <Screen scroll>
      <Header title={t('search.title')} back />

      <Field value={term} onChangeText={setTerm} placeholder={t('search.placeholder')} autoFocus />

      {!searching ? (
        <>
          <Text style={[typography.section, { color: palette.text, marginBottom: spacing.xs }]}>
            {t('home.recent.title')}
          </Text>
          {recent.map((k, i) => (
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
              </Pressable>
            </View>
          ))}
        </>
      ) : hits.length === 0 ? (
        /* 🚫 "다시 검색해 보세요" 같은 지시를 붙이지 않는다. 한 줄로 끝낸다 */
        <Text style={[typography.body, { color: palette.textMuted }]}>{t('search.empty')}</Text>
      ) : (
        /* 🚫 결과 개수를 크게 띄우지 않는다. `12건` 은 성취가 아니다 */
        hits.map((h, i) => (
          <View key={h.id}>
            {i > 0 && <View style={divider} />}
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/knowledge/${h.id}`)}
              style={({ pressed }) => ({ paddingVertical: spacing.lg, opacity: pressed ? 0.6 : 1 })}
            >
              <Text style={[typography.label, { color: palette.textMuted }]}>{axisLabel(h.axes)}</Text>
              <Text
                style={[typography.quote, { color: palette.text, marginTop: spacing.xs }]}
                numberOfLines={3}
              >
                {h.content}
              </Text>
              {h.bookTitle !== null && (
                <Text style={[...meta, { marginTop: spacing.xs }]} numberOfLines={1}>
                  {h.bookTitle}
                </Text>
              )}
            </Pressable>
          </View>
        ))
      )}
    </Screen>
  );
}
