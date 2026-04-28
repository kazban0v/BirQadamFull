import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { Project, Task } from '../types';
import { appColors } from '../theme';

const NOTIFICATION_INDEX_KEY = '@birqadam:volunteer_notifications:index';
const NOTIFICATION_FINGERPRINT_KEY = '@birqadam:volunteer_notifications:fingerprint';
const NOTIFICATION_CHANNEL_ID = 'volunteer-reminders';
const DEV_NOTIFICATION_MODE_KEY = '@birqadam:volunteer_notifications:dev_mode';
const NOTIFICATION_PREFERENCES_KEY = '@birqadam:volunteer_notifications:preferences';

export type VolunteerNotificationPreferences = {
  tasks: boolean;
  deadlines: boolean;
  photoReports: boolean;
  chats: boolean;
  projects: boolean;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: VolunteerNotificationPreferences = {
  tasks: true,
  deadlines: true,
  photoReports: true,
  chats: true,
  projects: true,
};

type NotificationRecord = Record<string, string>;

type NotificationTarget =
  | { route: 'VolunteerTaskDetail'; params: { taskId: number } }
  | { route: 'VolunteerProjectDetail'; params: { projectId: number } };

type NotificationPlanItem = {
  key: string;
  title: string;
  body: string;
  triggerAt: Date;
  target: NotificationTarget;
};

type NotificationBuildOptions = {
  debugMode: boolean;
  preferences: VolunteerNotificationPreferences;
};

const ACTIVE_NOTIFICATION_STATUSES = new Set([
  'open',
  'pending',
  'in_progress',
  'active',
  'under_review',
  'revision',
]);

const isNativeNotificationsSupported = () => Platform.OS === 'ios' || Platform.OS === 'android';

const parseDateWithTime = (
  dateValue?: string | null,
  timeValue?: string | null,
  fallbackTime = '09:00'
) => {
  if (!dateValue) {
    return null;
  }

  const normalizedDate = dateValue.includes('T') ? dateValue.slice(0, 10) : dateValue.split(' ')[0];
  const normalizedTime = (timeValue || fallbackTime).slice(0, 5);
  const date = new Date(`${normalizedDate}T${normalizedTime}:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const shiftMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60 * 1000);
const shiftDays = (date: Date, days: number) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
const isFuture = (date: Date) => date.getTime() > Date.now();

const isTaskExpired = (task: Pick<Task, 'status' | 'end_date' | 'end_time' | 'is_expired'>) => {
  if (task.status === 'expired' || task.is_expired) {
    return true;
  }

  const deadline = parseDateWithTime(task.end_date, task.end_time, '23:59');
  return Boolean(deadline && deadline.getTime() < Date.now());
};

const shouldScheduleForTask = (task: Task) => {
  if (!ACTIVE_NOTIFICATION_STATUSES.has(task.status) || isTaskExpired(task)) {
    return false;
  }

  return Boolean(task.accepted || ['in_progress', 'active', 'under_review', 'revision'].includes(task.status));
};

const createTaskNotifications = (task: Task, options: NotificationBuildOptions): NotificationPlanItem[] => {
  if (!shouldScheduleForTask(task)) {
    return [];
  }

  const taskTitle = task.title || 'Задача';
  const projectTitle = task.project_title || 'Ваш проект';
  const target: NotificationTarget = {
    route: 'VolunteerTaskDetail',
    params: { taskId: task.id },
  };

  if (options.debugMode) {
    const now = new Date();
    const debugItems: NotificationPlanItem[] = [];

    if (options.preferences.tasks) {
      debugItems.push({
        key: `task:${task.id}:debug-start`,
        title: 'DEV: Скоро начнется задача',
        body: `Быстрый тест для «${taskTitle}» (${projectTitle})`,
        triggerAt: shiftMinutes(now, 0.25),
        target,
      });
    }

    if (options.preferences.deadlines) {
      debugItems.push({
        key: `task:${task.id}:debug-deadline`,
        title: 'DEV: Скоро дедлайн задачи',
        body: `Проверьте локальное уведомление по задаче «${taskTitle}».`,
        triggerAt: shiftMinutes(now, 0.5),
        target,
      });
    }

    if (task.can_upload_photo && options.preferences.photoReports) {
      debugItems.push({
        key: `task:${task.id}:debug-photo`,
        title: 'DEV: Не забудьте фотоотчет',
        body: `Тест фотоотчета для задачи «${taskTitle}».`,
        triggerAt: shiftMinutes(now, 0.75),
        target,
      });
    }

    return debugItems;
  }

  const startAt = parseDateWithTime(task.start_date, task.start_time, '09:00');
  const deadlineAt = parseDateWithTime(task.end_date, task.end_time, '18:00');
  const items: NotificationPlanItem[] = [];

  if (startAt) {
    const twoHoursBeforeStart = shiftMinutes(startAt, -120);
    if (options.preferences.tasks && isFuture(twoHoursBeforeStart)) {
      items.push({
        key: `task:${task.id}:start-120`,
        title: 'Скоро начнется задача',
        body: `Через 2 часа: ${taskTitle} (${projectTitle})`,
        triggerAt: twoHoursBeforeStart,
        target,
      });
    }
  }

  if (deadlineAt) {
    const oneDayBeforeDeadline = shiftDays(deadlineAt, -1);
    if (options.preferences.deadlines && isFuture(oneDayBeforeDeadline)) {
      items.push({
        key: `task:${task.id}:deadline-1d`,
        title: 'Завтра дедлайн задачи',
        body: `Не забудьте завершить «${taskTitle}» и подготовить результат.`,
        triggerAt: oneDayBeforeDeadline,
        target,
      });
    }

    const twoHoursBeforeDeadline = shiftMinutes(deadlineAt, -120);
    if (options.preferences.deadlines && isFuture(twoHoursBeforeDeadline)) {
      items.push({
        key: `task:${task.id}:deadline-120`,
        title: 'Скоро дедлайн задачи',
        body: `Через 2 часа дедлайн по задаче «${taskTitle}».`,
        triggerAt: twoHoursBeforeDeadline,
        target,
      });
    }

    if (task.can_upload_photo && options.preferences.photoReports) {
      const photoReminder = shiftMinutes(deadlineAt, -60);
      if (isFuture(photoReminder)) {
        items.push({
          key: `task:${task.id}:photo-60`,
          title: 'Не забудьте фотоотчет',
          body: `По задаче «${taskTitle}» пора загрузить фото результата.`,
          triggerAt: photoReminder,
          target,
        });
      }
    }
  }

  return items;
};

const createProjectNotifications = (project: Project, options: NotificationBuildOptions): NotificationPlanItem[] => {
  if (!options.preferences.projects || !project.joined || !['approved', 'active'].includes(project.status)) {
    return [];
  }

  const target: NotificationTarget = {
    route: 'VolunteerProjectDetail',
    params: { projectId: project.id },
  };

  if (options.debugMode) {
    const now = new Date();
    return [
      {
        key: `project:${project.id}:debug-start`,
        title: 'DEV: Проект скоро начнется',
        body: `Быстрый тест по проекту «${project.title}».`,
        triggerAt: shiftMinutes(now, 0.33),
        target,
      },
      {
        key: `project:${project.id}:debug-end`,
        title: 'DEV: Проект скоро завершится',
        body: `Проверьте локальное уведомление проекта «${project.title}».`,
        triggerAt: shiftMinutes(now, 0.66),
        target,
      },
    ];
  }

  const startAt = parseDateWithTime(project.start_date, null, '09:00');
  const endAt = parseDateWithTime(project.end_date, null, '18:00');
  const items: NotificationPlanItem[] = [];

  if (startAt) {
    const dayBeforeStart = shiftDays(startAt, -1);
    if (isFuture(dayBeforeStart)) {
      items.push({
        key: `project:${project.id}:start-1d`,
        title: 'Завтра стартует проект',
        body: `Проект «${project.title}» начинается завтра.`,
        triggerAt: dayBeforeStart,
        target,
      });
    }

    const startMorning = parseDateWithTime(project.start_date, null, '08:00');
    if (startMorning && isFuture(startMorning)) {
      items.push({
        key: `project:${project.id}:start-day`,
        title: 'Проект начинается сегодня',
        body: `Сегодня стартует «${project.title}». Проверьте детали участия.`,
        triggerAt: startMorning,
        target,
      });
    }
  }

  if (endAt) {
    const dayBeforeEnd = shiftDays(endAt, -1);
    if (isFuture(dayBeforeEnd)) {
      items.push({
        key: `project:${project.id}:end-1d`,
        title: 'Проект скоро завершится',
        body: `Завтра завершается проект «${project.title}».`,
        triggerAt: dayBeforeEnd,
        target,
      });
    }
  }

  return items;
};

const ensurePermissions = async () => {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }

  if (!current.canAskAgain) {
    return false;
  }

  const requested = await Notifications.requestPermissionsAsync();
  return Boolean(
    requested.granted || requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
};

const ensureChannel = async () => {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
    name: 'Напоминания BirQadam',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: appColors.primary,
  });
};

const readScheduledIndex = async (): Promise<NotificationRecord> => {
  const raw = await AsyncStorage.getItem(NOTIFICATION_INDEX_KEY);
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw) as NotificationRecord;
  } catch {
    return {};
  }
};

const writeScheduledIndex = async (value: NotificationRecord) => {
  await AsyncStorage.setItem(NOTIFICATION_INDEX_KEY, JSON.stringify(value));
};

export const isDevNotificationModeEnabled = async () => {
  const raw = await AsyncStorage.getItem(DEV_NOTIFICATION_MODE_KEY);
  return raw === '1';
};

export const setDevNotificationModeEnabled = async (enabled: boolean) => {
  await AsyncStorage.setItem(DEV_NOTIFICATION_MODE_KEY, enabled ? '1' : '0');
};

export const getVolunteerNotificationPreferences = async (): Promise<VolunteerNotificationPreferences> => {
  const raw = await AsyncStorage.getItem(NOTIFICATION_PREFERENCES_KEY);
  if (!raw) {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }

  try {
    return {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...(JSON.parse(raw) as Partial<VolunteerNotificationPreferences>),
    };
  } catch {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
};

export const setVolunteerNotificationPreferences = async (
  preferences: VolunteerNotificationPreferences
) => {
  await AsyncStorage.setItem(NOTIFICATION_PREFERENCES_KEY, JSON.stringify(preferences));
};

const buildFingerprint = (plans: NotificationPlanItem[]) =>
  JSON.stringify(
    plans
      .map((item) => ({
        key: item.key,
        triggerAt: item.triggerAt.toISOString(),
        route: item.target.route,
        params: item.target.params,
      }))
      .sort((left, right) => left.key.localeCompare(right.key))
  );

const schedulePlanItem = async (item: NotificationPlanItem) =>
  Notifications.scheduleNotificationAsync({
    content: {
      title: item.title,
      body: item.body,
      data: {
        route: item.target.route,
        ...item.target.params,
      },
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: item.triggerAt,
      channelId: Platform.OS === 'android' ? NOTIFICATION_CHANNEL_ID : undefined,
    },
  });

export const syncVolunteerLocalNotifications = async (tasks: Task[], projects: Project[]) => {
  if (!isNativeNotificationsSupported()) {
    return;
  }

  const debugMode = __DEV__ ? await isDevNotificationModeEnabled() : false;
  const preferences = await getVolunteerNotificationPreferences();

  const plans = [
    ...tasks.flatMap((task) => createTaskNotifications(task, { debugMode, preferences })),
    ...projects.flatMap((project) => createProjectNotifications(project, { debugMode, preferences })),
  ].filter((item) => isFuture(item.triggerAt));

  const nextFingerprint = buildFingerprint(plans);
  const previousFingerprint = await AsyncStorage.getItem(NOTIFICATION_FINGERPRINT_KEY);

  if (previousFingerprint === nextFingerprint) {
    return;
  }

  const permissionsGranted = await ensurePermissions();
  if (!permissionsGranted) {
    if (__DEV__) {
      console.log('[LOCAL NOTIF] Permission not granted, skip scheduling');
    }
    return;
  }

  await ensureChannel();

  const scheduledIndex = await readScheduledIndex();
  for (const notificationId of Object.values(scheduledIndex)) {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch {
      // ignore stale ids
    }
  }

  const nextIndex: NotificationRecord = {};
  for (const item of plans) {
    const notificationId = await schedulePlanItem(item);
    nextIndex[item.key] = notificationId;
  }

  await writeScheduledIndex(nextIndex);
  await AsyncStorage.setItem(NOTIFICATION_FINGERPRINT_KEY, nextFingerprint);

  if (__DEV__) {
    console.log(
      '[LOCAL NOTIF] Scheduled reminders:',
      plans.map((item) => ({
        key: item.key,
        at: item.triggerAt.toISOString(),
        title: item.title,
      })),
      'debugMode=',
      debugMode,
      'preferences=',
      preferences
    );
  }
};

export const sendDebugNotification = async () => {
  if (!isNativeNotificationsSupported()) {
    return false;
  }

  const permissionsGranted = await ensurePermissions();
  if (!permissionsGranted) {
    return false;
  }

  await ensureChannel();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'BirQadam: тест уведомления',
      body: 'Если вы это видите, локальные уведомления на устройстве работают.',
      sound: 'default',
      data: {
        route: 'Main',
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(Date.now() + 5000),
      channelId: Platform.OS === 'android' ? NOTIFICATION_CHANNEL_ID : undefined,
    },
  });

  return true;
};

export const handleNotificationNavigation = (
  data: Record<string, unknown> | undefined,
  navigate: (routeName: string, params?: Record<string, unknown>) => void
) => {
  if (!data?.route || typeof data.route !== 'string') {
    return;
  }

  const taskId =
    typeof data.taskId === 'number'
      ? data.taskId
      : typeof data.taskId === 'string'
        ? Number(data.taskId)
        : null;
  const projectId =
    typeof data.projectId === 'number'
      ? data.projectId
      : typeof data.projectId === 'string'
        ? Number(data.projectId)
        : null;

  if (data.route === 'VolunteerTaskDetail' && taskId) {
    navigate('Main', {
      screen: 'VolunteerTaskDetail',
      params: { taskId },
    });
    return;
  }

  if (data.route === 'VolunteerProjectDetail' && projectId) {
    navigate('Main', {
      screen: 'VolunteerProjectDetail',
      params: { projectId },
    });
  }
};
