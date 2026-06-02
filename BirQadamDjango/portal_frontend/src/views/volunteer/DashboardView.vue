












































































































































































































































































































































































































































































































































































































































<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch, watchEffect, nextTick } from 'vue';
import { useRouter } from 'vue-router';

import { useAuthStore } from '@/stores/auth';
import { useDashboardStore } from '@/stores/dashboard';
import type { VolunteerTaskSummary, VolunteerPhotoSummary } from '@/services/dashboard';
import { uploadPhotoReport, fetchTaskPhotos } from '@/services/photoReports';
import { acceptTask, declineTask, completeTask } from '@/services/tasks';
import { fetchVolunteerStats } from '@/services/stats';
import telegramIcon from '@/assets/icons/telegram.png';

const router = useRouter();

const authStore = useAuthStore();
const dashboardStore = useDashboardStore();

const defaultSummary = {
  active_tasks: 0,
  completed_tasks: 0,
  upcoming_tasks: 0,
  active_projects: 0,
  pending_photos: 0,
  total_photos: 0,
  unread_notifications: 0,
};

const loading = computed(() => dashboardStore.loading);
const summary = computed(() => dashboardStore.summary ?? defaultSummary);
// Защита от undefined/null - всегда возвращаем массив
const tasks = computed(() => dashboardStore.tasks ?? []);
const projects = computed(() => dashboardStore.projects ?? []);
const photos = computed(() => dashboardStore.photos ?? []);
const stats = ref<Awaited<ReturnType<typeof fetchVolunteerStats>> | null>(null);
const statsLoading = ref(false);

const selectedTask = ref<VolunteerTaskSummary | null>(null);
const uploadDialog = ref(false);
const uploadForm = reactive({
  files: [] as File[],
  comment: '',
});
const uploadError = ref<string | null>(null);
const uploading = ref(false);
const taskPhotos = ref<VolunteerPhotoSummary[]>([]);
const taskPhotosLoading = ref(false);
const snackbar = reactive({
  show: false,
  message: '',
  color: 'success',
});
const taskActionLoading = ref<number | null>(null);

const taskStatusMap: Record<string, { text: string; color: string }> = {
  open: { text: 'Открыто', color: 'primary' },
  in_progress: { text: 'В работе', color: 'warning' },
  completed: { text: 'Выполнено', color: 'success' },
  failed: { text: 'Отклонено', color: 'error' },
  closed: { text: 'Закрыто', color: 'grey-darken-1' },
};

const projectStatusMap: Record<string, { text: string; color: string }> = {
  pending: { text: 'На модерации', color: 'warning' },
  approved: { text: 'Активен', color: 'success' },
  rejected: { text: 'Отклонён', color: 'error' },
};

const photoStatusMap: Record<string, { text: string; color: string }> = {
  pending: { text: 'Ожидает', color: 'warning' },
  approved: { text: 'Одобрено', color: 'success' },
  rejected: { text: 'Отклонено', color: 'error' },
};

const volunteerName = computed(() => {
  const user = authStore.user;
  return user?.full_name || user?.username || 'Волонтёр BirQadam';
});

const hasProfile = computed(() => {
  // API возвращает full_name (которое содержит значение user.name из базы)
  // Также проверяем phone_number, так как это тоже часть профиля
  const fullName = authStore.user?.full_name || '';
  const phoneNumber = authStore.user?.phone_number || '';
  const hasFullName = Boolean(fullName && fullName.trim());
  const hasPhone = Boolean(phoneNumber && phoneNumber.trim());
  // Профиль считается заполненным, если есть имя ИЛИ телефон
  const result = hasFullName || hasPhone;
  console.log('[ONBOARDING DEBUG] hasProfile:', { 
    fullName, 
    phoneNumber, 
    hasFullName, 
    hasPhone, 
    result 
  });
  return result;
});

// Проверяем, присоединился ли волонтёр к проекту
// Шаг считается выполненным, если есть активные проекты (is_active=True) в summary
// ИЛИ есть проекты в загруженных данных (в dashboard возвращаются только присоединённые проекты)
const hasActiveProject = computed(() => {
  const activeProjectsCount = summary.value?.active_projects ?? 0;
  const projectsCount = projects.value?.length ?? 0;
  
  console.log('[ONBOARDING DEBUG] hasActiveProject:', {
    activeProjectsCount,
    projectsCount,
    summary: summary.value,
    projects: projects.value,
  });
  
  // Проверяем summary (более надёжный источник)
  if (activeProjectsCount > 0) {
    console.log('[ONBOARDING DEBUG] hasActiveProject: TRUE (from summary)');
    return true;
  }
  // Проверяем загруженные проекты как резервный вариант
  // В dashboard возвращаются только проекты, к которым пользователь присоединился (is_active=True)
  // Поэтому если есть проекты в списке, значит пользователь присоединился
  if (projectsCount > 0) {
    console.log('[ONBOARDING DEBUG] hasActiveProject: TRUE (from projects list)');
    return true;
  }
  console.log('[ONBOARDING DEBUG] hasActiveProject: FALSE');
  return false;
});

// Проверяем, есть ли у волонтёра задачи
// Шаг "Присоединитесь к проекту" считается выполненным, если есть проекты ИЛИ задачи
const hasActiveTask = computed(() => {
  const activeTasksCount = summary.value?.active_tasks ?? 0;
  const tasksCount = tasks.value?.length ?? 0;
  
  console.log('[ONBOARDING DEBUG] hasActiveTask:', {
    activeTasksCount,
    tasksCount,
    summary: summary.value,
    tasks: tasks.value,
  });
  
  // Проверяем summary
  if (activeTasksCount > 0) {
    console.log('[ONBOARDING DEBUG] hasActiveTask: TRUE (from summary)');
    return true;
  }
  // Проверяем загруженные задачи
  if (tasksCount > 0) {
    console.log('[ONBOARDING DEBUG] hasActiveTask: TRUE (from tasks list)');
    return true;
  }
  console.log('[ONBOARDING DEBUG] hasActiveTask: FALSE');
  return false;
});

// Проверяем, отправил ли волонтёр фотоотчёт
// Шаг считается выполненным, если есть хотя бы одно фото с любым статусом
const hasPhotoReport = computed(() => {
  const totalPhotosCount = summary.value?.total_photos ?? 0;
  const photosCount = photos.value?.length ?? 0;
  
  // Проверяем summary (более надёжный источник)
  if (totalPhotosCount > 0) {
    return true;
  }
  // Проверяем загруженные фото
  if (photosCount > 0) {
    return true;
  }
  // Дополнительная проверка: есть ли фото с любым статусом в списке задач
  const hasPhotoInTasks = tasks.value.some(task => 
    task.has_photo_report === true || 
    (task.photo_status && task.photo_status !== null && task.photo_status !== undefined)
  );
  if (hasPhotoInTasks) {
    return true;
  }
  return false;
});

// Реактивный счетчик для принудительного обновления UI
const onboardingUpdateKey = ref(0);

