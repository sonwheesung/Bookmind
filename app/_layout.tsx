import * as Notifications from 'expo-notifications';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import '@/lib/i18n';
// 🔴 저장된 UI 언어를 부팅에 복원한다(`docs/I18N_SYSTEM.md` §2.1).
//    import 만으로 스토어가 만들어지고 onRehydrateStorage 가 i18n 에 적용한다.
import '@/features/settings/language';
import { AgeGate } from '@/components/AgeGate';
import { bootGateDecision } from '@/features/auth/age-store';
import { requestAgeVerification } from '@/features/auth/gate-store';
import { useReminderSync } from '@/hooks/useReminderSync';
import { ThemeProvider, useTheme } from '@/theme';

/**
 * 앱이 앞에 있을 때 알림이 오면 어떻게 보일지.
 * 🚫 소리·배지를 켜지 않는다 — 앱을 보고 있는 사람을 또 찌르지 않는다(기둥 5).
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

function Nav() {
  const { palette, isDark } = useTheme();
  useReminderSync();

  /*
   * 🔴 연령 게이트 — 부팅에 선다. **벽이 아니다**(`docs/AUTH_SYSTEM.md` §1.2 · 결정 #25 · 조각 승계).
   *    결과를 기다리지 않는다. 닫든 미달이든 저장·복습·실천은 막지 않는다.
   * ⏭ Phase 7: 통과했을 때만 기기 세션을 만든다(조각 `ensureDeviceSession`). 지금은 만들 식별자가 없다.
   */
  useEffect(() => {
    void (async () => {
      const decision = await bootGateDecision();
      // 'verified'(통과) · 'blocked'(미달 유예 안) 둘 다 묻지 않는다
      if (decision === 'ask') await requestAgeVerification();
    })();
  }, []);
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: palette.bg },
        }}
      />
      {/* 🔴 연령 게이트는 라우트가 아니라 앱 전체를 덮는 층이다. 딥링크로 지나칠 수 없게 여기서 한 번 그린다 */}
      <AgeGate />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <Nav />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
