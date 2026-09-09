/**
 * 복습 단서 — `docs/REVIEW_SYSTEM.md` §3 · §3.1.
 *
 * 🔴 이 파일이 있는 이유: 기둥 1 이 만드는 **기본 산출물은 원문 하나뿐인 카드**다.
 *    §3 의 화면은 책·페이지·내 생각을 단서로 쓰는데 그것들이 전부 없으면
 *    "원문을 떠올려 보세요"만 남은 **빈 상자**가 된다. 그때 무엇을 보여줄지가 §3.1 이고 여기다.
 *
 * 🔴 순수하다 — DB 도 시각도 모른다. 값을 받아 값을 돌려준다(가드가 node 에서 잰다).
 */

/** 원문 앞 몇 글자를 단서로 줄 것인가(§3.1 출발값). 절반을 보여주면 회상이 아니라 읽기가 된다. */
export const CUE_HEAD_CHARS = 12;

export interface CueInput {
  readonly content: string;
  readonly thought?: string | null;
  readonly bookTitle?: string | null;
  readonly page?: string | null;
  readonly tags?: readonly string[];
}

export type CueKind = 'thought' | 'source' | 'tags' | 'head' | 'none';

export interface Cue {
  /** 어떤 단서를 골랐나 — 화면이 이 값으로 문구를 고른다 */
  readonly kind: CueKind;
  /** 보여줄 단서 본문. `none` 이면 빈 문자열(저장 시점만 보여준다) */
  readonly text: string;
}

const clean = (v: string | null | undefined): string => (v ?? '').trim();

/**
 * 있는 것부터 순서대로 고른다(§3.1 표): 내 생각 → 책·페이지 → 태그 → 원문 앞 글자.
 *
 * ⚠ 원문이 `CUE_HEAD_CHARS` 이하이면 앞 글자 단서를 **생략**한다 —
 *   다 보여주게 되므로 회상이 성립하지 않는다. 그때는 `none` 이고 화면은 저장 시점만 남긴다.
 */
export function pickCue(input: CueInput): Cue {
  const thought = clean(input.thought);
  if (thought !== '') return { kind: 'thought', text: thought };

  const source = [clean(input.bookTitle), clean(input.page)].filter((v) => v !== '').join(' · ');
  if (source !== '') return { kind: 'source', text: source };

  const tags = (input.tags ?? []).map((t) => t.trim()).filter((t) => t !== '');
  if (tags.length > 0) return { kind: 'tags', text: tags.join(' · ') };

  const content = clean(input.content);
  // 🔴 [...content] — 이모지·한글 조합을 코드 유닛으로 자르면 글자가 깨진다
  const chars = [...content];
  if (chars.length > CUE_HEAD_CHARS) {
    return { kind: 'head', text: `${chars.slice(0, CUE_HEAD_CHARS).join('')}…` };
  }
  return { kind: 'none', text: '' };
}