const onboardingSteps = computed(() => {
  // Используем onboardingUpdateKey для принудительного пересчета
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  void onboardingUpdateKey.value;
  
  // Вычисляем статусы выполнения шагов
  const profileDone = hasProfile.value;
  const projectDone = hasActiveProject.value || hasActiveTask.value;
  const reportDone = hasPhotoReport.value;

  console.log('[ONBOARDING DEBUG] onboardingSteps computed:', {
    profileDone,
    projectDone,
    reportDone,
    hasActiveProject: hasActiveProject.value,
    hasActiveTask: hasActiveTask.value,
    hasPhotoReport: hasPhotoReport.value,
    updateKey: onboardingUpdateKey.value,
  });

  const rawSteps = [
    {
      key: 'profile',
      title: 'Заполните профиль',
      description: 'Добавьте имя и контакты, чтобы организаторы могли быстро связаться с вами.',
      done: profileDone,
    },
    {
      key: 'project',
      title: 'Присоединитесь к проекту',
      description: 'Выберите интересное направление и возьмите первую задачу.',
      done: projectDone,
    },
    {
      key: 'report',
      title: 'Отправьте фотоотчёт',
      description: 'Подтвердите участие фотографиями и получайте благодарности и рейтинг.',
      done: reportDone,
    },
  ];

  // Находим первый невыполненный шаг - это будет активный шаг
  const currentStep = rawSteps.find(s => !s.done);
  const currentKey = currentStep?.key || null;
  
  // Если все шаги выполнены, currentKey будет null, но это нормально - показываем завершенное состояние
  console.log('[ONBOARDING DEBUG] currentStep:', currentStep, 'currentKey:', currentKey, 'allDone:', rawSteps.every(s => s.done));

  const steps = rawSteps.map((step, index) => {
    let status: 'done' | 'active' | 'waiting';
    if (step.done) {
      status = 'done';
    } else if (step.key === currentKey) {
      status = 'active';
    } else {
      status = 'waiting';
    }
    
    // isCurrent должен быть true только для одного шага - активного и невыполненного
    // Если все шаги выполнены (currentKey === null), ни один шаг не будет активным
    const isCurrent = currentKey !== null && step.key === currentKey && !step.done;
    
    const stepResult = { ...step, status, index, isCurrent, total: rawSteps.length };
    
    // Логируем каждый шаг для отладки
    if (index === 0 || step.done || isCurrent) {
      console.log(`[ONBOARDING DEBUG] Step "${step.key}":`, {
        done: step.done,
        status,
        isCurrent,
        updateKey: onboardingUpdateKey.value,
      });
    }
    
    return stepResult;
  });
  
  console.log('[ONBOARDING DEBUG] Final steps array:', steps.map(s => ({ key: s.key, done: s.done, status: s.status, isCurrent: s.isCurrent })));
  
  return steps;
});

const onboardingProgress = computed(() => {
  const total = onboardingSteps.value.length;
  const completed = onboardingSteps.value.filter((step) => step.status === 'done').length;
  return Math.round((completed / total) * 100);
});

// Показываем онбординг всегда, чтобы пользователь видел свой прогресс
// Даже когда все шаги выполнены, показываем завершенное состояние с прогрессом 100%
const showOnboarding = computed(() => {
  // Всегда показываем онбординг - это помогает пользователю видеть свой прогресс
  // В будущем можно добавить опцию для скрытия после завершения
  return true;
});

const showGlobalLoading = computed(
  () =>
    loading.value &&
    !tasks.value.length &&
    !projects.value.length &&
    !photos.value.length,
);

const stepIconConfig = (st: string) => {
  const map: Record<string, { icon: string; bg: string }> = {
    done:    { icon: 'mdi-check',            bg: 'linear-gradient(135deg,#4caf50,#2e7d32)' },
    active:  { icon: 'mdi-progress-clock',   bg: 'linear-gradient(135deg,#8bc34a,#558b2f)' },
    error:   { icon: 'mdi-alert',            bg: 'linear-gradient(135deg,#e53935,#c62828)' },
    waiting: { icon: 'mdi-dots-horizontal',  bg: 'linear-gradient(135deg,#90a4ae,#607d8b)' },
  };
  return map[st] || map.waiting;
};

const quickActions = [
  {
    title: 'Найти проект',
    description: 'Просматривайте доступные проекты и присоединяйтесь к интересным.',
    icon: 'mdi-magnify',
    accent: '#558b2f',
    bg: 'rgba(139, 195, 74, 0.1)',
    to: '/volunteer/projects',
    tag: 'Проекты',
  },
  {
    title: 'Мои задачи',
    description: 'Просматривайте назначенные задачи и отслеживайте прогресс.',
    icon: 'mdi-clipboard-text-outline',
    accent: '#00695c',
    bg: 'rgba(0, 137, 123, 0.1)',
    to: '/volunteer/tasks',
    tag: 'Задачи',
  },
  {
    title: 'Фотоотчёты',
    description: 'Загружайте фотографии выполненных заданий.',
    icon: 'mdi-camera-plus-outline',
    accent: '#283593',
    bg: 'rgba(57, 73, 171, 0.1)',
    to: '/volunteer/photo-reports',
    tag: 'Отчёты',
  },
  {
    title: 'Достижения',
    description: 'Просматривайте свои награды, рейтинг и уровни.',
    icon: 'mdi-trophy-outline',
    accent: '#e65100',
    bg: 'rgba(230, 81, 0, 0.1)',
    to: '/volunteer/achievements',
    tag: 'Награды',
  },
  {
    title: 'Профиль',
    description: 'Обновите личную информацию и настройки.',
    icon: 'mdi-account-outline',
    accent: '#bf360c',
    bg: 'rgba(230, 74, 25, 0.1)',
    to: '/volunteer/profile',
    tag: 'Профиль',
  },
];

const infoCards = [
  {
    title: 'Синхронизация с Telegram',
    text: 'Все действия из веб-портала сразу появляются в Telegram-боте.',
    iconSrc: telegramIcon,
    accent: '#0088cc',
    bg: 'rgba(0,136,204,0.08)',
  },
  {
    title: 'Мгновенные уведомления',
    text: 'Получайте пуш-уведомления о новых задачах и комментариях.',
    icon: 'mdi-bell-badge-outline',
    accent: '#e65100',
    bg: 'rgba(230,81,0,0.08)',
  },
  {
    title: 'Рейтинг и достижения',
    text: 'Зарабатывайте рейтинг за выполнение задач и получайте достижения.',
    icon: 'mdi-star-circle-outline',
    accent: '#4527a0',
    bg: 'rgba(94,53,177,0.08)',
  },
];

const navigate = (to: string) => router.push(to);

const snackbarIcon = computed(() => {
  if (snackbar.color === 'error') return 'mdi-alert-circle';
  if (snackbar.color === 'warning') return 'mdi-alert';
  if (snackbar.color === 'info' || snackbar.color === 'primary') return 'mdi-information';
  return 'mdi-check-circle';
});

function formatStatus(
  value: string,
  map: Record<string, { text: string; color: string }>,
) {
  if (!value) {
    return { text: '—', color: 'primary' };
  }
  return map[value] ?? { text: value, color: 'primary' };
}

function formatDate(value: string | null | undefined, options: Intl.DateTimeFormatOptions = {}) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'long',
    ...options,
  }).format(date);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatTime(value: string | null | undefined) {
  if (!value) return '';
  return value.slice(0, 5);
}

function showSnackbar(message: string, color: string = 'success') {
  snackbar.message = message;
  snackbar.color = color;
  snackbar.show = true;
}

async function loadStats() {
  statsLoading.value = true;
  try {
    stats.value = await fetchVolunteerStats();
  } finally {
    statsLoading.value = false;
  }
}

// Отслеживаем изменения данных в store напрямую для автоматического обновления онбординга
// Используем watch на каждый отдельный ref для более точного отслеживания
watch(
  () => dashboardStore.summary,
  (newSummary, oldSummary) => {
    console.log('[ONBOARDING DEBUG] Watch summary triggered:', {
      oldSummary: oldSummary ? {
        active_projects: oldSummary.active_projects,
        active_tasks: oldSummary.active_tasks,
        total_photos: oldSummary.total_photos,
      } : null,
      newSummary: newSummary ? {
        active_projects: newSummary.active_projects,
        active_tasks: newSummary.active_tasks,
        total_photos: newSummary.total_photos,
      } : null,
    });
    // Принудительно обновляем UI через увеличение счетчика
    onboardingUpdateKey.value++;
    console.log('[ONBOARDING DEBUG] Summary updated, forcing UI update, key:', onboardingUpdateKey.value);
  },
  { deep: true, immediate: false }
);

