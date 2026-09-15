import { router, useLocalSearchParams } from 'expo-router';
import { Check, Pencil, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { ChipRow } from '@/components/ChipRow';
import { Field } from '@/components/Field';
import { Header } from '@/components/Header';
import { IconButton } from '@/components/IconButton';
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
 * 🔄 2026-09-14 수정 · 삭제 · 저장 · 취소를 위 오른쪽 아이콘으로 옮기고 표지 자리를 지웠다(사용자 지시 · 선택).
 * 🔄 2026-09-15 읽기 상태는 **수정 모드에서만** 바꾼다. 보기에서는 글자 한 줄이다(사용자 지적 · §4.1).
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
  const [draftStatus, setDraftStatus] = useState<BookStatus>('reading');

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

  const startEdit = () => {
    setDraftTitle(row.title);
    setDraftStatus(row.status);
    setDraftAuthor(row.author ?? '');
    setDraftTotal(row.total_pages === null ? '' : String(row.total_pages));
    setDraftRead(row.read_pages === null ? '' : String(row.read_pages));
    setEditing(true);
  };

  const applyEdit = () => {
    // 🔴 제목이 비면 저장을 잠근다 — 지식 상세에서 이 잠금이 빠져 조용한 먹통이 났었다
    //    (2026-09-09 · docs/EDGE_CASES.md §2). 아이콘도 잠기지만 여기서 한 번 더 막는다
    if (draftTitle.trim() === '') return;
    renameBook(id, {
      title: draftTitle,
      author: draftAuthor,
      totalPages: parsePages(draftTotal),
      readPages: parsePages(draftRead),
    });
    // ⚠ 상태 전이를 자동화하지 않는다 — 사용자가 고르고 ✓ 를 누른 것만 바뀐다(§4.1)
    if (draftStatus !== row.status) setBookStatus(id, draftStatus);
    setEditing(false);
    reload();
  };

  return (
    <Screen scroll>
      <Header
        title={row.title}
        back
        right={
          editing ? (
            <>
              <IconButton icon={X} label={t('common.cancel')} onPress={() => setEditing(false)} />
              <IconButton
                icon={Check}
                label={t('common.save')}
                onPress={applyEdit}
                disabled={draftTitle.trim() === ''}
              />
            </>
          ) : (
            <>
              <IconButton icon={Pencil} label={t('common.edit')} onPress={startEdit} />
              {/* 🔴 아이콘이 작아도 확인창을 거친다. 잘못 누르기 쉬운 자리다 */}
              <IconButton icon={Trash2} label={t('common.delete')} onPress={confirmDelete} />
            </>
          )
        }
      />

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
          <AppText variant="label" tone="muted" style={{ marginBottom: spacing.xs }}>
            {t('books.field.status')}
          </AppText>
          {/* 🔄 상태는 수정 모드에서만 고른다. ✓ 를 눌러야 반영되고 × 로 나가면 안 바뀐다(§4.1 · 2026-09-15) */}
          <ChipRow style={{ marginBottom: spacing.xl }}>
            {BOOK_STATUSES.map((s) => (
              <Chip
                key={s}
                label={t(`books.status.${s}`)}
                active={s === draftStatus}
                onPress={() => setDraftStatus(s)}
              />
            ))}
          </ChipRow>
        </>
      ) : (
        /* 🔴 보기에서는 누를 수 없는 글자 한 줄이다(`저자 · 읽는 중` · §4.2).
              칩으로 두면 태그처럼 보이고, 누르면 저장 없이 바로 바뀌었다(2026-09-15 사용자 지적) */
        <AppText tone="muted" style={{ marginBottom: spacing.xl }}>
          {joinMeta([row.author, t(`books.status.${row.status}`)])}
        </AppText>
      )}

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

      <Spacer size="xl" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
