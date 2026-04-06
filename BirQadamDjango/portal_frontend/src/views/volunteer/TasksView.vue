<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { fetchVolunteerTasks, dismissTask, type VolunteerTask } from '@/services/tasks';

const router = useRouter();

const loading = ref(false);
const tasks = ref<VolunteerTask[]>([]);
const filter = ref<'all' | 'open' | 'in_progress' | 'under_review' | 'revision' | 'completed' | 'archived'>(
  (sessionStorage.getItem('last_tasks_filter') as any) || 'all'
);

watch(filter, (newVal) => {
  sessionStorage.setItem('last_tasks_filter', newVal);
});

const selectedProjectId = ref<number | null>(
  sessionStorage.getItem('last_project_filter') 
    ? Number(sessionStorage.getItem('last_project_filter')) 
    : null
);

watch(selectedProjectId, (newVal) => {
  if (newVal === null) sessionStorage.removeItem('last_project_filter');
  else sessionStorage.setItem('last_project_filter', String(newVal));
});

const projects = computed(() => {
  const map = new Map<number, string>();
  tasks.value.forEach(t => {
    if (t.project_id != null && t.project_title) {
      map.set(t.project_id, t.project_title);
    }
  });
  const res = Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  return [{ id: null, title: 'Все проекты' }, ...res];
});

const snackbar = reactive({ show: false, message: '', color: 'success' });

// ─── Delete confirmation ───────────────────────────────────────────
const confirmDialog = reactive({ show: false, taskId: null as number | null, taskText: '' });
const deleteLoading = ref(false);

function askDelete(task: VolunteerTask, event: MouseEvent) {
  event.stopPropagation();
  confirmDialog.taskId   = task.id;
  confirmDialog.taskText = task.text;
  confirmDialog.show     = true;
}

async function confirmDelete() {
  if (!confirmDialog.taskId) return;
  deleteLoading.value = true;
  try {
    await dismissTask(confirmDialog.taskId);
    tasks.value = tasks.value.filter(t => t.id !== confirmDialog.taskId);
    showSnackbar('Задача удалена из списка', 'success');
  } catch (e: any) {
    showSnackbar(e?.response?.data?.error || 'Не удалось удалить задачу', 'error');
  } finally {
    deleteLoading.value  = false;
    confirmDialog.show   = false;
    confirmDialog.taskId = null;
  }
}

// ─── Status config ────────────────────────────────────────────────
const STATUS_MAP: Record<string, { text: string; color: string; bg: string }> = {
  open:         { text: 'Открыто',      color: '#1565c0', bg: 'rgba(21,101,192,0.1)'   },
  in_progress:  { text: 'В работе',     color: '#e65100', bg: 'rgba(230,81,0,0.1)'     },
  under_review: { text: 'На проверке',  color: '#6a1b9a', bg: 'rgba(106,27,154,0.1)'   },
  completed:    { text: 'Выполнено',    color: '#2e7d32', bg: 'rgba(46,125,50,0.1)'    },
  failed:       { text: 'Отклонено',    color: '#c62828', bg: 'rgba(198,40,40,0.1)'    },
  closed:       { text: 'Закрыто',      color: '#546e7a', bg: 'rgba(84,110,122,0.1)'   },
  revision:     { text: 'На доработке', color: '#f57c00', bg: 'rgba(255,152,0,0.1)'    },
  archived:     { text: 'В архиве',     color: '#37474f', bg: 'rgba(55,71,79,0.1)'     },
};

function statusCfg(status: string) {
  return STATUS_MAP[status] ?? { text: status, color: '#546e7a', bg: 'rgba(84,110,122,0.1)' };
}


// ─── Summary ──────────────────────────────────────────────────────
const summary = computed(() => {
  let list = tasks.value;
  if (selectedProjectId.value !== null) {
    list = list.filter(t => t.project_id === selectedProjectId.value);
  }

  return {
    total:        list.length,
    open:         list.filter(t => t.status === 'open' && !t.is_assigned).length,
    in_progress:  list.filter(t =>
      t.status === 'in_progress' ||
      (t.is_assigned && !['completed', 'under_review', 'failed', 'closed', 'archived', 'revision'].includes(t.status)),
    ).length,
    under_review: list.filter(t => t.status === 'under_review').length,
    revision:     list.filter(t => t.status === 'revision').length,
    completed:    list.filter(t => t.status === 'completed').length,
    archived:     list.filter(t => t.status === 'archived').length,
  };
});