watch(
  () => dashboardStore.projects?.length,
  (newLength, oldLength) => {
    console.log('[ONBOARDING DEBUG] Watch projects length triggered:', { oldLength, newLength });
    if (newLength !== oldLength) {
      onboardingUpdateKey.value++;
      console.log('[ONBOARDING DEBUG] Projects count changed, forcing UI update, key:', onboardingUpdateKey.value);
    }
  },
  { immediate: false }
);

watch(
  () => dashboardStore.tasks?.length,
  (newLength, oldLength) => {
    console.log('[ONBOARDING DEBUG] Watch tasks length triggered:', { oldLength, newLength });
    if (newLength !== oldLength) {
      onboardingUpdateKey.value++;
      console.log('[ONBOARDING DEBUG] Tasks count changed, forcing UI update, key:', onboardingUpdateKey.value);
    }
  },
  { immediate: false }
);

watch(
  () => dashboardStore.photos?.length,
  (newLength, oldLength) => {
    console.log('[ONBOARDING DEBUG] Watch photos length triggered:', { oldLength, newLength });
    if (newLength !== oldLength) {
      onboardingUpdateKey.value++;
      console.log('[ONBOARDING DEBUG] Photos count changed, forcing UI update, key:', onboardingUpdateKey.value);
    }
  },
  { immediate: false }
);

// Отслеживаем завершение загрузки dashboard для принудительного обновления UI
watch(
  () => dashboardStore.loading,
  (isLoading, wasLoading) => {
    // Когда загрузка завершается (было true, стало false), обновляем UI
    if (wasLoading && !isLoading) {
      console.log('[ONBOARDING DEBUG] Dashboard loading completed, forcing UI update');
      nextTick(() => {
        onboardingUpdateKey.value++;
        console.log('[ONBOARDING DEBUG] UI update after loading, key:', onboardingUpdateKey.value);
      });
    }
  },
  { immediate: false }
);

// Также отслеживаем через watchEffect для дополнительной гарантии
watchEffect(() => {
  const activeProjects = summary.value?.active_projects ?? 0;
  const activeTasks = summary.value?.active_tasks ?? 0;
  const totalPhotos = summary.value?.total_photos ?? 0;
  const projectsCount = projects.value?.length ?? 0;
  const tasksCount = tasks.value?.length ?? 0;
  const photosCount = photos.value?.length ?? 0;
  
  // Логируем только при реальных изменениях (не при каждом рендере)
  // Используем nextTick чтобы избежать лишних логов
  nextTick(() => {
    console.log('[ONBOARDING DEBUG] WatchEffect computed values:', {
      activeProjects,
      activeTasks,
      totalPhotos,
      projectsCount,
      tasksCount,
      photosCount,
    });
  });
});

onMounted(async () => {
  console.log('[ONBOARDING DEBUG] Component mounted, loading data...');
  await authStore.initialize();
  console.log('[ONBOARDING DEBUG] Auth initialized, user:', authStore.user);
  await dashboardStore.loadDashboard();
  console.log('[ONBOARDING DEBUG] Dashboard loaded:', {
    summary: dashboardStore.summary,
    projects: dashboardStore.projects,
    tasks: dashboardStore.tasks,
    photos: dashboardStore.photos,
  });
  await loadStats();
  console.log('[ONBOARDING DEBUG] Stats loaded');
});

const canAcceptTask = (task: VolunteerTaskSummary) => task.status === 'open' && !task.accepted;
const canCompleteTask = (task: VolunteerTaskSummary) => task.accepted && !task.completed;
const canDeclineTask = (task: VolunteerTaskSummary) => {
  // Можно отклонить, если задача не завершена и (не принята или принята)
  return task.status !== 'completed';
};
const isActionLoading = (task: VolunteerTaskSummary) => taskActionLoading.value === task.task_id;

const uploadAllowed = computed(() => {
  if (!selectedTask.value) return false;
  if (!selectedTask.value.can_upload_photo) return false;
  return taskPhotos.value.length === 0;
});

function resetUploadState() {
  uploadForm.files = [];
  uploadForm.comment = '';
  uploadError.value = null;
  taskPhotos.value = [];
  taskPhotosLoading.value = false;
}

async function loadTaskPhotos(taskId: number) {
  taskPhotosLoading.value = true;
  try {
    const data = await fetchTaskPhotos(taskId);
    taskPhotos.value = data.photos;
    if (selectedTask.value) {
      selectedTask.value.has_photo_report = data.photos.length > 0;
      selectedTask.value.photo_status = data.photos[0]?.status ?? selectedTask.value.photo_status;
      if (data.photos.length > 0) {
        selectedTask.value.can_upload_photo = false;
      }
    }
  } catch (error) {
    taskPhotos.value = [];
  } finally {
    taskPhotosLoading.value = false;
  }
}

function openUploadDialog(task: VolunteerTaskSummary) {
  selectedTask.value = task;
  resetUploadState();
  uploadDialog.value = true;
  loadTaskPhotos(task.task_id);
}

function closeUploadDialog() {
  uploadDialog.value = false;
  selectedTask.value = null;
}

function handleFileChange(files: File[]) {
  uploadForm.files = files;
  uploadError.value = null;
}

async function submitPhotoReport() {
  if (!selectedTask.value) return;
  if (!uploadForm.files.length) {
    uploadError.value = 'Выберите хотя бы одну фотографию.';
    return;
  }

  if (uploadForm.files.length > 5) {
    uploadError.value = 'Можно загрузить максимум 5 фотографий.';
    return;
  }

  if (!uploadAllowed.value) {
    uploadError.value = 'Сейчас нельзя отправить новый фотоотчёт для этой задачи.';
    return;
  }

  const formData = new FormData();
  uploadForm.files.forEach((file) => {
    formData.append('photos', file);
  });
  if (uploadForm.comment) {
    formData.append('comment', uploadForm.comment);
  }

  uploading.value = true;
  uploadError.value = null;

  try {
    const response = await uploadPhotoReport(selectedTask.value.task_id, formData);
    taskPhotos.value = response.photos;
    selectedTask.value.has_photo_report = true;
    selectedTask.value.photo_status = response.photos[0]?.status ?? 'pending';
    selectedTask.value.can_upload_photo = false;
    showSnackbar(response.message || 'Фотоотчёт отправлен.', 'success');
    await dashboardStore.loadDashboard(true);
    const updatedTask = tasks.value.find((task) => task.task_id === selectedTask.value?.task_id);
    if (updatedTask) {
      selectedTask.value = { ...updatedTask };
    }
  } catch (error: any) {
    const detail = error?.response?.data?.detail || error?.response?.data?.error || 'Не удалось отправить фотоотчёт.';
    uploadError.value = detail;
  } finally {
    uploading.value = false;
  }
}

