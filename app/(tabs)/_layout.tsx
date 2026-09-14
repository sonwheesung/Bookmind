import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme';

/** 탭 이름 글자. 🔴 활성 탭은 accent 가 아니라 진한 글자다(한 화면 accent 하나) */
function TabLabel({ focused, children }: { focused: boolean; children: string }) {
  return (
    <AppText variant="label" tone={focused ? 'text' : 'muted'}>
      {children}
    </AppText>
  );
}

/**
 * 하단 탭 다섯 — 결정 #26(2026-09-14) · `docs/UI_GUIDE.md` §2.1.
 *
 * 사용자 지시 *"홈 화면에 다 몰려있어서 쫌 보기 힘들다"* · *"설정도 … 네비게이션에 추가"*.
 *
 * 🔴 **아이콘이 없다**(에셋 0KB · 아이콘 라이브러리를 들이지 않았다 · `DESIGN_REVIEW.md` §3). 글자 탭이다.
 * 🔴 **활성 탭은 accent 가 아니라 진한 글자**다. 탭 바는 모든 화면에 붙어 있어서
 *    accent 를 쓰면 화면마다 accent 가 둘이 된다(한 화면에 accent 하나).
 */
export default function TabLayout() {
  const { t } = useTranslation();
  const { palette } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarIcon: () => null,
        tabBarIconStyle: { display: 'none' },
        tabBarStyle: { backgroundColor: palette.bg, borderTopColor: palette.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarLabel: ({ focused }) => <TabLabel focused={focused}>{t('tabs.home')}</TabLabel>,
        }}
      />
      <Tabs.Screen
        name="knowledge"
        options={{
          title: t('knowledge.list.title'),
          tabBarLabel: ({ focused }) => <TabLabel focused={focused}>{t('knowledge.list.title')}</TabLabel>,
        }}
      />
      <Tabs.Screen
        name="books"
        options={{
          title: t('books.list.title'),
          tabBarLabel: ({ focused }) => <TabLabel focused={focused}>{t('books.list.title')}</TabLabel>,
        }}
      />
      <Tabs.Screen
        name="practice"
        options={{
          title: t('practice.title'),
          tabBarLabel: ({ focused }) => <TabLabel focused={focused}>{t('practice.title')}</TabLabel>,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('settings.title'),
          tabBarLabel: ({ focused }) => <TabLabel focused={focused}>{t('settings.title')}</TabLabel>,
        }}
      />
    </Tabs>
  );
}
