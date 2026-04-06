<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { VForm } from 'vuetify/components';

import { useAuthStore } from '@/stores/auth';
import { useOrganizerStore } from '@/stores/organizer';
import { deleteTask } from '@/services/organizer';

const authStore = useAuthStore();
const organizerStore = useOrganizerStore();
const route = useRoute();
const router = useRouter();

const isOrganizer = computed(() => organizerStore.isOrganizer);
const isApproved = computed(() => organizerStore.isApproved);

const projects = computed(() => organizerStore.projects || []);
const projectOptions = computed(() =>
  Array.isArray(projects.value)
    ? projects.value.map(p => ({ title: p.title, value: p.id }))
    : [],
);

const selectedProjectId = ref<number | null>(null);
const selectedProject = computed(() => projects.value.find(p => p.id === selectedProjectId.value) ?? null);

const currentTasks = computed(() => {
  if (!selectedProjectId.value) return [];
  return organizerStore.tasksByProject[selectedProjectId.value] ?? [];
});

const loadingTasks = computed(() => selectedProjectId.value ? organizerStore.loadingTasks[selectedProjectId.value] : false);
const taskError = computed(() => selectedProjectId.value ? organizerStore.taskErrors[selectedProjectId.value] : null);

const taskFormRef = ref<VForm | null>(null);
const createTaskDialog = ref(false);
const isEditing = ref(false);
const currentEditingTaskId = ref<number | null>(null);
const createTaskLoading = ref(false);
const viewTaskDialog = ref(false);
const selectedTaskForView = ref<any>(null);

const approveDialog = reactive({
  open: false, photoIds: [] as number[],
  rating: 5, feedback: '', error: '',
});
const rejectDialog = reactive({
  open: false, photoIds: [] as number[],
  feedback: '', error: '',
});
const rejectFormRef = ref<VForm | null>(null);

const groupedPhotos = computed(() => {
  if (!selectedTaskForView.value?.photos) return [];
  const groups: Record<string, any> = {};
  selectedTaskForView.value.photos.forEach((p: any) => {
    const name = p.volunteer_name || 'Волонтёр';
    if (!groups[name]) {
      groups[name] = { 
        name, 
        photos: [] as any[], 
        pending: false, 
        hasApproved: false,
        hasRejected: false,
        pendingIds: [] as number[],
        allIds: [] as number[],
        latestDate: p.uploaded_at
      };
    }
    groups[name].photos.push(p);
    groups[name].allIds.push(p.id);
    if (p.status === 'pending') {
      groups[name].pending = true;
      groups[name].pendingIds.push(p.id);
    }
    if (p.status === 'approved') groups[name].hasApproved = true;
    if (p.status === 'rejected') groups[name].hasRejected = true;
    if (new Date(p.uploaded_at) > new Date(groups[name].latestDate)) {
      groups[name].latestDate = p.uploaded_at;
    }
  });
  return Object.values(groups);
});

const snackbar = reactive({ show: false, color: 'success', message: '' });

const taskFormState = reactive({
  text: '',
  deadline_date: null as string | null,
  start_time: null as string | null,
  end_time: null as string | null,
});

const deleteTaskDialog = ref(false);
const taskToDelete = ref<{ projectId: number; taskId: number; text: string } | null>(null);
const deletingTask = ref(false);

const rules = {
  required: (value: string) => !!value || 'Поле обязательно к заполнению.',
};

const taskStatusConfig = (status: string) => {
  const map: Record<string, { color: string; label: string; icon: string }> = {
    open:         { color: '#1565c0', label: 'Открыта',      icon: 'mdi-circle-outline'        },
    in_progress:  { color: '#ff9800', label: 'В работе',     icon: 'mdi-clock-outline'         },
    under_review: { color: '#7b1fa2', label: 'На проверке',  icon: 'mdi-magnify-scan'          },
    completed:    { color: '#2e7d32', label: 'Выполнена',    icon: 'mdi-check-circle-outline'  },
    cancelled:    { color: '#757575', label: 'Отменена',     icon: 'mdi-cancel'                },
    failed:       { color: '#c62828', label: 'Отклонена',    icon: 'mdi-close-circle-outline'  },
    closed:       { color: '#424242', label: 'Закрыта',      icon: 'mdi-lock-outline'          },
    archived:     { color: '#37474f', label: 'В архиве',     icon: 'mdi-archive-outline'       },
    pending:      { color: '#e65100', label: 'В ожидании',   icon: 'mdi-clock-outline'         },
  };
  return map[status] || { color: '#757575', label: status, icon: 'mdi-help-circle-outline' };
};

const formatDeadline = (date: string | null | undefined) => {
  if (!date) return null;
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date));
};

const taskStats = computed(() => {
  const tasks = currentTasks.value;
  return {
    total:        tasks.length,
    completed:    tasks.filter(t => t.status === 'completed').length,
    open:         tasks.filter(t => t.status === 'open').length,
    under_review: tasks.filter(t => t.status === 'under_review').length,
    archived:     tasks.filter(t => t.status === 'archived').length,
  };
});

onMounted(async () => {
  if (!organizerStore.isOrganizer) return;
  await organizerStore.loadProjects();
  const projectQuery = route.query.project;
  if (projectQuery) {
    const projectId = Number(projectQuery);
    if (!Number.isNaN(projectId)) selectedProjectId.value = projectId;
  }
  if (!selectedProjectId.value && projects.value.length) {
    selectedProjectId.value = projects.value[0].id;
  }
});

watch(selectedProjectId, async (newProject) => {
  if (!newProject) return;
  await organizerStore.loadTasks(newProject, true);
});

const openCreateTaskDialog = () => {
  isEditing.value = false;
  currentEditingTaskId.value = null;
  taskFormState.text = '';
  taskFormState.deadline_date = null;
  taskFormState.start_time = null;
  taskFormState.end_time = null;
  createTaskDialog.value = true;
};

const openEditTaskDialog = (task: any) => {
  isEditing.value = true;
  currentEditingTaskId.value = task.id;
  taskFormState.text = task.text;
  taskFormState.deadline_date = task.deadline_date ? task.deadline_date.split('T')[0] : null;
  taskFormState.start_time = task.start_time;
  taskFormState.end_time = task.end_time;
  createTaskDialog.value = true;
};

const closeCreateTaskDialog = () => { createTaskDialog.value = false; };

