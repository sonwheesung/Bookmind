import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Field } from '@/components/Field';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { parsePages, progressPercent } from '@/features/books/progress';
import { bookCounts, getBook, removeBook, renameBook, setBookStatus } from '@/features/books/repo';
import { listKnowledgeOfBook } from '@/features/knowledge/repo';
import { BOOK_STATUSES, type BookStatus } from '@/features/types';
import { useDbQuery } from '@/hooks/useDbQuery';
import { useTheme } from '@/theme';

/**
 * 책 상세 = **그 책에서 나온 지식의 중심**(`docs/KNOWLEDGE_SYSTEM.md` §4.2).
 *
 * 🔴 집계 넷은 파생값이다 — 저장하지 않고 매번 센다.
 * 🔴 삭제 확인 문구에 "문장 N개는 그대로 남습니다"를 **반드시** 넣는다(§4.3).
 *    캐스케이드 삭제가 아니라는 사실을 사용자가 누르기 전에 알아야 한다.
 */
export default function BookDetail() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;
  const { t } = useTranslation();
  const { palette, radius, spacing, typography } = useTheme();

  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftAuthor, setDraftAuthor] = useState('');
  const [draftTotal, setDraftTotal] = useState('');
  const [draftRead, setDraftRead] = useState('');

  const { data, reload } = useDbQuery(() => {
    const row = getBook(id);
    return {
      row,
      counts: row === undefined ? undefined : bookCounts(id),
      passages: row === undefined ? [] : listKnowledgeOfBook(id),
    };
  });

  if (data.row === undefined || data.counts === undefined) {
    return (
      <Screen>
        <Header title={t('books.list.title')} back />
        <Text style={[typography.body, { color: palette.textMuted }]}>{t('books.list.empty')}</Text>
      </Screen>
    );
  }
  const { row, counts } = data;
  const percent = progressPercent(row);

  const confirmDelete = () => {
    Alert.alert(t('books.delete.title'), t('books.delete.body', { count: counts.knowledge }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          removeBook(id);
          router.back();
        },
      },
    ]);
  };

  const change = (status: BookStatus) => {
    setBookStatus(id, status);
    reload();
  };

  const startEdit = () => {
    setDraftTitle(row.title);
    setDraftAuthor(row.author ?? '');
    setDraftTotal(row.total_pages === null ? '' : String(row.total_pages));
    setDraftRead(row.read_pages === null ? '' : String(row.read_pages));
    setEditing(true);
  };

  const applyEdit = () => {
    renameBook(id, {
      title: draftTitle,
      author: draftAuthor,
      totalPages: parsePages(draftTotal),
      readPages: parsePages(draftRead),
    });
    setEditing(false);
    reload();
  };

  return (
    <Screen scroll>
      <Header title={row.title} back />

      {editing ? (
        <>
          <Field label={t('books.field.title')} value={draftTitle} onChangeText={setDraftTitle} />
          <Field label={t('books.field.author')} value={draftAuthor} onChangeText={setDraftAuthor} />
          <Field
            label={t('books.field.totalPages')}
            value={draftTotal}
            onChangeText={setDraftTotal}
            keyboardType="number-pad"
          />
          <Field
            label={t('books.field.readPages')}
            value={draftRead}
            onChangeText={setDraftRead}
            keyboardType="number-pad"
          />
          <View style={[styles.row, { gap: spacing.md, marginBottom: spacing.xl }]}>
            {/* 🔴 제목이 비면 저장을 잠근다 — 지식 상세에서 이 잠금이 빠져 조용한 먹통이 났었다
                (2026-09-09 · docs/EDGE_CASES.md §2). 같은 실수를 여기서 되풀이하지 않는다 */}
            <Button
              label={t('common.save')}
              onPress={applyEdit}
              disabled={draftTitle.trim() === ''}
              style={styles.grow}
            />
            <Button
              label={t('common.cancel')}
              variant="ghost"
              onPress={() => setEditing(false)}
              style={styles.grow}
            />
          </View>
        </>
      ) : (
        <>
          {row.author !== null && (
            <Text style={[typography.body, { color: palette.textMuted, marginBottom: spacing.sm }]}>
              {row.author}
            </Text>
          )}
          <Button
            label={t('common.edit')}
            variant="ghost"
            onPress={startEdit}
            style={{ marginBottom: spacing.lg }}
          />
        </>
      )}

      {/* ⚠ 상태 전이를 자동화하지 않는다 — 사용자가 누른 것만 바뀐다(§4.1) */}
      <View style={[styles.chips, { gap: spacing.sm, marginBottom: spacing.xl }]}>
        {BOOK_STATUSES.map((s) => {
          const active = s === row.status;
          return (
            <Pressable
              key={s}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => change(s)}
              style={{
                backgroundColor: active ? palette.accent : palette.surface,
                borderColor: active ? palette.accent : palette.border,
                borderWidth: 1,
                borderRadius: radius.full,
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.md,
              }}
            >
              <Text style={[typography.label, { color: active ? palette.onAccent : palette.text }]}>
                {t(`books.status.${s}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* 🔴 모르면 아예 안 그린다 — 0% 는 "안 읽었다"이지 "모른다"가 아니다(§4.4) */}
      {percent !== null && (
        <View style={{ marginBottom: spacing.lg }}>
          <View style={[styles.progressRow, { marginBottom: spacing.xs }]}>
            <Text style={[typography.label, { color: palette.textMuted }]}>
              {t('books.detail.progress', { read: row.read_pages, total: row.total_pages })}
            </Text>
            <Text style={[typography.label, { color: palette.text }]}>{percent}%</Text>
          </View>
          <View
            style={{
              height: 6,
              borderRadius: radius.full,
              backgroundColor: palette.border,
              overflow: 'hidden',
            }}
          >
            <View style={{ width: `${percent}%`, height: '100%', backgroundColor: palette.accent }} />
          </View>
        </View>
      )}

      <Card>
        <Text style={[typography.body, { color: palette.text }]}>
          {t('books.detail.counts.knowledge', { count: counts.knowledge })}
        </Text>
        <Text style={[typography.caption, { color: palette.textMuted, marginTop: spacing.xs }]}>
          {[
            t('books.detail.counts.thoughts', { count: counts.thoughts }),
            t('books.detail.counts.reviews', { count: counts.reviews }),
            t('books.detail.counts.practices', { count: counts.practices }),
          ].join(' · ')}
        </Text>
      </Card>

      <Text
        style={[
          typography.label,
          { color: palette.textMuted, marginTop: spacing.lg, marginBottom: spacing.sm },
        ]}
      >
        {t('books.detail.passages')}
      </Text>
      {data.passages.length === 0 ? (
        <Text style={[typography.body, { color: palette.textMuted }]}>{t('books.detail.empty')}</Text>
      ) : (
        data.passages.map((k) => (
          <Card key={k.id} onPress={() => router.push(`/knowledge/${k.id}`)}>
            <Text style={[typography.thought, { color: palette.text }]} numberOfLines={3}>
              {k.content}
            </Text>
            {k.page !== null && (
              <Text style={[typography.caption, { color: palette.textMuted, marginTop: spacing.xs }]}>
                {k.page}
              </Text>
            )}
          </Card>
        ))
      )}

      <View style={{ height: spacing.xxl }} />
      <Button label={t('common.delete')} variant="danger" onPress={confirmDelete} />
      <View style={{ height: spacing.xl }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { flexDirection: 'row' },
  grow: { flex: 1 },
});
