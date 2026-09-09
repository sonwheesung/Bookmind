import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState } from 'react-native';

import { syncReminders } from '@/features/review/reminder';
import { useReminderStore } from '@/features/settings/reminder';

/**
 * 예약을 **앱이 앞으로 올 때마다** 다시 맞춘다(`docs/REVIEW_SYSTEM.md` §6.2.1).
 *
 * 🔴 로컬 알림은 발송 시점에 코드를 못 돌린다. 그래서 "복습할 게 있을 때만"은
 *    **앱이 열려 있는 동안** 다시 계산해서만 지킬 수 있다.
 * ⚠ 그래서 앱을 오래 안 열면 예약이 낡는다. 예산은 7일이고, 그건 로컬 알림의 성질이다.
 */
export function useReminderSync(): void {
  const { t } = useTranslation();
  const enabled = useReminderStore((s) => s.enabled);
  const time = useReminderStore((s) => s.time);

  useEffect(() => {
    const run = () => {
      void syncReminders(enabled, time, {
        title: t('reminder.notify.title'),
        body: t('reminder.notify.body'),
      });
    };
    run();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') run();
    });
    return () => sub.remove();
  }, [enabled, time, t]);
}
