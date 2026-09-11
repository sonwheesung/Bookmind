import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Field } from '@/components/Field';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import {
  SCRIPTS,
  canSaveText,
  discardImage,
  displayHeight,
  joinSelected,
  needsFallback,
  pickFromCamera,
  pickFromLibrary,
  recognize,
  scaleBoxes,
  scriptForLanguage,
  type Picked,
  type Script,
  type SelectableLine,
} from '@/features/ocr/repo';
import { useTheme } from '@/theme';

/**
 * 사진에서 문장 가져오기 — `docs/KNOWLEDGE_SYSTEM.md` §2.2 (결정 #22 · 책담 승계).
 *
 * 🔴 **고르는 화면이지 읽는 화면이 아니다.** 책 페이지 한 장은 30~40줄인데 사용자가 원하는 것은
 *    1~3줄이다. 전부 합쳐서 편집 칸에 넣으면 **90%를 지우는 일**이 되고 기둥 1 과 부딪힌다.
 * 🔴 **저장은 여기서 하지 않는다.** 빠른 저장 화면으로 텍스트를 넘긴다.
 *    책·페이지·태그를 붙이는 규칙이 한 벌만 있어야 한다.
 * 🔴 **고른 뒤에도 편집 칸을 지난다**(§2). OCR 은 틀리고, 틀린 채로 저장되면 복습 질문까지 오염된다.
 * 🔴 **이미지는 화면을 떠날 때 지운다.** 스크립트를 바꿔 다시 읽으려면 그 사진이 아직 있어야 한다.
 */
