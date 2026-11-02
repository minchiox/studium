import { closingSoon } from '@studium/core';
import { NativeTabs } from 'expo-router/native-tabs';
import { useExams } from '@/lib/api';
import { fonts, usePalette } from '@/lib/theme';

export default function TabsLayout() {
  const c = usePalette();
  const exams = useExams().data;
  // Something to do on the official page: results to confirm, bookings about to close.
  const todo = exams ? exams.toConfirm + closingSoon(exams.courses, Date.now(), 3).length : 0;
  return (
    <NativeTabs
      backgroundColor={c.surface}
      indicatorColor={c.inkSoft}
      iconColor={{ default: c.textMuted, selected: c.ink }}
      labelStyle={{
        default: { color: c.textMuted, fontFamily: fonts.uiMedium },
        selected: { color: c.ink, fontFamily: fonts.uiMedium },
      }}
      labelVisibilityMode="labeled"
    >
      <NativeTabs.Trigger name="home">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="courses">
        <NativeTabs.Trigger.Label>Corsi</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="menu_book" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="exams">
        <NativeTabs.Trigger.Label>Esami</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="event_available" />
        {todo > 0 ? (
          <NativeTabs.Trigger.Badge>{todo > 9 ? '9+' : String(todo)}</NativeTabs.Trigger.Badge>
        ) : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="career">
        <NativeTabs.Trigger.Label>Carriera</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="school" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="more">
        <NativeTabs.Trigger.Label>Altro</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="more_horiz" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
