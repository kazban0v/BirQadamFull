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

const projects = computed(() => organizerStore.projects);
const projectOptions = computed(() =>
  projects.value.map((project) => ({
    title: project.title,
    value: project.id,
    subtitle: `${project.city} • ${project.volunteer_count} волонтёров • ${project.task_count} задач`,
  })),
);

const selectedProjectId = ref<number | null>(null);

const currentTasks = computed(() => {
  if (!selectedProjectId.value) return [];
  return organizerStore.tasksByProject[selectedProjectId.value] ?? [];
});

const loadingTasks = computed(() => (selectedProjectId.value ? organizerStore.loadingTasks[selectedProjectId.value] : false));
const taskError = computed(() => (selectedProjectId.value ? organizerStore.taskErrors[selectedProjectId.value] : null));

const taskFormRef = ref<VForm | null>(null);
const createTaskDialog = ref(false);
const createTaskLoading = ref(false);
const snackbar = reactive({
  show: false,
  color: 'success',
  message: '',
});

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

onMounted(async () => {
  if (!organizerStore.isOrganizer) return;
  await organizerStore.loadProjects();
  const projectQuery = route.query.project;
  if (projectQuery) {
    const projectId = Number(projectQuery);
    if (!Number.isNaN(projectId)) {
      selectedProjectId.value = projectId;
    }
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

const closeCreateTaskDialog = () => {
  createTaskDialog.value = false;
};

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
    snackbar.message = 'Задача создана и волонтёры уведомлены.';
    snackbar.color = 'success';
    snackbar.show = true;
    closeCreateTaskDialog();
  } catch (error: any) {
    const detail = error?.response?.data?.error || error?.message || 'Не удалось создать задачу.';
    snackbar.message = detail;
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

function closeDeleteTaskDialog() {
  deleteTaskDialog.value = false;
  taskToDelete.value = null;
}

async function confirmDeleteTask() {
  if (!taskToDelete.value || !selectedProjectId.value) return;

  deletingTask.value = true;
  try {
    await deleteTask(taskToDelete.value.projectId, taskToDelete.value.taskId);
    snackbar.message = 'Задача успешно удалена.';
    snackbar.color = 'success';
    snackbar.show = true;
    closeDeleteTaskDialog();
    await organizerStore.loadTasks(selectedProjectId.value, true);
  } catch (error: any) {
    const detail = error?.response?.data?.error || error?.response?.data?.detail || 'Не удалось удалить задачу.';
    snackbar.message = detail;
    snackbar.color = 'error';
    snackbar.show = true;
  } finally {
    deletingTask.value = false;
  }
}
</script>

<template>
  <div class="tasks-view">
    <v-row class="ga-6">
      <v-col cols="12" lg="7">
        <v-card class="tasks-card" rounded="xl" elevation="6">
          <div class="tasks-card__header">
            <div>
              <h1 class="text-h5 font-weight-bold mb-1">Задачи проектов</h1>
              <p class="text-body-2 text-medium-emphasis mb-0">
                Создавайте задания, указывайте сроки и уведомляйте волонтёров. Все изменения синхронизируются с ботом и приложением.
              </p>
            </div>
            <v-btn
              color="primary"
              variant="flat"
              class="text-none font-weight-bold"
              :disabled="!isOrganizer || !isApproved || !selectedProjectId"
              @click="openCreateTaskDialog"
            >
              Создать задачу
            </v-btn>
          </div>

          <v-divider class="my-4" />

          <v-alert
            v-if="!isOrganizer"
            type="error"
            variant="tonal"
            border="start"
            class="mb-4"
          >
            У вас нет прав организатора. Войдите под аккаунтом организатора, чтобы управлять задачами.
          </v-alert>

          <div v-else>
            <v-alert
              v-if="!isApproved"
              type="warning"
              variant="tonal"
              border="start"
              class="mb-4"
              title="Ожидаем одобрения"
            >
              После подтверждения заявки вы сможете создавать задачи и уведомлять волонтёров из веб-портала.
            </v-alert>

            <div v-if="isApproved">
              <v-select
                v-model="selectedProjectId"
                :items="projectOptions"
                label="Выберите проект"
                variant="outlined"
                prepend-inner-icon="mdi-briefcase-outline"
                density="comfortable"
                class="mb-4"
                :disabled="!projects.length"
              />

              <v-alert
                v-if="projects.length === 0"
                type="info"
                variant="tonal"
                border="start"
              >
                Сначала создайте проект, затем вы сможете назначать задачи волонтёрам.
              </v-alert>

              <div v-if="projects.length > 0 && selectedProjectId">
                <v-alert
                  v-if="taskError"
                  type="error"
                  variant="tonal"
                  border="start"
                  class="mb-4"
                >
                  {{ taskError }}
                </v-alert>

                <v-skeleton-loader v-else-if="loadingTasks" type="list-item, list-item, list-item" />

                <v-list v-else-if="currentTasks.length" class="task-list" density="comfortable">
                  <v-list-item
                    v-for="task in currentTasks"
                    :key="task.id"
                    class="task-item"
                    rounded="lg"
                    border
                  >
                    <template #prepend>
                      <v-avatar color="primary" size="40">
                        <v-icon icon="mdi-clipboard-text-outline" />
                      </v-avatar>
                    </template>
                    <v-list-item-title class="font-weight-semibold">{{ task.text }}</v-list-item-title>
                    <v-list-item-subtitle>
                      <div class="d-flex flex-wrap ga-3 mt-2">
                        <span>
                          <v-icon icon="mdi-calendar" size="18" class="me-1" />
                          {{ task.deadline_date ? new Date(task.deadline_date).toLocaleDateString() : 'Без срока' }}
                        </span>
                        <span v-if="task.start_time && task.end_time">
                          <v-icon icon="mdi-clock-outline" size="18" class="me-1" />
                          {{ task.start_time }} — {{ task.end_time }}
                        </span>
                        <span>
                          <v-chip size="small" :color="task.status === 'completed' ? 'success' : task.status === 'open' ? 'primary' : 'warning'" class="text-none">
                            {{ task.status === 'completed' ? 'Выполнена' : task.status === 'open' ? 'Открыта' : task.status }}
                          </v-chip>
                        </span>
                      </div>
                    </v-list-item-subtitle>
                    <template #append>
                      <v-btn
                        icon="mdi-delete-outline"
                        variant="text"
                        color="error"
                        size="small"
                        @click="openDeleteTaskDialog(selectedProjectId!, task.id, task.text)"
                      />
                    </template>
                  </v-list-item>
                </v-list>

                <v-sheet v-else class="empty-state" rounded="lg" border>
                  <v-icon icon="mdi-clipboard-plus-outline" size="40" color="primary" class="mb-3" />
                  <h3 class="text-subtitle-1 font-weight-semibold mb-2">Задач пока нет</h3>
                  <p class="text-body-2 text-medium-emphasis mb-0">
                    Создайте первое задание, и волонтёры сразу получат уведомления в Telegram и приложении.
                  </p>
                </v-sheet>
              </div>
            </div>
          </div>
        </v-card>
      </v-col>

      <v-col cols="12" lg="5">
        <v-card class="notify-card" rounded="xl" elevation="6">
          <div class="d-flex align-center ga-3 mb-4">
            <v-avatar color="primary" size="48">
              <v-icon icon="mdi-bell-ring-outline" />
            </v-avatar>
            <div>
              <h2 class="text-h6 font-weight-bold mb-1">Уведомления и контроль</h2>
              <p class="text-body-2 text-medium-emphasis mb-0">
                Каждая задача синхронизируется с Telegram-ботом — волонтёры получают уведомления мгновенно.
              </p>
            </div>
          </div>

          <v-sheet rounded="lg" border class="notify-card__item pa-4">
            <h3 class="text-subtitle-1 font-weight-semibold mb-2">Автоматические напоминания</h3>
            <p class="text-body-2 text-medium-emphasis mb-0">
              За 2 часа до дедлайна волонтёры получают push и сообщение. Просроченные задачи видно в разделе «Модерация».
            </p>
          </v-sheet>

          <v-sheet rounded="lg" border class="notify-card__item pa-4">
            <h3 class="text-subtitle-1 font-weight-semibold mb-2">История действий</h3>
            <p class="text-body-2 text-medium-emphasis mb-0">
              Лента активности показывает, кто принял задачу, загрузил фото или запросил перенос.
            </p>
          </v-sheet>

          <v-sheet rounded="lg" border class="notify-card__item pa-4">
            <h3 class="text-subtitle-1 font-weight-semibold mb-2">Шаблоны заданий</h3>
            <p class="text-body-2 text-medium-emphasis mb-0">
              Повторяющиеся мероприятия можно сохранить как шаблон и запускать за пару кликов.
            </p>
          </v-sheet>
        </v-card>
      </v-col>
    </v-row>

    <v-dialog v-model="createTaskDialog" max-width="640">
      <v-card class="create-task-dialog pa-6 pa-md-8">
        <div class="d-flex align-center ga-3 mb-4">
          <v-avatar color="primary" size="48">
            <v-icon icon="mdi-clipboard-plus-outline" />
          </v-avatar>
          <div>
            <h2 class="text-h6 font-weight-bold mb-1">Создать задачу</h2>
            <p class="text-body-2 text-medium-emphasis mb-0">
              Задание будет отправлено всем волонтёрам проекта. Вы можете указать сроки и временные окна.
            </p>
          </div>
        </div>
        <v-form ref="taskFormRef" @submit.prevent="submitCreateTask">
          <v-textarea
            v-model="taskFormState.text"
            label="Текст задачи"
            variant="outlined"
            rows="4"
            prepend-inner-icon="mdi-text"
            :rules="[rules.required]"
            auto-grow
            class="mb-4"
          />
          <v-row>
            <v-col cols="12" md="6">
              <v-dialog max-width="320">
                <template #activator="{ props }">
                  <v-text-field
                    v-model="taskFormState.deadline_date"
                    label="Дата дедлайна"
                    variant="outlined"
                    prepend-inner-icon="mdi-calendar"
                    readonly
                    v-bind="props"
                  />
                </template>
                <template #default="{ isActive }">
                  <v-date-picker
                    v-model="taskFormState.deadline_date"
                    @update:modelValue="isActive.value = false"
                  />
                </template>
              </v-dialog>
            </v-col>
            <v-col cols="12" md="3">
              <v-text-field
                v-model="taskFormState.start_time"
                type="time"
                label="Начало"
                variant="outlined"
                prepend-inner-icon="mdi-clock-outline"
              />
            </v-col>
            <v-col cols="12" md="3">
              <v-text-field
                v-model="taskFormState.end_time"
                type="time"
                label="Конец"
                variant="outlined"
                prepend-inner-icon="mdi-clock-end"
              />
            </v-col>
          </v-row>
          <div class="d-flex flex-column flex-sm-row ga-3 mt-6">
            <v-btn
              color="primary"
              class="text-none font-weight-bold"
              size="large"
              type="submit"
              :loading="createTaskLoading"
            >
              Создать задачу
            </v-btn>
            <v-btn
              variant="text"
              color="primary"
              class="text-none font-weight-semibold"
              size="large"
              @click="closeCreateTaskDialog"
            >
              Отменить
            </v-btn>
          </div>
        </v-form>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="4000">
      {{ snackbar.message }}
    </v-snackbar>

    <!-- Диалог подтверждения удаления задачи -->
    <v-dialog v-model="deleteTaskDialog" max-width="500">
      <v-card>
        <v-card-title class="d-flex align-center ga-3">
          <v-icon icon="mdi-alert" color="error" size="24" />
          <span class="text-h6 font-weight-bold">Удалить задачу?</span>
        </v-card-title>
        <v-card-text>
          <p class="text-body-1 mb-2">Вы уверены, что хотите удалить эту задачу?</p>
          <v-card variant="outlined" class="pa-3 mt-3">
            <p class="text-body-2 font-weight-medium mb-0">{{ taskToDelete?.text }}</p>
          </v-card>
          <p class="text-body-2 text-medium-emphasis mt-3 mb-0">
            Это действие нельзя отменить. Задача будет помечена как удаленная.
          </p>
        </v-card-text>
        <v-card-actions class="pa-4">
          <v-spacer />
          <v-btn
            variant="text"
            class="text-none"
            :disabled="deletingTask"
            @click="closeDeleteTaskDialog"
          >
            Отмена
          </v-btn>
          <v-btn
            color="error"
            variant="flat"
            class="text-none font-weight-bold"
            :loading="deletingTask"
            @click="confirmDeleteTask"
          >
            Удалить
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.tasks-view {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.tasks-card {
  padding: clamp(24px, 5vw, 40px);
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(255, 243, 224, 0.9));
}

.tasks-card__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
}

.task-list {
  border: none;
  background: transparent;
}

.task-item {
  margin-bottom: 12px;
  background: #ffffff;
  border: 1px solid rgba(33, 33, 33, 0.06);
}

.empty-state {
  padding: 32px;
  text-align: center;
  background: linear-gradient(150deg, rgba(139, 195, 74, 0.08), rgba(227, 121, 77, 0.08)); /* BirQadam colors */
}

.notify-card {
  padding: clamp(24px, 5vw, 36px);
  background: linear-gradient(160deg, rgba(139, 195, 74, 0.08), rgba(227, 121, 77, 0.08)); /* BirQadam colors */
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.notify-card__item {
  background: #ffffff;
  border: 1px solid rgba(33, 33, 33, 0.06);
}

.create-task-dialog {
  border-radius: 24px;
  background: linear-gradient(150deg, rgba(255, 255, 255, 0.98), rgba(236, 245, 255, 0.96));
}

:deep(.v-picker-title) {
  display: none;
}
</style>


