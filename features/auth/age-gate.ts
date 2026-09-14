/**
 * 연령 게이트 — 순수 판정 (`docs/AUTH_SYSTEM.md` §1 · 결정 #25 · 조각 `features/auth/age-gate.ts` 승계)
 *
 * ⚠ 이 파일은 RN·expo·저장소·네트워크를 import 하지 않는다.
 *   기기 계층은 `age-store.ts`, 화면 상태는 `gate-store.ts`, 화면은 `components/AgeGate.tsx` 가 갖는다.
 *   순수하게 두는 이유는 가드(`npm run check:age-gate`)가 이 파일만 import 해
 *   **지역 × 출생연도 경계를 전수로** 재기 위해서다. 화면을 띄워야만 확인되는 규칙은 결국 확인되지 않는다.
 *
 * 근거(1차 출처는 `common/GLOBAL_DATA_COMPLIANCE.md` §2·§3):
 *   - GDPR §8      EEA 는 회원국이 13~16 에서 정한다 → 16 이면 어느 회원국에서도 안전
 *   - 개인정보보호법 §22조의2   만 14세 미만은 법정대리인 동의
 *   - COPPA        13세. 질문 자체는 의무가 아니지만 **중립적으로** 물으면 세이프하버가 생긴다
 */

/**
 * 규칙 버전. **기준 연령이나 판정식을 바꾸면 반드시 올린다** — 올리면 전원이 다시 확인한다.
 * 기록이 기기에 영구히 남는 만큼 이 숫자가 유일한 갱신 수단이다.
 *
 * 1 = 2026-09-14 최초(지역별 16/14/13 + 판정 불가 16 + 보수 판정식 · 조각 v1 과 같은 규칙).
 */
export const AGE_GATE_VERSION = 1;

/** EEA(27) + 아이슬란드·리히텐슈타인·노르웨이 + 영국 + 스위스. GDPR·UK GDPR 적용권. */
const EEA_PLUS = new Set([
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
  'IS',
  'LI',
  'NO',
  'GB',
  'CH',
]);

/**
 * 지역을 못 읽었을 때 적용할 기준 — **가장 보수적인 값**.
 *
 * 🔴 공용 문서의 일반 기본값(13)에서 **의도적으로 이탈한다.** 로케일 읽기는 실패할 수 있는데
 * 실패가 **가장 느슨한 기준**으로 떨어지면 게이트가 무의미해진다. 실패는 안전한 쪽으로 넘어져야 한다.
 */
export const FALLBACK_THRESHOLD = 16;

/**
 * 지역 코드(ISO 3166-1 alpha-2) → 기준 연령.
 *
 * ⚠ 배포 국가와 무관하게 EEA 기준을 넣는다. 로케일은 해외 거주자·기기 설정 때문에 어디로든 읽히고,
 * 게이트가 배포 설정에 기대면 국가를 넓히는 날 조용히 뚫린다.
 */
