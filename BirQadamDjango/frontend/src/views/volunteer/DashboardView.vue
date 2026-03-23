

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';

import { useAuthStore } from '@/stores/auth';
import { useDashboardStore } from '@/stores/dashboard';
import type { VolunteerTaskSummary, VolunteerPhotoSummary } from '@/services/dashboard';
import { uploadPhotoReport, fetchTaskPhotos } from '@/services/photoReports';
import { acceptTask, declineTask, completeTask } from '@/services/tasks';
import { fetchVolunteerStats } from '@/services/stats';

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
const tasks = computed(() => dashboardStore.tasks);
const projects = computed(() => dashboardStore.projects);
const photos = computed(() => dashboardStore.photos);
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
  return user?.name || user?.full_name || user?.username || 'Волонтёр BirQadam';
});

const hasProfile = computed(() => Boolean(authStore.user?.name || authStore.user?.full_name));
const hasActiveProject = computed(() => summary.value.active_projects > 0);
const hasActiveTask = computed(() => summary.value.active_tasks > 0 || tasks.value.length > 0);
const hasPhotoReport = computed(() => summary.value.total_photos > 0 || photos.value.length > 0);

const onboardingSteps = computed(() => {
  const rawSteps = [
    {
      key: 'profile',
      title: 'Заполните профиль',
      description: 'Добавьте имя и контакты, чтобы организаторы могли быстро связаться с вами.',
      done: hasProfile.value,
    },
    {
      key: 'project',
      title: 'Присоединитесь к проекту',
      description: 'Выберите интересное направление и возьмите первую задачу.',
      done: hasActiveProject.value || hasActiveTask.value,
    },
    {
      key: 'report',
      title: 'Отправьте фотоотчёт',
      description: 'Подтвердите участие фотографиями и получайте благодарности и рейтинг.',
      done: hasPhotoReport.value,
    },
  ];

  let firstPendingMarked = false;
  return rawSteps.map((step) => {
    let status: 'done' | 'active' | 'waiting';
    if (step.done) {
      status = 'done';
    } else if (!firstPendingMarked) {
      status = 'active';
      firstPendingMarked = true;
    } else {
      status = 'waiting';
    }
    return { ...step, status };
  });
});

const onboardingProgress = computed(() => {
  const total = onboardingSteps.value.length;
  const completed = onboardingSteps.value.filter((step) => step.status === 'done').length;
  return Math.round((completed / total) * 100);
});

const showOnboarding = computed(() => onboardingProgress.value < 100);

const showGlobalLoading = computed(
  () =>
    loading.value &&
    !tasks.value.length &&
    !projects.value.length &&
    !photos.value.length,
);

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

onMounted(async () => {
  await authStore.initialize();
  await dashboardStore.loadDashboard();
  await loadStats();
});

