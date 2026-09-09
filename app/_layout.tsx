import * as Notifications from 'expo-notifications';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import '@/lib/i18n';
// 🔴 저장된 UI 언어를 부팅에 복원한다(`docs/I18N_SYSTEM.md` §2.1).
//    import 만으로 스토어가 만들어지고 onRehydrateStorage 가 i18n 에 적용한다.
import '@/features/settings/language';
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
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: palette.bg },
        }}
      />
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
