/**
 * 광고 제거 — 순수 판정 (`docs/MONETIZATION_SYSTEM.md` §A.5 · My Word `PurchaseContext` 승계)
 *
 * ⚠ 이 파일은 RN·expo·결제 SDK 를 import 하지 않는다. 가드(`npm run check:ads`)가 node 에서 잰다.
 */

/** Play 콘솔의 관리형 상품(비소비성). ⏭ 콘솔 등록 전이다(§A.7) */
export const REMOVE_ADS_PRODUCT_ID = 'remove_ads';

/** 기기 캐시 키. 🔴 진실은 Play 이고 이 값은 부팅 직후 광고가 번쩍이지 않게 하는 용도다 */
export const AD_FREE_CACHE_KEY = 'reread-ad-free';

/**
 * 구매 목록에 우리 상품이 실제로 '구매됨' 상태로 들어 있는가.
 *
 * 🔴 `pending`(결제 대기)은 아직 지급하지 않는다. 무통장·상품권 결제가 여기 걸린다.
 *    `purchaseState` 를 안 내려주는 경우는 소유로 본다. 이미 목록에 있기 때문이다(My Word 판단).
 */
export function ownsRemoveAds(purchases: unknown): boolean {
  if (!Array.isArray(purchases)) return false;
  return purchases.some((p) => {
    if (typeof p !== 'object' || p === null) return false;
    const row = p as { productId?: unknown; purchaseState?: unknown };
    if (row.productId !== REMOVE_ADS_PRODUCT_ID) return false;
    return row.purchaseState === undefined || row.purchaseState === 'purchased';
  });
}

/** 캐시 값을 읽는다. 🔴 `'1'` 만 산 것이다. 깨진 값은 안 산 것으로 둔다(Play 가 곧 정정한다) */
export function parseAdFreeCache(raw: string | null | undefined): boolean {
  return raw === '1';
}

export function serializeAdFreeCache(owned: boolean): string {
  return owned ? '1' : '0';
}

/** `not-found` 는 복원할 구매가 없다는 뜻이다. `unavailable` 은 이 기기에서 결제를 못 쓴다는 뜻이다(Expo Go 등) */
export type PurchaseFailure = 'cancelled' | 'unavailable' | 'already-owned' | 'not-found' | 'error';

/** 결제 SDK 오류 코드를 사유로 옮긴다 */
export function purchaseFailureOf(code: unknown): PurchaseFailure {
  const c = String(code ?? '');
  if (/cancel/i.test(c)) return 'cancelled';
  if (/already[_-]?owned/i.test(c)) return 'already-owned';
  return 'error';
}
