import { Tabs } from 'expo-router';
import { BookOpen, CircleCheckBig, House, Quote, Settings, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme';

/**
 * 탭 바 치수 — 아이콘 24 · 바 높이 64(M3 Expressive 의 하한 · `docs/DESIGN_REVIEW.md` §3 · 2026-09-14).
 * 🔄 2026-09-15 선택 표시를 아이콘 뒤 알약(56×32)에서 **탭 칸 전체**로 넓혔다(관리자 수정사항 #4).
 */
const ICON_SIZE = 24;
const BAR_HEIGHT = 64;

const TABS: readonly { name: 'index' | 'knowledge' | 'books' | 'practice' | 'settings'; Icon: LucideIcon }[] =
  [
    { name: 'index', Icon: House },
    { name: 'knowledge', Icon: Quote },
    { name: 'books', Icon: BookOpen },
    { name: 'practice', Icon: CircleCheckBig },
    { name: 'settings', Icon: Settings },
  ];

/** 선택 배경은 탭 칸(`tabBarActiveBackgroundColor`)이 칠한다. 아이콘은 굵기와 색만 바꾼다 */
function TabIcon({ Icon, focused }: { Icon: LucideIcon; focused: boolean }) {
  const { palette } = useTheme();
  return (
    <Icon
      size={ICON_SIZE}
      color={focused ? palette.text : palette.textMuted}
      strokeWidth={focused ? 2.25 : 1.75}
    />
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
 * 🔄 2026-09-15 관리자 *"네비게이션 바 배경이 아이콘만 되는데 해당 영역 전부 색상 변경되게"* →
 *    선택 배경을 **탭 칸 전체**(아이콘 + 글자)로 칠한다. 🔴 accent 가 아니다(탭 바는 모든 화면에 붙어 accent 가 둘이 된다).
 * 🔴 아이콘은 **탭 바에만** 쓴다. 화면 안으로 번지지 않게 한다.
 */
export default function TabLayout() {
  const { t } = useTranslation();
  const { palette, radius, spacing } = useTheme();
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
          // 🔄 2026-09-15 위아래 8 · 좌우 4 로 선택 배경이 바를 꽉 채우지 않게 한다(`DESIGN_REVIEW.md` §3).
          // 🔴 칸 높이는 **56** 이다. 검수 권고 48(바 64 안에서 위아래 8)은 에뮬레이터에서 **탭 글자 아래가 잘렸다**(아이콘 24 + 글자 18 + 라이브러리 여백).
          //    그래서 바를 8 키워 72 + 아래 인셋으로 둔다
          height: BAR_HEIGHT + spacing.sm + insets.bottom,
          paddingTop: spacing.sm,
          paddingBottom: insets.bottom + spacing.sm,
          paddingHorizontal: spacing.xs,
        },
        tabBarActiveBackgroundColor: palette.tabIndicator,
        // 🔴 라이브러리는 칸 안쪽 버튼에 모서리를 안 준다(uikit 변형 = 0). 바깥 칸에서 잘라야 배경이 둥글게 보인다
        tabBarItemStyle: { borderRadius: radius.md, overflow: 'hidden' },
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