const submitCreateTask = async () => {
  if (!selectedProjectId.value || !selectedProject.value) return;
  const { valid } = (await taskFormRef.value?.validate()) ?? { valid: false };
  if (!valid) return;

  // Validate deadline against project end date
  if (taskFormState.deadline_date && selectedProject.value.end_date) {
    const taskDl = new Date(taskFormState.deadline_date);
    const projDl = new Date(selectedProject.value.end_date);
    if (taskDl > projDl) {
      snackbar.message = 'Дату нельзя ставить позже окончания проекта.';
      snackbar.color = 'error';
      snackbar.show = true;
      return;
    }
  }

  createTaskLoading.value = true;
  try {
    const defaultDl = selectedProject.value.end_date ? selectedProject.value.end_date.split('T')[0] : undefined;
    
    const payload = {
      text: taskFormState.text,
      deadline_date: taskFormState.deadline_date || defaultDl,
      start_time: taskFormState.start_time || undefined,
      end_time: taskFormState.end_time || undefined,
    };

    if (isEditing.value && currentEditingTaskId.value) {
      await organizerStore.updateTask(selectedProjectId.value, currentEditingTaskId.value, payload);
      snackbar.message = 'Задача успешно обновлена.';
    } else {
      await organizerStore.createTask(selectedProjectId.value, payload);
      snackbar.message = 'Задача создана, волонтёры уведомлены.';
    }

    snackbar.color = 'success';
    snackbar.show = true;
    closeCreateTaskDialog();
  } catch (error: any) {
    snackbar.message = error?.response?.data?.error || error?.message || 'Не удалось сохранить задачу.';
    snackbar.color = 'error';
    snackbar.show = true;
  } finally {
    createTaskLoading.value = false;
  }
};

function openDeleteTaskDialog(projectId: number, taskId: number, taskText: string) {
  taskToDelete.value = { projectId, taskId, text: taskText };
  deleteTaskDialog.value = true;
}

function closeDeleteTaskDialog() { deleteTaskDialog.value = false; taskToDelete.value = null; }

async function confirmDeleteTask() {
  if (!taskToDelete.value || !selectedProjectId.value) return;
  deletingTask.value = true;
  try {
    await deleteTask(taskToDelete.value.projectId, taskToDelete.value.taskId);
    snackbar.message = 'Задача удалена.';
    snackbar.color = 'success';
    snackbar.show = true;
    closeDeleteTaskDialog();
    await organizerStore.loadTasks(selectedProjectId.value, true);
  } catch (error: any) {
    snackbar.message = error?.response?.data?.error || error?.response?.data?.detail || 'Не удалось удалить задачу.';
    snackbar.color = 'error';
    snackbar.show = true;
  } finally {
    deletingTask.value = false;
  }
}

const openViewTaskDialog = (task: any) => {
  selectedTaskForView.value = task;
  viewTaskDialog.value = true;
};

const getPhotoStatusConfig = (status: string) => {
  const map: Record<string, { color: string; label: string }> = {
    pending:  { color: '#ff9800', label: 'На проверке' },
    approved: { color: '#2e7d32', label: 'Одобрено' },
    rejected: { color: '#c62828', label: 'Отклонено' },
  };
  return map[status] || { color: '#757575', label: status };
};

const getFullImageUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
  return `${baseUrl.replace(/\/$/, '')}${url.startsWith('/') ? '' : '/'}${url}`;
};

function openApproveDialog(photoIds: number[]) {
  approveDialog.open = true;
  approveDialog.photoIds = photoIds;
  approveDialog.rating = 5;
  approveDialog.feedback = '';
  approveDialog.error = '';
}

async function submitApprove(skip = false) {
  if (!approveDialog.photoIds.length) return;
  approveDialog.error = '';
  if (!skip) {
    if (!approveDialog.rating) { approveDialog.error = 'Выберите оценку от 1 до 5.'; return; }
    if (approveDialog.rating <= 3 && !approveDialog.feedback.trim()) {
      approveDialog.error = 'Для оценки 1–3 звезды добавьте комментарий.'; return;
    }
  }
  try {
    // Approve first photo with full rating/feedback
    const firstId = approveDialog.photoIds[0];
    await organizerStore.approvePhotoReport(firstId, {
      skip,
      rating: skip ? undefined : approveDialog.rating,
      feedback: approveDialog.feedback.trim() || undefined,
    });

    // Approve remaining photos in group as "skip" to avoid duplicate rating
    if (approveDialog.photoIds.length > 1) {
      const restIds = approveDialog.photoIds.slice(1);
      for (const id of restIds) {
        await organizerStore.approvePhotoReport(id, { skip: true });
      }
    }

    approveDialog.open = false;
    snackbar.message = skip ? 'Отчёт одобрен без оценки.' : 'Отчёт одобрен.';
    snackbar.color = skip ? 'primary' : 'success';
    snackbar.show = true;
    
    // Refresh tasks to update photos in view
    if (selectedProjectId.value) {
      await organizerStore.loadTasks(selectedProjectId.value, true);
      if (selectedTaskForView.value) {
        selectedTaskForView.value = currentTasks.value.find(t => t.id === selectedTaskForView.value.id) || null;
      }
    }
  } catch (error: any) {
    approveDialog.error = error?.response?.data?.error || error?.message || 'Не удалось одобрить отчёт.';
  }
}

function openRejectDialog(photoIds: number[]) {
  rejectDialog.open = true;
  rejectDialog.photoIds = photoIds;
  rejectDialog.feedback = '';
  rejectDialog.error = '';
}

async function submitReject() {
  if (!rejectDialog.photoIds.length) return;
  rejectDialog.error = '';
  const { valid } = (await rejectFormRef.value?.validate()) ?? { valid: false };
  if (!valid) return;
  try {
    // Reject all photos in the group
    for (const id of rejectDialog.photoIds) {
      await organizerStore.rejectPhotoReport(id, rejectDialog.feedback.trim());
    }
    
    rejectDialog.open = false;
    snackbar.message = 'Отчёт отклонён, волонтёр уведомлён.';
    snackbar.color = 'info';
    snackbar.show = true;

    // Refresh tasks
    if (selectedProjectId.value) {
      await organizerStore.loadTasks(selectedProjectId.value, true);
      if (selectedTaskForView.value) {
        selectedTaskForView.value = currentTasks.value.find(t => t.id === selectedTaskForView.value.id) || null;
      }
    }
  } catch (error: any) {
    rejectDialog.error = error?.response?.data?.error || error?.message || 'Не удалось отклонить отчёт.';
  }
}

const photoActionLoading = (photoId: number) => organizerStore.photoActionLoading[photoId] ?? false;
// For grouped loading state
const groupActionLoading = (photoIds: number[]) => photoIds.some(id => organizerStore.photoActionLoading[id]);

