import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { IconButton } from '@/components/IconButton';
import type { WeekCell } from '@/features/practice/repo';
import { WEEKDAY_KEYS, fromDate } from '@/lib/day';
import { formatMonth } from '@/lib/format';
import { deviceLocale } from '@/lib/i18n';
import { useTheme } from '@/theme';

type Props = {
  /** `YYYY-MM` */
  month: string;
  /** `monthCells` 결과. `null` 은 그 달이 아닌 빈칸이다 */
  cells: readonly (WeekCell | null)[];
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToggle?: (day: string) => void;
};

const DOT = 36;

/**
 * 실천 기록 달력 한 달 — `docs/PRACTICE_SYSTEM.md` §3.1.
 *
 * 🔴 판정(누를 수 있나 · 예정일인가)은 `monthCells` 가 한다. 여기서는 그리기만 한다.
 * 🚫 달 성공률도, 빈칸 강조도 없다(§4). 한 날은 채운 동그라미, 안 한 날은 그냥 숫자다.
 * 🔴 누를 수 없는 날(시작 전 · 미래 · 종료 뒤)은 흐리게 둔다. 주 칸(`WeekRow`)과 같은 표시다.
 */
export function MonthCalendar({ month, cells, canPrev, canNext, onPrev, onNext, onToggle }: Props) {
  const { t } = useTranslation();
  const { palette, spacing } = useTheme();
  // 오늘 테두리는 판정이 아니라 표시라 여기서 센다
  const today = fromDate(new Date());

  const weeks: (WeekCell | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <View>
      <View style={[styles.row, { marginBottom: spacing.sm }]}>
        <IconButton
          icon={ChevronLeft}
          label={t('practice.calendar.prev')}
          onPress={onPrev}
          disabled={!canPrev}
        />
        {/* 🔴 달 이름은 기기 로케일이다(`formatDate` 와 같다 · `CLAUDE.md` §9) */}
        <AppText variant="section" style={styles.center}>
          {formatMonth(month, deviceLocale())}
        </AppText>
        <IconButton
          icon={ChevronRight}
          label={t('practice.calendar.next')}
          onPress={onNext}
          disabled={!canNext}
        />
      </View>

      <View style={[styles.row, { marginBottom: spacing.xs }]}>
        {WEEKDAY_KEYS.map((key) => (
          <AppText key={key} variant="caption" tone="muted" style={[styles.grow, styles.center]}>
            {t(`practice.weekday.${key}`)}
          </AppText>
        ))}
      </View>

      {weeks.map((week) => (
        <View key={week.find((c) => c !== null)?.day ?? 'blank'} style={styles.row}>
          {week.map((c, i) => {
            if (c === null) return <View key={`blank-${i}`} style={styles.grow} />;
            const isToday = c.day === today;
            return (
              <Pressable
                key={c.day}
                accessibilityRole="button"
                accessibilityLabel={c.day}
                accessibilityState={{ selected: c.done, disabled: !c.checkable }}
                disabled={!c.checkable || onToggle === undefined}
                onPress={() => onToggle?.(c.day)}
                style={({ pressed }) => [
                  styles.grow,
                  styles.cell,
                  { paddingVertical: spacing.xs, opacity: !c.checkable ? 0.35 : pressed ? 0.6 : 1 },
                ]}
              >
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor: c.done ? palette.text : 'transparent',
                      borderColor: isToday && !c.done ? palette.text : 'transparent',
                    },
                  ]}
                >
                  <AppText
                    variant={isToday ? 'label' : 'body'}
                    tone={c.done || c.scheduled ? 'text' : 'muted'}
                    style={c.done ? { color: palette.bg } : undefined}
                  >
                    {String(Number(c.day.slice(8)))}
                  </AppText>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1 },
  center: { flex: 1, textAlign: 'center' },
  cell: { alignItems: 'center' },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
