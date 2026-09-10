/**
 * OCR 계산 — `docs/KNOWLEDGE_SYSTEM.md` §2.1 · §2.3.
 *
 * 🔴 **인식 정확도는 여기서 안 정해진다.** 모델은 네이티브에 있다. 여기서 정하는 것은
 *    ① 어떤 스크립트로 읽을까 ② 받은 조각을 어떻게 원문처럼 이을까 ③ 저장을 열어도 되나,
 *    셋뿐이고 **셋 다 틀리면 화면은 멀쩡한 채로 원문만 조용히 망가진다.**
 *
 * 🔴 순수하다. 네이티브도 expo 도 안 쓴다(가드가 node 에서 그대로 돌린다).
 */

/** ML Kit 이 가진 스크립트. 값은 라이브러리의 `TextRecognitionScript` 키와 같게 둔다 */
export type Script = 'latin' | 'korean' | 'japanese' | 'chinese' | 'devanagari';

export const SCRIPTS: readonly Script[] = ['latin', 'korean', 'japanese', 'chinese', 'devanagari'];

/**
 * 앱 언어에서 기본 스크립트를 고른다(§2.1).
 *
 * 🟢 한국어·일본어·중국어 모델은 **라틴 문자도 함께 읽는다.** 그래서 한국어 책 속의 영어 단어는
 *    기본값 그대로 잡힌다. 반대(라틴 모델로 한글)는 안 되므로, 애매하면 CJK 쪽이 안전하다.
 * 🚫 모르는 언어를 한국어로 떨어뜨리지 않는다. 우리는 글로벌 앱이고 기본 언어는 `en` 이다(§9).
 */
export function scriptForLanguage(lang: string): Script {
  const base = lang.toLowerCase().split(/[-_]/)[0] ?? '';
  if (base === 'ko') return 'korean';
  if (base === 'ja') return 'japanese';
  if (base === 'zh') return 'chinese';
  if (base === 'hi' || base === 'mr' || base === 'ne' || base === 'sa') return 'devanagari';
  return 'latin';
}

/** 줄을 이을 때 사이에 무엇을 넣나. 🔴 CJK 에 공백을 넣으면 없던 띄어쓰기가 생긴다 */
export function lineJoiner(script: Script): string {
  return script === 'latin' || script === 'devanagari' ? ' ' : '';
}

export interface OcrLine {
  readonly text: string;
}

export interface OcrBlock {
  readonly lines: readonly OcrLine[];
}

/**
 * ML Kit 이 준 블록·줄을 **원문처럼** 잇는다(§2.3 축 ③).
 *
 * ```
 * 블록 안의 줄  →  스크립트에 따라 ' ' 또는 ''
 * 블록과 블록   →  줄바꿈 하나
 * ```
 *
 * 🔴 **줄을 잃지 않는다.** 빈 줄만 버리고 나머지는 순서 그대로 남는다.
 * ⚠ 완벽하지 않다. 한국어 책은 낱말 중간에서 줄이 바뀌기도 하고, 그때는 붙이는 것이 맞지만
 *    문장 끝에서 바뀌면 띄어쓰기가 사라진다. **그래서 결과를 편집 가능한 상태로 보여준다**(§2).
 */
export function joinBlocks(blocks: readonly OcrBlock[], script: Script): string {
  const sep = lineJoiner(script);
  const paragraphs: string[] = [];

  for (const b of blocks) {
    const lines = b.lines.map((l) => l.text.trim()).filter((t) => t !== '');
    if (lines.length === 0) continue;
    paragraphs.push(lines.join(sep));
  }
  return paragraphs.join('\n');
}

/**
 * 저장 버튼을 열어도 되나(§2.2).
 *
 * 🔴 **빈 카드가 생기면 안 된다.** 공백만 남은 인식 결과로 저장이 되면
 *    목록에 빈 줄이 생기고, 그건 사용자가 왜 생겼는지 알 수 없는 형태다.
 */
export function canSaveText(text: string): boolean {
  return text.trim() !== '';
}

/**
 * 인식이 끝나고 **지울 파일**의 경로(§2.2 · 축 ④).
 *
 * 🔴 이미지를 앱 저장소에 남기지 않는다. 다만 지울 수 있는 것은 **우리가 만든 임시 파일**뿐이다.
 *    사진 라이브러리의 원본(`content://`)은 사용자 것이라 건드리지 않는다.
 */
export function cleanupTarget(uri: string): string | null {
  if (!uri.startsWith('file://')) return null;
  return uri;
}