// ─── Filtered list ────────────────────────────────────────────────
const filteredTasks = computed(() => {
  let list = tasks.value;
  
  if (selectedProjectId.value !== null) {
    list = list.filter(t => t.project_id === selectedProjectId.value);
  }

  switch (filter.value) {
    case 'open':
      return list.filter(t => t.status === 'open' && !t.is_assigned);
    case 'in_progress':
      return list.filter(t =>
        t.status === 'in_progress' ||
        (t.is_assigned && !['completed', 'under_review', 'failed', 'closed', 'archived', 'revision'].includes(t.status)),
      );
    case 'under_review':
      return list.filter(t => t.status === 'under_review');
    case 'revision':
      return list.filter(t => t.status === 'revision');
    case 'completed':
      return list.filter(t => t.status === 'completed');
    case 'archived':
      return list.filter(t => t.status === 'archived');
    default:
      return list;
  }
});

// ─── Formatters ───────────────────────────────────────────────────
const dateFmt     = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function formatDate(v: string | null)  { if (!v) return '—'; const d = new Date(v); return isNaN(d.getTime()) ? '—' : dateFmt.format(d); }
function formatDateTime(v: string)     { const d = new Date(v); return isNaN(d.getTime()) ? v : dateTimeFmt.format(d); }

// ─── Data loading ─────────────────────────────────────────────────
async function loadTasks() {
  loading.value = true;
  try {
    tasks.value = await fetchVolunteerTasks();
  } catch (error: any) {
    if (error?.response?.status === 429) {
      showSnackbar('Слишком много запросов. Повторная попытка...', 'warning');
      setTimeout(() => loadTasks(), 2000);
    } else {
      const msg = error?.response?.data?.error || error?.response?.data?.detail || 'Не удалось загрузить задачи.';
      showSnackbar(msg, 'error');
    }
  } finally {
    loading.value = false;
  }
}

function showSnackbar(message: string, color = 'success') {
  Object.assign(snackbar, { message, color, show: true });
}

function goToTask(taskId: number) {
  router.push({ name: 'volunteer-task-detail', params: { id: taskId } });
}

onMounted(loadTasks);
</script>

