import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AgendaItem } from '@studium/core';
import * as Notifications from 'expo-notifications';
import { formatTime } from './format';

const KEY = 'studium.reminders';
const CHANNEL = 'exams';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function remindersEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEY)) === '1';
}

/** Asks for permission (creating the channel first, as Android 13+ requires) and stores the preference. */
export async function setRemindersEnabled(on: boolean): Promise<boolean> {
  if (!on) {
    await AsyncStorage.setItem(KEY, '0');
    await Notifications.cancelAllScheduledNotificationsAsync();
    return false;
  }
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Promemoria esami',
    importance: Notifications.AndroidImportance.HIGH,
  });
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  const granted = status === 'granted';
  await AsyncStorage.setItem(KEY, granted ? '1' : '0');
  return granted;
}

/** Re-schedules local reminders: the evening before (18:00) and 2 hours before each exam or booking. */
export async function syncReminders(agenda: AgendaItem[], now = Date.now()): Promise<number> {
  if (!(await remindersEnabled())) return 0;
  await Notifications.cancelAllScheduledNotificationsAsync();
  let n = 0;
  for (const item of agenda) {
    if (item.kind === 'live') continue;
    const eve = new Date(item.startsAt);
    eve.setDate(eve.getDate() - 1);
    eve.setHours(18, 0, 0, 0);
    const slots = [
      { at: eve.getTime(), body: `Domani alle ${formatTime(item.startsAt)}: ${item.title}` },
      { at: item.startsAt - 2 * 3600_000, body: `Tra 2 ore: ${item.title}` },
    ];
    for (const s of slots) {
      if (s.at <= now) continue;
      await Notifications.scheduleNotificationAsync({
        content: { title: item.kind === 'booking' ? 'Esame prenotato' : 'Appello', body: s.body },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(s.at),
          channelId: CHANNEL,
        },
      });
      n++;
    }
  }
  return n;
}
