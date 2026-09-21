import { Platform } from 'react-native';

/**
 * 광고 SDK 를 **없을 수도 있는 것**으로 읽는다(My Word 방어 규약 승계).
 * 네이티브 모듈이 없는 환경(Expo Go)에서 import 만으로 앱이 죽으면 안 된다.
 */
type AdsModule = typeof import('react-native-google-mobile-ads');

let mod: AdsModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  mod = Platform.OS === 'android' ? (require('react-native-google-mobile-ads') as AdsModule) : null;
} catch {
  mod = null;
}

export const adsSdk: AdsModule | null = mod;
