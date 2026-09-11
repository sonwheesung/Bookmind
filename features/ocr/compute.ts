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

/** ML Kit 이 줄마다 주는 좌표. **원본 픽셀** 기준이다(§2.2.1) */
export interface Frame {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface OcrLine {
  readonly text: string;
  /** 🔴 없을 수 있다. 없는 줄은 고를 수 없으므로 폴백이 필요하다(§2.2) */
  readonly frame?: Frame | null;
}

export interface OcrBlock {
  readonly lines: readonly OcrLine[];
}

/** 화면이 고르게 되는 줄 하나 */
export interface SelectableLine {
  readonly id: string;
  readonly text: string;
  readonly frame: Frame;
}

/** 사진 위에 그릴 박스 하나. 표시 좌표계다(§2.2.1) */
export interface ScaledBox {
  readonly id: string;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/**
 * 블록·줄을 **고를 수 있는 목록**으로 편다(§2.2 · 결정 #22).
 *
 * 🔴 **좌표 없는 줄을 조용히 버리지 않는다.** 책담은 `if (!line.frame) return` 으로 버리는데,
 *    그러면 그 문장을 **가져올 방법이 아예 없어진다.** 우리는 몇 줄이 빠졌는지 세어 돌려주고,
 *    화면은 그 수가 0 이 아니면 전체 텍스트 경로를 폴백으로 함께 보여준다.
 * ⚠ 빈 텍스트는 버린다. 그건 고를 것이 없는 줄이다.
 */
export function collectLines(blocks: readonly OcrBlock[]): {
  readonly lines: readonly SelectableLine[];
  readonly missingFrames: number;
} {
  const lines: SelectableLine[] = [];
  let missingFrames = 0;

  blocks.forEach((block, bi) => {
    block.lines.forEach((line, li) => {
      const text = line.text.trim();
      if (text === '') return;
      const f = line.frame;
      if (f == null || f.width <= 0 || f.height <= 0) {
        missingFrames += 1;
        return;
      }
      lines.push({ id: `${bi}-${li}`, text, frame: f });
    });
  });

  return { lines, missingFrames };
}

/** 좌표를 못 받은 줄이 있으면 전체 텍스트 경로를 함께 내보낸다(§2.2) */
export function needsFallback(missingFrames: number): boolean {
  return missingFrames > 0;
}

/**
 * 읽기 순서로 정렬한다 — 위에서 아래로, 같은 줄이면 왼쪽에서 오른쪽으로.
 *
 * 🔴 **같은 줄인지를 고정 픽셀로 재지 않는다.** 책담은 `10` 을 썼는데, 그 값은 사진 해상도에 딸린다.
 *    12MP 사진의 글자 높이는 60px 쯤이고 작은 사진은 20px 쯤이라 **같은 10 이 전혀 다른 뜻**이 된다.
 *    → 두 줄의 **글자 높이 절반**을 문턱으로 쓴다. 해상도가 바뀌어도 같은 판정이 나온다.
 * ⚠ 원본 배열을 건드리지 않는다(`readonly` 를 받는다).
 */
export function readingOrder(lines: readonly SelectableLine[]): readonly SelectableLine[] {
  return [...lines].sort((a, b) => {
    const tolerance = Math.max(a.frame.height, b.frame.height) / 2;
    const dy = a.frame.top - b.frame.top;
    if (Math.abs(dy) > tolerance) return dy;
    return a.frame.left - b.frame.left;
  });
}

/**
 * 고른 줄을 원문처럼 잇는다(§2.2).
 *
 * 🔴 **구분자는 스크립트를 따른다.** 책담은 언제나 공백으로 잇는데, 한국어 책에서 낱말 중간에
 *    줄이 끊기면 `습관은 반 복이다` 처럼 **없던 띄어쓰기**가 생긴다.
 * 🚫 **낱말 안의 공백을 우리가 정리하지 않는다.** 원문을 고치는 쪽이 더 나쁘다. 사용자가 편집한다.
 */
export function joinSelected(
  lines: readonly SelectableLine[],
  selectedIds: ReadonlySet<string>,
  script: Script,
): string {
  const sep = lineJoiner(script);
  return readingOrder(lines.filter((l) => selectedIds.has(l.id)))
    .map((l) => l.text)
    .join(sep)
    .trim();
}

/**
 * 원본 픽셀 좌표를 **표시 좌표**로 환산한다(§2.2.1).
 *
 * 🔴 **폭이 0 이면 빈 배열을 돌려준다.** 배치가 끝나기 전에 그리면 박스가 왼쪽 위에 뭉친다.
 *    아무것도 안 그리는 것이 맞다.
 * 🚫 이 식은 **이미지를 폭에 맞춰 세로를 늘려 그릴 때만** 참이다. `maxHeight` 를 걸면 거짓이 된다.
 */
export function scaleBoxes(
  lines: readonly SelectableLine[],
  imageWidth: number,
  displayWidth: number,
): readonly ScaledBox[] {
  if (imageWidth <= 0 || displayWidth <= 0) return [];
  const scale = displayWidth / imageWidth;
  return lines.map((l) => ({
    id: l.id,
    left: l.frame.left * scale,
    top: l.frame.top * scale,
    width: l.frame.width * scale,
    height: l.frame.height * scale,
  }));
}

/** 사진을 폭에 맞춰 그릴 때의 표시 높이. 🔴 박스 배율과 **같은 식**을 써야 좌표가 맞는다 */
export function displayHeight(
  imageWidth: number,
  imageHeight: number,
  displayWidth: number,
): number {
  if (imageWidth <= 0 || displayWidth <= 0) return 0;
  return imageHeight * (displayWidth / imageWidth);
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
 * 고른 것으로 저장을 열어도 되나(§2.2).
 *
 * 🔴 **하나도 안 골랐으면 잠긴다.** 인식이 성공했다는 것과 사용자가 고를 것을 골랐다는 것은
 *    다른 사실이다. 둘을 한 조건으로 묶으면 빈 카드가 생긴다.
 */
export function canSaveSelection(
  lines: readonly SelectableLine[],
  selectedIds: ReadonlySet<string>,
  script: Script,
): boolean {
  return canSaveText(joinSelected(lines, selectedIds, script));
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
