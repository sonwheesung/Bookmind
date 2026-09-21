import { router, useLocalSearchParams } from 'expo-router';
import { Check, Pencil, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BookSelect } from '@/components/BookSelect';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { ChipRow } from '@/components/ChipRow';
import { Field } from '@/components/Field';
import { Header } from '@/components/Header';
import { IconButton } from '@/components/IconButton';
import { Screen } from '@/components/Screen';
import { Spacer } from '@/components/Spacer';
import { getBook, listBooks } from '@/features/books/repo';
import { splitTagInput } from '@/features/knowledge/compute';
import {
  addThought,
  attachTag,
  detachTag,
  editKnowledge,
  getKnowledge,
  removeKnowledge,
  removeThought,
  thoughtsOf,
} from '@/features/knowledge/repo';
import { tagsOf } from '@/features/tags/repo';
import { useDbQuery } from '@/hooks/useDbQuery';
import { confirmDestructive } from '@/lib/confirm';
import { joinMeta } from '@/lib/format';
import { toggled } from '@/lib/set';
import { useTheme } from '@/theme';

/**
 * 지식 카드 상세 — `docs/KNOWLEDGE_SYSTEM.md` §3.
 *
 * 🔴 내 생각은 원문과 **동등하게** 둔다(기둥 6). 다만 비어 있어도 카드는 완결이므로
 *    빈 상태 문구가 "안 써도 됩니다"다 — 채우라고 압박하지 않는다.
 * 🔴 AI 분석 블록은 없다. 없는 것을 "결제하면 보입니다"로 채우지 않는다(§3).
 * 🔄 2026-09-14 수정 · 삭제 · 저장 · 취소를 위 오른쪽 아이콘으로 옮겼다(사용자 지시).
 *    태그 추가 · 생각 추가 · 실천 제안은 **본문 안의 행동**이라 글자 버튼으로 남는다.
 */
