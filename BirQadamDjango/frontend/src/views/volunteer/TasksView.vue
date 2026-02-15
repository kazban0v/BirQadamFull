<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import { fetchVolunteerTasks, type VolunteerTask } from '@/services/tasks';

const router = useRouter();

const loading = ref(false);
const tasks = ref<VolunteerTask[]>([]);
const filter = ref<'all' | 'open' | 'assigned' | 'completed'>('all');
const snackbar = reactive({
  show: false,
  message: '',
  color: 'success',
});

const taskStatusMap: Record<string, { text: string; color: string }> = {
  open: { text: 'Открыто', color: 'primary' },
  in_progress: { text: 'В работе', color: 'warning' },
  completed: { text: 'Выполнено', color: 'success' },
  failed: { text: 'Отклонено', color: 'error' },
  closed: { text: 'Закрыто', color: 'grey-darken-1' },
};

const filteredTasks = computed(() => {
  let list = tasks.value;

  if (filter.value === 'open') {
    list = list.filter((task) => task.status === 'open' && !task.is_assigned);
  } else if (filter.value === 'assigned') {
    list = list.filter((task) => task.is_assigned && task.status !== 'completed');
  } else if (filter.value === 'completed') {
    list = list.filter((task) => task.status === 'completed');
  }

  return list;
});

const summary = computed(() => {
  return {
    total: tasks.value.length,
    open: tasks.value.filter((t) => t.status === 'open' && !t.is_assigned).length,
    assigned: tasks.value.filter((t) => t.is_assigned && t.status !== 'completed').length,
    completed: tasks.value.filter((t) => t.status === 'completed').length,
  };
});

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

async function loadTasks() {
  loading.value = true;
  try {
    tasks.value = await fetchVolunteerTasks();
  } catch (error: any) {
    // Обрабатываем ошибку 429
    if (error?.response?.status === 429) {
      showSnackbar('Слишком много запросов. Пожалуйста, подождите немного.', 'warning');
      // Пытаемся использовать кеш если есть
      setTimeout(() => loadTasks(), 2000);
    } else {
      const errorMessage = error?.response?.data?.error || error?.response?.data?.detail || 'Не удалось загрузить задачи.';
      showSnackbar(errorMessage, 'error');
    }
  } finally {
    loading.value = false;
  }
}

function showSnackbar(message: string, color: string = 'success') {
  snackbar.message = message;
  snackbar.color = color;
  snackbar.show = true;
}

function goToTask(taskId: number) {
  router.push({ name: 'volunteer-task-detail', params: { id: taskId } });
}

onMounted(async () => {
  await loadTasks();
});
</script>

