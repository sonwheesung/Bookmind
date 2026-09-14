import { Tabs } from 'expo-router';
import { BookOpen, CircleCheckBig, House, Quote, Settings, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme';

/**
 * 탭 바 치수 — Material 3 내비게이션 바를 따른다(아이콘 24 · 선택 알약 56×32).
 * 바 높이는 M3 Expressive 의 하한 64 다(`docs/DESIGN_REVIEW.md` §3 · 2026-09-14).
 */
const ICON_SIZE = 24;
const PILL_WIDTH = 56;
const PILL_HEIGHT = 32;
const BAR_HEIGHT = 64;

const TABS: readonly { name: 'index' | 'knowledge' | 'books' | 'practice' | 'settings'; Icon: LucideIcon }[] =
  [
    { name: 'index', Icon: House },
    { name: 'knowledge', Icon: Quote },
    { name: 'books', Icon: BookOpen },
    { name: 'practice', Icon: CircleCheckBig },
    { name: 'settings', Icon: Settings },
  ];

/** 선택된 탭은 아이콘 뒤에 엷은 알약. 🔴 accent 를 쓰지 않는다(한 화면 accent 하나) */
function TabIcon({ Icon, focused }: { Icon: LucideIcon; focused: boolean }) {
  const { palette, radius } = useTheme();
  return (
    <View
      style={[
        styles.pill,
        { borderRadius: radius.full, backgroundColor: focused ? palette.tabIndicator : 'transparent' },
      ]}
    >
      <Icon
        size={ICON_SIZE}
        color={focused ? palette.text : palette.textMuted}
        strokeWidth={focused ? 2.25 : 1.75}
      />
    </View>
  );
}

function TabLabel({ focused, children }: { focused: boolean; children: string }) {
  return (
    <AppText variant="label" tone={focused ? 'text' : 'muted'} numberOfLines={1}>
      {children}
    </AppText>
  );
}

/**
 * 하단 탭 다섯 — 결정 #26 · `docs/UI_GUIDE.md` §2.1.
 *
 * 🔄 2026-09-14 사용자 *"하단 네비게이션 디자인 너무 별로인데? 다른 앱들 참고해볼래"* →
 *    글자만 있던 탭을 **아이콘 + 글자 · 선택은 엷은 알약**으로 바꿨다(Material 3 내비게이션 바 · iOS 탭 바 참고).
 * 🔴 아이콘은 **탭 바에만** 쓴다. 화면 안으로 번지지 않게 한다.
 */
export default function TabLayout() {
  const { t } = useTranslation();
  const { palette, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  // 🔴 키를 글자 그대로 부른다. `t(변수)` 로 부르면 check:i18n 이 키를 못 보고 "죽은 키"로 센다(2026-09-14)
  const titles = {
    index: t('tabs.home'),
    knowledge: t('knowledge.list.title'),
    books: t('books.list.title'),
    practice: t('practice.title'),
    settings: t('settings.title'),
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: palette.bg,
          borderTopColor: palette.border,
          height: BAR_HEIGHT + insets.bottom,
          paddingTop: spacing.sm,
          paddingBottom: insets.bottom,
        },
      }}
    >
      {TABS.map(({ name, Icon }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title: titles[name],
            tabBarIcon: ({ focused }) => <TabIcon Icon={Icon} focused={focused} />,
            tabBarLabel: ({ focused }) => <TabLabel focused={focused}>{titles[name]}</TabLabel>,
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  pill: { width: PILL_WIDTH, height: PILL_HEIGHT, alignItems: 'center', justifyContent: 'center' },
});
