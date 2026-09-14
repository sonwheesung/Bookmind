import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BookCover } from '@/components/BookCover';
import { Button } from '@/components/Button';
import { ButtonRow } from '@/components/ButtonRow';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { ChipRow } from '@/components/ChipRow';
import { Field } from '@/components/Field';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { Spacer } from '@/components/Spacer';
import { parsePages, progressPercent } from '@/features/books/progress';
import { bookCounts, getBook, removeBook, renameBook, setBookStatus } from '@/features/books/repo';
import { listKnowledgeOfBook } from '@/features/knowledge/repo';
import { BOOK_STATUSES, type BookStatus } from '@/features/types';
import { useDbQuery } from '@/hooks/useDbQuery';
import { confirmDestructive } from '@/lib/confirm';
import { joinMeta } from '@/lib/format';
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
  const { palette, radius, spacing } = useTheme();

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
        <AppText tone="muted">{t('books.list.empty')}</AppText>
      </Screen>
    );
  }
  const { row, counts } = data;
  const percent = progressPercent(row);

  const confirmDelete = () =>
    confirmDestructive({
      title: t('books.delete.title'),
      body: t('books.delete.body', { count: counts.knowledge }),
      action: t('common.delete'),
      onConfirm: () => {
        removeBook(id);
        router.back();
      },
    });

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
          {/* 🔴 제목이 비면 저장을 잠근다 — 지식 상세에서 이 잠금이 빠져 조용한 먹통이 났었다
              (2026-09-09 · docs/EDGE_CASES.md §2). 같은 실수를 여기서 되풀이하지 않는다 */}
          <ButtonRow style={{ marginBottom: spacing.xl }}>
            <Button label={t('common.save')} onPress={applyEdit} disabled={draftTitle.trim() === ''} />
            <Button label={t('common.cancel')} variant="ghost" onPress={() => setEditing(false)} />
          </ButtonRow>
        </>
      ) : (
        <>
          <View style={[styles.row, { gap: spacing.md, marginBottom: spacing.md }]}>
            {/* 🔴 이미지 파일이 아니다 — 첫 글자 + 고정 색(DESIGN_REVIEW §3) */}
            <BookCover book={row} />
            {row.author !== null && (
              <AppText tone="muted" style={styles.center}>
                {row.author}
              </AppText>
            )}
          </View>
          <Button
            label={t('common.edit')}
            variant="ghost"
            onPress={startEdit}
            style={{ marginBottom: spacing.lg }}
          />
        </>
      )}

      {/* ⚠ 상태 전이를 자동화하지 않는다 — 사용자가 누른 것만 바뀐다(§4.1) */}
      <ChipRow style={{ marginBottom: spacing.xl }}>
        {BOOK_STATUSES.map((s) => (
          <Chip key={s} label={t(`books.status.${s}`)} active={s === row.status} onPress={() => change(s)} />
        ))}
      </ChipRow>

      {/* 🔴 모르면 아예 안 그린다 — 0% 는 "안 읽었다"이지 "모른다"가 아니다(§4.4) */}
      {percent !== null && (
        <View style={{ marginBottom: spacing.lg }}>
          <View style={[styles.progressRow, { marginBottom: spacing.xs }]}>
            <AppText variant="label" tone="muted">
              {t('books.detail.progress', { read: row.read_pages, total: row.total_pages })}
            </AppText>
            <AppText variant="label">{percent}%</AppText>
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

      {/* 🔴 데이터가 생긴 뒤에만 통계를 낸다(DESIGN_REVIEW §3).
          빈 책에 `문장 0 · 생각 0 · 복습 0 · 실천 0` 은 진행이 아니라 **미완성**으로 보인다 */}
      {counts.knowledge > 0 && (
        <Card>
          <AppText>{t('books.detail.counts.knowledge', { count: counts.knowledge })}</AppText>
          <AppText variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>
            {joinMeta([
              t('books.detail.counts.thoughts', { count: counts.thoughts }),
              t('books.detail.counts.reviews', { count: counts.reviews }),
              t('books.detail.counts.practices', { count: counts.practices }),
            ])}
          </AppText>
        </Card>
      )}

      {data.passages.length > 0 && (
        <AppText variant="label" tone="muted" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
          {t('books.detail.passages')}
        </AppText>
      )}
      {data.passages.length === 0 ? (
        <AppText tone="muted">{t('books.detail.empty')}</AppText>
      ) : (
        data.passages.map((k) => (
          <Card key={k.id} onPress={() => router.push(`/knowledge/${k.id}`)}>
            <AppText variant="thought" numberOfLines={3}>
              {k.content}
            </AppText>
            {k.page !== null && (
              <AppText variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>
                {k.page}
              </AppText>
            )}
          </Card>
        ))
      )}

      <Spacer size="xxl" />
      <Button label={t('common.delete')} variant="danger" onPress={confirmDelete} />
      <Spacer size="xl" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { flexDirection: 'row' },
  center: { alignSelf: 'center' },
});