async function handleTaskAction(action: 'accept' | 'decline' | 'complete', task: VolunteerTaskSummary) {
  taskActionLoading.value = task.task_id;
  try {
    let response:
      | Awaited<ReturnType<typeof acceptTask>>
      | Awaited<ReturnType<typeof declineTask>>
      | Awaited<ReturnType<typeof completeTask>>;

    if (action === 'accept') {
      response = await acceptTask(task.task_id);
    } else if (action === 'decline') {
      response = await declineTask(task.task_id);
    } else {
      response = await completeTask(task.task_id);
    }

    showSnackbar(response.message || 'Действие выполнено.', 'success');
    await dashboardStore.loadDashboard(true);

    if (selectedTask.value) {
      const updated = tasks.value.find((item) => item.task_id === selectedTask.value?.task_id);
      if (updated) {
        selectedTask.value = { ...updated };
      }
    }
  } catch (error: any) {
    const detail = error?.response?.data?.detail || error?.response?.data?.error || 'Не удалось выполнить действие.';
    showSnackbar(detail, 'error');
  } finally {
    taskActionLoading.value = null;
  }
}
</script>

<template>
  <div class="dashboard">
    <v-overlay
      v-model="showGlobalLoading"
      class="loading-overlay"
      persistent
      scrim="rgba(139, 195, 74, 0.08)"
    >
      <div class="loading-overlay__content">
        <v-progress-circular indeterminate color="primary" size="54" width="6" />
        <p class="text-body-1 text-medium-emphasis mb-0">Подгружаем ваши проекты и задания…</p>
      </div>
    </v-overlay>

    <!-- ─── Hero ─── -->
    <div class="hero">
      <div class="hero__content">
        <div class="hero__badge">
          <v-icon icon="mdi-human-handsup" size="15" />
          Кабинет волонтёра
            </div>
        <h1 class="hero__title">
          Привет, {{ volunteerName }}! 👋
            </h1>
        <p class="hero__sub">
          Присоединяйтесь к проектам, выполняйте задачи и развивайтесь. Весь инструментарий в одном месте.
            </p>
        <div class="hero__btns">
          <button class="hero__btn hero__btn--solid" @click="navigate('/volunteer/projects')">
            <v-icon icon="mdi-magnify" size="17" />
                Найти проект
          </button>
          <button class="hero__btn hero__btn--outline" @click="navigate('/volunteer/tasks')">
            <v-icon icon="mdi-clipboard-text-outline" size="17" />
            Мои задачи
          </button>
            </div>
          </div>
      <div class="hero__art" aria-hidden="true">
        <div class="hero__orb hero__orb--1" />
        <div class="hero__orb hero__orb--2" />
        <v-icon icon="mdi-hand-heart" class="hero__art-icon" />
          </div>
    </div>

    <!-- ─── Onboarding ─── -->
    <div v-if="showOnboarding" class="section-card">
      <div class="onboarding-top">
            <div>
          <div class="status-pill" style="color: #8bc34a; background: rgba(139,195,74,0.1); border-color: rgba(139,195,74,0.2);">
            <v-icon icon="mdi-progress-clock" size="13" />
                Путь волонтёра
            </div>
          <h2 class="card-title mt-2">Онбординг волонтёра</h2>
          <p class="card-sub">Этапы подготовки к активной работе.</p>
        </div>
        <div class="progress-widget">
          <v-progress-circular
            :model-value="onboardingProgress"
            color="#8bc34a"
            size="54"
            width="5"
            bg-color="rgba(0,0,0,0.07)"
          >
            <span class="progress-pct">{{ onboardingProgress }}%</span>
                </v-progress-circular>
          <span class="progress-lbl">
            {{ onboardingProgress === 0 ? 'Начните' : onboardingProgress < 100 ? 'В процессе' : 'Готово' }}
          </span>
            </div>
          </div>

      <!-- Steps -->
      <div class="steps-grid" :key="`onboarding-${onboardingUpdateKey}`">
        <div
          v-for="(step, index) in onboardingSteps"
          :key="`${step.key}-${onboardingUpdateKey}`"
          class="step-card"
          :class="[`step-card--${step.status}`, { 'step-card--current': step.isCurrent }]"
          :style="{ animationDelay: `${index * 0.15}s` }"
              >
          <!-- Анимированная линия соединения -->
          <div 
            v-if="index < onboardingSteps.length - 1" 
            class="step-connector"
            :class="{ 'step-connector--active': step.status === 'done' }"
          >
            <div class="step-connector__line"></div>
            <div 
              class="step-connector__progress" 
              :style="{ width: step.status === 'done' ? '100%' : '0%' }"
            ></div>
                </div>
          
          <div class="step-card__num">{{ step.index + 1 }} / {{ step.total }}</div>
          <div 
            class="step-card__icon" 
            :style="{ background: stepIconConfig(step.status)?.bg || 'rgba(0,0,0,0.1)' }"
            :class="{ 
              'step-card__icon--pulse': step.isCurrent && step.status === 'active',
              'step-card__icon--success': step.status === 'done'
            }"
          >
            <v-icon :icon="stepIconConfig(step.status)?.icon || 'mdi-circle'" size="20" color="white" />
            <!-- Анимация для активного шага -->
            <div v-if="step.isCurrent && step.status === 'active'" class="step-card__icon-ring"></div>
          </div>
          <div class="step-card__title">{{ step.title }}</div>
          <p class="step-card__desc">{{ step.description }}</p>
          
          <!-- Кнопка действия для активного шага -->
          <div v-if="step.isCurrent && step.status === 'active'" class="step-card__action mt-2">
            <v-btn
              v-if="step.key === 'profile'"
              color="primary"
              variant="flat"
              size="small"
              class="text-none w-100 font-weight-bold"
              @click="navigate('/volunteer/profile')"
            >
              Заполнить
            </v-btn>
            <v-btn
              v-else-if="step.key === 'project'"
              color="primary"
              variant="flat"
              size="small"
              class="text-none w-100 font-weight-bold"
              @click="navigate('/volunteer/projects')"
            >
              Найти проект
            </v-btn>
            <v-btn
              v-else-if="step.key === 'report'"
              color="primary"
              variant="flat"
              size="small"
              class="text-none w-100 font-weight-bold"
              @click="navigate('/volunteer/tasks')"
            >
              К задачам
            </v-btn>
          </div>

          <div v-if="step.isCurrent && step.status === 'active'" class="step-card__now">
            <span class="step-card__now-dot"></span>
            Сейчас
          </div>
        </div>
      </div>
    </div>

    <!-- ─── Как работает BirQadam ─── -->
    <div class="section-card">
      <div class="onboarding-top">
        <div>
          <div class="status-pill" style="color: #00897b; background: rgba(0,137,123,0.1); border-color: rgba(0,137,123,0.2);">
            <v-icon icon="mdi-help-circle-outline" size="13" />
            Инструкция
          </div>
          <h2 class="card-title mt-2">Как работает платформа BirQadam</h2>
          <p class="card-sub">Простой цикл волонтерства от выбора проекта до получения наград.</p>
        </div>
      </div>
      
      <div class="info-row">
        <div class="info-tile" style="background: rgba(139, 195, 74, 0.05); border: 1px solid rgba(139, 195, 74, 0.1);">
          <div class="info-tile__icon" style="color: #558b2f; background: rgba(139, 195, 74, 0.15);">
            <v-icon icon="mdi-magnify" size="22" />
          </div>
          <div class="info-tile__title">1. Найдите проект</div>
          <p class="info-tile__text">
            Перейдите в раздел проектов, изучите доступные инициативы в вашем городе или онлайн и подайте заявку.
          </p>
        </div>

        <div class="info-tile" style="background: rgba(0, 137, 123, 0.05); border: 1px solid rgba(0, 137, 123, 0.1);">
          <div class="info-tile__icon" style="color: #00695c; background: rgba(0, 137, 123, 0.15);">
            <v-icon icon="mdi-clipboard-text-play-outline" size="22" />
          </div>
          <div class="info-tile__title">2. Выполняйте задачи</div>
          <p class="info-tile__text">
            После одобрения организатором, вы увидите доступные задачи проекта. Выбирайте их и приступайте к делу.
          </p>
        </div>

        <div class="info-tile" style="background: rgba(57, 73, 171, 0.05); border: 1px solid rgba(57, 73, 171, 0.1);">
          <div class="info-tile__icon" style="color: #283593; background: rgba(57, 73, 171, 0.15);">
            <v-icon icon="mdi-camera-outline" size="22" />
          </div>
          <div class="info-tile__title">3. Отправьте отчет</div>
          <p class="info-tile__text">
            Подтвердите выполненное задание, загрузив фотографии и комментарий прямо в личном кабинете.
          </p>
        </div>

        <div class="info-tile" style="background: rgba(230, 81, 0, 0.05); border: 1px solid rgba(230, 81, 0, 0.1);">
          <div class="info-tile__icon" style="color: #bf360c; background: rgba(230, 81, 0, 0.15);">
            <v-icon icon="mdi-trophy-outline" size="22" />
          </div>
          <div class="info-tile__title">4. Получайте рейтинг</div>
          <p class="info-tile__text">
            Организаторы одобрят отчет, и вы получите баллы XP, которые повышают ваш уровень и открывают достижения!
          </p>
        </div>
      </div>
    </div>

    <!-- ─── Stats ─── -->
    <div class="stats-grid">
        <div 
          class="stat-card stat-card--primary stat-card--clickable" 
          @click="navigate('/volunteer/achievements')"
        >
          <div class="stat-card__icon">
          <v-icon icon="mdi-star-circle" size="28" />
          </div>
          <div class="stat-card__body">
            <div class="stat-card__label">Общая оценка</div>
            <div v-if="statsLoading" class="stat-card__loader">
            <v-progress-circular indeterminate color="white" size="24" width="3" />
            </div>
            <template v-else>
              <div class="stat-card__value">{{ stats?.rating ?? 0 }}</div>
            <div class="stat-card__hint">Уровень {{ stats?.level ?? 1 }} · Награды</div>
            </template>
          </div>
        </div>
        <div class="stat-card stat-card--success">
          <div class="stat-card__icon">
          <v-icon icon="mdi-checkbox-marked-circle-outline" size="28" />
          </div>
          <div class="stat-card__body">
            <div class="stat-card__label">Завершено задач</div>
            <div class="stat-card__value">{{ summary.completed_tasks }}</div>
          <div class="stat-card__hint">Спасибо за помощь!</div>
          </div>
        </div>
        <div class="stat-card stat-card--warning">
          <div class="stat-card__icon">
          <v-icon icon="mdi-folder-account-outline" size="28" />
          </div>
          <div class="stat-card__body">
            <div class="stat-card__label">Активные проекты</div>
            <div class="stat-card__value">{{ summary.active_projects }}</div>
            <div class="stat-card__hint">Участия в сообществах</div>
          </div>
        </div>
        <div class="stat-card stat-card--info">
          <div class="stat-card__icon">
          <v-icon icon="mdi-bell-badge-outline" size="28" />
          </div>
          <div class="stat-card__body">
            <div class="stat-card__label">Уведомления</div>
            <div class="stat-card__value">{{ summary.unread_notifications }}</div>
            <div class="stat-card__hint">Новых сообщений</div>
          </div>
        </div>
    </div>

    <!-- ─── Quick actions ─── -->
    <div>
      <div class="actions-head">Быстрые действия</div>
      <div class="actions-grid">
        <div
          v-for="action in quickActions"
          :key="action.title"
          class="action-tile"
          @click="navigate(action.to)"
        >
          <div class="action-tile__tag" :style="{ color: action.accent, background: action.bg }">
            {{ action.tag }}
          </div>
          <div class="action-tile__icon" :style="{ background: action.bg }">
            <v-icon :icon="action.icon" size="26" :style="{ color: action.accent }" />
          </div>
          <div class="action-tile__title">{{ action.title }}</div>
          <p class="action-tile__desc">{{ action.description }}</p>
          <div class="action-tile__arrow" :style="{ color: action.accent }">
            <v-icon icon="mdi-arrow-right" size="18" />
          </div>
        </div>
      </div>
    </div>

    <!-- ─── Tasks ─── -->
    <div class="section-card">
      <div class="section-card__row">
        <div>
          <h2 class="card-title">Мои задания</h2>
          <p class="card-sub">Следите за дедлайнами и отправляйте результаты вовремя</p>
            </div>
            <v-btn
              color="primary"
              variant="text"
              prepend-icon="mdi-refresh"
              class="text-none font-weight-semibold"
              :loading="loading"
              @click="dashboardStore.loadDashboard(true)"
            >
              Обновить
            </v-btn>
      </div>
      <div class="section-card__content">
            <v-skeleton-loader v-if="loading" type="list-item-three-line@3" />
            <template v-else>
              <div v-if="tasks.length" class="task-grid">
                <v-sheet
                  v-for="task in tasks"
                  :key="task.task_id ?? task.id"
                  class="task-card"
                  rounded="xl"
                  elevation="1"
                >
                  <div class="task-card__header">
                    <div>
                      <h3 class="task-card__title">{{ task.text }}</h3>
                      <v-chip
                        size="x-small"
                        color="primary"
                        variant="tonal"
                        prepend-icon="mdi-folder"
                        class="text-none font-weight-medium"
                      >
                        {{ task.project_title }}
                      </v-chip>
                    </div>
                    <div class="task-card__status">
                      <v-chip
                        :color="formatStatus(task.status, taskStatusMap).color"
                        size="small"
                        variant="flat"
                        class="text-none font-weight-semibold"
                      >
                        {{ formatStatus(task.status, taskStatusMap).text }}
                      </v-chip>
                      <v-chip
                        v-if="task.is_expired && !task.completed"
                        color="error"
                        size="small"
                        variant="tonal"
                        prepend-icon="mdi-clock-alert"
                      >
                        Просрочено
                      </v-chip>
                    </div>
                  </div>

                  <div class="task-card__meta">
                    <div class="task-meta">
                      <v-icon icon="mdi-map-marker" size="16" />
                      <span>{{ task.project_city || 'Город не указан' }}</span>
                    </div>
                    <div class="task-meta">
                      <v-icon icon="mdi-calendar" size="16" />
                      <span>{{ formatDate(task.deadline_date) }}</span>
                    </div>
                    <div class="task-meta">
                      <v-icon icon="mdi-clock-outline" size="16" />
                      <span>
                        {{
                          task.start_time || task.end_time
                            ? `${formatTime(task.start_time)}–${formatTime(task.end_time)}`
                            : 'Гибкий график'
                        }}
                      </span>
                    </div>
                  </div>

                  <div class="task-card__photos" v-if="task.photo_status">
                    <v-chip
                      :color="formatStatus(task.photo_status, photoStatusMap).color"
                      size="x-small"
                      variant="tonal"
                      prepend-icon="mdi-camera"
                      class="text-none font-weight-medium"
                    >
                      Фотоотчёт: {{ formatStatus(task.photo_status, photoStatusMap).text }}
                    </v-chip>
                  </div>

                  <div class="task-card__actions">
                    <div class="d-flex flex-wrap ga-2">
                      <v-btn
                        v-if="canAcceptTask(task)"
                        color="primary"
                        variant="flat"
                        size="small"
                        class="text-none font-weight-semibold"
                        prepend-icon="mdi-hand-okay"
                        :loading="isActionLoading(task)"
                        :disabled="isActionLoading(task)"
                        @click="handleTaskAction('accept', task)"
                      >
                        Взяться
                      </v-btn>
                      <v-btn
                        v-if="canCompleteTask(task)"
                        color="success"
                        variant="flat"
                        size="small"
                        class="text-none font-weight-semibold"
                        prepend-icon="mdi-check"
                        :loading="isActionLoading(task)"
                        :disabled="isActionLoading(task)"
                        @click="handleTaskAction('complete', task)"
                      >
                        Выполнено
                      </v-btn>
                      <v-btn
                        v-if="canDeclineTask(task)"
                        color="error"
                        variant="text"
                        size="small"
                        class="text-none font-weight-semibold"
                        prepend-icon="mdi-close"
                        :loading="isActionLoading(task)"
                        :disabled="isActionLoading(task)"
                        @click="handleTaskAction('decline', task)"
                      >
                        Отказаться
                      </v-btn>
                    </div>
                    <v-btn
                      :variant="task.has_photo_report ? 'flat' : 'outlined'"
                      :color="task.has_photo_report ? 'success' : 'primary'"
                      size="small"
                      class="text-none font-weight-semibold"
                      prepend-icon="mdi-camera-plus"
                      :disabled="(!task.has_photo_report && !task.can_upload_photo) || isActionLoading(task)"
                      @click="openUploadDialog(task)"
                    >
                      {{ task.has_photo_report ? 'Фотоотчёт' : 'Загрузить фото' }}
                    </v-btn>
                  </div>
                </v-sheet>
              </div>

              <div v-else class="empty-state">
                <v-avatar size="72" color="primary-lighten-4">
                  <v-icon icon="mdi-calendar-clock" size="40" color="primary" />
                </v-avatar>
                <h3 class="text-h6 font-weight-semibold mt-3 mb-1">У вас пока нет активных задач</h3>
                <p class="text-body-2 text-medium-emphasis mb-4">
                  Следите за проектами или найдите новые инициативы, чтобы подключиться.
                </p>
                <v-btn
                  color="primary"
                  variant="flat"
                  class="text-none font-weight-semibold"
                  :to="{ name: 'volunteer-projects' }"
                  prepend-icon="mdi-magnify"
                >
                  Смотреть проекты
                </v-btn>
              </div>
            </template>
      </div>
    </div>

    <!-- ─── Projects ─── -->
    <div class="section-card">
      <div class="section-card__row">
        <div>
          <h2 class="card-title">Мои проекты</h2>
          <p class="card-sub">Команды и организаторы, вместе с которыми вы работаете</p>
            </div>
            </div>
      <div class="section-card__content">
            <v-skeleton-loader v-if="loading" type="list-item-three-line@3" />
            <template v-else>
              <v-list v-if="projects.length" class="projects-list" lines="two">
                <v-list-item
                  v-for="project in projects"
                  :key="project.id"
                  class="projects-list__item"
                >
                  <template #title>
                    <div class="projects-list__title">
                      <span>{{ project.title }}</span>
                      <v-chip
                        size="small"
                        :color="formatStatus(project.status, projectStatusMap).color"
                        variant="flat"
                        class="text-none font-weight-medium"
                      >
                        {{ formatStatus(project.status, projectStatusMap).text }}
                      </v-chip>
                    </div>
                  </template>
                  <template #subtitle>
                    <div class="projects-list__meta">
                      <div class="projects-list__meta-item">
                        <v-icon icon="mdi-map-marker" size="16" />
                        <span>{{ project.city || 'Город не указан' }}</span>
                      </div>
                      <div class="projects-list__meta-item">
                        <v-icon icon="mdi-account-tie" size="16" />
                        <span>{{ project.organizer_name || '—' }}</span>
                      </div>
                      <div class="projects-list__meta-item">
                        <v-icon icon="mdi-account-group-outline" size="16" />
                        <span>{{ project.active_members }} участников</span>
                      </div>
                      <div class="projects-list__meta-item">
                        <v-icon icon="mdi-calendar-range" size="16" />
                        <span>{{ formatDate(project.start_date) }} — {{ formatDate(project.end_date) }}</span>
                      </div>
                    </div>
                  </template>
                </v-list-item>
              </v-list>
              <div v-else class="empty-state empty-state--inline">
                <v-icon icon="mdi-account-group-outline" size="40" color="teal-darken-1" />
                <p class="text-body-2 text-medium-emphasis mb-3">
                  Вы ещё не присоединились к проектам или они в ожидании. Найдите интересные инициативы и вступайте!
                </p>
                <v-btn
                  color="teal-darken-1"
                  variant="flat"
                  class="text-none font-weight-semibold"
                  :to="{ name: 'volunteer-projects' }"
                  prepend-icon="mdi-magnify"
                >
                  Найти проект
                </v-btn>
              </div>
            </template>
      </div>
    </div>
  </div>

  <v-dialog v-model="uploadDialog" max-width="640">
    <v-card>
      <v-card-title class="d-flex align-center justify-space-between">
        <div>
          <div class="text-h6 font-weight-bold">Фотоотчёт</div>
          <div class="text-caption text-medium-emphasis">
            {{ selectedTask?.project_title }} — {{ selectedTask?.text }}
          </div>
        </div>
        <v-btn icon="mdi-close" variant="text" @click="closeUploadDialog" />
      </v-card-title>
      <v-divider class="opacity-10" />
      <v-card-text>
        <v-alert
          v-if="taskPhotosLoading"
          type="info"
          variant="tonal"
          density="comfortable"
          class="mb-4"
        >
          Загружаем данные о фотоотчётах...
        </v-alert>

        <template v-else>
          <v-alert
            v-if="taskPhotos.length"
            type="info"
            variant="tonal"
            density="comfortable"
            class="mb-4"
          >
            Фотоотчёт уже отправлен. Дождитесь решения модератора или свяжитесь с организатором.
          </v-alert>

          <v-list v-if="taskPhotos.length" class="mb-4" lines="three">
            <v-list-item
              v-for="photo in taskPhotos"
              :key="photo.id"
              :title="photo.project_title"
            >
              <template #subtitle>
                <div class="text-body-2 text-medium-emphasis">
                  Загружено: {{ formatDateTime(photo.uploaded_at) }}
                </div>
                <div class="text-body-2 text-medium-emphasis" v-if="photo.volunteer_comment">
                  Комментарий: {{ photo.volunteer_comment }}
                </div>
                <div class="text-body-2 text-medium-emphasis" v-if="photo.organizer_comment">
                  Ответ организатора: {{ photo.organizer_comment }}
                </div>
                <div class="text-body-2 text-error" v-if="photo.rejection_reason">
                  Причина отклонения: {{ photo.rejection_reason }}
                </div>
              </template>
              <template #append>
                <v-chip
                  :color="formatStatus(photo.status, photoStatusMap).color"
                  size="small"
                  variant="tonal"
                  class="text-uppercase font-weight-medium"
                >
                  {{ formatStatus(photo.status, photoStatusMap).text }}
                </v-chip>
              </template>
            </v-list-item>
          </v-list>
        </template>

        <v-form @submit.prevent="submitPhotoReport">
          <v-alert
            v-if="selectedTask && !selectedTask.can_upload_photo && !taskPhotos.length"
            type="warning"
            variant="tonal"
            class="mb-4"
          >
            Прикрепите фото-отчет по выполненной задаче.
          </v-alert>

          <v-file-input
            label="Фотографии"
            prepend-inner-icon="mdi-camera"
            accept="image/*"
            multiple
            counter
            show-size
            :disabled="(!uploadAllowed && !taskPhotos.length) || uploading"
            :rules="[() => uploadAllowed || taskPhotos.length > 0 || 'Фотоотчёт уже отправлен или недоступен.']"
            @update:model-value="handleFileChange"
          />

          <v-textarea
            v-model="uploadForm.comment"
            label="Комментарий (необязательно)"
            rows="3"
            auto-grow
            maxlength="500"
            hint="Добавьте пояснение для организатора"
            :disabled="!uploadAllowed || uploading"
          />

          <v-alert
            v-if="uploadError"
            type="error"
            variant="tonal"
            class="mb-4"
          >
            {{ uploadError }}
          </v-alert>

          <div class="d-flex justify-end ga-3 mt-4">
            <v-btn variant="text" class="text-none" @click="closeUploadDialog">
              Закрыть
            </v-btn>
            <v-btn
              color="primary"
              class="text-none font-weight-bold"
              :loading="uploading"
              :disabled="!uploadAllowed || uploading"
              type="submit"
            >
              Отправить фото
            </v-btn>
          </div>
        </v-form>
      </v-card-text>
    </v-card>
  </v-dialog>

  <v-snackbar
    v-model="snackbar.show"
    :color="snackbar.color"
    timeout="4000"
    location="top right"
    class="feedback-snackbar"
  >
    <div class="feedback-snackbar__content">
      <v-icon :icon="snackbarIcon" size="20" />
      <span>{{ snackbar.message }}</span>
    </div>
  </v-snackbar>