const canSubmitApproval = computed(() => {
  if (!approveDialog.photoIds.length) return false;
  if (approveDialog.rating >= 1 && approveDialog.rating <= 5) {
    if (approveDialog.rating <= 3 && !approveDialog.feedback.trim()) return false;
    return true;
  }
  return false;
});
function goBack() {
  router.push({ name: 'organizer-projects' });
}
</script>

<template>
  <div class="tasks-view">

    <!-- ─── Page Header ─── -->
    <div class="page-header">
      <div class="d-flex align-center">
        <v-btn
          icon="mdi-arrow-left"
          variant="tonal"
          size="small"
          rounded="lg"
          color="primary"
          class="mr-4 back-btn"
          @click="goBack"
        />
        <div>
          <h1 class="page-title">Задачи</h1>
          <p class="page-subtitle">Создавайте задания и управляйте сроками волонтёров</p>
        </div>
      </div>
      <button
        v-if="isOrganizer && isApproved && selectedProjectId"
        class="create-btn"
        @click="openCreateTaskDialog"
      >
        <v-icon icon="mdi-plus" size="18" />
        Создать задачу
      </button>
    </div>

    <!-- ─── Alerts ─── -->
    <v-alert v-if="!isOrganizer" type="error" variant="tonal" rounded="xl" border="start" icon="mdi-shield-alert-outline">
      У вас нет прав организатора.
    </v-alert>
    <v-alert v-else-if="!isApproved" type="warning" variant="tonal" rounded="xl" border="start" icon="mdi-clock-outline">
      После одобрения заявки вы сможете создавать задачи.
    </v-alert>

    <div v-else class="main-layout">

      <!-- ── Tasks column ── -->
      <div class="tasks-col">

        <!-- Project selector -->
        <div class="project-selector-card">
          <label class="project-selector-label">Проект</label>
          <v-select
            v-model="selectedProjectId"
            :items="projectOptions"
            variant="outlined"
            density="comfortable"
            hide-details
            prepend-inner-icon="mdi-briefcase-outline"
            :disabled="!projects.length"
            placeholder="Выберите проект"
          />
          <!-- Mini stats -->
          <div v-if="selectedProjectId && currentTasks.length" class="task-stats">
            <div class="task-stat">
              <span class="task-stat__value">{{ taskStats.total }}</span>
              <span class="task-stat__label">всего</span>
            </div>
            <div class="task-stat-divider" />
            <div class="task-stat">
              <span class="task-stat__value task-stat__value--green">{{ taskStats.completed }}</span>
              <span class="task-stat__label">выполнено</span>
            </div>
            <div class="task-stat-divider" />
            <div class="task-stat">
              <span class="task-stat__value task-stat__value--blue">{{ taskStats.open }}</span>
              <span class="task-stat__label">открыто</span>
            </div>
          </div>
        </div>

        <!-- No project -->
        <div v-if="!projects.length" class="empty-state">
          <div class="empty-state__icon">
            <v-icon icon="mdi-briefcase-outline" size="36" />
          </div>
          <h3 class="empty-state__title">Нет проектов</h3>
          <p class="empty-state__text">Сначала создайте проект, затем добавьте задачи.</p>
        </div>

        <template v-else-if="selectedProjectId">
          <!-- Error -->
          <v-alert v-if="taskError" type="error" variant="tonal" rounded="xl" border="start">
            {{ taskError }}
          </v-alert>

          <!-- Loading -->
          <div v-else-if="loadingTasks" class="tasks-list">
            <div v-for="i in 4" :key="i" class="task-item task-item--skeleton">
              <v-skeleton-loader type="list-item-two-line" />
            </div>
          </div>

          <!-- Tasks list -->
          <div v-else-if="currentTasks.length" class="tasks-list">
            <div v-for="task in currentTasks" :key="task.id" class="task-item">
              <!-- Status indicator -->
              <div class="task-item__indicator" :style="{ background: taskStatusConfig(task.status).color }" />

              <!-- Icon -->
              <div class="task-item__icon">
                <v-icon :icon="taskStatusConfig(task.status).icon" size="18" :style="{ color: taskStatusConfig(task.status).color }" />
              </div>

              <!-- Content -->
              <div class="task-item__content">
                <div class="task-item__text">{{ task.text }}</div>
                <div class="task-item__meta">
                  <span v-if="task.deadline_date" class="task-meta-chip">
                    <v-icon icon="mdi-calendar-outline" size="13" />
                    {{ formatDeadline(task.deadline_date) }}
                  </span>
                  <span v-else-if="selectedProject?.end_date" class="task-meta-chip">
                    <v-icon icon="mdi-calendar-alert" size="13" color="orange" />
                    {{ formatDeadline(selectedProject.end_date) }}
                  </span>
                  <span v-else class="task-meta-chip task-meta-chip--muted">
                    <v-icon icon="mdi-calendar-remove-outline" size="13" />
                    Без срока
                  </span>
                  <span v-if="task.start_time && task.end_time" class="task-meta-chip">
                    <v-icon icon="mdi-clock-outline" size="13" />
                    {{ task.start_time }} — {{ task.end_time }}
                  </span>
                  <span class="task-status-badge" :style="{ color: taskStatusConfig(task.status).color, background: taskStatusConfig(task.status).color + '18' }">
                    {{ taskStatusConfig(task.status).label }}
                  </span>
                </div>
              </div>

              <!-- Actions -->
              <div class="task-item__actions">
                <button
                  class="task-item__view"
                  title="Просмотреть задачу"
                  @click="openViewTaskDialog(task)"
                >
                  <v-icon icon="mdi-eye-outline" size="16" />
                </button>
                <button
                  v-if="task.can_edit"
                  class="task-item__edit"
                  title="Редактировать задачу"
                  @click="openEditTaskDialog(task)"
                >
                  <v-icon icon="mdi-pencil-outline" size="16" />
                </button>
                <button class="task-item__delete" @click="openDeleteTaskDialog(selectedProjectId!, task.id, task.text)">
                  <v-icon icon="mdi-trash-can-outline" size="16" />
                </button>
              </div>
            </div>
          </div>

          <!-- Empty tasks -->
          <div v-else class="empty-state">
            <div class="empty-state__icon empty-state__icon--primary">
              <v-icon icon="mdi-clipboard-plus-outline" size="36" />
            </div>
            <h3 class="empty-state__title">Задач пока нет</h3>
            <p class="empty-state__text">Создайте первое задание — волонтёры получат уведомление в Telegram.</p>
            <button class="create-btn create-btn--sm" @click="openCreateTaskDialog">
              <v-icon icon="mdi-plus" size="16" />
              Создать задачу
            </button>
          </div>
        </template>

        <!-- ── Info card for mobile ── -->
        <div class="info-card-mobile">
          <div class="info-card">
            <div class="info-card__header">
              <v-icon icon="mdi-bell-ring-outline" size="18" class="info-card__icon" />
              <span>Как это работает</span>
            </div>

            <div class="info-items">
              <div class="info-item">
                <div class="info-item__num">1</div>
                <div>
                  <div class="info-item__title">Создайте задачу</div>
                  <p class="info-item__text">Укажите описание, дедлайн и временное окно. Задача сразу появится у волонтёров.</p>
                </div>
              </div>
              <div class="info-item">
                <div class="info-item__num">2</div>
                <div>
                  <div class="info-item__title">Волонтёры получают уведомление</div>
                  <p class="info-item__text">Push-уведомление в Telegram и приложении — синхронизация мгновенная.</p>
                </div>
              </div>
              <div class="info-item">
                <div class="info-item__num">3</div>
                <div>
                  <div class="info-item__title">Напоминание за 2 часа</div>
                  <p class="info-item__text">Автоматическое напоминание перед дедлайном, чтобы ничего не пропустили.</p>
                </div>
              </div>
              <div class="info-item">
                <div class="info-item__num">4</div>
                <div>
                  <div class="info-item__title">Фотоотчёт и оценка</div>
                  <p class="info-item__text">После выполнения волонтёр загружает фото — вы проверяете в разделе «Фотоотчёты».</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Info sidebar ── -->
      <div class="sidebar-col">
        <div class="info-card">
          <div class="info-card__header">
            <v-icon icon="mdi-bell-ring-outline" size="18" class="info-card__icon" />
            <span>Как это работает</span>
          </div>

          <div class="info-items">
            <div class="info-item">
              <div class="info-item__num">1</div>
              <div>
                <div class="info-item__title">Создайте задачу</div>
                <p class="info-item__text">Укажите описание, дедлайн и временное окно. Задача сразу появится у волонтёров.</p>
              </div>
            </div>
            <div class="info-item">
              <div class="info-item__num">2</div>
              <div>
                <div class="info-item__title">Волонтёры получают уведомление</div>
                <p class="info-item__text">Push-уведомление в Telegram и приложении — синхронизация мгновенная.</p>
              </div>
            </div>
            <div class="info-item">
              <div class="info-item__num">3</div>
              <div>
                <div class="info-item__title">Напоминание за 2 часа</div>
                <p class="info-item__text">Автоматическое напоминание перед дедлайном, чтобы ничего не пропустили.</p>
              </div>
            </div>
            <div class="info-item">
              <div class="info-item__num">4</div>
              <div>
                <div class="info-item__title">Фотоотчёт и оценка</div>
                <p class="info-item__text">После выполнения волонтёр загружает фото — вы проверяете в разделе «Фотоотчёты».</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ─── Create Task Dialog ─── -->
    <v-dialog v-model="createTaskDialog" max-width="580">
      <div class="task-modal">
        <div class="task-modal__header">
          <div class="task-modal__header-icon" :class="{ 'task-modal__header-icon--edit': isEditing }">
            <v-icon :icon="isEditing ? 'mdi-pencil-outline' : 'mdi-clipboard-plus-outline'" size="22" color="white" />
          </div>
          <div>
            <div class="task-modal__title">{{ isEditing ? 'Редактировать задачу' : 'Новая задача' }}</div>
            <div class="task-modal__subtitle">
              {{ isEditing ? 'Изменения увидят все участники проекта' : 'Будет отправлена всем волонтёрам проекта' }}
            </div>
          </div>
          <button class="task-modal__close" @click="closeCreateTaskDialog">
            <v-icon icon="mdi-close" size="20" />
          </button>
        </div>

        <div class="task-modal__body">
          <v-form ref="taskFormRef" @submit.prevent="submitCreateTask">
            <div class="form-section">
              <div class="form-section__label">Описание задачи</div>
              <v-textarea
                v-model="taskFormState.text"
                label="Что нужно сделать?"
                variant="outlined"
                density="comfortable"
                rows="4"
                auto-grow
                :rules="[rules.required]"
              />
            </div>

            <div class="form-section">
              <div class="form-section__label">Сроки (опционально)</div>
              <v-row dense>
                <v-col cols="12" md="6">
                  <v-dialog max-width="320">
                    <template #activator="{ props }">
                      <v-text-field
                        :model-value="taskFormState.deadline_date ? formatDeadline(taskFormState.deadline_date) : ''"
                        label="Дата дедлайна"
                        variant="outlined"
                        density="comfortable"
                        prepend-inner-icon="mdi-calendar-outline"
                        readonly
                        v-bind="props"
                        placeholder="Выбрать дату"
                      />
                    </template>
                    <template #default="{ isActive }">
                      <v-card rounded="xl">
                        <v-date-picker
                          v-model="taskFormState.deadline_date"
                          locale="ru"
                          :first-day-of-week="1"
                          color="primary"
                          :min="new Date().toISOString().split('T')[0]"
                          :max="selectedProject?.end_date"
                          @update:model-value="(v: any) => {
                            if (v instanceof Date) {
                              const y = v.getFullYear();
                              const m = String(v.getMonth() + 1).padStart(2, '0');
                              const d = String(v.getDate()).padStart(2, '0');
                              taskFormState.deadline_date = `${y}-${m}-${d}`;
                            } else {
                              taskFormState.deadline_date = v;
                            }
                            isActive.value = false;
                          }"
                        />
                      </v-card>
                    </template>
                  </v-dialog>
                </v-col>
                <v-col cols="6" md="3">
                  <v-text-field
                    v-model="taskFormState.start_time"
                    type="time"
                    label="Начало"
                    variant="outlined"
                    density="comfortable"
                    prepend-inner-icon="mdi-clock-outline"
                  />
                </v-col>
                <v-col cols="6" md="3">
                  <v-text-field
                    v-model="taskFormState.end_time"
                    type="time"
                    label="Конец"
                    variant="outlined"
                    density="comfortable"
                    prepend-inner-icon="mdi-clock-end"
                  />
                </v-col>
              </v-row>
            </div>
          </v-form>
        </div>

        <div class="task-modal__footer">
          <button class="task-modal__cancel" @click="closeCreateTaskDialog">Отмена</button>
          <button class="task-modal__submit" :disabled="createTaskLoading" @click="submitCreateTask">
            <v-icon v-if="createTaskLoading" icon="mdi-loading" size="18" class="spin" />
            <v-icon v-else icon="mdi-check" size="18" />
            {{ isEditing ? 'Сохранить изменения' : 'Создать и уведомить' }}
          </button>
        </div>
      </div>
    </v-dialog>

    <!-- ─── Delete Dialog ─── -->
    <v-dialog v-model="deleteTaskDialog" max-width="420">
      <div class="delete-modal">
        <div class="delete-modal__icon">
          <v-icon icon="mdi-trash-can-outline" size="28" color="error" />
        </div>
        <h2 class="delete-modal__title">Удалить задачу?</h2>
        <div class="delete-modal__task">{{ taskToDelete?.text }}</div>
        <p class="delete-modal__desc">Это действие нельзя отменить.</p>
        <div class="delete-modal__actions">
          <button class="delete-modal__cancel" :disabled="deletingTask" @click="closeDeleteTaskDialog">Отмена</button>
          <button class="delete-modal__confirm" :disabled="deletingTask" @click="confirmDeleteTask">
            <v-icon v-if="deletingTask" icon="mdi-loading" size="16" class="spin" />
            <v-icon v-else icon="mdi-trash-can-outline" size="16" />
            Удалить
          </button>
        </div>
      </div>
    </v-dialog>

    <!-- ─── View Task Dialog ─── -->
    <v-dialog v-model="viewTaskDialog" max-width="700">
      <div v-if="selectedTaskForView" class="task-details-modal">
        <div class="task-details-modal__header">
          <div class="task-details-modal__title-section">
            <h2 class="task-details-modal__title">Детали задачи</h2>
            <div class="task-details-modal__status">
              <span class="task-status-badge" :style="{ color: taskStatusConfig(selectedTaskForView.status).color, background: taskStatusConfig(selectedTaskForView.status).color + '18' }">
                {{ taskStatusConfig(selectedTaskForView.status).label }}
              </span>
            </div>
          </div>
          <button class="task-modal__close" @click="viewTaskDialog = false">
            <v-icon icon="mdi-close" size="20" />
          </button>
        </div>

        <div class="task-details-modal__body">
          <!-- Text section -->
          <div class="detail-section">
            <div class="detail-section__label">Описание</div>
            <div class="detail-section__content detail-section__content--text">
              {{ selectedTaskForView.text }}
            </div>
          </div>

          <!-- Meta section -->
          <div class="detail-section">
            <div class="detail-section__label">Информация</div>
            <div class="detail-meta-grid">
              <div class="detail-meta-item">
                <v-icon icon="mdi-calendar-outline" size="18" />
                <div>
                  <div class="detail-meta-item__label">Срок выполнения</div>
                  <div class="detail-meta-item__value">
                    {{ selectedTaskForView.deadline_date 
                         ? formatDeadline(selectedTaskForView.deadline_date) 
                         : (selectedProject?.end_date ? formatDeadline(selectedProject.end_date) : 'Без срока') }}
                  </div>
                </div>
              </div>
              <div v-if="selectedTaskForView.start_time" class="detail-meta-item">
                <v-icon icon="mdi-clock-outline" size="18" />
                <div>
                  <div class="detail-meta-item__label">Время</div>
                  <div class="detail-meta-item__value">
                    {{ selectedTaskForView.start_time }} — {{ selectedTaskForView.end_time || '' }}
                  </div>
                </div>
              </div>
              <div class="detail-meta-item">
                <v-icon icon="mdi-calendar-plus" size="18" />
                <div>
                  <div class="detail-meta-item__label">Дата создания</div>
                  <div class="detail-meta-item__value">
                    {{ selectedTaskForView.created_at ? new Intl.DateTimeFormat('ru-RU').format(new Date(selectedTaskForView.created_at)) : '—' }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Photos section -->
          <div class="detail-section">
            <div class="detail-section__label">Фотоотчёты ({{ selectedTaskForView.photos?.length || 0 }})</div>
            <div v-if="groupedPhotos.length > 0" class="report-groups">
              <div v-for="group in groupedPhotos" :key="group.name" class="report-group">
                <div class="report-group__header">
                  <div class="volunteer-block">
                    <div class="volunteer-block__avatar">
                      {{ group.name.slice(0, 2).toUpperCase() }}
                    </div>
                    <div class="volunteer-block__info">
                      <div class="volunteer-block__name">{{ group.name }}</div>
                      <div class="volunteer-block__date">
                        Последнее обновление: {{ new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(group.latestDate)) }}
                      </div>
                    </div>
                  </div>
                  
                  <div v-if="group.pending" class="report-group__moderation">
                    <v-btn
                      color="success"
                      variant="flat"
                      rounded="lg"
                      class="px-4"
                      prepend-icon="mdi-check"
                      :loading="groupActionLoading(group.pendingIds)"
                      @click="openApproveDialog(group.pendingIds)"
                    >
                      Одобрить отчёт
                    </v-btn>
                    <v-btn
                      color="error"
                      variant="tonal"
                      rounded="lg"
                      class="px-4"
                      prepend-icon="mdi-close"
                      :loading="groupActionLoading(group.pendingIds)"
                      @click="openRejectDialog(group.pendingIds)"
                    >
                      Отклонить
                    </v-btn>
                  </div>
                  <div v-else class="report-group__status-badge">
                    <v-icon :icon="group.hasRejected ? 'mdi-close-circle-outline' : 'mdi-check-circle-outline'" 
                            :color="group.hasRejected ? 'error' : 'success'" size="20" />
                    <span :style="{ color: group.hasRejected ? '#e53935' : '#2e7d32' }">
                      {{ group.hasRejected ? 'Отчёт отклонён' : 'Отчёт одобрен' }}
                    </span>
                  </div>
                </div>

                <!-- Multi-image gallery -->
                <div class="photo-gallery">
                  <v-carousel
                    v-if="group.photos.length > 0"
                    height="400"
                    hide-delimiter-background
                    show-arrows="hover"
                    rounded="xl"
                  >
                    <v-carousel-item
                      v-for="(photo, i) in group.photos"
                      :key="photo.id"
                      cover
                    >
                      <v-img :src="getFullImageUrl(photo.url) || ''" height="400" cover>
                        <div class="photo-caption" v-if="photo.comment">
                          <v-icon icon="mdi-message-text-outline" size="14" class="mr-1" />
                          {{ photo.comment }}
                        </div>
                        <div class="photo-index">{{ i + 1 }} / {{ group.photos.length }}</div>
                        <div class="photo-status-corner" :style="{ background: getPhotoStatusConfig(photo.status).color }">
                          {{ getPhotoStatusConfig(photo.status).label }}
                        </div>
                      </v-img>
                    </v-carousel-item>
                  </v-carousel>
                </div>
              </div>
            </div>
            <div v-else class="photos-empty">
              <v-icon icon="mdi-image-off-outline" size="32" color="rgba(0,0,0,0.15)" />
              <p>Пока нет загруженных фотоотчётов</p>
            </div>
          </div>
        </div>
      </div>
    </v-dialog>

    <!-- ─── Approve Dialog ─── -->
    <v-dialog v-model="approveDialog.open" max-width="400">
      <div class="action-modal">
        <div class="action-modal__header action-modal__header--approve">
          <div class="action-modal__icon">
            <v-icon icon="mdi-check-circle-outline" size="24" color="white" />
          </div>
          <div class="action-modal__title">Оценить фотоотчёт</div>
        </div>
        <div class="action-modal__body">
          <p class="action-modal__desc">Выберите оценку. Для 1–3 звёзд добавьте комментарий.</p>
          <div class="rating-row">
            <v-rating v-model="approveDialog.rating" length="5" color="amber-darken-1" active-color="amber-darken-1" size="32" />
          </div>
          <v-textarea
            v-model="approveDialog.feedback"
            label="Комментарий"
            variant="outlined"
            density="comfortable"
            rows="3"
            auto-grow
            counter="400"
            maxlength="400"
            hint="Обязателен для оценки 1–3 ★"
          />
          <v-alert v-if="approveDialog.error" type="error" variant="tonal" density="compact" rounded="lg" class="mt-3">
            {{ approveDialog.error }}
          </v-alert>
        </div>
        <div class="action-modal__footer">
          <button class="action-modal__btn action-modal__btn--primary action-modal__btn--green"
            :disabled="!canSubmitApproval || (approveDialog.photoId ? photoActionLoading(approveDialog.photoId) : false)"
            @click="submitApprove(false)">
            <v-icon icon="mdi-check" size="18" />
            Одобрить отчёт целиком
          </button>
          <button class="action-modal__btn action-modal__btn--secondary"
            :disabled="groupActionLoading(approveDialog.photoIds)"
            @click="submitApprove(true)">
            Одобрить без оценки
          </button>
          <button class="action-modal__btn action-modal__btn--cancel" @click="approveDialog.open = false">Отмена</button>
        </div>
      </div>
    </v-dialog>

    <!-- ─── Reject Dialog ─── -->
    <v-dialog v-model="rejectDialog.open" max-width="400">
      <div class="action-modal">
        <div class="action-modal__header action-modal__header--reject">
          <div class="action-modal__icon">
            <v-icon icon="mdi-close-circle-outline" size="24" color="white" />
          </div>
          <div class="action-modal__title">Отклонить отчёт</div>
        </div>
        <div class="action-modal__body">
          <p class="action-modal__desc">Все фотографии волонтера в этом задании будут отклонены. Укажите причину:</p>
          <v-form ref="rejectFormRef">
            <v-textarea
              v-model="rejectDialog.feedback"
              label="Причина отклонения"
              variant="outlined"
              density="comfortable"
              rows="3"
              auto-grow
              :rules="[(v: string) => !!v?.trim() || 'Обязательно']"
            />
          </v-form>
          <v-alert v-if="rejectDialog.error" type="error" variant="tonal" density="compact" rounded="lg" class="mt-3">
            {{ rejectDialog.error }}
          </v-alert>
        </div>
        <div class="action-modal__footer">
          <button class="action-modal__btn action-modal__btn--primary action-modal__btn--red"
            :disabled="groupActionLoading(rejectDialog.photoIds)"
            @click="submitReject">
            <v-icon icon="mdi-close" size="18" />
            Отклонить весь отчёт
          </button>
          <button class="action-modal__btn action-modal__btn--cancel" @click="rejectDialog.open = false">Отмена</button>
        </div>
      </div>
    </v-dialog>

    <!-- ─── Snackbar ─── -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="4000" rounded="pill" location="bottom center">
      {{ snackbar.message }}
    </v-snackbar>
  </div>
