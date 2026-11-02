import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AgendaItem, ExamOffer } from '@studium/core';
import * as Notifications from 'expo-notifications';
import { formatDate, formatTime } from './format';

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

let lastDeadlines: ExamOffer[] = [];

/**
 * Re-schedules local reminders: the evening before (18:00) and 2 hours before each exam or booking, and for
 * booking deadlines (one per course, see `closingSoon`) the evening before and the morning of the last day.
 * Callers without deadlines keep the last known ones.
 */
export async function syncReminders(
  agenda: AgendaItem[],
  deadlines?: ExamOffer[],
  now = Date.now(),
): Promise<number> {
  if (deadlines) lastDeadlines = deadlines;
  if (!(await remindersEnabled())) return 0;
  await Notifications.cancelAllScheduledNotificationsAsync();
  let n = 0;
  for (const o of lastDeadlines) {
    if (!o.closesOn) continue;
    const [y, m, d] = o.closesOn.split('-').map(Number);
    const lastDay = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 9, 0, 0, 0);
    const exam = formatDate(o.date).replace(/ \d{4}$/, '');
    const slots = [
      {
        at: lastDay.getTime() - 15 * 3600_000,
        body: `Domani è l’ultimo giorno per prenotare ${o.courseTitle} (appello del ${exam}).`,
      },
      {
        at: lastDay.getTime(),
        body: `Oggi è l’ultimo giorno per prenotare ${o.courseTitle} (appello del ${exam}).`,
      },
    ];
    for (const s of slots) {
      if (s.at <= now) continue;
      await Notifications.scheduleNotificationAsync({
        content: { title: 'Prenotazioni in chiusura', body: s.body },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(s.at),
          channelId: CHANNEL,
        },
      });
      n++;
    }
  }
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