</template>

<style scoped>
/* ─── Base ─── */
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* ─── Loading overlay ─── */
.loading-overlay :deep(.v-overlay__scrim) {
  backdrop-filter: blur(6px);
}

.loading-overlay__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  padding: 32px 36px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 24px 48px rgba(139, 195, 74, 0.18);
}

/* ─── Hero ─── */
.hero {
  display: flex;
  align-items: stretch;
  background: linear-gradient(118deg, #2d5a1b 0%, #4a8f2a 48%, #d4631a 100%);
  border-radius: 24px;
  overflow: hidden;
  min-height: 230px;
  position: relative;
}

.hero__content {
  padding: clamp(24px, 4vw, 44px);
  display: flex;
  flex-direction: column;
  gap: 14px;
  z-index: 2;
  max-width: 560px;
}

.hero__badge {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background: rgba(255,255,255,0.18);
  border: 1px solid rgba(255,255,255,0.22);
  border-radius: 100px;
  padding: 5px 14px;
  font-size: 0.72rem;
  font-weight: 700;
  color: rgba(255,255,255,0.9);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  width: fit-content;
}

.hero__title {
  font-size: clamp(1.45rem, 3vw, 2.15rem);
  font-weight: 800;
  line-height: 1.2;
  letter-spacing: -0.4px;
  color: #fff;
  margin: 0;
}

.hero__sub {
  font-size: 0.925rem;
  color: rgba(255,255,255,0.7);
  margin: 0;
  line-height: 1.5;
}

.hero__btns {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.hero__btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 9px 20px;
  border-radius: 100px;
  font-size: 0.875rem;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.15s;
}
.hero__btn:hover { opacity: 0.88; transform: translateY(-1px); }
.hero__btn--solid  { background: #fff; color: #2d5a1b; border: none; }
.hero__btn--outline { background: transparent; color: #fff; border: 1.5px solid rgba(255,255,255,0.45); }

.hero__art {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 150px;
}

.hero__orb {
  position: absolute;
  border-radius: 50%;
}
.hero__orb--1 {
  width: 200px; height: 200px;
  background: radial-gradient(circle, rgba(255,255,255,0.12), transparent 70%);
  top: 10%; right: 15%;
}
.hero__orb--2 {
  width: 280px; height: 280px;
  background: radial-gradient(circle, rgba(212,99,26,0.2), transparent 70%);
  bottom: -30px; right: -5%;
}
.hero__art-icon {
  font-size: 110px !important;
  color: rgba(255,255,255,0.15) !important;
  position: relative;
}

@media (max-width: 768px) {
  .hero { flex-direction: column; }
  .hero__art { min-height: 110px; }
}

/* ─── Section card ─── */
.section-card {
  background: #fff;
  border-radius: 20px;
  border: 1px solid rgba(0,0,0,0.07);
  padding: clamp(18px, 3vw, 26px);
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.section-card__row {
  display: flex;
  align-items: flex-start;
    justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.section-card__content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card-title {
  font-size: 1.05rem;
  font-weight: 800;
  color: #1a1a1a;
  margin: 0;
}

.card-sub {
  font-size: 0.825rem;
  color: rgba(0,0,0,0.44);
  margin: 3px 0 0;
}

/* ─── Onboarding top row ─── */
.onboarding-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.status-pill {
  display: inline-flex;
    align-items: center;
  gap: 6px;
  padding: 4px 11px;
  border-radius: 100px;
  border: 1px solid;
  font-size: 0.78rem;
  font-weight: 700;
  width: fit-content;
}

.progress-widget {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

.progress-pct {
  font-size: 0.7rem;
  font-weight: 800;
  color: #1a1a1a;
}

.progress-lbl {
  font-size: 0.72rem;
  color: rgba(0,0,0,0.42);
  font-weight: 600;
}

/* ─── Steps ─── */
.steps-grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 10px;
}

.step-card {
  position: relative;
  background: #fafafa;
  border-radius: 14px;
  border: 1px solid rgba(0,0,0,0.07);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  animation: stepSlideIn 0.6s ease-out forwards;
}

@keyframes stepSlideIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.step-card--current {
  border-color: rgba(139,195,74,0.32);
  background: rgba(139,195,74,0.04);
  transform: translateY(-2px);
  box-shadow: 0 8px 22px rgba(139,195,74,0.12);
  animation: stepCurrentPulse 2s ease-in-out infinite;
}

@keyframes stepCurrentPulse {
  0%, 100% {
    box-shadow: 0 8px 22px rgba(139,195,74,0.12);
}
  50% {
    box-shadow: 0 12px 28px rgba(139,195,74,0.18);
  }
}

.step-card--done {
  animation: stepDoneSuccess 0.6s ease-out;
}

@keyframes stepDoneSuccess {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
  }
}

.step-card__num {
  font-size: 0.67rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: rgba(0,0,0,0.32);
}

.step-card__icon {
  position: relative;
  width: 38px; 
  height: 38px;
  border-radius: 10px;
  display: flex;
  align-items: center; 
  justify-content: center;
  transition: all 0.3s ease;
  z-index: 1;
}

.step-card__icon--pulse {
  animation: iconPulse 2s ease-in-out infinite;
}

@keyframes iconPulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(139, 195, 74, 0.4);
  }
  50% {
    transform: scale(1.05);
    box-shadow: 0 0 0 8px rgba(139, 195, 74, 0);
  }
}

.step-card__icon--success {
  animation: iconSuccess 0.6s ease-out;
}

@keyframes iconSuccess {
  0% {
    transform: scale(1) rotate(0deg);
  }
  50% {
    transform: scale(1.2) rotate(180deg);
  }
  100% {
    transform: scale(1) rotate(360deg);
  }
}

.step-card__icon-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 100%;
  height: 100%;
  border-radius: 10px;
  border: 2px solid rgba(139, 195, 74, 0.5);
  transform: translate(-50%, -50%);
  animation: ringPulse 2s ease-out infinite;
}

@keyframes ringPulse {
  0% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) scale(1.5);
    opacity: 0;
  }
}