</template>

<style scoped>
/* ─── Base ─── */
.tasks-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

@keyframes spin { to { transform: rotate(360deg); } }
.spin { animation: spin 1s linear infinite; }

/* ─── Page Header ─── */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  background: linear-gradient(135deg, #f0faf0, #fafff5);
  border: 1px solid rgba(139, 195, 74, 0.18);
  border-radius: 20px;
  padding: 20px 28px;
}

.page-title {
  font-size: 1.75rem;
  font-weight: 800;
  letter-spacing: -0.5px;
  color: #1a1a1a;
  margin: 0 0 4px;
}

.page-subtitle {
  font-size: 0.875rem;
  color: rgba(0, 0, 0, 0.45);
  margin: 0;
}

/* Create button */
.create-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 10px 22px;
  background: linear-gradient(135deg, #8bc34a, #558b2f);
  color: #fff;
  border: none;
  border-radius: 100px;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(139, 195, 74, 0.35);
  transition: opacity 0.15s, transform 0.15s, box-shadow 0.15s;
}

.create-btn:hover { opacity: 0.9; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(139, 195, 74, 0.45); }
.create-btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }

.create-btn--sm {
  padding: 8px 18px;
  font-size: 0.82rem;
  margin-top: 4px;
}

/* ─── Main layout ─── */
.main-layout {
  display: grid;
  grid-template-columns: 1fr 260px;
  gap: 16px;
  align-items: start;
}