<template>
  <div class="tasks-view">

    <!-- ─── Header ─── -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Мои задачи</h1>
        <p class="page-subtitle">Задачи по проектам, в которых вы участвуете</p>
      </div>
    </div>

    <!-- ─── Project Filter ─── -->
    <div class="project-filter-card card mb-4">
      <div class="filter-label">ПРОЕКТ</div>
      <v-select
        v-model="selectedProjectId"
        :items="projects"
        item-title="title"
        item-value="id"
        placeholder="Выберите проект"
        variant="outlined"
        hide-details
        density="comfortable"
        class="project-select"
        bg-color="white"
      >
        <template v-slot:prepend-inner>
          <v-icon icon="mdi-briefcase-outline" color="grey-darken-1" />
        </template>
      </v-select>
    </div>

    <!-- ─── Summary ─── -->
    <div class="summary-grid">
      <div class="stat-card stat-card--green" :class="{ 'stat-card--active': filter === 'all' }" @click="filter = 'all'" style="cursor: pointer;">
        <div class="stat-card__ico"><v-icon icon="mdi-clipboard-list" size="22" /></div>
        <div class="stat-card__val">{{ summary.total }}</div>
        <div class="stat-card__lbl">Всего задач</div>
      </div>
      <div class="stat-card stat-card--blue" :class="{ 'stat-card--active': filter === 'open' }" @click="filter = 'open'" style="cursor: pointer;">
        <div class="stat-card__ico"><v-icon icon="mdi-folder-open-outline" size="22" /></div>
        <div class="stat-card__val">{{ summary.open }}</div>
        <div class="stat-card__lbl">Открытые</div>
      </div>
      <div class="stat-card stat-card--orange" :class="{ 'stat-card--active': filter === 'in_progress' }" @click="filter = 'in_progress'" style="cursor: pointer;">
        <div class="stat-card__ico"><v-icon icon="mdi-progress-clock" size="22" /></div>
        <div class="stat-card__val">{{ summary.in_progress }}</div>
        <div class="stat-card__lbl">В работе</div>
      </div>
      <div class="stat-card stat-card--purple" :class="{ 'stat-card--active': filter === 'under_review' }" @click="filter = 'under_review'" style="cursor: pointer;">
        <div class="stat-card__ico"><v-icon icon="mdi-magnify-scan" size="22" /></div>
        <div class="stat-card__val">{{ summary.under_review }}</div>
        <div class="stat-card__lbl">На проверке</div>
      </div>
      <div class="stat-card stat-card--amber" :class="{ 'stat-card--active': filter === 'revision' }" @click="filter = 'revision'" style="cursor: pointer;">
        <div class="stat-card__ico"><v-icon icon="mdi-alert-circle-outline" size="22" /></div>
        <div class="stat-card__val">{{ summary.revision }}</div>
        <div class="stat-card__lbl">На доработке</div>
      </div>
      <div class="stat-card stat-card--teal" :class="{ 'stat-card--active': filter === 'completed' }" @click="filter = 'completed'" style="cursor: pointer;">
        <div class="stat-card__ico"><v-icon icon="mdi-check-circle-outline" size="22" /></div>
        <div class="stat-card__val">{{ summary.completed }}</div>
        <div class="stat-card__lbl">Завершено</div>
      </div>
      <div class="stat-card stat-card--grey" :class="{ 'stat-card--active': filter === 'archived' }" @click="filter = 'archived'" style="cursor: pointer;">
        <div class="stat-card__ico"><v-icon icon="mdi-archive-outline" size="22" /></div>
        <div class="stat-card__val">{{ summary.archived }}</div>
        <div class="stat-card__lbl">В архиве</div>
      </div>
    </div>


    <!-- ─── Loading skeletons ─── -->
    <div v-if="loading" class="cards-grid">
      <div v-for="i in 4" :key="i" class="task-skeleton">
        <v-skeleton-loader type="list-item-three-line" />
      </div>
    </div>

    <!-- ─── Empty state ─── -->
    <div v-else-if="!filteredTasks.length" class="empty-state">
      <div class="empty-state__ico">
        <v-icon icon="mdi-clipboard-text-off-outline" size="36" />
      </div>
      <p class="empty-state__title">Задачи не найдены</p>
      <p class="empty-state__text">
        {{ filter === 'all'
          ? 'Новые задачи появляются в проектах, к которым вы присоединились.'
          : 'Нет задач с выбранным статусом.' }}
      </p>
    </div>

    <!-- ─── Task cards ─── -->
    <div v-else class="cards-grid">
      <div
        v-for="task in filteredTasks"
        :key="task.id"
        class="task-card"
        @click="goToTask(task.id)"
      >
        <!-- Top row: project chip + status badge -->
        <div class="task-card__top">
          <div class="task-card__project">
            <v-icon icon="mdi-briefcase-outline" size="13" />
            {{ task.project_title }}
          </div>
          <div
            class="task-card__status"
            :style="{ color: statusCfg(task.status).color, background: statusCfg(task.status).bg }"
          >
            {{ statusCfg(task.status).text }}
          </div>
        </div>

        <!-- Title -->
        <h3 class="task-card__title">{{ task.text }}</h3>

        <!-- Meta -->
        <div class="task-card__meta">
          <div class="meta-item">
            <v-icon icon="mdi-account-outline" size="13" />
            {{ task.creator_name }}
          </div>
          <div class="meta-item">
            <v-icon icon="mdi-clock-outline" size="13" />
            {{ formatDateTime(task.created_at) }}
          </div>
          <div v-if="task.deadline_date" class="meta-item meta-item--deadline">
            <v-icon icon="mdi-calendar-clock" size="13" />
            Срок: {{ formatDate(task.deadline_date) }}
            <span v-if="task.start_time && task.end_time">&nbsp;{{ task.start_time }}–{{ task.end_time }}</span>
          </div>
        </div>

        <!-- Rating (stars from organizer) -->
        <div
          v-if="(task.status === 'completed' || task.status === 'archived') && task.rating"
          class="task-card__rating"
        >
          <v-icon
            v-for="star in 5"
            :key="star"
            :icon="star <= task.rating ? 'mdi-star' : 'mdi-star-outline'"
            size="16"
            :color="star <= task.rating ? '#f59e0b' : '#d1d5db'"
          />
          <span class="task-card__rating-label">{{ task.rating }}/5</span>
        </div>

        <!-- Footer -->
        <div class="task-card__footer">
          <span class="task-card__go">
            Перейти к задаче
            <v-icon icon="mdi-arrow-right" size="14" />
          </span>
          <button
            v-if="task.status === 'completed' || task.status === 'archived'"
            class="task-card__delete-btn"
            title="Удалить из списка"
            @click.stop="askDelete(task, $event)"
          >
            <v-icon icon="mdi-delete-outline" size="16" />
          </button>
        </div>
      </div>
    </div>

    <!-- ─── Confirm delete dialog ─── -->
    <v-dialog v-model="confirmDialog.show" max-width="420" persistent>
      <v-card rounded="xl" class="confirm-card">
        <v-card-title class="confirm-card__title">
          <v-icon icon="mdi-delete-alert-outline" color="error" size="24" />
          Удалить задачу?
        </v-card-title>
        <v-card-text class="confirm-card__text">
          Задача <strong>«{{ confirmDialog.taskText }}»</strong> будет убрана из вашего списка.
          Это действие нельзя отменить.
        </v-card-text>
        <v-card-actions class="confirm-card__actions">
          <v-btn variant="text" @click="confirmDialog.show = false" :disabled="deleteLoading">
            Отмена
          </v-btn>
          <v-btn
            color="error"
            variant="elevated"
            :loading="deleteLoading"
            @click="confirmDelete"
          >
            Удалить
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="4000">
      {{ snackbar.message }}
    </v-snackbar>
  </div>
