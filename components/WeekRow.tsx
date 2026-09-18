import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import type { WeekCell } from '@/features/practice/repo';
import { WEEKDAY_KEYS, fromDate } from '@/lib/day';
import { useTheme } from '@/theme';

type Props = {
  cells: readonly WeekCell[];
  onToggle?: (day: string) => void;
};

/**
 * 이번 주 일곱 칸 — `docs/PRACTICE_SYSTEM.md` §3 · §8.
 *
 * 🚫 **못 한 날은 그냥 빈 동그라미다.** 붉은색도 느낌표도 없다(§4 · 기둥 5).
 * 🚫 예정일이 아닌 날(`weekdays` 의 주말)은 **흐리게 둘 뿐 실패로 보이지 않게** 한다.
 * 🔴 미래와 종료일 뒤는 **누를 수 없다**(🔄 2026-09-18 시작일 이전은 누를 수 있다 · `PRACTICE_SYSTEM.md` §3.2). 판정은 `compute.ts` 가 하고 여기서는 그리기만 한다.
 */
export function WeekRow({ cells, onToggle }: Props) {
  const { t } = useTranslation();
  const { palette, spacing } = useTheme();
  // 오늘 칸의 요일을 굵게 한다. 판정이 아니라 **표시**라 여기서 센다(누를 수 있는지는 compute.ts 의 checkable)
  const today = fromDate(new Date());

  return (
    <View style={styles.row}>
      {cells.map((c, i) => {
        // 🔴 칸은 월요일부터다(`weekCells`). 인덱스가 곧 `isoWeekday - 1` 이다
        const key = WEEKDAY_KEYS[i] ?? 'mon';
        const mark = c.done ? '●' : '○';
        const color = c.done ? palette.text : c.scheduled ? palette.textMuted : palette.border;
        // 🔴 누를 수 없는 칸(미래 · 시작 전 · 종료 뒤)은 흐리게 — 모든 요일이 눌리는 것처럼 보였다(2026-09-14 사용자 지적)
        const faded = !c.checkable;
        const isToday = c.day === today;
        return (
          <Pressable
            key={c.day}
            accessibilityRole="button"
            accessibilityLabel={`${t(`practice.weekday.${key}`)} ${c.day}`}
            accessibilityState={{ selected: c.done, disabled: !c.checkable }}
            disabled={!c.checkable || onToggle === undefined}
            onPress={() => onToggle?.(c.day)}
            hitSlop={6}
            style={({ pressed }) => [styles.cell, { opacity: faded ? 0.35 : pressed ? 0.6 : 1 }]}
          >
            <AppText variant={isToday ? 'label' : 'caption'} tone={isToday ? 'text' : 'muted'}>
              {t(`practice.weekday.${key}`)}
            </AppText>
            <AppText variant="section" style={{ color, marginTop: spacing.xs }}>
              {mark}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  cell: { alignItems: 'center', flex: 1 },
});