<template>
  <div class="tasks-page">
    <!-- Статистика - 2x2 -->
    <v-row class="stats-row mb-4" dense>
      <v-col cols="6" class="stats-col">
        <v-card elevation="2" class="stats-card stats-card-total" rounded="lg">
          <div class="stats-card-content">
            <div class="stats-icon-wrapper">
              <v-icon icon="mdi-clipboard-list" size="24" color="primary" />
            </div>
            <div class="stats-text">
              <div class="stats-label">Всего задач</div>
              <div class="stats-value">{{ summary.total }}</div>
            </div>
          </div>
        </v-card>
      </v-col>
      <v-col cols="6" class="stats-col">
        <v-card elevation="2" class="stats-card stats-card-open" rounded="lg">
          <div class="stats-card-content">
            <div class="stats-icon-wrapper">
              <v-icon icon="mdi-folder-open-outline" size="24" color="info" />
            </div>
            <div class="stats-text">
              <div class="stats-label">Открыто</div>
              <div class="stats-value">{{ summary.open }}</div>
            </div>
          </div>
        </v-card>
      </v-col>
      <v-col cols="6" class="stats-col">
        <v-card elevation="2" class="stats-card stats-card-progress" rounded="lg">
          <div class="stats-card-content">
            <div class="stats-icon-wrapper">
              <v-icon icon="mdi-progress-clock" size="24" color="warning" />
            </div>
            <div class="stats-text">
              <div class="stats-label">В работе</div>
              <div class="stats-value">{{ summary.assigned }}</div>
            </div>
          </div>
        </v-card>
      </v-col>
      <v-col cols="6" class="stats-col">
        <v-card elevation="2" class="stats-card stats-card-completed" rounded="lg">
          <div class="stats-card-content">
            <div class="stats-icon-wrapper">
              <v-icon icon="mdi-check-circle-outline" size="24" color="success" />
            </div>
            <div class="stats-text">
              <div class="stats-label">Завершено</div>
              <div class="stats-value">{{ summary.completed }}</div>
            </div>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <!-- Фильтр -->
    <v-row class="mb-4 mb-md-6">
      <v-col cols="12">
        <v-card elevation="3" class="filter-card" rounded="lg">
          <div class="filter-header">
            <v-icon icon="mdi-filter-variant" size="22" class="me-2" color="primary" />
            <span class="filter-title">Фильтр</span>
          </div>
          <div class="filter-buttons">
            <v-btn
              :variant="filter === 'all' ? 'flat' : 'outlined'"
              :color="filter === 'all' ? 'primary' : 'default'"
              class="filter-btn text-none"
              @click="filter = 'all'"
            >
              Все
            </v-btn>
            <v-btn
              :variant="filter === 'open' ? 'flat' : 'outlined'"
              :color="filter === 'open' ? 'primary' : 'default'"
              class="filter-btn text-none"
              @click="filter = 'open'"
            >
              Открытые
            </v-btn>
            <v-btn
              :variant="filter === 'assigned' ? 'flat' : 'outlined'"
              :color="filter === 'assigned' ? 'primary' : 'default'"
              class="filter-btn text-none"
              @click="filter = 'assigned'"
            >
              В работе
            </v-btn>
            <v-btn
              :variant="filter === 'completed' ? 'flat' : 'outlined'"
              :color="filter === 'completed' ? 'primary' : 'default'"
              class="filter-btn text-none"
              @click="filter = 'completed'"
            >
              Завершенные
            </v-btn>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <v-alert
      v-if="!loading && !filteredTasks.length"
      type="info"
      variant="tonal"
      class="mb-6"
    >
      Задачи не найдены. Новые задачи появляются в проектах, к которым вы присоединились.
    </v-alert>

    <v-row class="ga-4 ga-md-6" v-if="filteredTasks.length">
      <v-col
        v-for="task in filteredTasks"
        :key="task.id"
        cols="12"
        md="6"
      >
        <v-card elevation="3" class="pa-4 pa-md-6 h-100 d-flex flex-column task-card">
          <div class="d-flex justify-space-between align-start mb-3 mb-md-4 flex-wrap ga-2">
            <div class="flex-grow-1 min-width-0">
              <h3 class="text-subtitle-1 text-md-h6 font-weight-bold mb-2 task-title">{{ task.text }}</h3>
              <div class="text-caption text-md-body-2 text-medium-emphasis mb-1 mb-md-2 task-info-item">
                <v-icon icon="mdi-folder-outline" size="14" class="me-1 flex-shrink-0" />
                <span>Проект: {{ task.project_title }}</span>
              </div>
              <div class="text-caption text-md-body-2 text-medium-emphasis mb-1 mb-md-2 task-info-item">
                <v-icon icon="mdi-account-outline" size="14" class="me-1 flex-shrink-0" />
                <span>Создатель: {{ task.creator_name }}</span>
              </div>
              <div class="text-caption text-md-body-2 text-medium-emphasis mb-1 mb-md-2 task-info-item">
                <v-icon icon="mdi-clock-outline" size="14" class="me-1 flex-shrink-0" />
                <span>Создано: {{ formatDateTime(task.created_at) }}</span>
              </div>
              <div v-if="task.deadline_date" class="text-caption text-md-body-2 text-medium-emphasis task-info-item">
                <v-icon icon="mdi-calendar-clock" size="14" class="me-1 flex-shrink-0" />
                <span>Срок: {{ formatDate(task.deadline_date) }}</span>
                <span v-if="task.start_time && task.end_time" class="ms-1">
                  ({{ task.start_time }} - {{ task.end_time }})
                </span>
              </div>
            </div>
            <v-chip
              :color="taskStatusMap[task.status]?.color || 'primary'"
              variant="tonal"
              size="small"
              class="ml-2 ml-md-3 flex-shrink-0 task-status-chip"
            >
              {{ taskStatusMap[task.status]?.text || task.status }}
            </v-chip>
          </div>

          <v-spacer />

          <div class="d-flex justify-end mt-3 mt-md-4">
            <v-btn
              color="primary"
              variant="flat"
              class="text-none font-weight-bold task-action-btn w-100 w-md-auto"
              @click="goToTask(task.id)"
            >
              Перейти к задаче
              <v-icon icon="mdi-arrow-right" end size="16" class="flex-shrink-0" />
            </v-btn>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <v-skeleton-loader
      v-if="loading"
      type="card@4"
    />

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="4000">
      {{ snackbar.message }}
    </v-snackbar>
  </div>