/* ─── Mobile info card ─── */
.info-card-mobile {
  display: none;
  margin-top: 24px;
}

@media (max-width: 1024px) {
  .main-layout { grid-template-columns: 1fr; }
  .sidebar-col { display: none; }
  .info-card-mobile { display: block; }
}

/* ─── Project selector ─── */
.project-selector-card {
  background: #fff;
  border-radius: 16px;
  border: 1px solid rgba(0, 0, 0, 0.07);
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.project-selector-label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: rgba(0, 0, 0, 0.4);
}

/* Stats row */
.task-stats {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 14px;
  background: rgba(0, 0, 0, 0.025);
  border-radius: 10px;
}

.task-stat {
  display: flex;
  align-items: baseline;
  gap: 5px;
}

.task-stat__value {
  font-size: 1.25rem;
  font-weight: 800;
  color: #1a1a1a;
}

.task-stat__value--green { color: #2e7d32; }
.task-stat__value--blue { color: #1565c0; }

.task-stat__label {
  font-size: 0.75rem;
  color: rgba(0, 0, 0, 0.4);
}

.task-stat-divider {
  width: 1px;
  height: 24px;
  background: rgba(0, 0, 0, 0.1);
}

/* ─── Tasks list ─── */
.tasks-col {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tasks-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ─── Task item ─── */
.task-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: #fff;
  border-radius: 14px;
  border: 1px solid rgba(0, 0, 0, 0.07);
  padding: 14px 14px 14px 0;
  position: relative;
  overflow: hidden;
  transition: box-shadow 0.2s, transform 0.2s;
}

.task-item:hover {
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
}

.task-item--skeleton { pointer-events: none; }

.task-item__indicator {
  width: 4px;
  align-self: stretch;
  border-radius: 0 4px 4px 0;
  flex-shrink: 0;
  min-height: 40px;
}

.task-item__icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.04);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 1px;
}

