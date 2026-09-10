import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Field } from '@/components/Field';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import {
  SCRIPTS,
  canSaveText,
  discardImage,
  pickFromCamera,
  pickFromLibrary,
  recognize,
  scriptForLanguage,
  type Script,
} from '@/features/ocr/repo';
import { useTheme } from '@/theme';

/**
 * 사진에서 문장 가져오기 — `docs/KNOWLEDGE_SYSTEM.md` §2.2.
 *
 * 🔴 **저장은 여기서 하지 않는다.** 빠른 저장 화면으로 텍스트를 넘긴다.
 *    책·페이지·태그를 붙이는 규칙이 한 벌만 있어야 한다. 두 벌이 되면 한쪽이 반드시 늙는다.
 * 🔴 **인식 결과는 편집 가능한 상태**로 보여준다(§2). OCR 은 틀리고, 틀린 채로 저장되면
 *    복습 질문까지 오염되는데 사용자는 그 이유를 알 수 없다.
 * 🔴 **이미지는 화면을 떠날 때 지운다.** 인식 직후가 아니다. 스크립트를 바꿔 다시 읽으려면
 *    그 사진이 아직 있어야 한다(§2.2).
 */
export default function ScanKnowledge() {
  const { t, i18n } = useTranslation();
  const { palette, spacing, typography } = useTheme();

  const [script, setScript] = useState<Script>(() => scriptForLanguage(i18n.language));
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [tried, setTried] = useState(false);

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
    setText(out);
  };

  const pick = async (from: 'camera' | 'library') => {
    const r = from === 'camera' ? await pickFromCamera() : await pickFromLibrary();
    if ('canceled' in r) return;
    // 앞서 쓰던 사진이 있으면 여기서 정리한다
    if (imageUri.current !== null && imageUri.current !== r.uri) discardImage(imageUri.current);
    imageUri.current = r.uri;
    await runOn(r.uri, script);
  };

  const changeScript = async (s: Script) => {
    setScript(s);
    if (imageUri.current !== null) await runOn(imageUri.current, s);
  };

  const useText = () => {
    if (!canSaveText(text)) return;
    router.replace({ pathname: '/knowledge/new', params: { text, source: 'ocr' } });
  };

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

      {tried && !unavailable && (
        <>
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
            minHeight={160}
            maxHeight={320}
          />

          {/* 🔴 빈 결과면 저장이 잠긴다. 그때 문구는 "다시 찍으세요"가 아니라 직접 입력으로 가는 길이다 */}
          {!canSaveText(text) && (
            <Text style={[typography.body, { color: palette.textMuted, marginBottom: spacing.lg }]}>
              {t('ocr.emptyHint')}
            </Text>
          )}

          <Button label={t('ocr.useText')} onPress={useText} disabled={!canSaveText(text)} />
        </>
      )}

      {(unavailable || (tried && !canSaveText(text))) && (
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