</template>

<style scoped>
.tasks-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* Строка статистики */
.stats-row {
  margin: -8px !important;
  display: flex;
  flex-wrap: wrap;
}

.stats-col {
  padding: 8px !important;
  flex: 0 0 50%;
  max-width: 50%;
}

/* Карточки статистики */
.stats-card {
  background: white;
  border: 1px solid rgba(76, 175, 80, 0.12);
  transition: all 0.3s ease;
  overflow: hidden;
  position: relative;
  height: 100%;
}

.stats-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, rgba(76, 175, 80, 0.4), rgba(76, 175, 80, 0.2));
  opacity: 0;
  transition: opacity 0.3s ease;
}

.stats-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.15) !important;
  border-color: rgba(76, 175, 80, 0.25);
}

.stats-card:hover::before {
  opacity: 1;
}

.stats-card-total::before {
  background: linear-gradient(90deg, rgba(76, 175, 80, 0.5), rgba(76, 175, 80, 0.3));
}

.stats-card-open::before {
  background: linear-gradient(90deg, rgba(33, 150, 243, 0.5), rgba(33, 150, 243, 0.3));
}

.stats-card-progress::before {
  background: linear-gradient(90deg, rgba(255, 152, 0, 0.5), rgba(255, 152, 0, 0.3));
}

.stats-card-completed::before {
  background: linear-gradient(90deg, rgba(76, 175, 80, 0.5), rgba(76, 175, 80, 0.3));
}

.stats-card-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 16px 12px;
  min-height: 100px;
}

.stats-icon-wrapper {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(76, 175, 80, 0.12), rgba(76, 175, 80, 0.06));
  flex-shrink: 0;
  margin-bottom: 10px;
}

.stats-card-open .stats-icon-wrapper {
  background: linear-gradient(135deg, rgba(33, 150, 243, 0.12), rgba(33, 150, 243, 0.06));
}

.stats-card-progress .stats-icon-wrapper {
  background: linear-gradient(135deg, rgba(255, 152, 0, 0.12), rgba(255, 152, 0, 0.06));
}

.stats-card-completed .stats-icon-wrapper {
  background: linear-gradient(135deg, rgba(76, 175, 80, 0.15), rgba(76, 175, 80, 0.08));
}

.stats-text {
  width: 100%;
}