.step-card__title {
  font-size: 0.9rem;
  font-weight: 700;
  color: #1a1a1a;
  transition: color 0.3s;
}

.step-card--current .step-card__title {
  color: #558b2f;
}

.step-card__desc {
  font-size: 0.8rem;
  color: rgba(0,0,0,0.5);
  line-height: 1.45;
  margin: 0;
  flex: 1;
}

.step-card__now {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 100px;
  background: linear-gradient(135deg, #8bc34a, #558b2f);
  color: #fff;
  font-size: 0.67rem;
  font-weight: 800;
  width: fit-content;
  animation: nowBadgePulse 2s ease-in-out infinite;
}

@keyframes nowBadgePulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(139, 195, 74, 0.4);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(139, 195, 74, 0);
  }
}

.step-card__now-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: white;
  animation: dotBlink 1.5s ease-in-out infinite;
}

@keyframes dotBlink {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}

/* Соединительная линия между шагами */
.step-connector {
  position: absolute;
  top: 50%;
  right: -10px;
  width: 20px;
  height: 2px;
  transform: translateY(-50%);
  z-index: 0;
  display: none;
}

@media (min-width: 600px) {
  .step-connector {
    display: block;
  }
}

.step-connector__line {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 2px;
}

.step-connector__progress {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: linear-gradient(90deg, #8bc34a, #558b2f);
  border-radius: 2px;
  transition: width 0.6s ease-out;
}

.step-connector--active .step-connector__progress {
  animation: connectorProgress 1s ease-out;
}

@keyframes connectorProgress {
  from {
    width: 0%;
  }
  to {
    width: 100%;
}
}

/* ─── Stats ─── */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px;
  border-radius: 16px;
  color: #fff;
  box-shadow: 0 8px 20px rgba(0,0,0,0.08);
}