const canAcceptTask = (task: VolunteerTaskSummary) => task.status === 'open' && !task.accepted;
const canCompleteTask = (task: VolunteerTaskSummary) => task.accepted && !task.completed;
const canDeclineTask = (task: VolunteerTaskSummary) => task.status !== 'completed';
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
    const updatedTask = dashboardStore.tasks.find((task) => task.task_id === selectedTask.value?.task_id);
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
      const updated = dashboardStore.tasks.find((item) => item.task_id === selectedTask.value?.task_id);
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
  <div class="volunteer-dashboard">
    <v-overlay
      v-model="showGlobalLoading"
      class="loading-overlay"
      persistent
      scrim="rgba(21, 101, 192, 0.08)"
    >
      <div class="loading-overlay__content">
        <v-progress-circular indeterminate color="primary" size="54" width="6" />
        <p class="text-body-1 text-medium-emphasis mb-0">Подгружаем ваши проекты и задания…</p>
      </div>
    </v-overlay>

    <v-row class="ga-6">
      <v-col cols="12">
        <v-card class="hero-card" elevation="8" rounded="xl">
          <div class="hero-card__content">
            <div class="hero-card__badge">
              <v-icon icon="mdi-human-handsup" size="20" />
              Добро пожаловать, {{ volunteerName }}
            </div>
            <h1>
              Присоединяйтесь к проектам<br />
              и развивайтесь в команде с BirQadam
            </h1>
            <p>
              Все задачи и фотоотчёты синхронизированы между веб-порталом и Telegram-ботом —
              выбирайте удобный канал и продолжайте помогать.
            </p>
            <div class="hero-card__actions">
              <v-btn
                color="warning"
                variant="flat"
                class="text-none font-weight-bold hero-card__btn"
                :to="{ name: 'volunteer-projects' }"
              >
                Найти проект
              </v-btn>
              <v-btn
                variant="outlined"
                color="white"
                class="text-none font-weight-bold hero-card__btn"
                :to="{ name: 'volunteer-photo-reports' }"
              >
                Фотоотчёты
              </v-btn>
            </div>
          </div>
          <div class="hero-card__visual">
            <div class="hero-card__orb hero-card__orb--primary" />
            <div class="hero-card__orb hero-card__orb--secondary" />
            <v-icon icon="mdi-hand-heart" size="120" class="hero-card__icon" />
          </div>
        </v-card>
      </v-col>

      <v-col cols="12" v-if="showOnboarding">
        <v-card class="onboarding-card" elevation="8" rounded="xl">
          <div class="onboarding-card__header">
            <div>
              <v-chip color="primary" variant="tonal" size="small" class="text-none font-weight-bold mb-2">
                Путь волонтёра
              </v-chip>
              <h2 class="text-h6 font-weight-bold mb-1">Три шага, чтобы включиться в работу</h2>
              <p class="text-body-2 text-medium-emphasis mb-0">
                Мы отмечаем выполненные этапы автоматически. Пройдите их, чтобы получать задачи и повышать рейтинг.
              </p>
            </div>
            <div class="onboarding-card__progress">
              <span class="text-caption text-medium-emphasis">Готовность</span>
              <div class="d-flex align-center ga-2">
                <v-progress-circular :model-value="onboardingProgress" color="primary" size="48" width="5">
                  {{ onboardingProgress }}%
                </v-progress-circular>
                <div class="text-body-2 text-medium-emphasis">
                  {{
                    onboardingProgress === 0
                      ? 'Начните прямо сейчас'
                      : onboardingProgress < 100
                        ? 'Ещё немного — и вы полностью готовы'
                        : 'Все шаги выполнены'
                  }}
                </div>
              </div>
            </div>
          </div>

          <v-divider class="my-4" />

          <v-row class="ga-4 ga-md-0">
            <v-col
              v-for="step in onboardingSteps"
              :key="step.key"
              cols="12"
              md="4"
            >
              <v-sheet
                class="onboarding-step pa-5"
                rounded="lg"
                :border="step.status !== 'active'"
                :color="step.status === 'active' ? 'primary-lighten-5' : step.status === 'waiting' ? 'grey-lighten-5' : 'success-lighten-5'"
              >
                <div class="onboarding-step__icon" :class="`onboarding-step__icon--${step.status}`">
                  <v-icon
                    :icon="step.status === 'done' ? 'mdi-check' : step.status === 'active' ? 'mdi-progress-clock' : 'mdi-dots-horizontal'"
                    size="22"
                  />
                </div>
                <h3 class="text-subtitle-1 font-weight-semibold mb-2">{{ step.title }}</h3>
                <p class="text-body-2 text-medium-emphasis mb-0">
                  {{ step.description }}
                </p>
              </v-sheet>
            </v-col>
          </v-row>
        </v-card>
      </v-col>
    </v-row>

    <v-row class="ga-4 stats-row">
      <v-col cols="12" sm="6" md="3">
        <div class="stat-card stat-card--primary">
          <div class="stat-card__icon">
            <v-icon icon="mdi-star-circle" size="32" />
          </div>
          <div class="stat-card__body">
            <div class="stat-card__label">Рейтинг</div>
            <div v-if="statsLoading" class="stat-card__loader">
              <v-progress-circular indeterminate color="white" size="28" width="3" />
            </div>
            <template v-else>
              <div class="stat-card__value">{{ stats?.rating ?? 0 }}</div>
              <v-chip color="white" variant="text" size="small" class="stat-card__chip">
                Уровень {{ stats?.level ?? 1 }}
              </v-chip>
              <div class="stat-card__hint">
                До следующего уровня: {{ stats?.next_level_rating ?? '—' }} XP
              </div>
            </template>
          </div>
        </div>
      </v-col>
      <v-col cols="12" sm="6" md="3">
        <div class="stat-card stat-card--success">
          <div class="stat-card__icon">
            <v-icon icon="mdi-checkbox-marked-circle-outline" size="32" />
          </div>
          <div class="stat-card__body">
            <div class="stat-card__label">Завершено задач</div>
            <div class="stat-card__value">{{ summary.completed_tasks }}</div>
            <div class="stat-card__hint">Спасибо за вашу помощь!</div>
          </div>
        </div>
      </v-col>
      <v-col cols="12" sm="6" md="3">
        <div class="stat-card stat-card--warning">
          <div class="stat-card__icon">
            <v-icon icon="mdi-folder-account-outline" size="32" />
          </div>
          <div class="stat-card__body">
            <div class="stat-card__label">Активные проекты</div>
            <div class="stat-card__value">{{ summary.active_projects }}</div>
            <div class="stat-card__hint">Участия в сообществах</div>
          </div>
        </div>
      </v-col>
      <v-col cols="12" sm="6" md="3">
        <div class="stat-card stat-card--info">
          <div class="stat-card__icon">
            <v-icon icon="mdi-bell-badge-outline" size="32" />
          </div>
          <div class="stat-card__body">
            <div class="stat-card__label">Уведомления</div>
            <div class="stat-card__value">{{ summary.unread_notifications }}</div>
            <div class="stat-card__hint">Новых сообщений</div>
          </div>
        </div>
      </v-col>
    </v-row>

    <v-row class="ga-4 main-section">
      <v-col cols="12">
        <v-card class="content-card" elevation="0" rounded="xl">
          <v-card-title class="content-card__title">
            <div>
              <div class="d-flex align-center ga-2 mb-1">
                <v-icon icon="mdi-clipboard-text-clock" color="primary" />
                <span class="text-h6 font-weight-bold">Мои задания</span>
              </div>
              <div class="text-body-2 text-medium-emphasis">
                Следите за дедлайнами и отправляйте результаты вовремя
              </div>
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
          </v-card-title>
          <v-divider />
          <v-card-text class="pa-6">
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
          </v-card-text>
        </v-card>
      </v-col>

      
    </v-row>

    <v-row class="ga-4">
      <v-col cols="12">
        <v-card class="content-card" elevation="0" rounded="xl">
          <v-card-title class="content-card__title">
            <div class="d-flex align-center ga-2">
              <v-icon icon="mdi-account-group" color="teal-darken-1" />
              <span class="text-h6 font-weight-bold">Мои проекты</span>
            </div>
            <div class="text-body-2 text-medium-emphasis">
              Команды и организаторы, вместе с которыми вы работаете
            </div>
          </v-card-title>
          <v-divider />
          <v-card-text class="pa-6">
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
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
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
            Чтобы отправить фото, возьмите задачу в работу в Telegram боте.
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
.volunteer-dashboard {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

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
  box-shadow: 0 24px 48px rgba(139, 195, 74, 0.18); /* BirQadam primary */
}

