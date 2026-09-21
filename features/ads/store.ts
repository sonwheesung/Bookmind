import { create } from 'zustand';

import { deviceThreshold, loadAgeBlock, loadAgePass } from '@/features/auth/age-store';
import { startPurchases, usePurchase } from '@/features/purchase/store';

import { decideAdRequest, type AdRequestDecision } from './compute';
import { adsSdk } from './sdk';

/**
 * 광고 부팅 상태 (`docs/MONETIZATION_SYSTEM.md` §A.1)
 *
 * 🔴 **연령 확인이 끝나기 전에 광고를 요청하지 않는다.** 미달인 사람에게 맞춤 광고가 한 번이라도 나가면 되돌릴 수 없다.
 * 🔴 **광고 제거를 산 사람은 SDK 초기화도 하지 않는다.** 보이지 않을 광고를 부르지 않는다.
 */
interface AdsState {
  /** SDK 초기화까지 끝나 광고를 요청해도 되는가 */
  ready: boolean;
  /** 요청에 붙일 표시. `ready` 전에는 가장 보수적인 값이다 */
  request: AdRequestDecision;
  /** 동의 수정 경로를 설정에 보여야 하는가(UMP 가 요구하는 지역) */
  privacyOptionsRequired: boolean;
}

export const useAds = create<AdsState>(() => ({
  ready: false,
  request: { personalized: false, underAge: false },
  privacyOptionsRequired: false,
}));

let started = false;

/**
 * 부팅에서 **연령 확인이 끝난 뒤** 한 번 부른다(`app/_layout.tsx`).
 * 실패해도 앱은 그대로 돈다. 광고만 안 나온다.
 */
export async function startAds(): Promise<void> {
  if (started) return;
  started = true;

  // 광고 제거 여부를 Play 에 물은 뒤에 정한다. 산 사람의 기기에서 SDK 를 깨우지 않는다
  await startPurchases();
  if (usePurchase.getState().adFree || adsSdk === null) return;
  const sdk = adsSdk;

  const [pass, block] = await Promise.all([loadAgePass(), loadAgeBlock()]);
  let request = decideAdRequest(pass, block, deviceThreshold(), Date.now());

  try {
    // 🔴 미달이면 미성년 표시로 묻는다. UMP 가 동의 폼을 띄우지 않고 비맞춤으로 간다
    const info = await sdk.AdsConsent.requestInfoUpdate({ tagForUnderAgeOfConsent: request.underAge });
    const after = request.underAge ? info : await sdk.AdsConsent.loadAndShowConsentFormIfRequired();
    useAds.setState({
      privacyOptionsRequired:
        after.privacyOptionsRequirementStatus === sdk.AdsConsentPrivacyOptionsRequirementStatus.REQUIRED,
    });
    // 동의가 필요한데 못 받았으면 광고를 요청하지 않는다
    if (!after.canRequestAds) return;
  } catch {
    // UMP 가 실패해도(오프라인 등) 동의가 필요 없는 지역일 수 있다. 비맞춤으로만 간다
    request = { ...request, personalized: false };
  }

  try {
    await sdk.default().setRequestConfiguration({ tagForUnderAgeOfConsent: request.underAge });
    await sdk.default().initialize();
    useAds.setState({ ready: true, request });
  } catch {
    // 초기화가 실패했다. 광고 없이 간다
  }
}

/** 설정의 [광고 개인정보 설정]. UMP 가 요구하는 지역에서만 보인다 */
export async function openAdPrivacyOptions(): Promise<void> {
  if (adsSdk === null) return;
  try {
    await adsSdk.AdsConsent.showPrivacyOptionsForm();
  } catch {
    // 폼을 못 띄웠다. 다음에 다시 누르면 된다
  }
}
