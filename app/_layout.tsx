import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import '@/lib/i18n';
// 🔴 저장된 UI 언어를 부팅에 복원한다(`docs/I18N_SYSTEM.md` §2.1).
//    import 만으로 스토어가 만들어지고 onRehydrateStorage 가 i18n 에 적용한다.
import '@/features/settings/language';
import { ThemeProvider, useTheme } from '@/theme';

function Nav() {
  const { palette, isDark } = useTheme();
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