.hero-card {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  overflow: hidden;
  background: linear-gradient(115deg, rgba(139, 195, 74, 0.95), rgba(139, 195, 74, 0.85) 45%, rgba(227, 121, 77, 0.9) 90%); /* BirQadam colors */
  border-radius: 28px;
  color: #fff;
  position: relative;
  min-height: 260px;
}

.hero-card__content {
  padding: clamp(24px, 4vw, 48px);
  width: 100%;
  max-width: 620px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  z-index: 2;
}

.hero-card__badge {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 999px;
  padding: 8px 16px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-size: 0.75rem;
}

.hero-card__content h1 {
  font-size: clamp(1.8rem, 3.2vw, 2.6rem);
  line-height: 1.25;
  margin: 0;
  font-weight: 700;
}

.hero-card__content p {
  margin: 0;
  color: rgba(255, 255, 255, 0.82);
  font-size: clamp(0.95rem, 1.8vw, 1.05rem);
  line-height: 1.6;
}

.hero-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.hero-card__btn {
  min-width: 180px;
}

.hero-card__visual {
  position: relative;
  flex: 1;
  min-height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.hero-card__orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(0);
  opacity: 0.65;
}

.hero-card__orb--primary {
  width: 220px;
  height: 220px;
  background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.4), transparent 65%);
  top: 18%;
  right: 20%;
}