</template>

<style scoped>
/* ─── Base ─── */
.tasks-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ─── Page header ─── */
.page-header {
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

/* ─── Summary grid ─── */
.summary-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 12px;
}

.stat-card {
  background: #fff;
  border-radius: 16px;
  border: 1px solid rgba(0, 0, 0, 0.07);
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 5px;
  transition: transform 0.2s, box-shadow 0.2s;
}
.stat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.08); }

.stat-card__ico {
  width: 44px; height: 44px;
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 4px;
}

.stat-card--green  .stat-card__ico { background: rgba(139,195,74,0.12); color: #558b2f; }
.stat-card--blue   .stat-card__ico { background: rgba(21,101,192,0.12); color: #1565c0; }
.stat-card--orange .stat-card__ico { background: rgba(230,81,0,0.12);   color: #e65100; }
.stat-card--purple .stat-card__ico { background: rgba(106,27,154,0.12); color: #6a1b9a; }
.stat-card--teal   .stat-card__ico { background: rgba(0,105,92,0.12);   color: #00695c; }
.stat-card--amber  .stat-card__ico { background: rgba(255,152,0,0.12);  color: #f57c00; }
.stat-card--grey   .stat-card__ico { background: rgba(55,71,79,0.12);   color: #37474f; }

/* Active state */
.stat-card--active {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  border-width: 1.5px;
}
.stat-card--green.stat-card--active  { border-color: #558b2f; background: rgba(139,195,74,0.04); }
.stat-card--blue.stat-card--active   { border-color: #1565c0; background: rgba(21,101,192,0.04); }
.stat-card--orange.stat-card--active { border-color: #e65100; background: rgba(230,81,0,0.04);   }
.stat-card--purple.stat-card--active { border-color: #6a1b9a; background: rgba(106,27,154,0.04); }
.stat-card--teal.stat-card--active   { border-color: #00695c; background: rgba(0,105,92,0.04);   }
.stat-card--amber.stat-card--active  { border-color: #f57c00; background: rgba(255,152,0,0.04);  }
.stat-card--grey.stat-card--active   { border-color: #37474f; background: rgba(55,71,79,0.04);   }

.stat-card__val {
  font-size: 1.75rem;
  font-weight: 800;
  color: #1a1a1a;
  line-height: 1;
}

.stat-card__lbl {
  font-size: 0.73rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.45);
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

/* ─── Project filter ─── */
.project-filter-card {
  padding: 16px 20px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.03);
  margin-bottom: 24px;
}
.filter-label {
  font-size: 0.65rem;
  font-weight: 800;
  color: #9e9e9e;
  margin-bottom: 8px;
  letter-spacing: 1px;
  text-transform: uppercase;
}
.project-select {
  max-width: 100%;
}
:deep(.v-field__outline) {
  --v-field-border-opacity: 0.1 !important;
}
:deep(.v-field--focused .v-field__outline) {
  --v-field-border-opacity: 0.3 !important;
  color: #558b2f !important;
}


/* ─── Cards grid ─── */
.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 14px;
}

/* ─── Task card ─── */
.task-card {
  background: #fff;
  border-radius: 16px;
  border: 1px solid rgba(0, 0, 0, 0.07);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
}
.task-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(139, 195, 74, 0.12);
  border-color: rgba(139, 195, 74, 0.25);
}

.task-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.task-card__project {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.78rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.42);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-card__status {
  display: inline-flex;
  align-items: center;
  padding: 2px 9px;
  border-radius: 100px;
  font-size: 0.72rem;
  font-weight: 700;
  flex-shrink: 0;
}

.task-card__title {
  font-size: 0.95rem;
  font-weight: 700;
  color: #1a1a1a;
  line-height: 1.4;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.task-card__meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.8rem;
  color: rgba(0, 0, 0, 0.48);
}

.meta-item--deadline { color: #e65100; font-weight: 600; }

.task-card__footer {
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.task-card__go {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.82rem;
  font-weight: 700;
  color: #558b2f;
  transition: gap 0.15s;
}
.task-card:hover .task-card__go { gap: 9px; }

/* ─── Delete button ─── */
.task-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.task-card__delete-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: none;
  background: rgba(198, 40, 40, 0.07);
  color: #c62828;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  flex-shrink: 0;
}
.task-card__delete-btn:hover {
  background: rgba(198, 40, 40, 0.16);
}

/* ─── Confirm dialog ─── */
.confirm-card { padding: 8px 4px 4px; }
.confirm-card__title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1rem;
  font-weight: 700;
  padding-bottom: 4px;
}
.confirm-card__text { color: rgba(0,0,0,0.65); font-size: 0.9rem; }
.confirm-card__actions { justify-content: flex-end; padding: 8px 16px 16px; gap: 8px; }

/* ─── Rating ─── */
.task-card__rating {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 6px 0 2px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  margin-top: 4px;
}
.task-card__rating-label {
  margin-left: 5px;
  font-size: 0.78rem;
  font-weight: 700;
  color: #f59e0b;
}

/* ─── Skeleton ─── */
.task-skeleton {
  background: #fff;
  border-radius: 16px;
  border: 1px solid rgba(0,0,0,0.07);
  overflow: hidden;
}

/* ─── Empty state ─── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 24px;
  text-align: center;
  background: #fff;
  border-radius: 20px;
  border: 1px solid rgba(0, 0, 0, 0.07);
}

.empty-state__ico {
  width: 72px; height: 72px;
  border-radius: 50%;
  background: rgba(139, 195, 74, 0.08);
  display: flex; align-items: center; justify-content: center;
  color: rgba(139, 195, 74, 0.55);
  margin-bottom: 14px;
}

.empty-state__title { font-size: 1rem; font-weight: 800; color: #1a1a1a; margin: 0 0 6px; }
.empty-state__text  { font-size: 0.875rem; color: rgba(0,0,0,0.45); margin: 0; max-width: 320px; }

/* ─── Responsive ─── */
@media (max-width: 1100px) {
  .summary-grid { grid-template-columns: repeat(3, 1fr); }
}

@media (max-width: 860px) {
  .summary-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 600px) {
  .page-header { padding: 16px 18px; border-radius: 16px; }
  .page-title  { font-size: 1.4rem; }

  /* Stats: 2×2 */
  .summary-grid { gap: 8px; }
  .stat-card { padding: 14px 10px; }
  .stat-card__val { font-size: 1.5rem; }

  /* Filter: wrap 2×2 */
  .filter-bar { flex-wrap: wrap; border-radius: 12px; }
  .filter-tab { flex: 1 0 calc(50% - 6px); font-size: 0.82rem; padding: 8px 6px; }

  /* Cards: single column */
  .cards-grid { grid-template-columns: 1fr; }
}

@media (max-width: 360px) {
  .stat-card__val { font-size: 1.3rem; }
  .stat-card__lbl { font-size: 0.65rem; }
  .filter-tab     { font-size: 0.78rem; }
}
</style>