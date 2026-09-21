/**
 * 광고 — 순수 판정 (`docs/MONETIZATION_SYSTEM.md` §A · 결정 #29 · #31)
 *
 * ⚠ 이 파일은 RN·expo·광고 SDK 를 import 하지 않는다. 가드(`npm run check:ads`)가 node 에서 직접 잰다.
 */
// 🔴 상대 경로다. `@/` 별칭은 Metro·tsc 만 알고 node 는 모른다(가드가 이 파일을 직접 import 한다).
import { blockActive, recordValid, type AgeBlockRecord, type AgePassRecord } from '../auth/age-gate.ts';

/** 광고 요청에 붙일 두 표시(§A.2) */
export interface AdRequestDecision {
  /** 맞춤 광고를 허용하는가. `false` 면 비맞춤 광고만 요청한다 */
  readonly personalized: boolean;
  /** 동의 연령 미만 표시(`tagForUnderAgeOfConsent`). 참이면 UMP 폼도 띄우지 않는다 */
  readonly underAge: boolean;
}

/**
 * 맞춤 광고 판정(§A.2).
 *
 * 🔴 **모르면 끈다.** 유효한 통과 기록이 있을 때만 맞춤 광고가 열린다.
 *    닫았거나 못 읽은 사람은 "모른다"이지 "성인"이 아니다.
 * 🔴 통과가 미달보다 우선이다(`decideBootGate` 와 같은 순서). 옛 미달 기록이 남아 있어도 통과했으면 통과다.
 */
export function decideAdRequest(
  pass: AgePassRecord | null | undefined,
  block: AgeBlockRecord | null | undefined,
  threshold: number,
  now: number,
): AdRequestDecision {
  if (recordValid(pass)) return { personalized: true, underAge: false };
  if (blockActive(block, threshold, now)) return { personalized: false, underAge: true };
  return { personalized: false, underAge: false };
}

/** 광고를 불러도 되는가. 🔴 광고 제거를 샀거나 준비 전이면 **요청 자체를 하지 않는다**(§A.1) */
export function shouldLoadAds(state: { readonly ready: boolean; readonly adFree: boolean }): boolean {
  return state.ready && !state.adFree;
}

/** 복습 끝 전면 광고의 지연(§A.3) */
export const INTERSTITIAL_DELAY_MS = 500;

/**
 * 복습 끝에서 전면 광고를 띄울까(§A.3).
 *
 * 🔴 이번 복습에서 **한 장 이상 넘겼을 때만**이다. 빈 큐로 들어와 본 끝 화면은 복습을 마친 게 아니다.
 * 🔴 한 세션에 **한 번**이다.
 */
export function shouldShowReviewInterstitial(reviewedThisSession: number, alreadyShown: boolean): boolean {
  return Number.isInteger(reviewedThisSession) && reviewedThisSession >= 1 && !alreadyShown;
}

/**
 * 광고가 들어가는 화면(§A.3). 🔴 **가드가 화면 파일과 대조한다.** 여기 없는 화면에 광고 부품이 있으면 실패다.
 */
export const AD_PLACEMENTS = {
  banner: ['app/(tabs)/index.tsx', 'app/(tabs)/knowledge.tsx', 'app/(tabs)/books.tsx', 'app/review.tsx'],
  interstitial: ['app/review.tsx'],
} as const;
