import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';

import {
  decideBootGate,
  makeBlockRecord,
  makeRecord,
  parseBlockRecord,
  parseRecord,
  recordValid,
  serializeBlockRecord,
  serializeRecord,
  thresholdFor,
  type AgeBlockRecord,
  type AgePassRecord,
  type BootGateDecision,
} from './age-gate';

/**
 * 연령 게이트 — 기기 계층 (`docs/AUTH_SYSTEM.md` §1.4 · 조각 `features/auth/api/age-store.ts` 승계)
 *
 * 순수 판정은 `age-gate.ts` 가 갖는다. 여기는 **지역을 읽고 기록을 넣고 뺀다.**
 *
 * 🔴 저장소가 조각과 다르다. 조각은 SQLite `app_settings` 에 뒀고 우리는 **AsyncStorage** 다.
 *    백업 교체는 DB 만 바꾸므로 연령 기록을 건드리지 않고, 백업 파일에도 들어가지 않는다.
 */

const PASS_KEY = 'reread-age-pass';
const BLOCK_KEY = 'reread-age-block';

/**
 * 기기 지역(ISO 3166-1 alpha-2). 못 읽으면 `null` — 판정이 최보수(16)로 떨어진다.
 *
 * ⚠ IP 지오로케이션을 쓰지 않는다. 정확도와 프라이버시 양쪽에서 나쁘다.
 * 🚫 앱 UI 언어로 읽지 않는다. 영어 UI 를 쓰는 한국 거주자가 13 으로 떨어진다.
 */
export function deviceRegion(): string | null {
  try {
    return getLocales()[0]?.regionCode ?? null;
  } catch {
    // 로케일 읽기가 던져도 앱이 죽으면 안 된다. null 이면 최보수로 판정된다.
    return null;
  }
}

/** 이 기기에 적용할 기준 연령. */
export function deviceThreshold(): number {
  return thresholdFor(deviceRegion());
}

async function read(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    // 🔴 못 읽으면 "기록 없음"이다 = 다시 묻는다. 통과로 넘어지지 않는다
    return null;
  }
}

async function write(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    // 못 쓰면 다음 실행에 다시 묻는다. 여기서 앱을 막지 않는다
  }
}

/** 저장된 통과 기록. 없거나 규칙 버전이 올랐으면 `null`(= 다시 물어야 한다). */
export async function loadAgePass(): Promise<AgePassRecord | null> {
  const rec = parseRecord(await read(PASS_KEY));
  return recordValid(rec) ? rec : null;
}

/** 통과를 기록한다. **판정에 성공했을 때만** 부른다. 🔴 연도를 인자로 받지 않는다 */
export async function saveAgePass(threshold: number): Promise<void> {
  await write(PASS_KEY, serializeRecord(makeRecord(threshold, Date.now())));
}

/** 저장된 미달 기록. 모양이 깨졌으면 `null`(= 유예 없음). 유효기간 판정은 `blockActive` 가 한다. */
export async function loadAgeBlock(): Promise<AgeBlockRecord | null> {
  return parseBlockRecord(await read(BLOCK_KEY));
}

/**
 * 미달을 기록한다. **연도를 입력해 기준 미달로 판정됐을 때만** 부른다.
 *
 * 🚫 사용자가 답하지 않고 닫았을 때는 부르지 않는다 — 그건 "모른다"이지 "미달"이 아니다.
 */
export async function saveAgeBlock(threshold: number): Promise<void> {
  await write(BLOCK_KEY, serializeBlockRecord(makeBlockRecord(threshold, Date.now())));
}

/**
 * 부팅 게이트 판정 — 화면을 띄울지의 유일한 질문.
 *
 * 판정식은 순수 계층(`decideBootGate`)이 갖는다. 여기는 저장소에서 꺼내 넘기기만 한다.
 */
export async function bootGateDecision(): Promise<BootGateDecision> {
  const threshold = deviceThreshold();
  const [pass, block] = await Promise.all([loadAgePass(), loadAgeBlock()]);
  return decideBootGate(pass, block, threshold, Date.now());
}