export default function ScanKnowledge() {
  const { t, i18n } = useTranslation();
  const { palette, radius, spacing, typography } = useTheme();

  const [script, setScript] = useState<Script>(() => scriptForLanguage(i18n.language));
  const [image, setImage] = useState<Picked | null>(null);
  const [lines, setLines] = useState<readonly SelectableLine[]>([]);
  const [missing, setMissing] = useState(0);
  const [fallbackText, setFallbackText] = useState('');
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [tried, setTried] = useState(false);

  // 🔴 표시 폭. 배치가 끝나기 전(0)에는 박스를 그리지 않는다(§2.2.1)
  const [displayWidth, setDisplayWidth] = useState(0);

  // 🔴 화면을 떠날 때 지운다. ref 라 리렌더와 무관하게 마지막 경로 하나를 들고 있는다
  const imageUri = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (imageUri.current !== null) discardImage(imageUri.current);
    },
    [],
  );

  const runOn = async (uri: string, s: Script) => {
    setBusy(true);
    const out = await recognize(uri, s);
    setBusy(false);
    setTried(true);
    if (out === null) {
      setUnavailable(true);
      return;
    }
    setUnavailable(false);
    setLines(out.lines);
    setMissing(out.missingFrames);
    setFallbackText(out.fallbackText);
    // 🔴 스크립트를 바꾸면 줄 id 가 달라진다. 고른 것을 들고 가면 엉뚱한 줄이 골라진 채로 남는다
    setSelected(new Set());
    setText('');
  };

  const pick = async (from: 'camera' | 'library') => {
    const r = from === 'camera' ? await pickFromCamera() : await pickFromLibrary();
    if ('canceled' in r) return;
    if (imageUri.current !== null && imageUri.current !== r.uri) discardImage(imageUri.current);
    imageUri.current = r.uri;
    setImage(r);
    await runOn(r.uri, script);
  };

  const changeScript = async (s: Script) => {
    setScript(s);
    if (imageUri.current !== null) await runOn(imageUri.current, s);
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
    setText(joinSelected(lines, next, script));
  };

  const useAll = () => {
    setSelected(new Set());
    setText(fallbackText);
  };

  const useText = () => {
    if (!canSaveText(text)) return;
    router.replace({ pathname: '/knowledge/new', params: { text, source: 'ocr' } });
  };

  // 🔴 박스와 사진이 **같은 배율**을 쓴다. 다르면 사진과 박스가 어긋난다(§2.2.1)
  const boxes = image === null ? [] : scaleBoxes(lines, image.width, displayWidth);
  const imageHeight =
    image === null ? 0 : displayHeight(image.width, image.height, displayWidth);

  return (
    <Screen scroll>
      <Header title={t('ocr.title')} back />

      <View style={[styles.row, { gap: spacing.md, marginBottom: spacing.xl }]}>
        <View style={styles.grow}>
          <Button label={t('ocr.camera')} onPress={() => void pick('camera')} />
        </View>
        <View style={styles.grow}>
          <Button label={t('ocr.library')} variant="ghost" onPress={() => void pick('library')} />
        </View>
      </View>

      {busy && (
        <Text style={[typography.body, { color: palette.textMuted, marginBottom: spacing.lg }]}>
          {t('ocr.recognizing')}
        </Text>
      )}

      {/* 🔴 네이티브 모듈이라 Expo Go 에서는 못 돈다(결정 #20). 빨간 오류 대신 한 줄로 알린다 */}
      {unavailable && (
        <Text style={[typography.body, { color: palette.textMuted, marginBottom: spacing.lg }]}>
          {t('ocr.unavailable')}
        </Text>
      )}

      {/* 🚫 사진에 maxHeight 를 걸지 않는다. 거는 순간 배율 식이 거짓이 되고 박스가 틀어진다(§2.2.1) */}
      {image !== null && !unavailable && (
        <View
          style={{ marginBottom: spacing.lg }}
          onLayout={(e: LayoutChangeEvent) => setDisplayWidth(e.nativeEvent.layout.width)}
        >
          {displayWidth > 0 && (
            <View style={{ width: displayWidth, height: imageHeight }}>
              <Image
                source={{ uri: image.uri }}
                style={{ width: displayWidth, height: imageHeight, borderRadius: radius.md }}
              />
              {boxes.map((b) => {
                const on = selected.has(b.id);
                return (
                  <Pressable
                    key={b.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    onPress={() => toggle(b.id)}
                    style={{
                      position: 'absolute',
                      left: b.left,
                      top: b.top,
                      width: b.width,
                      height: b.height,
                      backgroundColor: on ? palette.highlight : palette.highlightIdle,
                      borderRadius: 2,
                    }}
                  />
                );
              })}
            </View>
          )}
        </View>
      )}

      {tried && !unavailable && (
        <>
          {lines.length > 0 && (
            <Text style={[typography.body, { color: palette.textMuted, marginBottom: spacing.lg }]}>
              {selected.size === 0
                ? t('ocr.selectHint')
                : t('ocr.selectedCount', { count: selected.size })}
            </Text>
          )}

          {/* 🔴 좌표를 못 받은 줄이 있으면 그 문장을 가져올 길을 연다(§2.2) */}
          {needsFallback(missing) && (
            <View style={{ marginBottom: spacing.lg }}>
              <Text
                style={[typography.body, { color: palette.textMuted, marginBottom: spacing.sm }]}
              >
                {t('ocr.someUnselectable', { count: missing })}
              </Text>
              <Button label={t('ocr.useAll')} variant="ghost" onPress={useAll} />
            </View>
          )}

          {/* 🔴 스크립트 바꾸기. 한국어·일본어·중국어 모델은 라틴도 함께 읽지만 그 반대는 안 된다(§2.1) */}
          <Text style={[typography.label, { color: palette.textMuted, marginBottom: spacing.sm }]}>
            {t('ocr.scriptLabel')}
          </Text>
          <View style={[styles.chips, { gap: spacing.sm, marginBottom: spacing.lg }]}>
            {SCRIPTS.map((s) => (
              <Chip
                key={s}
                label={t(`ocr.script.${s}`)}
                active={script === s}
                onPress={() => void changeScript(s)}
              />
            ))}
          </View>

          <Field
            label={t('ocr.resultLabel')}
            value={text}
            onChangeText={setText}
            placeholder={t('ocr.empty')}
            emphasis="quote"
            multiline
            minHeight={120}
            maxHeight={280}
          />

          {/* 🔴 빈 결과면 저장이 잠긴다. 그때 문구는 "다시 찍으세요"가 아니라 직접 입력으로 가는 길이다 */}
          {!canSaveText(text) && (
            <Text style={[typography.body, { color: palette.textMuted, marginBottom: spacing.lg }]}>
              {lines.length === 0 ? t('ocr.emptyHint') : t('ocr.nothingSelected')}
            </Text>
          )}

          <Button label={t('ocr.useText')} onPress={useText} disabled={!canSaveText(text)} />
        </>
      )}

      {(unavailable || (tried && lines.length === 0 && !canSaveText(text))) && (
        <Button
          label={t('ocr.manual')}
          variant="ghost"
          onPress={() => router.replace('/knowledge/new')}
          style={{ marginTop: spacing.md }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
});