.hero-card__orb--secondary {
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, rgba(227, 121, 77, 0.25), transparent 70%); /* BirQadam accent */
  bottom: -40px;
  right: -10%;
}

.hero-card__icon {
  position: relative;
  color: rgba(255, 255, 255, 0.28);
}

.onboarding-card {
  padding: clamp(24px, 4vw, 32px);
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(255, 250, 246, 0.92)); /* BirQadam background */
  border: 1px solid rgba(139, 195, 74, 0.12); /* BirQadam primary */
}

.onboarding-card__header {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

@media (min-width: 960px) {
  .onboarding-card__header {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    gap: 32px;
  }
}

.onboarding-card__progress {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 160px;
}

.onboarding-step {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.onboarding-step__icon {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 6px;
  color: #fff;
}

.onboarding-step__icon--done {
  background: linear-gradient(135deg, #4caf50, #2e7d32);
}

.onboarding-step__icon--active {
  background: linear-gradient(135deg, #8BC34A, #689F38); /* BirQadam primary */
}

.onboarding-step__icon--waiting {
  background: linear-gradient(135deg, #90a4ae, #607d8b); /* Waiting state - оставляем серый */
}

.onboarding-step p {
  color: rgba(33, 33, 33, 0.7);
  line-height: 1.5;
}

.feedback-snackbar {
  border-radius: 16px;
  box-shadow: 0 18px 32px rgba(139, 195, 74, 0.2); /* BirQadam primary */
}

.feedback-snackbar__content {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 600;
}

.stats-row {
  margin-top: 6px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 22px;
  border-radius: 22px;
  color: #fff;
  box-shadow: 0 24px 48px rgba(139, 195, 74, 0.18); /* BirQadam primary */
}

.stat-card--primary {
  background: linear-gradient(135deg, #8BC34A, #689F38); /* BirQadam primary */
}

.stat-card--success {
  background: linear-gradient(135deg, #66bb6a, #2e7d32);
}

.stat-card--warning {
  background: linear-gradient(135deg, #ffca28, #f57c00);
}

.stat-card--info {
  background: linear-gradient(135deg, #8BC34A, #689F38); /* BirQadam primary */
}

.stat-card__icon {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.22);
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-card__body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.stat-card__label {
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.8;
  font-weight: 600;
}

.stat-card__value {
  font-size: clamp(1.9rem, 3vw, 2.4rem);
  font-weight: 700;
  line-height: 1;
}

.stat-card__chip {
  align-self: flex-start;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.stat-card__hint {
  font-size: 0.82rem;
  opacity: 0.85;
}

.stat-card__loader {
  padding: 6px 0;
}

.content-card {
  border: 1px solid rgba(33, 33, 33, 0.06);
  background: #ffffff;
  box-shadow: 0 20px 40px rgba(139, 195, 74, 0.1); /* BirQadam primary */
}

.content-card__title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.task-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 18px;
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

@media (max-width: 1280px) {
  .content-card__title {
    flex-direction: column;
    align-items: flex-start;
  }
}

@media (max-width: 1100px) {
  .hero-card {
    flex-direction: column;
  }

  .hero-card__visual {
    min-height: 200px;
  }
}

@media (max-width: 960px) {
  .volunteer-dashboard {
    gap: 20px;
  }

  .task-grid {
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  }

  .hero-card__visual {
    min-height: 180px;
  }
}

@media (max-width: 600px) {
  .hero-card__actions {
    flex-direction: column;
    align-items: stretch;
  }

  .task-grid {
    grid-template-columns: 1fr;
  }

  .content-card__title {
    gap: 8px;
  }
}
</style>

