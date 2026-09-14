import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, LayoutChangeEvent, Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ButtonRow } from '@/components/ButtonRow';
import { Chip } from '@/components/Chip';
import { ChipRow } from '@/components/ChipRow';
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
  recognizeAuto,
  scaleBoxes,
  scriptForLanguage,
  type Picked,
  type Recognized,
  type Script,
  type SelectableLine,
} from '@/features/ocr/repo';
import { toggled } from '@/lib/set';
import { useTheme } from '@/theme';

/**
 * 사진에서 문장 가져오기 — `docs/KNOWLEDGE_SYSTEM.md` §2.2 (결정 #22 · 책담 승계).
 *
 * 🔴 **고르는 화면이지 읽는 화면이 아니다.** 책 페이지 한 장은 30~40줄인데 사용자가 원하는 것은
 *    1~3줄이다. 전부 합쳐서 편집 칸에 넣으면 **90%를 지우는 일**이 되고 기둥 1 과 부딪힌다.
 * 🔴 **저장은 여기서 하지 않는다.** 빠른 저장 화면으로 텍스트를 넘긴다.
 *    책·페이지·태그를 붙이는 규칙이 한 벌만 있어야 한다.
 * 🔴 **고른 뒤에도 편집 칸을 지난다**(§2). OCR 은 틀리고, 틀린 채로 저장되면 복습 질문까지 오염된다.
 * 🔴 **이미지는 화면을 떠날 때 지운다.** 다른 문자로 다시 읽으려면 그 사진이 아직 있어야 한다.
 * 🔴 **문자는 앱이 자동으로 고른다**(결정 #24 · §2.1.1). 칩은 자동이 헛짚은 날의 탈출구라 링크 뒤에 있다.
 */
export default function ScanKnowledge() {
  const { t, i18n } = useTranslation();
  const { palette, radius, spacing } = useTheme();

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
  // 🔴 칩은 링크를 눌러야 열린다. 사진을 새로 고르면 다시 닫는다(자동으로 돌아간다)
  const [pickScript, setPickScript] = useState(false);

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

  /**
   * 🔴 `auto` 면 문자를 앱이 고른다(`recognizeAuto`). 링크 뒤 칩으로 손수 고른 문자는 **그 하나로만** 읽는다.
   *    손으로 고른 것을 자동이 다시 뒤집으면 사용자가 탈출구를 잃는다.
   */
  const runOn = async (uri: string, s: Script, auto: boolean) => {
    setBusy(true);
    let out: (Recognized & { readonly script: Script }) | null;
    if (auto) {
      out = await recognizeAuto(uri, s);
    } else {
      const r = await recognize(uri, s);
      out = r === null ? null : { ...r, script: s };
    }
    setBusy(false);
    setTried(true);
    if (out === null) {
      setUnavailable(true);
      return;
    }
    setUnavailable(false);
    setScript(out.script);
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
    setPickScript(false);
    await runOn(r.uri, scriptForLanguage(i18n.language), true);
  };

  const changeScript = async (s: Script) => {
    setScript(s);
    if (imageUri.current !== null) await runOn(imageUri.current, s, false);
  };

  const toggle = (id: string) => {
    const next = toggled(selected, id);
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
  const imageHeight = image === null ? 0 : displayHeight(image.width, image.height, displayWidth);

  return (
    <Screen scroll>
      <Header title={t('ocr.title')} back />

      <ButtonRow style={{ marginBottom: spacing.xl }}>
        <Button label={t('ocr.camera')} onPress={() => void pick('camera')} />
        <Button label={t('ocr.library')} variant="ghost" onPress={() => void pick('library')} />
      </ButtonRow>

      {busy && (
        <AppText tone="muted" style={{ marginBottom: spacing.lg }}>
          {t('ocr.recognizing')}
        </AppText>
      )}

      {/* 🔴 네이티브 모듈이라 Expo Go 에서는 못 돈다(결정 #20). 빨간 오류 대신 한 줄로 알린다 */}
      {unavailable && (
        <AppText tone="muted" style={{ marginBottom: spacing.lg }}>
          {t('ocr.unavailable')}
        </AppText>
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
            <AppText tone="muted" style={{ marginBottom: spacing.lg }}>
              {selected.size === 0 ? t('ocr.selectHint') : t('ocr.selectedCount', { count: selected.size })}
            </AppText>
          )}

          {/* 🔴 좌표를 못 받은 줄이 있으면 그 문장을 가져올 길을 연다(§2.2) */}
          {needsFallback(missing) && (
            <View style={{ marginBottom: spacing.lg }}>
              <AppText tone="muted" style={{ marginBottom: spacing.sm }}>
                {t('ocr.someUnselectable', { count: missing })}
              </AppText>
              <Button label={t('ocr.useAll')} variant="ghost" onPress={useAll} />
            </View>
          )}

          {/* 🔴 문자는 앱이 고른다(결정 #24). 칩은 자동이 헛짚은 날만 링크 뒤에서 연다.
              한국어·일본어·중국어 모델은 라틴도 함께 읽지만 그 반대는 안 된다(§2.1) */}
          {pickScript ? (
            <>
              <AppText variant="label" tone="muted" style={{ marginBottom: spacing.sm }}>
                {t('ocr.scriptLabel')}
              </AppText>
              <ChipRow style={{ marginBottom: spacing.lg }}>
                {SCRIPTS.map((s) => (
                  <Chip
                    key={s}
                    label={t(`ocr.script.${s}`)}
                    active={script === s}
                    onPress={() => void changeScript(s)}
                  />
                ))}
              </ChipRow>
            </>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() => setPickScript(true)}
              hitSlop={8}
              style={{ marginBottom: spacing.lg }}
            >
              <AppText variant="caption" tone="muted">
                {t('ocr.otherScript')}
              </AppText>
            </Pressable>
          )}

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
            <AppText tone="muted" style={{ marginBottom: spacing.lg }}>
              {lines.length === 0 ? t('ocr.emptyHint') : t('ocr.nothingSelected')}
            </AppText>
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