export function thresholdFor(region: string | null | undefined): number {
  const r = (region ?? '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(r)) return FALLBACK_THRESHOLD; // 판정 불가 → 최보수
  if (EEA_PLUS.has(r)) return 16;
  if (r === 'KR') return 14;
  if (r === 'US') return 13;
  return 13; // 그 외 — 보수적 기본값
}

/** 중립 입력 UI 가 그릴 출생연도 목록의 범위. 상한 = 올해, 하한 = 올해 − 120. */
export function birthYearRange(thisYear: number): { min: number; max: number } {
  return { min: thisYear - 120, max: thisYear };
}

/**
 * 통과 판정 — **보수적으로** 센다.
 *
 * 출생 **연도만** 받으므로 실나이는 최대 12개월 흔들린다(2026년의 2012년생 = 13 또는 14).
 *   관대식 `올해 − 출생연도 >= 기준`      → 기준 미달자를 들여보낸다 = **위법**
 *   보수식 `올해 − 출생연도 >= 기준 + 1`  → 자격자가 최대 11개월 늦게 들어온다 = 불편
 * 후자를 택한다. 월·일을 더 묻는 것은 *수집 항목을 늘리는 쪽*이라 해법이 아니다.
 *
 * 범위 밖·비정수는 **불통과**다 — 오작동으로 통과시키지 않는다.
 */
export function passes(birthYear: number, thisYear: number, threshold: number): boolean {
  if (!Number.isInteger(birthYear) || !Number.isInteger(thisYear)) return false;
  const { min, max } = birthYearRange(thisYear);
  if (birthYear < min || birthYear > max) return false;
  return thisYear - birthYear >= threshold + 1;
}

/**
 * 미달 판정 유예 — 365일(`docs/AUTH_SYSTEM.md` §1.5).
 *
 * 게이트가 부팅에 서므로 결과를 안 남기면 미달자가 **매 실행마다** 나이를 묻힌다.
 * 그렇다고 영구히 저장하면 **나이를 먹어도 영영 막힌다.** 생년을 저장하는 것은 §1.4 가 금지한다.
 * → 판정 결과만 남기고 1년 뒤 다시 묻는다. 받은 것이 **연도**뿐이라 1년이 정확히 그 해상도다.
 */
export const BLOCK_GRACE_DAYS = 365;

/**
 * 미달로 판정된 기록 — **생년은 없다.** 통과 기록과 같은 규율이다.
 *
 * ⚠ **닫은 것은 미달이 아니다.** 연도를 입력해 기준 미달로 판정됐을 때만 만든다.
 *   "모른다"를 "미달"로 굳히면 자격자를 1년간 막게 된다.
 */
export interface AgeBlockRecord {
  /** 언제 미달로 판정됐는지 (epoch ms) */
  blockedAt: number;
  /** 어느 기준으로 막혔는지 — 기준이 바뀌면 유예와 무관하게 다시 묻는다 */
  threshold: number;
  /** 어느 규칙 버전으로 막혔는지 */
  version: number;
}

/** 미달 기록 생성. 통과와 마찬가지로 **생년을 인자로도 받지 않는다.** */
export function makeBlockRecord(threshold: number, now: number): AgeBlockRecord {
  return { blockedAt: now, threshold, version: AGE_GATE_VERSION };
}

/**
 * 이 미달 기록이 **지금도 유예 안에 있는가**.
 *
 * 규칙 버전이 올랐거나 기기 기준이 바뀌었으면 유예를 무시하고 다시 묻는다 —
 * 다른 기준으로 막힌 기록은 지금 기준에 대해 아무것도 말해주지 않는다.
 */
export function blockActive(rec: AgeBlockRecord | null | undefined, threshold: number, now: number): boolean {
  if (!rec || typeof rec !== 'object') return false;
  if (!Number.isFinite(rec.blockedAt) || !Number.isFinite(rec.threshold)) return false;
  if (rec.version !== AGE_GATE_VERSION) return false;
  if (rec.threshold !== threshold) return false;
  const elapsed = now - rec.blockedAt;
  // 미래 시각(기기 시계를 되돌린 경우)은 유예로 치지 않는다 — 물어서 손해 볼 것이 없다.
  if (!(elapsed >= 0)) return false;
  return elapsed < BLOCK_GRACE_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * 부팅 게이트 판정 — 화면을 띄울지 여기 하나로 정한다.
 *
 * `'verified'` 통과했다 → 묻지 않는다 · (Phase 7) 기기 세션 발급 O · 로그인 O
 * `'blocked'`  미달이고 유예 안 → **묻지 않는다** · (Phase 7) 기기 세션 X · 로그인 X
 * `'ask'`      기록이 없거나 유예가 끝났다 → 게이트를 띄운다
 *
 * 🔴 세 값 중 어느 것도 **저장·복습·실천을 막지 않는다**(`docs/AUTH_SYSTEM.md` §1.2).
 */
export type BootGateDecision = 'verified' | 'blocked' | 'ask';

export function decideBootGate(
  pass: AgePassRecord | null | undefined,
  block: AgeBlockRecord | null | undefined,
  threshold: number,
  now: number,
): BootGateDecision {
  // 통과가 우선이다 — 옛 미달 기록이 남아 있어도 통과했으면 통과다.
  if (recordValid(pass)) return 'verified';
  if (blockActive(block, threshold, now)) return 'blocked';
  return 'ask';
}

/** 저장되는 통과 기록 — **생년은 없다.** 받아서 판정하고 버린다. */
export interface AgePassRecord {
  /** 언제 통과했는지 (epoch ms) */
  passedAt: number;
  /** 어느 기준으로 통과했는지 — 사후 감사용 */
  threshold: number;
  /** 어느 규칙 버전으로 통과했는지 */
  version: number;
}

/** 저장된 기록이 지금도 유효한가. 규칙 버전이 오르면 무효(= 재확인), 모양이 깨진 값도 무효. */
export function recordValid(rec: AgePassRecord | null | undefined): boolean {
  if (!rec || typeof rec !== 'object') return false;
  if (!Number.isFinite(rec.passedAt) || !Number.isFinite(rec.threshold)) return false;
  return rec.version === AGE_GATE_VERSION;
}

/**
 * 통과 기록 생성(판정에 성공했을 때만 부른다).
 *
 * 🔴 **생년을 인자로도 받지 않는다.** "실수로 같이 저장"하는 경로를 타입 수준에서 없애는 편이
 * 주석으로 금지하는 것보다 강하다.
 */
export function makeRecord(threshold: number, now: number): AgePassRecord {
  return { passedAt: now, threshold, version: AGE_GATE_VERSION };
}

/** 통과 기록 직렬화. 깨진 값은 읽는 쪽에서 무효 처리된다. */
export function serializeRecord(rec: AgePassRecord): string {
  return JSON.stringify(rec);
}

/** 저장된 문자열 → 통과 기록. 파싱 실패·모양 불일치는 `null`(= 다시 묻는다). */
export function parseRecord(raw: string | null | undefined): AgePassRecord | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v !== 'object' || v === null) return null;
    const o = v as Record<string, unknown>;
    if (typeof o.passedAt !== 'number') return null;
    if (typeof o.threshold !== 'number') return null;
    if (typeof o.version !== 'number') return null;
    return { passedAt: o.passedAt, threshold: o.threshold, version: o.version };
  } catch {
    return null;
  }
}

/** 미달 기록 직렬화. 통과 기록과 **다른 키에** 넣는다 — 한 칸에 두면 어느 쪽인지 파싱으로 갈라야 한다. */
export function serializeBlockRecord(rec: AgeBlockRecord): string {
  return JSON.stringify(rec);
}

/** 저장된 문자열 → 미달 기록. 파싱 실패·모양 불일치는 `null`(= 유예 없음 = 다시 묻는다). */
export function parseBlockRecord(raw: string | null | undefined): AgeBlockRecord | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v !== 'object' || v === null) return null;
    const o = v as Record<string, unknown>;
    if (typeof o.blockedAt !== 'number') return null;
    if (typeof o.threshold !== 'number') return null;
    if (typeof o.version !== 'number') return null;
    return { blockedAt: o.blockedAt, threshold: o.threshold, version: o.version };
  } catch {
    return null;
  }
}