.task-item__content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.task-item__text {
  font-size: 0.9rem;
  font-weight: 600;
  color: #1a1a1a;
  line-height: 1.4;
}

.task-item__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.task-meta-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  color: rgba(0, 0, 0, 0.5);
  background: rgba(0, 0, 0, 0.04);
  border-radius: 100px;
  padding: 2px 8px;
}

.task-meta-chip--muted { color: rgba(0, 0, 0, 0.3); }

.task-status-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 100px;
  font-size: 0.72rem;
  font-weight: 700;
}

/* Actions */
.task-item__actions {
  display: flex;
  gap: 6px;
  align-items: center;
  opacity: 0;
  transition: opacity 0.15s;
  margin-top: 2px;
}

.task-item:hover .task-item__actions { opacity: 1; }

.task-item__view,
.task-item__edit,
.task-item__delete {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s;
}

.task-item__view {
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: rgba(0, 0, 0, 0.04);
  color: rgba(0, 0, 0, 0.5);
}
.task-item__view:hover { background: rgba(0, 0, 0, 0.08); color: #1a1a1a; }

.task-item__edit {
  border: 1px solid rgba(21, 101, 192, 0.15);
  background: rgba(21, 101, 192, 0.06);
  color: #1565c0;
}
.task-item__edit:hover { background: rgba(21, 101, 192, 0.12); }

.task-item__delete {
  border: 1px solid rgba(198, 40, 40, 0.15);
  background: rgba(198, 40, 40, 0.06);
  color: #c62828;
}
.task-item__delete:hover { background: rgba(198, 40, 40, 0.12); }

/* ─── Empty states ─── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 48px 24px;
  background: #fff;
  border-radius: 16px;
  border: 2px dashed rgba(0, 0, 0, 0.08);
}

.empty-state__icon {
  width: 68px;
  height: 68px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.04);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(0, 0, 0, 0.25);
  margin-bottom: 14px;
}

.empty-state__icon--primary {
  background: rgba(139, 195, 74, 0.1);
  color: rgba(139, 195, 74, 0.8);
}

.empty-state__title {
  font-size: 1rem;
  font-weight: 800;
  margin: 0 0 6px;
}

.empty-state__text {
  font-size: 0.85rem;
  color: rgba(0, 0, 0, 0.45);
  max-width: 280px;
  line-height: 1.5;
  margin: 0 0 16px;
}

/* ─── Sidebar ─── */
.sidebar-col { position: sticky; top: 80px; }

.info-card {
  background: #fff;
  border-radius: 18px;
  border: 1px solid rgba(0, 0, 0, 0.07);
  padding: 18px;
}

.info-card__header {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.7px;
  color: rgba(0, 0, 0, 0.4);
  margin-bottom: 18px;
}

.info-card__icon { color: #8bc34a; }

.info-items {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.info-item {
  display: flex;
  gap: 12px;
  padding-bottom: 18px;
  position: relative;
}

.info-item:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 11px;
  top: 26px;
  bottom: 0;
  width: 2px;
  background: linear-gradient(to bottom, rgba(139, 195, 74, 0.25), transparent);
}

.info-item:last-child { padding-bottom: 0; }

.info-item__num {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: linear-gradient(135deg, #8bc34a, #558b2f);
  color: #fff;
  font-size: 0.72rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 1px;
}

.info-item__title {
  font-size: 0.85rem;
  font-weight: 700;
  color: #1a1a1a;
  margin-bottom: 3px;
}

.info-item__text {
  font-size: 0.775rem;
  color: rgba(0, 0, 0, 0.5);
  line-height: 1.45;
  margin: 0;
}

/* ─── Task Modal ─── */
.task-modal {
  background: #fff;
  border-radius: 20px;
  overflow: hidden;
}

.task-modal__header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 20px;
  background: linear-gradient(135deg, #2d5a1b, #4a8f2a);
}

.task-modal__header-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: #8bc34a;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(139, 195, 74, 0.3);
}

.task-modal__header-icon--edit {
  background: #1565c0;
  box-shadow: 0 4px 12px rgba(21, 101, 192, 0.3);
}

.task-modal__title {
  font-size: 1rem;
  font-weight: 800;
  color: #fff;
}

.task-modal__subtitle {
  font-size: 0.775rem;
  color: rgba(255, 255, 255, 0.65);
  margin-top: 2px;
}

.task-modal__close {
  margin-left: auto;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: transparent;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}

.task-modal__close:hover { background: rgba(255, 255, 255, 0.15); }

.task-modal__body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-section { display: flex; flex-direction: column; gap: 10px; }

.form-section__label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: rgba(0, 0, 0, 0.38);
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.task-modal__footer {
  display: flex;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid rgba(0, 0, 0, 0.07);
  justify-content: flex-end;
}

.task-modal__cancel {
  padding: 9px 18px;
  border-radius: 100px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  background: transparent;
  color: rgba(0, 0, 0, 0.5);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.task-modal__cancel:hover { background: rgba(0, 0, 0, 0.05); }

.task-modal__submit {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 9px 22px;
  border-radius: 100px;
  border: none;
  background: linear-gradient(135deg, #8bc34a, #558b2f);
  color: #fff;
  font-size: 0.875rem;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s;
}

.task-modal__submit:hover:not(:disabled) { opacity: 0.88; }
.task-modal__submit:disabled { opacity: 0.45; cursor: not-allowed; }

/* ─── Delete Modal ─── */
.delete-modal {
  background: #fff;
  border-radius: 20px;
  padding: 28px 24px 24px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.delete-modal__icon {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: rgba(198, 40, 40, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14px;
}

.delete-modal__title {
  font-size: 1.05rem;
  font-weight: 800;
  margin: 0 0 12px;
}

.delete-modal__task {
  background: rgba(0, 0, 0, 0.04);
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 0.875rem;
  color: #1a1a1a;
  font-weight: 500;
  line-height: 1.4;
  width: 100%;
  margin-bottom: 10px;
}

.delete-modal__desc {
  font-size: 0.825rem;
  color: rgba(0, 0, 0, 0.45);
  margin: 0 0 20px;
}

.delete-modal__actions {
  display: flex;
  gap: 8px;
  width: 100%;
}

.delete-modal__cancel {
  flex: 1;
  padding: 10px;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  background: transparent;
  color: rgba(0, 0, 0, 0.5);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.delete-modal__cancel:disabled { opacity: 0.4; cursor: not-allowed; }
.delete-modal__cancel:hover:not(:disabled) { background: rgba(0, 0, 0, 0.05); }

.delete-modal__confirm {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg, #e53935, #c62828);
  color: #fff;
  font-size: 0.875rem;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s;
}

.delete-modal__confirm:disabled { opacity: 0.45; cursor: not-allowed; }
.delete-modal__confirm:hover:not(:disabled) { opacity: 0.88; }

:deep(.v-picker-title) { display: none; }
/* ─── Task Details Modal ─── */
.task-details-modal {
  background: #fff;
  border-radius: 24px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.task-details-modal__header {
  padding: 24px 28px;
  background: linear-gradient(135deg, #f0faf0, #fafff5);
  border-bottom: 1px solid rgba(139, 195, 74, 0.12);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.task-details-modal__title {
  font-size: 1.5rem;
  font-weight: 800;
  color: #1a1a1a;
  margin: 0;
}

.task-details-modal__title-section {
  display: flex;
  align-items: center;
  gap: 16px;
}

.task-details-modal__body {
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 32px;
  max-height: 70vh;
  overflow-y: auto;
}

.detail-section__label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: rgba(0, 0, 0, 0.35);
  margin-bottom: 12px;
}

.detail-section__content--text {
  font-size: 1.05rem;
  line-height: 1.6;
  color: #333;
  padding: 18px 24px;
  background: #f8fbf7;
  border-radius: 16px;
  border-left: 4px solid #8bc34a;
}

.detail-meta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
}

.detail-meta-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #fff;
  border: 1px solid rgba(0,0,0,0.06);
  border-radius: 12px;
}

.detail-meta-item :deep(.v-icon) {
  color: #8bc34a;
  opacity: 0.8;
}

.detail-meta-item__label {
  font-size: 0.72rem;
  color: rgba(0, 0, 0, 0.4);
}

.detail-meta-item__value {
  font-size: 0.9rem;
  font-weight: 700;
  color: #1a1a1a;
}

/* Photos */
.photos-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.photo-item {
  display: flex;
  gap: 16px;
  padding: 12px;
  background: #fff;
  border: 1px solid rgba(0,0,0,0.06);
  border-radius: 16px;
  transition: transform 0.2s;
}

.photo-item:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.05); }

.photo-item__image-wrap {
  width: 120px;
  height: 120px;
  border-radius: 12px;
  overflow: hidden;
  flex-shrink: 0;
}

.photo-item__info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.photo-item__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.photo-item__volunteer {
  font-weight: 700;
  font-size: 0.95rem;
  color: #1a1a1a;
}

.photo-item__status {
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
}

.photo-item__comment {
  font-size: 0.9rem;
  color: #555;
  line-height: 1.4;
  padding: 8px 12px;
  background: rgba(0,0,0,0.02);
  border-radius: 10px;
}

.report-groups {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.report-group {
  background: #fff;
  border: 1px solid rgba(0,0,0,0.06);
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 4px 15px rgba(0,0,0,0.03);
}

.report-group__header {
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fcfcfc;
  border-bottom: 1px solid rgba(0,0,0,0.05);
}

.volunteer-block {
  display: flex;
  align-items: center;
  gap: 12px;
}

.volunteer-block__avatar {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #8bc34a, #afb42b);
  border-radius: 12px;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 0.85rem;
}

.volunteer-block__name {
  font-weight: 700;
  color: #333;
  font-size: 0.95rem;
}

.volunteer-block__date {
  font-size: 0.75rem;
  color: rgba(0,0,0,0.4);
  margin-top: 2px;
}

.report-group__moderation {
  display: flex;
  gap: 10px;
}

.report-group__status-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 0.85rem;
  padding: 6px 14px;
  background: rgba(0,0,0,0.03);
  border-radius: 50px;
}

.photo-gallery {
  position: relative;
}

.photo-caption {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.7), transparent);
  padding: 30px 20px 15px;
  color: #fff;
  font-size: 0.85rem;
  font-weight: 500;
}

.photo-index {
  position: absolute;
  top: 15px;
  left: 15px;
  background: rgba(0,0,0,0.4);
  backdrop-filter: blur(4px);
  color: #fff;
  padding: 4px 10px;
  border-radius: 50px;
  font-size: 0.75rem;
  font-weight: 700;
}

.photo-status-corner {
  position: absolute;
  top: 0;
  right: 0;
  padding: 6px 12px;
  color: #fff;
  font-size: 0.75rem;
  font-weight: 700;
  border-bottom-left-radius: 12px;
}

.photos-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  background: #fafafa;
  border-radius: 16px;
  border: 2px dashed rgba(0,0,0,0.05);
  color: rgba(0,0,0,0.4);
  gap: 12px;
  text-align: center;
}

/* ─── Action Modals (Approve/Reject) ─── */
.action-modal {
  background: #fff;
  border-radius: 20px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.action-modal__header {
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 14px;
}

.action-modal__header--approve { background: linear-gradient(135deg, #2e7d32, #43a047); }
.action-modal__header--reject { background: linear-gradient(135deg, #c62828, #e53935); }

.action-modal__icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-modal__title {
  font-size: 1.15rem;
  font-weight: 800;
  color: #fff;
}

.action-modal__body {
  padding: 24px;
}

.action-modal__desc {
  font-size: 0.9rem;
  color: rgba(0,0,0,0.55);
  margin-bottom: 20px;
  line-height: 1.4;
}

.rating-row {
  display: flex;
  justify-content: center;
  margin-bottom: 24px;
}

.action-modal__footer {
  padding: 0 24px 24px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.action-modal__btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  border-radius: 12px;
  font-size: 0.9rem;
  font-weight: 700;
  transition: opacity 0.15s, transform 0.1s;
}

.action-modal__btn:active { transform: scale(0.98); }
.action-modal__btn:disabled { opacity: 0.5; cursor: not-allowed; }

.action-modal__btn--primary { color: #fff; border: none; }
.action-modal__btn--green { background: linear-gradient(135deg, #2e7d32, #43a047); }
.action-modal__btn--red { background: linear-gradient(135deg, #c62828, #e53935); }
.action-modal__btn--secondary { background: #f5f5f5; color: #333; border: 1px solid #eee; }
.action-modal__btn--cancel { background: transparent; color: #777; border: 1px solid #ddd; }
</style>