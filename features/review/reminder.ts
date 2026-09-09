/**
 * 로컬 알림 — `docs/REVIEW_SYSTEM.md` §6. 기둥 7의 도달 수단이다.
 *
 * 🔴 규칙은 여기 없다. **언제 울릴지는 `notify.ts`(순수)가 정하고** 이 파일은 예약만 한다.
 * 🔴 서버 푸시는 원천적으로 불가능하다. 서버가 무엇을 복습해야 하는지 모른다(결정 #1의 대가).
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { selectAll } from '@/db';
import { planReminders } from '@/features/review/notify';

/** 예약해 둔 것을 우리 것만 골라 지우기 위한 표식 */
const TAG = 'reread-review';

export interface ReminderCopy {
  readonly title: string;
  readonly body: string;
}

async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/**
 * 🔴 안드로이드는 채널이 없으면 알림이 **조용히 안 뜬다.** 권한만 보고 판단하면 안 된다.
 * 🚫 소리·진동을 기본으로 세게 두지 않는다 — 복습은 알람이 아니다(기둥 5).
 */
async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('review', {
    name: 'Review',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200],
  });
}

/** 우리가 건 것만 취소한다. 🚫 `cancelAllScheduledNotificationsAsync` 를 쓰지 않는다 */
async function cancelOurs(): Promise<number> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  let n = 0;
  for (const item of all) {
    if (item.content.data?.tag !== TAG) continue;
    await Notifications.cancelScheduledNotificationAsync(item.identifier);
    n++;
  }
  return n;
}

/** 살아 있는 카드의 만기 시각. `selectAll` 이므로 지운 지식의 일정은 안 들어온다 */
function dueAts(): string[] {
  const rows = selectAll<{ due_at: string }>('review_schedules', { columns: ['due_at'] });
  return rows.map((r) => r.due_at);
}

export interface SyncResult {
  readonly scheduled: number;
  readonly canceled: number;
  readonly blocked: 'permission' | null;
}

/**
 * 예약을 **현재 상태로 다시 맞춘다**(§6.2.1). 앱이 열릴 때·복습을 마칠 때·설정을 바꿀 때 부른다.
 *
 * 🔴 매번 전부 지우고 다시 넣는다. 누적되면 하루에 여러 번 울린다.
 */
export function syncReminders(
  enabled: boolean,
  time: string,
  copy: ReminderCopy,
  now: Date = new Date(),
): Promise<SyncResult> {
  // 🔴 **줄을 세운다.** 아래 주석의 사고를 막는 유일한 장치다.
  const next = inFlight.then(() => runSync(enabled, time, copy, now));
  inFlight = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

/**
 * 🔴 **동시에 두 번 돌면 예약이 두 배가 된다** (2026-09-13 에뮬 실측: 7일치가 14건).
 *
 * 설정에서 스위치를 켜면 ① `toggleReminder` 가 직접 부르고 ② `enabled` 가 바뀌어
 * `useReminderSync` 의 effect 도 부른다. 둘이 **같이** 출발하면 `cancelOurs()` 가 **둘 다 빈 목록**을
 * 보고, 각자 7건씩 넣는다. 취소가 있어도 소용없다 — 취소할 시점에 아직 아무것도 없기 때문이다.
 *
 * ⚠ 화면에는 아무 표시도 안 난다. `dumpsys alarm` 을 보기 전에는 모른다.
 */
let inFlight: Promise<void> = Promise.resolve();

async function runSync(enabled: boolean, time: string, copy: ReminderCopy, now: Date): Promise<SyncResult> {
  const canceled = await cancelOurs();
  if (!enabled) return { scheduled: 0, canceled, blocked: null };

  if (!(await ensurePermission())) return { scheduled: 0, canceled, blocked: 'permission' };
  await ensureChannel();

  const when = planReminders({ dueAts: dueAts(), now, time });
  for (const date of when) {
    await Notifications.scheduleNotificationAsync({
      content: { title: copy.title, body: copy.body, data: { tag: TAG } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
        channelId: 'review',
      },
    });
  }
  return { scheduled: when.length, canceled, blocked: null };
}

/*
 * 🚫 예약 개수를 읽는 헬퍼를 두지 않는다.
 *    실측은 `adb shell dumpsys alarm` 으로 한다 — 앱이 자기 예약을 세어 보여 주면
 *    **앱이 맞다고 하는 것**을 보는 것이지 기기가 실제로 들고 있는 것을 보는 게 아니다.
 *    이중 예약 결함(§6.5)을 잡은 것도 앱이 아니라 dumpsys 였다.
 */