.stat-card--clickable {
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.stat-card--clickable:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 24px rgba(139, 195, 74, 0.24);
}

.stat-card--primary {
  background: linear-gradient(135deg, #8bc34a, #689f38);
}

.stat-card--success {
  background: linear-gradient(135deg, #66bb6a, #2e7d32);
}

.stat-card--warning {
  background: linear-gradient(135deg, #ffca28, #f57c00);
}

.stat-card--info {
  background: linear-gradient(135deg, #42a5f5, #1976d2);
}

.stat-card__icon {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: rgba(255,255,255,0.22);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-card__body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.stat-card__label {
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  opacity: 0.85;
  font-weight: 700;
}

.stat-card__value {
  font-size: 1.8rem;
  font-weight: 800;
  line-height: 1;
}

.stat-card__hint {
  font-size: 0.78rem;
  opacity: 0.85;
}

.stat-card__loader {
  padding: 4px 0;
}

/* ─── Bot badge ─── */
.bot-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 100px;
  background: rgba(139,195,74,0.1);
  border: 1px solid rgba(139,195,74,0.2);
  color: #558b2f;
  font-size: 0.75rem;
  font-weight: 700;
}

/* ─── Info tiles ─── */
.info-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 12px;
}

.info-tile {
  border-radius: 14px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-tile__icon {
  width: 40px; height: 40px;
  border-radius: 10px;
  background: rgba(255,255,255,0.7);
  display: flex; align-items: center; justify-content: center;
}

.info-tile__title {
  font-size: 0.9rem;
  font-weight: 700;
  color: #1a1a1a;
}

.info-tile__text {
  font-size: 0.8rem;
  color: rgba(0,0,0,0.5);
  line-height: 1.45;
  margin: 0;
}

/* ─── Quick actions ─── */
.actions-head {
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.7px;
  color: rgba(0,0,0,0.4);
  margin-bottom: 12px;
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 12px;
}

.action-tile {
  background: #fff;
  border-radius: 16px;
  border: 1px solid rgba(0,0,0,0.07);
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  cursor: pointer;
  transition: box-shadow 0.2s, transform 0.2s;
}

.action-tile:hover {
  transform: translateY(-3px);
  box-shadow: 0 10px 28px rgba(0,0,0,0.09);
}

.action-tile__tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 100px;
  font-size: 0.67rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  width: fit-content;
}

.action-tile__icon {
  width: 46px; height: 46px;
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  margin: 4px 0;
}

.action-tile__title {
  font-size: 0.925rem;
  font-weight: 800;
  color: #1a1a1a;
}

.action-tile__desc {
  font-size: 0.8rem;
  color: rgba(0,0,0,0.5);
  line-height: 1.45;
  margin: 0;
  flex: 1;
}

.action-tile__arrow {
  margin-top: 4px;
  opacity: 0;
  transform: translateX(-4px);
  transition: opacity 0.18s, transform 0.18s;
}

.action-tile:hover .action-tile__arrow {
  opacity: 1;
  transform: translateX(0);
}

/* ─── Tasks ─── */
.task-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}

.task-card {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 20px;
  border-radius: 20px;
  border: 1px solid rgba(33, 33, 33, 0.05);
  background: linear-gradient(145deg, #ffffff, #f7f9ff);
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}

.task-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 20px 36px rgba(139, 195, 74, 0.12); /* BirQadam primary */
}

.task-card__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.task-card__title {
  margin: 0 0 6px;
  font-size: 1.05rem;
  font-weight: 600;
}

.task-card__status {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.task-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 16px;
  font-size: 0.9rem;
  color: rgba(33, 33, 33, 0.6);
}

.task-meta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.task-card__photos {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.task-card__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.projects-list__item {
  border-bottom: 1px solid rgba(33, 33, 33, 0.05);
  padding: 16px 0;
}

.projects-list__title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.projects-list__meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px;
  margin-top: 10px;
  font-size: 0.9rem;
  color: rgba(33, 33, 33, 0.68);
}

.projects-list__meta-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 12px;
  padding: 40px 24px;
  border-radius: 20px;
  border: 1px dashed rgba(139, 195, 74, 0.18); /* BirQadam primary */
  background: rgba(248, 236, 196, 0.25); /* BirQadam background */
}

.empty-state--inline {
  padding: 28px 18px;
  gap: 10px;
}

/* ─── Feedback snackbar ─── */
.feedback-snackbar {
  border-radius: 16px;
  box-shadow: 0 18px 32px rgba(139, 195, 74, 0.2);
}

.feedback-snackbar__content {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 600;
  }

/* ─── Responsive ─── */
@media (max-width: 960px) {
  .dashboard {
    gap: 18px;
  }

  .task-grid {
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  }

  .stats-grid {
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  }

  .section-card__row {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .section-card__row .v-btn {
    width: 100%;
    justify-content: center;
  }
}

@media (max-width: 600px) {
  .hero__btns {
    flex-direction: column;
    align-items: stretch;
  }

  .task-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .section-card {
    padding: 16px;
  }

  .section-card__row {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .card-title {
    font-size: 0.95rem;
  }

  .card-sub {
    font-size: 0.8rem;
  }

  /* Адаптация карточек задач для мобильных */
  .task-card {
    padding: 16px;
    gap: 14px;
    border-radius: 16px;
  }

  .task-card__header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .task-card__title {
    font-size: 0.95rem;
    line-height: 1.4;
    margin-bottom: 8px;
  }

  .task-card__status {
    width: 100%;
    justify-content: flex-start;
    gap: 6px;
  }

  .task-card__meta {
    flex-direction: column;
    gap: 8px;
    font-size: 0.85rem;
  }

  .task-meta {
    width: 100%;
    gap: 8px;
  }

  .task-card__photos {
    width: 100%;
  }

  .task-card__actions {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .task-card__actions > .d-flex {
    width: 100%;
    flex-direction: column;
    gap: 8px;
  }

  .task-card__actions .v-btn {
    width: 100%;
    justify-content: center;
  }

  .task-card__actions > .v-btn {
    width: 100%;
    justify-content: center;
  }
}
</style>

