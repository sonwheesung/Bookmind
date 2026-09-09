import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Field } from '@/components/Field';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { getBook, listBooks } from '@/features/books/repo';
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
import { useTheme } from '@/theme';

/**
 * 지식 카드 상세 — `docs/KNOWLEDGE_SYSTEM.md` §3.
 *
 * 🔴 내 생각은 원문과 **동등하게** 둔다(기둥 6). 다만 비어 있어도 카드는 완결이므로
 *    빈 상태 문구가 "안 써도 됩니다"다 — 채우라고 압박하지 않는다.
 * 🔴 AI 분석 블록은 없다. 없는 것을 "결제하면 보입니다"로 채우지 않는다(§3).
 */
export default function KnowledgeDetail() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;
  const { t } = useTranslation();
  const { palette, spacing, typography } = useTheme();

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

  if (data.row === undefined) {
    return (
      <Screen>
        <Header title={t('knowledge.detail.title')} back />
        <Text style={[typography.body, { color: palette.textMuted }]}>{t('knowledge.list.empty')}</Text>
      </Screen>
    );
  }
  const row = data.row;

  const startEdit = () => {
    setDraft(row.content);
    setDraftPage(row.page ?? '');
    setEditing(true);
  };

  const applyEdit = () => {
    editKnowledge(id, { content: draft, page: draftPage });
    setEditing(false);
    reload();
  };

  const linkBook = (bookId: string | null) => {
    editKnowledge(id, { bookId });
    reload();
  };

  const confirmDelete = () => {
    Alert.alert(t('knowledge.delete.title'), t('knowledge.delete.body'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          removeKnowledge(id);
          router.back();
        },
      },
    ]);
  };

  return (
    <Screen scroll>
      <Header title={t('knowledge.detail.title')} back />

      {editing ? (
        <>
          <Field
            label={t('knowledge.field.passage')}
            value={draft}
            onChangeText={setDraft}
            multiline
            emphasis="quote"
            minHeight={140}
          />
          <Field label={t('knowledge.field.page')} value={draftPage} onChangeText={setDraftPage} />
          <View style={[styles.row, { gap: spacing.md, marginBottom: spacing.xl }]}>
            <Button label={t('common.save')} onPress={applyEdit} style={styles.grow} />
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
          <Card>
            <Text style={[typography.quote, { color: palette.text }]}>{row.content}</Text>
            {(data.book !== undefined || row.page !== null) && (
              <Text style={[typography.caption, { color: palette.textMuted, marginTop: spacing.md }]}>
                {[data.book?.title, row.page].filter((v) => v != null && v !== '').join(' · ')}
              </Text>
            )}
          </Card>
          <Button
            label={t('common.edit')}
            variant="ghost"
            onPress={startEdit}
            style={{ marginBottom: spacing.xl }}
          />
        </>
      )}

      {/* 책 연결 — ⚠ 저장 후 유도는 한 번만이지만, 상세에서는 언제든 붙일 수 있어야 한다(§1.1) */}
      <Text style={[typography.label, { color: palette.textMuted, marginBottom: spacing.xs }]}>
        {t('knowledge.field.book')}
      </Text>
      <View style={[styles.chips, { gap: spacing.sm, marginBottom: spacing.xl }]}>
        <Chip label={t('knowledge.book.none')} active={row.book_id === null} onPress={() => linkBook(null)} />
        {data.books.map((b) => (
          <Chip key={b.id} label={b.title} active={row.book_id === b.id} onPress={() => linkBook(b.id)} />
        ))}
      </View>

      {/* 태그 */}
      <Text style={[typography.label, { color: palette.textMuted, marginBottom: spacing.xs }]}>
        {t('knowledge.tags.title')}
      </Text>
      <View style={[styles.chips, { gap: spacing.sm, marginBottom: spacing.sm }]}>
        {data.tags.length === 0 ? (
          <Text style={[typography.caption, { color: palette.textMuted }]}>{t('knowledge.tags.empty')}</Text>
        ) : (
          data.tags.map((tag) => (
            <Chip
              key={tag.id}
              label={`${tag.name}  ×`}
              active={false}
              onPress={() => {
                detachTag(id, tag.id);
                reload();
              }}
            />
          ))
        )}
      </View>
      <View style={[styles.row, { gap: spacing.sm, marginBottom: spacing.xl }]}>
        <View style={styles.grow}>
          <Field value={newTag} onChangeText={setNewTag} placeholder={t('knowledge.tags.placeholder')} />
        </View>
        <Button
          label={t('common.add')}
          variant="ghost"
          disabled={newTag.trim() === ''}
          onPress={() => {
            attachTag(id, newTag);
            setNewTag('');
            reload();
          }}
        />
      </View>

      {/* 내 생각 — 1:N. 최신이 위 */}
      <Text style={[typography.label, { color: palette.textMuted, marginBottom: spacing.sm }]}>
        {t('knowledge.thoughts.title')}
      </Text>
      {data.thoughts.length === 0 ? (
        <Text style={[typography.body, { color: palette.textMuted, marginBottom: spacing.md }]}>
          {t('knowledge.thoughts.empty')}
        </Text>
      ) : (
        data.thoughts.map((th) => (
          <Card key={th.id}>
            <Text style={[typography.thought, { color: palette.text }]}>{th.body}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                removeThought(th.id);
                reload();
              }}
              hitSlop={8}
              style={{ marginTop: spacing.sm }}
            >
              <Text style={[typography.caption, { color: palette.textMuted }]}>{t('common.remove')}</Text>
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

      <Button label={t('common.delete')} variant="danger" onPress={confirmDelete} />
      <View style={{ height: spacing.xl }} />
    </Screen>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { palette, radius, spacing, typography } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        backgroundColor: active ? palette.accent : palette.surface,
        borderColor: active ? palette.accent : palette.border,
        borderWidth: 1,
        borderRadius: radius.full,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
      }}
    >
      <Text style={[typography.label, { color: active ? palette.onAccent : palette.text }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  grow: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
});