export default function KnowledgeDetail() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;
  const { t } = useTranslation();
  const { spacing } = useTheme();

  const { data, reload } = useDbQuery(() => {
    const row = getKnowledge(id);
    return {
      row,
      book: row?.book_id == null ? undefined : getBook(row.book_id),
      thoughts: row === undefined ? [] : thoughtsOf(id),
      tags: row === undefined ? [] : tagsOf(id),
      books: listBooks(),
    };
  });

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [draftPage, setDraftPage] = useState('');
  const [newThought, setNewThought] = useState('');
  const [newTag, setNewTag] = useState('');
  // 이미 붙어 있는 태그를 다시 넣으면 조용히 아무 일도 안 일어나 "안 눌렸나"로 읽혔다
  const [tagNotice, setTagNotice] = useState(false);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const toggleThought = (thoughtId: string) => setExpanded((prev) => toggled(prev, thoughtId));

  if (data.row === undefined) {
    return (
      <Screen>
        <Header title={t('knowledge.detail.title')} back />
        <AppText tone="muted">{t('knowledge.list.empty')}</AppText>
      </Screen>
    );
  }
  const row = data.row;
  // 🔴 책도 페이지도 없으면(빈 문자열 포함) 출처 줄을 안 만든다(`joinMeta` 가 '' 를 준다)
  const source = joinMeta([data.book?.title, row.page]);

  const startEdit = () => {
    setDraft(row.content);
    setDraftPage(row.page ?? '');
    setEditing(true);
  };

  const applyEdit = () => {
    // 🔴 새 문장 화면에만 있던 잠금이 여기 빠져 있었다 — 빈 원문으로 누르면
    //    예외가 나고 사용자에게는 아무 일도 안 일어난 것처럼 보였다(2026-09-09 점검)
    if (draft.trim() === '') return;
    editKnowledge(id, { content: draft, page: draftPage });
    setEditing(false);
    reload();
  };

  const linkBook = (bookId: string | null) => {
    editKnowledge(id, { bookId });
    reload();
  };

  // 되돌릴 수 없는 동작에는 확인을 붙인다 — 문장·책 삭제에는 있는데 생각에만 없었다
  const confirmRemoveThought = (thoughtId: string) =>
    confirmDestructive({
      title: t('knowledge.thoughts.removeTitle'),
      body: t('knowledge.thoughts.removeBody'),
      action: t('common.remove'),
      onConfirm: () => {
        removeThought(thoughtId);
        reload();
      },
    });

  const confirmDelete = () =>
    confirmDestructive({
      title: t('knowledge.delete.title'),
      body: t('knowledge.delete.body'),
      action: t('common.delete'),
      onConfirm: () => {
        removeKnowledge(id);
        router.back();
      },
    });

  return (
    <Screen scroll>
      <Header
        title={t('knowledge.detail.title')}
        back
        right={
          editing ? (
            <>
              <IconButton icon={X} label={t('common.cancel')} onPress={() => setEditing(false)} />
              <IconButton icon={Check} label={t('common.save')} onPress={applyEdit} disabled={draft.trim() === ''} />
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
        <View style={{ marginBottom: spacing.md }}>
          <Field
            label={t('knowledge.field.passage')}
            value={draft}
            onChangeText={setDraft}
            multiline
            emphasis="quote"
            minHeight={140}
            maxHeight={260}
          />
          <Field label={t('knowledge.field.page')} value={draftPage} onChangeText={setDraftPage} />
        </View>
      ) : (
        <View style={{ marginBottom: spacing.lg }}>
          <Card>
            <AppText variant="quote">{row.content}</AppText>
          </Card>
          {/* 🔴 카드인 것은 원문 하나다. 출처·태그는 메타데이터라 카드에서 뺀다(DESIGN_REVIEW §3) */}
          {source !== '' && (
            <AppText variant="caption" tone="muted">
              {source}
            </AppText>
          )}
        </View>
      )}

      {/* 책 연결 — ⚠ 저장 후 유도는 한 번만이지만, 상세에서는 언제든 붙일 수 있어야 한다(§1.1) */}
      <AppText variant="label" tone="muted" style={{ marginBottom: spacing.xs }}>
        {t('knowledge.field.book')}
      </AppText>
      {/* 🔴 저장 화면과 **같은 부품**이다(§1.1.1). 두 화면이 다르게 생기면
          사용자는 저장 화면에서 배운 것을 여기서 다시 배워야 한다 */}
      <BookSelect
        books={data.books}
        value={row.book_id}
        onChange={linkBook}
        onCreate={() => router.push('/books/new')}
      />

      {/* 태그 */}
      <AppText variant="label" tone="muted" style={{ marginBottom: spacing.xs }}>
        {t('knowledge.tags.title')}
      </AppText>
      {/* 🚫 "태그가 없습니다"를 쓰지 않는다 — 없는 것에 문장을 붙이면 할 일처럼 읽힌다 */}
      <ChipRow style={{ marginBottom: spacing.sm }}>
        {data.tags.map((tag) => (
          <Chip
            key={tag.id}
            label={tag.name}
            trailing="×"
            onPress={() => {
              detachTag(id, tag.id);
              reload();
            }}
          />
        ))}
      </ChipRow>
      <View style={[styles.row, { gap: spacing.sm, marginBottom: spacing.xl }]}>
        <View style={styles.grow}>
          <Field value={newTag} onChangeText={setNewTag} placeholder={t('knowledge.tags.placeholder')} />
        </View>
        <Button
          label={t('common.add')}
          variant="ghost"
          disabled={newTag.trim() === ''}
          onPress={() => {
            // 🔴 새 문장 화면과 같은 규칙으로 나눈다 — 화면마다 규칙이 다르면
            //    사용자는 저장 화면에서 배운 것을 여기서 다시 배워야 한다(§5)
            const names = splitTagInput(newTag);
            const before = data.tags.length;
            for (const name of names) attachTag(id, name);
            setNewTag('');
            reload();
            setTagNotice(names.length > 0 && tagsOf(id).length === before);
          }}
        />
      </View>

      {tagNotice && (
        <AppText variant="caption" tone="muted" style={{ marginBottom: spacing.md }}>
          {t('knowledge.tags.already')}
        </AppText>
      )}

      {/* 내 생각 — 1:N. 최신이 위 */}
      <AppText variant="label" tone="muted" style={{ marginBottom: spacing.sm }}>
        {t('knowledge.thoughts.title')}
      </AppText>
      {data.thoughts.length === 0 ? (
        <AppText tone="muted" style={{ marginBottom: spacing.md }}>
          {t('knowledge.thoughts.empty')}
        </AppText>
      ) : (
        data.thoughts.map((th, i) => (
          <Card key={th.id}>
            {/* 🔴 최신 하나만 펼치고 나머지는 접는다(§3) — 긴 생각이 쌓이면
                삭제 버튼까지 스와이프 세 번이 걸렸다(2026-09-09 점검) */}
            <Pressable onPress={() => toggleThought(th.id)} accessibilityRole="button">
              <AppText variant="thought" numberOfLines={i === 0 || expanded.has(th.id) ? undefined : 3}>
                {th.body}
              </AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => confirmRemoveThought(th.id)}
              hitSlop={8}
              style={{ marginTop: spacing.sm }}
            >
              <AppText variant="caption" tone="muted">
                {t('common.remove')}
              </AppText>
            </Pressable>
          </Card>
        ))
      )}
      <Field
        value={newThought}
        onChangeText={setNewThought}
        placeholder={t('knowledge.thoughts.placeholder')}
        multiline
        emphasis="thought"
        minHeight={80}
      />
      <Button
        label={t('knowledge.thoughts.add')}
        variant="ghost"
        disabled={newThought.trim() === ''}
        onPress={() => {
          addThought(id, newThought);
          setNewThought('');
          reload();
        }}
        style={{ marginBottom: spacing.xxl }}
      />

      {/* ── 실천 (`docs/PRACTICE_SYSTEM.md` §1) ────────────────────────
          🔄 2026-09-21 AI 실천 제안 배너를 걷어냈다(결정 #28). AI 가 없어 한 번도 안 떴다.
          🚫 아래 [이 문장으로 실천 만들기] 는 **도구**다. 조용한 글자 하나이고 권유 문구를 붙이지 않는다(§4). */}
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push(`/practice/new?knowledgeId=${id}`)}
        hitSlop={8}
      >
        <AppText variant="caption" tone="muted">
          {t('practice.createFromKnowledge')}
        </AppText>
      </Pressable>
      <Spacer size="xl" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  grow: { flex: 1 },
});