.stats-label {
  font-size: 0.7rem;
  color: #6c757d;
  font-weight: 600;
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stats-value {
  font-size: 1.9rem;
  font-weight: 800;
  color: #1a1a1a;
  line-height: 1.1;
}

/* Карточка фильтра */
.filter-card {
  background: white;
  border: 1px solid rgba(76, 175, 80, 0.2);
  padding: 18px;
  box-shadow: 0 2px 10px rgba(76, 175, 80, 0.1);
}

.filter-header {
  display: flex;
  align-items: center;
  margin-bottom: 14px;
  font-weight: 700;
  color: #1a1a1a;
  font-size: 0.9375rem;
  text-transform: uppercase;
  letter-spacing: 0.8px;
}

.filter-title {
  color: #1a1a1a;
}

.filter-buttons {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  width: 100%;
}

.filter-btn {
  font-weight: 600;
  letter-spacing: 0.3px;
  padding: 14px 12px !important;
  font-size: 0.9rem !important;
  min-height: 48px !important;
  border-radius: 8px !important;
  border: 1.5px solid rgba(76, 175, 80, 0.25) !important;
  transition: all 0.2s ease;
}

.filter-btn.v-btn--variant-flat {
  background: linear-gradient(135deg, rgba(76, 175, 80, 0.25), rgba(76, 175, 80, 0.18)) !important;
  color: rgb(var(--v-theme-primary)) !important;
  font-weight: 700 !important;
  box-shadow: inset 0 2px 4px rgba(76, 175, 80, 0.1) !important;
  border-color: rgba(76, 175, 80, 0.4) !important;
}

.filter-btn.v-btn--variant-outlined:hover {
  background: rgba(76, 175, 80, 0.08) !important;
}

.task-card {
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}

.task-card:hover {
  box-shadow: 0 8px 24px rgba(139, 195, 74, 0.15);
  transform: translateY(-2px);
}

/* Мобильная адаптация */
@media (max-width: 960px) {
  .stats-card-content {
    padding: 14px 10px;
    min-height: 90px;
  }
  
  .stats-icon-wrapper {
    width: 40px;
    height: 40px;
    margin-bottom: 8px;
  }
  
  .stats-icon-wrapper :deep(.v-icon) {
    font-size: 20px !important;
  }
  
  .stats-value {
    font-size: 1.6rem;
  }
  
  .stats-label {
    font-size: 0.65rem;
    margin-bottom: 4px;
  }
  
  .filter-card {
    padding: 16px;
  }
  
  .filter-header {
    margin-bottom: 12px;
    font-size: 0.875rem;
  }
  
  .filter-buttons {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }
  
  .filter-btn {
    font-size: 0.875rem !important;
    padding: 12px 10px !important;
    min-height: 44px !important;
  }
  
  .task-info-item {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
  }
  
  .task-title {
    word-break: break-word;
    line-height: 1.3;
  }
}

@media (max-width: 600px) {
  .stats-row {
    margin: -4px !important;
  }
  
  .stats-col {
    padding: 4px !important;
  }
  
  .stats-card-content {
    padding: 12px 8px;
    min-height: 85px;
  }
  
  .stats-icon-wrapper {
    width: 36px;
    height: 36px;
    margin-bottom: 6px;
  }
  
  .stats-icon-wrapper :deep(.v-icon) {
    font-size: 18px !important;
  }
  
  .stats-value {
    font-size: 1.5rem;
  }
  
  .stats-label {
    font-size: 0.6rem;
    margin-bottom: 4px;
    line-height: 1.2;
  }
  
  .filter-card {
    padding: 14px;
  }
  
  .filter-header {
    font-size: 0.8rem;
    margin-bottom: 10px;
  }
  
  .filter-header :deep(.v-icon) {
    font-size: 18px !important;
  }
  
  .filter-buttons {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  
  .filter-btn {
    font-size: 0.85rem !important;
    padding: 12px 16px !important;
    min-height: 44px !important;
    width: 100% !important;
  }
  
  .task-action-btn {
    font-size: 0.875rem !important;
    padding: 10px 16px !important;
  }
  
  .task-action-btn :deep(.v-btn__content) {
    font-size: 0.875rem;
    gap: 4px;
  }
  
  .task-status-chip {
    margin-left: 0 !important;
    margin-top: 8px;
    align-self: flex-start;
  }
  
  .task-card {
    padding: 16px !important;
  }
}

@media (max-width: 400px) {
  .filter-btn {
    font-size: 0.8rem !important;
    padding: 10px 12px !important;
    min-height: 40px !important;
  }
}
</style>