/**
 * OCR 실행 — `docs/KNOWLEDGE_SYSTEM.md` §2.
 *
 * 이 파일은 **얇다.** 판정이 되는 것(스크립트 · 줄 합치기 · 저장 가능 여부)은 `compute.ts` 에 있다.
 *
 * 🔴 **네트워크를 쓰지 않는다.** 모델이 기기에 있다(결정 #20). 이 파일에 `fetch` 가 생기면
 *    기둥 2 가 깨지는 것이고, 가드 축 ⑤ 가 그것을 소스에서 잰다.
 * 🔴 **네이티브 모듈이라 Expo Go 에서 안 돈다.** 그래서 import 를 지연시키고 실패를 문구로 바꾼다.
 */
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

import {
  cleanupTarget,
  collectLines,
  joinBlocks,
  type OcrBlock,
  type Script,
  type SelectableLine,
} from './compute';

export {
  SCRIPTS,
  canSaveSelection,
  canSaveText,
  displayHeight,
  joinSelected,
  needsFallback,
  scaleBoxes,
  scriptForLanguage,
  type ScaledBox,
  type Script,
  type SelectableLine,
} from './compute';

/**
 * 고른 사진. 🔴 **크기를 같이 들고 온다** — 좌표를 표시 크기로 환산하려면 원본 폭이 있어야 한다(§2.2.1).
 */
export type Picked = { readonly uri: string; readonly width: number; readonly height: number };
export type PickResult = Picked | { readonly canceled: true };

/** 🔴 `quality: 1` 로 받는다. 압축하면 좌표가 원본과 어긋난다 */
const pickOptions = (): ImagePicker.ImagePickerOptions => ({ mediaTypes: ['images'], quality: 1 });

function toPicked(r: ImagePicker.ImagePickerResult): PickResult {
  const a = r.canceled ? undefined : r.assets[0];
  if (a === undefined) return { canceled: true };
  return { uri: a.uri, width: a.width ?? 0, height: a.height ?? 0 };
}

/** 카메라로 한 장. 🔴 권한이 없으면 던지지 않고 `canceled` 로 돌려준다 */
export async function pickFromCamera(): Promise<PickResult> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return { canceled: true };
  return toPicked(await ImagePicker.launchCameraAsync(pickOptions()));
}

/** 앨범에서 한 장 */
export async function pickFromLibrary(): Promise<PickResult> {
  return toPicked(await ImagePicker.launchImageLibraryAsync(pickOptions()));
}

/**
 * 인식 결과 — **고를 수 있는 줄**과, 못 고르는 줄을 위한 **폴백 전체 텍스트**(§2.2).
 *
 * 🔴 `fallbackText` 는 언제나 만든다. `missingFrames` 가 0 이 아니면 화면이 그 길을 열어 준다.
 *    좌표 없는 줄을 버리고 끝내면 **그 문장을 가져올 방법이 아예 없어진다.**
 */
export interface Recognized {
  readonly lines: readonly SelectableLine[];
  readonly missingFrames: number;
  readonly fallbackText: string;
}

/**
 * 인식. 🔴 **네이티브가 없으면(Expo Go) 여기서 잡아 `null` 을 돌려준다.**
 * 화면이 빨간 오류가 아니라 "이 빌드에서는 안 됩니다"를 보여주게 하기 위해서다.
 */
export async function recognize(uri: string, script: Script): Promise<Recognized | null> {
  try {
    // 🔴 지연 import. 최상위에서 부르면 Expo Go 가 **앱 시작 때** 죽는다
    const mod = await import('@react-native-ml-kit/text-recognition');
    const TextRecognition = mod.default;
    const scriptEnum = mod.TextRecognitionScript as unknown as Record<string, unknown>;
    const key = script.toUpperCase();
    const result = (await TextRecognition.recognize(uri, scriptEnum[key] as never)) as unknown as {
      blocks?: readonly OcrBlock[];
    };
    const blocks = result.blocks ?? [];
    const { lines, missingFrames } = collectLines(blocks);
    return { lines, missingFrames, fallbackText: joinBlocks(blocks, script) };
  } catch {
    return null;
  }
}

/**
 * 🔴 인식이 끝나면 **임시 파일을 지운다**(§2 "이미지는 저장하지 않는다").
 * 실패해도 조용히 넘어간다. 지우기 실패로 저장 흐름을 막지 않는다(기둥 1).
 */
export function discardImage(uri: string): void {
  const target = cleanupTarget(uri);
  if (target === null) return;
  try {
    // 백업이 쓰는 것과 같은 API 다(`features/backup/repo.ts`). 두 벌을 만들지 않는다
    new File(target).delete();
  } catch {
    /* 남아도 캐시라 OS 가 정리한다. 여기서 사용자를 막지 않는다 */
  }
}
