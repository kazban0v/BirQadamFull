<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import type { VForm } from 'vuetify/components';

import { useAuthStore } from '@/stores/auth';
import { useOrganizerStore } from '@/stores/organizer';
import { deleteTask } from '@/services/organizer';

const authStore = useAuthStore();
const organizerStore = useOrganizerStore();
const route = useRoute();

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
const createTaskLoading = ref(false);
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
    open: { color: '#1565c0', label: 'Открыта', icon: 'mdi-circle-outline' },
    in_progress: { color: '#ff9800', label: 'В работе', icon: 'mdi-clock-outline' },
    completed: { color: '#2e7d32', label: 'Выполнена', icon: 'mdi-check-circle-outline' },
    cancelled: { color: '#757575', label: 'Отменена', icon: 'mdi-cancel' },
    failed: { color: '#c62828', label: 'Отклонена', icon: 'mdi-close-circle-outline' },
    closed: { color: '#424242', label: 'Закрыта', icon: 'mdi-lock-outline' },
    pending: { color: '#e65100', label: 'В ожидании', icon: 'mdi-clock-outline' },
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
    total: tasks.length,
    completed: tasks.filter(t => t.status === 'completed').length,
    open: tasks.filter(t => t.status === 'open').length,
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
  taskFormState.text = '';
  taskFormState.deadline_date = null;
  taskFormState.start_time = null;
  taskFormState.end_time = null;
  createTaskDialog.value = true;
};

const closeCreateTaskDialog = () => { createTaskDialog.value = false; };

const submitCreateTask = async () => {
  if (!selectedProjectId.value) return;
  const { valid } = (await taskFormRef.value?.validate()) ?? { valid: false };
  if (!valid) return;
  createTaskLoading.value = true;
  try {
    await organizerStore.createTask(selectedProjectId.value, {
      text: taskFormState.text,
      deadline_date: taskFormState.deadline_date || undefined,
      start_time: taskFormState.start_time || undefined,
      end_time: taskFormState.end_time || undefined,
    });
    snackbar.message = 'Задача создана, волонтёры уведомлены.';
    snackbar.color = 'success';
    snackbar.show = true;
    closeCreateTaskDialog();
  } catch (error: any) {
    snackbar.message = error?.response?.data?.error || error?.message || 'Не удалось создать задачу.';
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
</script>

<template>
  <div class="tasks-view">

    <!-- ─── Page Header ─── -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Задачи</h1>
        <p class="page-subtitle">Создавайте задания и управляйте сроками волонтёров</p>
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

              <!-- Delete button -->
              <button class="task-item__delete" @click="openDeleteTaskDialog(selectedProjectId!, task.id, task.text)">
                <v-icon icon="mdi-trash-can-outline" size="16" />
              </button>
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
          <div class="task-modal__header-icon">
            <v-icon icon="mdi-clipboard-plus-outline" size="22" color="white" />
          </div>
          <div>
            <div class="task-modal__title">Новая задача</div>
            <div class="task-modal__subtitle">Будет отправлена всем волонтёрам проекта</div>
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
            <v-icon v-else icon="mdi-send-outline" size="18" />
            Создать и уведомить
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

/* Delete button */
.task-item__delete {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: 1px solid rgba(198, 40, 40, 0.15);
  background: rgba(198, 40, 40, 0.06);
  color: #c62828;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  opacity: 0;
  transition: background 0.15s, opacity 0.15s;
  margin-top: 2px;
}

.task-item:hover .task-item__delete { opacity: 1; }
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
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
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
</style>