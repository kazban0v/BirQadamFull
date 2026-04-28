import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { CalendarEvent } from '../types';
import { appColors } from '../theme';

const REMINDER_PREFIX = '@birqadam:calendar_reminder:';
const DEFAULT_REMINDER_MINUTES = 30;
const REMINDABLE_TASK_STATUSES = new Set(['in_progress', 'under_review', 'revision']);

const padTimePart = (value: string) => value.padStart(2, '0');

const normalizeTime = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const [hours = '09', minutes = '00'] = value.split(':');
  return `${padTimePart(hours)}:${padTimePart(minutes)}`;
};

const buildEventDateTime = (event: CalendarEvent) => {
  if (!event.date) {
    return null;
  }

  const normalizedTime = normalizeTime(event.start_time) ?? (event.is_all_day ? '09:00' : null);
  if (!normalizedTime) {
    return null;
  }

  const date = new Date(`${event.date}T${normalizedTime}:00`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

const getStorageKey = (eventId: string) => `${REMINDER_PREFIX}${eventId}`;

export const getCalendarReminderEligibility = (
  event: CalendarEvent,
  minutesBefore = DEFAULT_REMINDER_MINUTES
) => {
  if (event.source_type !== 'task' || !event.task_id) {
    return {
      allowed: false,
      reason: 'Напоминание доступно только для задач.',
    };
  }

  if (event.status === 'open') {
    return {
      allowed: false,
      reason: 'Сначала примите задачу, потом можно включить напоминание.',
    };
  }

  if (!REMINDABLE_TASK_STATUSES.has(event.status ?? '')) {
    return {
      allowed: false,
      reason: 'Для текущего статуса задачи напоминание недоступно.',
    };
  }

  const eventDate = buildEventDateTime(event);
  if (!eventDate) {
    return {
      allowed: false,
      reason: 'Для этой задачи не указана корректная дата начала.',
    };
  }

  const triggerDate = new Date(eventDate.getTime() - minutesBefore * 60 * 1000);
  if (triggerDate.getTime() <= Date.now()) {
    return {
      allowed: false,
      reason: 'Для этой даты напоминание уже нельзя поставить.',
    };
  }

  return {
    allowed: true,
    reason: null,
    eventDate,
    triggerDate,
  };
};

const ensureNotificationPermissions = async () => {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return;
  }

  const requested = await Notifications.requestPermissionsAsync();
  if (!requested.granted && requested.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL) {
    throw new Error('Для напоминаний нужен доступ к уведомлениям.');
  }
};

const ensureAndroidChannel = async () => {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync('calendar-reminders', {
    name: 'Напоминания календаря',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: appColors.primary,
  });
};

export const getCalendarReminderId = async (eventId: string) => {
  return AsyncStorage.getItem(getStorageKey(eventId));
};

export const hasCalendarReminder = async (eventId: string) => {
  const reminderId = await getCalendarReminderId(eventId);
  return Boolean(reminderId);
};

export const disableCalendarReminder = async (eventId: string) => {
  const reminderId = await getCalendarReminderId(eventId);
  if (reminderId) {
    await Notifications.cancelScheduledNotificationAsync(reminderId);
  }

  await AsyncStorage.removeItem(getStorageKey(eventId));
};

export const enableCalendarReminder = async (
  event: CalendarEvent,
  minutesBefore = DEFAULT_REMINDER_MINUTES
) => {
  const eligibility = getCalendarReminderEligibility(event, minutesBefore);
  if (!eligibility.allowed || !eligibility.triggerDate) {
    throw new Error(eligibility.reason || 'Напоминание для этой задачи недоступно.');
  }

  await ensureNotificationPermissions();
  await ensureAndroidChannel();
  await disableCalendarReminder(event.id);

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Напоминание о задаче',
      body: `Через ${minutesBefore} мин: ${event.title}`,
      data: {
        eventId: event.id,
        sourceType: event.source_type,
        sourceId: event.source_id,
      },
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: eligibility.triggerDate,
      channelId: Platform.OS === 'android' ? 'calendar-reminders' : undefined,
    },
  });

  await AsyncStorage.setItem(getStorageKey(event.id), notificationId);
  return notificationId;
};
