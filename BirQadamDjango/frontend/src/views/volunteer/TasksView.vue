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
    const errorMessage = error?.response?.data?.error || error?.response?.data?.detail || 'Не удалось загрузить задачи.';
    showSnackbar(errorMessage, 'error');
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
    <v-row class="ga-4 mb-6">
      <v-col cols="12" sm="6" md="3">
        <v-card elevation="4" class="pa-4 gradient-card">
          <div class="text-caption text-medium-emphasis mb-1">Всего задач</div>
          <div class="text-h4 font-weight-bold">{{ summary.total }}</div>
        </v-card>
      </v-col>
      <v-col cols="12" sm="6" md="3">
        <v-card elevation="4" class="pa-4 gradient-card">
          <div class="text-caption text-medium-emphasis mb-1">Открыто</div>
          <div class="text-h4 font-weight-bold">{{ summary.open }}</div>
        </v-card>
      </v-col>
      <v-col cols="12" sm="6" md="3">
        <v-card elevation="4" class="pa-4 gradient-card">
          <div class="text-caption text-medium-emphasis mb-1">В работе</div>
          <div class="text-h4 font-weight-bold">{{ summary.assigned }}</div>
        </v-card>
      </v-col>
      <v-col cols="12" sm="6" md="3">
        <v-card elevation="4" class="pa-4 gradient-card">
          <div class="text-caption text-medium-emphasis mb-1">Завершено</div>
          <div class="text-h4 font-weight-bold">{{ summary.completed }}</div>
        </v-card>
      </v-col>
      <v-col cols="12">
        <v-card elevation="4" class="pa-4 gradient-card d-flex flex-column justify-center">
          <div class="text-caption text-medium-emphasis mb-2">Фильтр</div>
          <v-btn-toggle v-model="filter" mandatory color="primary" class="align-self-start">
            <v-btn value="all" size="small">Все</v-btn>
            <v-btn value="open" size="small">Открытые</v-btn>
            <v-btn value="assigned" size="small">В работе</v-btn>
            <v-btn value="completed" size="small">Завершенные</v-btn>
          </v-btn-toggle>
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

    <v-row class="ga-6" v-if="filteredTasks.length">
      <v-col
        v-for="task in filteredTasks"
        :key="task.id"
        cols="12"
        md="6"
      >
        <v-card elevation="3" class="pa-6 h-100 d-flex flex-column task-card">
          <div class="d-flex justify-space-between align-start mb-4">
            <div class="flex-grow-1">
              <h3 class="text-h6 font-weight-bold mb-2">{{ task.text }}</h3>
              <div class="text-body-2 text-medium-emphasis mb-2">
                <v-icon icon="mdi-folder-outline" size="16" class="me-1" />
                Проект: {{ task.project_title }}
              </div>
              <div class="text-body-2 text-medium-emphasis mb-2">
                <v-icon icon="mdi-account-outline" size="16" class="me-1" />
                Создатель: {{ task.creator_name }}
              </div>
              <div class="text-body-2 text-medium-emphasis mb-2">
                <v-icon icon="mdi-clock-outline" size="16" class="me-1" />
                Создано: {{ formatDateTime(task.created_at) }}
              </div>
              <div v-if="task.deadline_date" class="text-body-2 text-medium-emphasis">
                <v-icon icon="mdi-calendar-clock" size="16" class="me-1" />
                Срок: {{ formatDate(task.deadline_date) }}
                <span v-if="task.start_time && task.end_time">
                  ({{ task.start_time }} - {{ task.end_time }})
                </span>
              </div>
            </div>
            <v-chip
              :color="taskStatusMap[task.status]?.color || 'primary'"
              variant="tonal"
              size="small"
              class="ml-3"
            >
              {{ taskStatusMap[task.status]?.text || task.status }}
            </v-chip>
          </div>

          <v-spacer />

          <div class="d-flex justify-end mt-4">
            <v-btn
              color="primary"
              variant="flat"
              class="text-none font-weight-bold"
              @click="goToTask(task.id)"
            >
              Перейти к задаче
              <v-icon icon="mdi-arrow-right" end size="18" />
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

.gradient-card {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(255, 250, 246, 0.9)); /* BirQadam background */
  backdrop-filter: blur(6px);
}

.task-card {
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}

.task-card:hover {
  box-shadow: 0 8px 24px rgba(139, 195, 74, 0.15); /* BirQadam primary */
  transform: translateY(-2px);
}
</style>



