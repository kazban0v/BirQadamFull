<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';

import { useDashboardStore } from '@/stores/dashboard';
import { useAuthStore } from '@/stores/auth';
import { fetchVolunteerProjects, joinVolunteerProject, fetchProjectTasks, fetchProjectDetail, type ProjectTask } from '@/services/projects';
import type { VolunteerProjectCatalogItem } from '@/services/projects';
import { getProjectChat, getChatMessages, sendMessage, markMessagesRead, type Chat, type ChatMessage } from '@/services/chat';
import { getOrganizerPortfolio, type OrganizerProfile } from '@/services/webPortal';

const dashboardStore = useDashboardStore();
const authStore = useAuthStore();
const route = useRoute();
const currentUser = computed(() => authStore.user);

const loading = ref(false);
const projects = ref<VolunteerProjectCatalogItem[]>([]);
const summary = reactive({
  total_available: 0,
  joined_count: 0,
});
const filter = ref<'all' | 'joined' | 'available'>('all');
const typeFilter = ref<'all' | 'social' | 'environmental' | 'cultural'>('all');
const selectedTags = ref<string[]>([]);
const snackbar = reactive({
  show: false,
  message: '',
  color: 'success',
});

// Состояние для деталей проекта
const expandedProjectId = ref<number | null>(null);
const projectTasks = ref<Record<number, ProjectTask[]>>({});
const loadingTasks = ref<Record<number, boolean>>({});

// Диалог с деталями проекта
const projectDialog = ref(false);
const projectDetail = ref<VolunteerProjectCatalogItem | null>(null);
const loadingProject = ref(false);

// Диалог с портфолио организатора
const organizerPortfolioDialog = ref(false);
const organizerPortfolio = ref<OrganizerProfile | null>(null);
const loadingPortfolio = ref(false);

// Чат
const chatDialog = ref(false);
const chatProjectId = ref<number | null>(null);
const chat = ref<Chat | null>(null);
const chatMessages = ref<ChatMessage[]>([]);
const chatLoading = ref(false);
const sendingMessage = ref(false);
const newMessageText = ref('');
const chatUnreadCounts = ref<Record<number, number>>({});
const messagesPollInterval = ref<ReturnType<typeof setInterval> | null>(null);
const taskStatusMap: Record<string, { text: string; color: string }> = {
  open: { text: 'Открыто', color: 'primary' },
  in_progress: { text: 'В работе', color: 'warning' },
  completed: { text: 'Выполнено', color: 'success' },
  failed: { text: 'Отклонено', color: 'error' },
  closed: { text: 'Закрыто', color: 'grey-darken-1' },
};

const volunteerTypeMap: Record<string, string> = {
  social: 'Социальная помощь',
  environmental: 'Экологические проекты',
  cultural: 'Культурные мероприятия',
};

const statusMap: Record<string, { text: string; color: string }> = {
  approved: { text: 'Активен', color: 'success' },
  pending: { text: 'На модерации', color: 'warning' },
  rejected: { text: 'Отклонён', color: 'error' },
};

const availableTags = computed(() => {
  const set = new Set<string>();
  projects.value.forEach((project) => {
    project.tags?.forEach((tag) => set.add(tag));
  });
  return Array.from(set);
});

const filteredProjects = computed(() => {
  let list = projects.value;

  if (filter.value === 'joined') {
    list = list.filter((project) => project.joined);
  } else if (filter.value === 'available') {
    list = list.filter((project) => !project.joined);
  }

  if (typeFilter.value !== 'all') {
    list = list.filter((project) => project.volunteer_type === typeFilter.value);
  }

  if (selectedTags.value.length) {
    list = list.filter((project) => {
      if (!project.tags?.length) return false;
      return selectedTags.value.every((tag) => project.tags?.includes(tag));
    });
  }

  return list;
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

function formatDateTime(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

async function toggleProjectDetails(projectId: number) {
  if (expandedProjectId.value === projectId) {
    // Скрываем детали
    expandedProjectId.value = null;
  } else {
    // Показываем детали
    expandedProjectId.value = projectId;
    
    // Загружаем задания, если еще не загружены
    if (!projectTasks.value[projectId] && !loadingTasks.value[projectId]) {
      await loadProjectTasks(projectId);
    }
  }
}

async function loadProjectTasks(projectId: number) {
  loadingTasks.value[projectId] = true;
  try {
    const tasks = await fetchProjectTasks(projectId);
    projectTasks.value[projectId] = tasks;
  } catch (error: any) {
    console.error('Failed to load project tasks:', error);
    projectTasks.value[projectId] = [];
    const errorMessage = error?.response?.data?.error || error?.response?.data?.detail || 'Не удалось загрузить задания проекта.';
    showMessage(errorMessage, 'error');
  } finally {
    loadingTasks.value[projectId] = false;
  }
}

async function loadProjects() {
  loading.value = true;
  try {
    const data = await fetchVolunteerProjects();
    projects.value = data.projects;
    summary.total_available = data.summary.total_available;
    summary.joined_count = data.summary.joined_count;
    if (!availableTags.value.length) {
      selectedTags.value = [];
    }
  } finally {
    loading.value = false;
  }
}

async function openProjectDialog(projectId: number) {
  if (!projectId) return;
  
  projectDialog.value = true;
  loadingProject.value = true;
  projectDetail.value = null;
  
  try {
    projectDetail.value = await fetchProjectDetail(projectId);
  } catch (error: any) {
    console.error('Failed to load project detail:', error);
    const errorMessage = error?.response?.data?.detail || 'Не удалось загрузить детали проекта.';
    showMessage(errorMessage, 'error');
    projectDialog.value = false;
  } finally {
    loadingProject.value = false;
  }
}

async function openOrganizerPortfolio(organizerId: number) {
  if (!organizerId) return;
  
  organizerPortfolioDialog.value = true;
  loadingPortfolio.value = true;
  organizerPortfolio.value = null;
  
  try {
    organizerPortfolio.value = await getOrganizerPortfolio(organizerId);
  } catch (error: any) {
    console.error('Failed to load organizer portfolio:', error);
    const errorMessage = error?.response?.data?.detail || 'Не удалось загрузить портфолио организатора.';
    showMessage(errorMessage, 'error');
    organizerPortfolioDialog.value = false;
  } finally {
    loadingPortfolio.value = false;
  }
}

function showMessage(message: string, color: string = 'success') {
  snackbar.message = message;
  snackbar.color = color;
  snackbar.show = true;
}

async function handleJoin(projectId: number) {
  try {
    loading.value = true;
    const data = await joinVolunteerProject(projectId);
    if (data.projects) {
      projects.value = data.projects;
    }
    if (data.summary) {
      summary.total_available = data.summary.total_available;
      summary.joined_count = data.summary.joined_count;
    }
    showMessage(data.message || 'Вы присоединились к проекту.', 'success');
    await dashboardStore.loadDashboard(true);
    
    // Обновляем детали проекта в диалоге, если он открыт
    if (projectDialog.value && projectDetail.value && (projectDetail.value.project_id === projectId || projectDetail.value.id === projectId)) {
      projectDetail.value = await fetchProjectDetail(projectId);
    }
  } catch (error: any) {
    const detail = error?.response?.data?.detail || 'Не удалось присоединиться к проекту.';
    showMessage(detail, 'error');
  } finally {
    loading.value = false;
  }
}

async function handleJoinFromDialog() {
  if (!projectDetail.value) return;
  // Используем project_id если есть, иначе id
  const projectId = projectDetail.value.project_id || projectDetail.value.id;
  await handleJoin(projectId);
  // Диалог остается открытым, чтобы пользователь увидел обновленную информацию
}

// Функции чата
async function openProjectChat(projectId: number) {
  chatProjectId.value = projectId;
  chatDialog.value = true;
  chatLoading.value = true;
  chat.value = null;
  chatMessages.value = [];
  newMessageText.value = '';
  
  try {
    chat.value = await getProjectChat(projectId);
    await loadChatMessages();
    
    if (chat.value.unread_count > 0) {
      await markMessagesRead(chat.value.id);
      chat.value.unread_count = 0;
      chatUnreadCounts.value[projectId] = 0;
    }
    
    startMessagesPolling();
  } catch (error: any) {
    console.error('Failed to load chat:', error);
  } finally {
    chatLoading.value = false;
  }
}

function closeChatDialog() {
  stopMessagesPolling();
  chatDialog.value = false;
  chatProjectId.value = null;
  chat.value = null;
  chatMessages.value = [];
  newMessageText.value = '';
}

async function loadChatMessages() {
  if (!chat.value) return;
  try {
    const response = await getChatMessages(chat.value.id, 50, 0);
    chatMessages.value = response.messages;
  } catch (error: any) {
    console.error('Failed to load chat messages:', error);
  }
}

async function handleSendMessage() {
  if (!chat.value || !newMessageText.value.trim() || sendingMessage.value) return;
  
  sendingMessage.value = true;
  try {
    const message = await sendMessage(chat.value.id, newMessageText.value.trim());
    chatMessages.value.push(message);
    newMessageText.value = '';
    if (chat.value) {
      chat.value.unread_count = 0;
    }
  } catch (error: any) {
    console.error('Failed to send message:', error);
  } finally {
    sendingMessage.value = false;
  }
}

function startMessagesPolling() {
  stopMessagesPolling();
  messagesPollInterval.value = setInterval(async () => {
    if (chat.value && chatDialog.value) {
      try {
        const response = await getChatMessages(chat.value.id, 50, 0);
        if (response.messages.length > chatMessages.value.length) {
          chatMessages.value = response.messages;
          const hasUnread = response.messages.some(
            (msg) => !msg.is_read && msg.sender_id !== currentUser.value?.id
          );
          if (hasUnread && chat.value) {
            await markMessagesRead(chat.value.id);
            chat.value.unread_count = 0;
          }
        }
      } catch (error) {
        // Игнорируем ошибки polling
      }
    }
  }, 3000);
}

function stopMessagesPolling() {
  if (messagesPollInterval.value) {
    clearInterval(messagesPollInterval.value);
    messagesPollInterval.value = null;
  }
}

async function loadUnreadCounts() {
  for (const project of projects.value.filter((p) => p.joined)) {
    try {
      const projectChat = await getProjectChat(project.id);
      if (projectChat.unread_count > 0) {
        chatUnreadCounts.value[project.id] = projectChat.unread_count;
      }
    } catch (error) {
      // Игнорируем ошибки
    }
  }
}

onMounted(async () => {
  await loadProjects();
  
  // Загружаем счетчики непрочитанных сообщений
  await loadUnreadCounts();
  
  // Проверяем query параметр для раскрытия проекта
  const projectIdParam = route.query.project_id;
  if (projectIdParam) {
    const projectId = Number(projectIdParam);
    if (!isNaN(projectId)) {
      // Находим проект в списке
      const project = projects.value.find((p) => p.id === projectId);
      if (project) {
        // Раскрываем проект (даже если еще не присоединен)
        expandedProjectId.value = projectId;
        
        // Загружаем задания только если проект присоединен
        if (project.joined) {
          await loadProjectTasks(projectId);
        }
        
        // Прокручиваем к проекту после рендеринга
        setTimeout(() => {
          const element = document.querySelector(`[data-project-id="${projectId}"]`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 300);
      }
    }
  }
});

onUnmounted(() => {
  stopMessagesPolling();
});
</script>

<template>
  <div class="projects-page">
    <v-row class="ga-4 mb-6">
      <v-col cols="12" sm="6" md="4">
        <v-card elevation="4" class="pa-4 gradient-card">
          <div class="text-caption text-medium-emphasis mb-1">Всего проектов</div>
          <div class="text-h4 font-weight-bold">{{ summary.total_available }}</div>
        </v-card>
      </v-col>
      <v-col cols="12" sm="6" md="4">
        <v-card elevation="4" class="pa-4 gradient-card">
          <div class="text-caption text-medium-emphasis mb-1">Мои проекты</div>
          <div class="text-h4 font-weight-bold">{{ summary.joined_count }}</div>
        </v-card>
      </v-col>
      <v-col cols="12" sm="6" md="4">
        <v-card elevation="4" class="pa-4 gradient-card d-flex flex-column justify-center">
          <div class="text-caption text-medium-emphasis mb-2">Показать</div>
          <v-btn-toggle v-model="filter" mandatory color="primary" class="align-self-start">
            <v-btn value="all" size="small">Все</v-btn>
            <v-btn value="available" size="small">Доступные</v-btn>
            <v-btn value="joined" size="small">Мои</v-btn>
          </v-btn-toggle>
        </v-card>
      </v-col>
      <v-col cols="12" sm="6" md="4">
        <v-card elevation="4" class="pa-4 gradient-card d-flex flex-column justify-center">
          <div class="text-caption text-medium-emphasis mb-2">Тип волонтёрства</div>
          <v-btn-toggle v-model="typeFilter" mandatory color="primary" class="align-self-start">
            <v-btn value="all" size="small">Все</v-btn>
            <v-btn value="social" size="small">Социальные</v-btn>
            <v-btn value="environmental" size="small">Экологические</v-btn>
            <v-btn value="cultural" size="small">Культурные</v-btn>
          </v-btn-toggle>
        </v-card>
      </v-col>
    </v-row>

    <v-row class="ga-4 mb-6" v-if="availableTags.length">
      <v-col cols="12">
        <v-card elevation="4" class="pa-4 gradient-card">
          <div class="text-caption text-medium-emphasis mb-2">Фильтр по тегам</div>
          <v-chip-group v-model="selectedTags" multiple column>
            <v-chip
              v-for="tag in availableTags"
              :key="tag"
              filter
              variant="outlined"
            >
              {{ tag }}
            </v-chip>
          </v-chip-group>
        </v-card>
      </v-col>
    </v-row>

    <v-alert
      v-if="!loading && !filteredProjects.length"
      type="info"
      variant="tonal"
      class="mb-6"
    >
      Проекты не найдены. Попробуйте изменить фильтр или зайдите позже — новые инициативы появляются регулярно.
    </v-alert>

        <v-row class="ga-6" v-if="filteredProjects.length">
          <v-col
            v-for="project in filteredProjects"
            :key="project.id"
            cols="12"
            sm="12"
            md="6"
          >
            <v-card 
              :data-project-id="project.id"
              elevation="3" 
              class="pa-6 h-100 d-flex flex-column"
            >
          <v-img
            v-if="project.cover_image_url"
            :src="project.cover_image_url"
            height="160"
            class="mb-4 rounded-lg"
            cover
          />
          <div class="d-flex justify-space-between align-start mb-4">
            <div>
              <h2 class="text-h6 font-weight-bold mb-2">{{ project.title }}</h2>
              <div class="text-body-2 text-medium-emphasis">
                {{ volunteerTypeMap[project.volunteer_type] || project.volunteer_type }} •
                {{ project.city || 'Город не указан' }}
              </div>
              <div class="text-body-2 text-medium-emphasis" v-if="project.address">
                <v-icon icon="mdi-map-marker-outline" size="16" class="me-1" />
                {{ project.address }}
              </div>
              <div class="text-body-2 text-medium-emphasis">
                С {{ formatDate(project.start_date) }} по {{ formatDate(project.end_date) }}
              </div>
            </div>
            <v-chip
              :color="statusMap[project.status]?.color || 'primary'"
              variant="tonal"
              class="text-uppercase font-weight-medium"
              size="small"
            >
              {{ statusMap[project.status]?.text || project.status }}
            </v-chip>
          </div>

          <p class="text-body-2 mb-4">
            {{ project.description }}
          </p>

          <div class="d-flex flex-wrap ga-2 mb-4" v-if="project.tags?.length">
            <v-chip
              v-for="tag in project.tags"
              :key="tag"
              size="small"
              color="primary-lighten-4"
              class="text-none"
            >
              {{ tag }}
            </v-chip>
          </div>

          <div
            class="d-flex flex-wrap ga-4 text-body-2 text-medium-emphasis mb-4"
            v-if="project.latitude !== null && project.latitude !== undefined && project.longitude !== null && project.longitude !== undefined"
          >
            <v-btn
              :href="`https://maps.google.com/?q=${project.latitude},${project.longitude}`"
              target="_blank"
              variant="outlined"
              size="small"
              class="text-none"
            >
              Открыть на карте
              <v-icon icon="mdi-map" end size="16" />
            </v-btn>
          </div>

          <div class="d-flex flex-wrap ga-4 text-body-2 text-medium-emphasis mb-6 align-center">
            <span>Участников: {{ project.active_members }}</span>
            <span>Заданий: {{ project.tasks_count }}</span>
            <div class="d-flex align-center ga-2">
              <span>Организатор: {{ project.organizer_name }}</span>
              <v-btn
                v-if="(project as any).organizer?.has_portfolio"
                variant="text"
                size="small"
                color="primary"
                class="text-none"
                @click="openOrganizerPortfolio((project as any).organizer_id || (project as any).organizer?.id)"
              >
                <v-icon icon="mdi-account-circle" size="16" start />
                Посмотреть
              </v-btn>
            </div>
          </div>

          <div class="contact-card" v-if="project.contact_person || project.contact_phone || project.contact_telegram || project.info_url">
            <div class="text-caption text-medium-emphasis mb-2">Контакты</div>
            <ul class="text-body-2 text-medium-emphasis pa-0 ma-0 contact-list">
              <li v-if="project.contact_person">
                <v-icon icon="mdi-account-tie" size="16" class="me-1" />
                {{ project.contact_person }}
              </li>
              <li v-if="project.contact_phone">
                <v-icon icon="mdi-phone" size="16" class="me-1" />
                <a :href="`tel:${project.contact_phone}`" class="link">{{ project.contact_phone }}</a>
              </li>
              <li v-if="project.contact_email">
                <v-icon icon="mdi-email-outline" size="16" class="me-1" />
                <a :href="`mailto:${project.contact_email}`" class="link">{{ project.contact_email }}</a>
              </li>
              <li v-if="project.contact_telegram">
                <v-icon icon="mdi-send" size="16" class="me-1" />
                <a :href="project.contact_telegram" class="link" target="_blank">Telegram</a>
              </li>
              <li v-if="project.info_url">
                <v-icon icon="mdi-web" size="16" class="me-1" />
                <a :href="project.info_url" class="link" target="_blank">Дополнительная информация</a>
              </li>
            </ul>
          </div>

          <v-spacer />

          <div class="d-flex flex-column ga-3 mt-auto">
            <div class="d-flex justify-space-between align-center">
              <div class="text-caption text-medium-emphasis" v-if="project.joined">
                Вы присоединились к проекту
              </div>
              <div class="text-caption text-medium-emphasis" v-else>
                Нажмите, чтобы вступить и получать задания
              </div>
              <v-btn
                :color="project.joined ? 'success' : 'primary'"
                :variant="project.joined ? 'tonal' : 'flat'"
                class="text-none font-weight-bold"
                :disabled="project.joined || loading"
                @click="handleJoin(project.id)"
              >
                {{ project.joined ? 'Уже в проекте' : 'Присоединиться' }}
              </v-btn>
            </div>

            <div class="d-flex ga-2">
              <!-- Кнопка для просмотра деталей проекта -->
              <v-btn
                variant="outlined"
                color="primary"
                class="text-none font-weight-bold"
                @click="openProjectDialog(project.id)"
              >
                <v-icon icon="mdi-information-outline" start />
                Подробнее
              </v-btn>

              <!-- Кнопка чата (только для присоединенных проектов) -->
              <v-btn
                v-if="project.joined"
                variant="outlined"
                color="primary"
                class="text-none font-weight-bold"
                @click="openProjectChat(project.id)"
              >
                <v-icon icon="mdi-chat-outline" start />
                Чат
                <v-badge v-if="chatUnreadCounts[project.id]" :content="chatUnreadCounts[project.id]" color="error" class="ms-2">
                  <template #badge>
                    <span>{{ chatUnreadCounts[project.id] }}</span>
                  </template>
                </v-badge>
              </v-btn>

              <!-- Кнопка для просмотра заданий (только для присоединенных проектов) -->
              <v-btn
                v-if="project.joined"
                variant="outlined"
                color="primary"
                class="text-none font-weight-bold"
                @click="toggleProjectDetails(project.id)"
              >
                <v-icon :icon="expandedProjectId === project.id ? 'mdi-chevron-up' : 'mdi-chevron-down'" start />
                {{ expandedProjectId === project.id ? 'Скрыть' : 'Задания' }}
                <v-chip
                  v-if="project.tasks_count > 0"
                  size="small"
                  class="ms-2"
                  color="primary"
                  variant="flat"
                >
                  {{ project.tasks_count }}
                </v-chip>
              </v-btn>
            </div>
          </div>

          <!-- Расширяемая секция с заданиями проекта -->
          <v-expand-transition>
            <div v-if="expandedProjectId === project.id && project.joined" class="project-details mt-4 pt-4" style="border-top: 1px solid rgba(0,0,0,0.12);">
              <div class="text-h6 font-weight-bold mb-4">Задания проекта</div>
              
              <v-skeleton-loader
                v-if="loadingTasks[project.id]"
                type="list-item-three-line@3"
                class="mb-4"
              />

              <div v-else-if="projectTasks[project.id] && projectTasks[project.id].length" class="tasks-list">
                <v-card
                  v-for="task in projectTasks[project.id]"
                  :key="task.id"
                  variant="outlined"
                  class="mb-3 pa-4 task-card"
                >
                  <div class="d-flex justify-space-between align-start mb-3">
                    <div class="flex-grow-1">
                      <div class="text-body-1 font-weight-medium mb-2">{{ task.text }}</div>
                      <div class="d-flex flex-wrap ga-3 text-body-2 text-medium-emphasis">
                        <span v-if="task.deadline_date">
                          <v-icon icon="mdi-calendar-clock" size="16" class="me-1" />
                          Срок: {{ formatDate(task.deadline_date) }}
                          <span v-if="task.start_time && task.end_time">
                            ({{ task.start_time }} - {{ task.end_time }})
                          </span>
                        </span>
                        <span>
                          <v-icon icon="mdi-clock-outline" size="16" class="me-1" />
                          Создано: {{ formatDateTime(task.created_at) }}
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
                  <div class="d-flex justify-end">
                    <v-btn
                      color="primary"
                      variant="outlined"
                      size="small"
                      class="text-none font-weight-bold"
                      :to="{ name: 'volunteer-task-detail', params: { id: task.id } }"
                    >
                      Перейти к задаче
                      <v-icon icon="mdi-arrow-right" end size="16" />
                    </v-btn>
                  </div>
                </v-card>
              </div>

              <v-alert
                v-else
                type="info"
                variant="tonal"
                class="mb-0"
              >
                В этом проекте пока нет заданий. Новые задания появятся здесь после их создания организатором.
              </v-alert>
            </div>
          </v-expand-transition>
        </v-card>
      </v-col>
    </v-row>

    <v-skeleton-loader
      v-if="loading"
      type="list-item-three-line@4"
    />

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="3500">
      {{ snackbar.message }}
    </v-snackbar>

    <!-- Диалог с деталями проекта -->
    <v-dialog v-model="projectDialog" max-width="800" scrollable>
      <v-card v-if="projectDetail" class="pa-6">
        <v-card-title class="d-flex justify-space-between align-center mb-4">
          <h2 class="text-h5 font-weight-bold">{{ projectDetail.title }}</h2>
          <v-btn icon="mdi-close" variant="text" @click="projectDialog = false" />
        </v-card-title>

        <v-card-text>
          <v-skeleton-loader v-if="loadingProject" type="article@3" />

          <div v-else>
            <!-- Обложка проекта -->
            <v-img
              v-if="projectDetail.cover_image_url"
              :src="projectDetail.cover_image_url"
              height="200"
              class="mb-6 rounded-lg"
              cover
            />

            <!-- Описание -->
            <div class="mb-6">
              <h3 class="text-h6 font-weight-bold mb-2">Описание</h3>
              <p class="text-body-1">{{ projectDetail.description }}</p>
            </div>

            <v-divider class="my-6" />

            <!-- Основная информация -->
            <v-row class="mb-6">
              <v-col cols="12" md="6">
                <div class="mb-3">
                  <v-icon icon="mdi-map-marker" size="20" class="me-2" />
                  <strong>Город:</strong> {{ projectDetail.city || '—' }}
                </div>
                <div class="mb-3">
                  <v-icon icon="mdi-calendar" size="20" class="me-2" />
                  <strong>Период:</strong>
                  <span v-if="projectDetail.start_date && projectDetail.end_date">
                    {{ formatDate(projectDetail.start_date) }} - {{ formatDate(projectDetail.end_date) }}
                  </span>
                  <span v-else-if="projectDetail.start_date">
                    С {{ formatDate(projectDetail.start_date) }}
                  </span>
                  <span v-else>—</span>
                </div>
                <div v-if="projectDetail.address" class="mb-3">
                  <v-icon icon="mdi-map-marker-outline" size="20" class="me-2" />
                  <strong>Адрес:</strong> {{ projectDetail.address }}
                </div>
              </v-col>
              <v-col cols="12" md="6">
                <div class="mb-3">
                  <v-icon icon="mdi-account-group" size="20" class="me-2" />
                  <strong>Участников:</strong> {{ projectDetail.active_members }}
                </div>
                <div class="mb-3">
                  <v-icon icon="mdi-clipboard-check" size="20" class="me-2" />
                  <strong>Заданий:</strong> {{ projectDetail.tasks_count }}
                </div>
                <div class="mb-3">
                  <v-icon icon="mdi-account-tie" size="20" class="me-2" />
                  <strong>Организатор:</strong> {{ projectDetail.organizer_name }}
                  <v-btn
                    v-if="projectDetail.organizer?.has_portfolio"
                    variant="text"
                    size="small"
                    color="primary"
                    class="text-none ml-2"
                    @click="openOrganizerPortfolio(projectDetail.organizer_id || projectDetail.organizer?.id)"
                  >
                    <v-icon icon="mdi-account-circle" size="16" start />
                    Посмотреть организатора
                  </v-btn>
                </div>
              </v-col>
            </v-row>

            <!-- Теги -->
            <div v-if="projectDetail.tags && projectDetail.tags.length" class="mb-6">
              <h3 class="text-h6 font-weight-bold mb-2">Теги</h3>
              <div class="d-flex flex-wrap ga-2">
                <v-chip
                  v-for="tag in projectDetail.tags"
                  :key="tag"
                  size="small"
                  color="primary"
                  variant="tonal"
                >
                  {{ tag }}
                </v-chip>
              </div>
            </div>

            <!-- Карта -->
            <div
              v-if="projectDetail.latitude && projectDetail.longitude"
              class="mb-6"
            >
              <h3 class="text-h6 font-weight-bold mb-3">Местоположение</h3>
              <div class="project-map-container">
                <iframe
                  :src="`https://yandex.ru/map-widget/v1/?ll=${projectDetail.longitude},${projectDetail.latitude}&z=15&pt=${projectDetail.longitude},${projectDetail.latitude}`"
                  width="100%"
                  height="300"
                  style="border:0; border-radius: 8px;"
                  allowfullscreen
                  loading="lazy"
                />
              </div>
            </div>

            <!-- Контакты -->
            <div
              v-if="projectDetail.contact_person || projectDetail.contact_phone || projectDetail.contact_email || projectDetail.contact_telegram || projectDetail.info_url"
              class="mb-6"
            >
              <h3 class="text-h6 font-weight-bold mb-3">Контакты</h3>
              <v-list density="compact" class="pa-0">
                <v-list-item v-if="projectDetail.contact_person" class="px-0">
                  <template #prepend>
                    <v-icon icon="mdi-account-tie" size="20" class="me-2" />
                  </template>
                  <v-list-item-title>{{ projectDetail.contact_person }}</v-list-item-title>
                </v-list-item>
                <v-list-item v-if="projectDetail.contact_phone" class="px-0">
                  <template #prepend>
                    <v-icon icon="mdi-phone" size="20" class="me-2" />
                  </template>
                  <v-list-item-title>
                    <a :href="`tel:${projectDetail.contact_phone}`" class="text-decoration-none">
                      {{ projectDetail.contact_phone }}
                    </a>
                  </v-list-item-title>
                </v-list-item>
                <v-list-item v-if="projectDetail.contact_email" class="px-0">
                  <template #prepend>
                    <v-icon icon="mdi-email-outline" size="20" class="me-2" />
                  </template>
                  <v-list-item-title>
                    <a :href="`mailto:${projectDetail.contact_email}`" class="text-decoration-none">
                      {{ projectDetail.contact_email }}
                    </a>
                  </v-list-item-title>
                </v-list-item>
                <v-list-item v-if="projectDetail.contact_telegram" class="px-0">
                  <template #prepend>
                    <v-icon icon="mdi-send" size="20" class="me-2" />
                  </template>
                  <v-list-item-title>
                    <a :href="projectDetail.contact_telegram" target="_blank" class="text-decoration-none">
                      Telegram
                    </a>
                  </v-list-item-title>
                </v-list-item>
                <v-list-item v-if="projectDetail.info_url" class="px-0">
                  <template #prepend>
                    <v-icon icon="mdi-web" size="20" class="me-2" />
                  </template>
                  <v-list-item-title>
                    <a :href="projectDetail.info_url" target="_blank" class="text-decoration-none">
                      Дополнительная информация
                    </a>
                  </v-list-item-title>
                </v-list-item>
              </v-list>
            </div>
          </div>
        </v-card-text>

        <v-card-actions class="pa-6 pt-0">
          <v-spacer />
          <v-btn
            v-if="!projectDetail.joined"
            color="primary"
            variant="flat"
            class="text-none font-weight-bold"
            :disabled="loading"
            @click="handleJoinFromDialog"
          >
            Присоединиться к проекту
            <v-icon icon="mdi-account-plus" end />
          </v-btn>
          <v-btn
            color="grey"
            variant="text"
            class="text-none"
            @click="projectDialog = false"
          >
            Закрыть
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Диалог с портфолио организатора -->
    <v-dialog v-model="organizerPortfolioDialog" max-width="700" scrollable>
      <v-card v-if="organizerPortfolio" class="pa-6">
        <v-card-title class="d-flex justify-space-between align-center mb-4">
          <div class="d-flex align-center ga-3">
            <v-avatar color="primary" size="48">
              <v-icon icon="mdi-account-tie" color="white" size="28" />
            </v-avatar>
            <div>
              <h2 class="text-h5 font-weight-bold mb-0">{{ organizerPortfolio.full_name || organizerPortfolio.username }}</h2>
              <p class="text-caption text-medium-emphasis mb-0" v-if="organizerPortfolio.organization_name">
                {{ organizerPortfolio.organization_name }}
              </p>
            </div>
          </div>
          <v-btn icon="mdi-close" variant="text" @click="organizerPortfolioDialog = false" />
        </v-card-title>

        <v-card-text>
          <v-skeleton-loader v-if="loadingPortfolio" type="article@5" />

          <div v-else>
            <!-- Фото портфолио -->
            <div v-if="organizerPortfolio.portfolio?.portfolio_photo_url" class="mb-6 text-center">
              <v-img
                :src="organizerPortfolio.portfolio.portfolio_photo_url"
                max-width="200"
                max-height="250"
                cover
                class="mx-auto rounded-lg"
              />
            </div>

            <!-- Основная информация -->
            <v-row class="mb-4">
              <v-col cols="12" md="6" v-if="organizerPortfolio.portfolio?.age">
                <div class="d-flex align-center mb-3">
                  <v-icon icon="mdi-calendar" size="20" class="me-2" />
                  <strong>Возраст:</strong>
                  <span class="ml-2">{{ organizerPortfolio.portfolio.age }} лет</span>
                </div>
              </v-col>
              <v-col cols="12" md="6" v-if="organizerPortfolio.portfolio?.gender">
                <div class="d-flex align-center mb-3">
                  <v-icon icon="mdi-gender-male-female" size="20" class="me-2" />
                  <strong>Пол:</strong>
                  <span class="ml-2">{{ organizerPortfolio.portfolio.gender_display }}</span>
                </div>
              </v-col>
              <v-col cols="12" md="6" v-if="organizerPortfolio.portfolio?.work_experience_years">
                <div class="d-flex align-center mb-3">
                  <v-icon icon="mdi-briefcase-clock" size="20" class="me-2" />
                  <strong>Стаж работы:</strong>
                  <span class="ml-2">{{ organizerPortfolio.portfolio.work_experience_years }} лет</span>
                </div>
              </v-col>
            </v-row>

            <!-- О себе -->
            <div v-if="organizerPortfolio.portfolio?.bio" class="mb-6">
              <h3 class="text-h6 font-weight-bold mb-2">
                <v-icon icon="mdi-account-circle" size="20" class="me-2" />
                О себе
              </h3>
              <p class="text-body-1">{{ organizerPortfolio.portfolio.bio }}</p>
            </div>

            <!-- Опыт работы -->
            <div v-if="organizerPortfolio.portfolio?.work_history" class="mb-6">
              <h3 class="text-h6 font-weight-bold mb-2">
                <v-icon icon="mdi-briefcase-edit" size="20" class="me-2" />
                Опыт работы
              </h3>
              <p class="text-body-1" style="white-space: pre-line">{{ organizerPortfolio.portfolio.work_history }}</p>
            </div>

            <v-alert
              v-if="!organizerPortfolio.portfolio?.bio && !organizerPortfolio.portfolio?.work_history && !organizerPortfolio.portfolio?.age"
              type="info"
              variant="tonal"
              class="mb-0"
            >
              Организатор еще не заполнил портфолио.
            </v-alert>
          </div>
        </v-card-text>

        <v-card-actions class="pa-6 pt-0">
          <v-spacer />
          <v-btn
            color="grey"
            variant="text"
            class="text-none"
            @click="organizerPortfolioDialog = false"
          >
            Закрыть
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Диалог чата -->
    <v-dialog v-model="chatDialog" max-width="900" fullscreen hide-overlay transition="dialog-bottom-transition">
      <v-card v-if="chat" class="chat-dialog d-flex flex-column h-100">
        <v-card-title class="d-flex justify-space-between align-center pa-4">
          <div class="d-flex align-center ga-3">
            <v-avatar color="primary" size="40">
              <v-icon icon="mdi-chat" color="white" />
            </v-avatar>
            <div>
              <h2 class="text-h6 font-weight-bold mb-0">{{ chat.project_title }}</h2>
              <p class="text-caption text-medium-emphasis mb-0">Чат с организатором</p>
            </div>
          </div>
          <v-btn icon="mdi-close" variant="text" @click="closeChatDialog" />
        </v-card-title>

        <v-divider />

        <div class="chat-messages-container d-flex flex-column flex-grow-1">
          <v-card-text class="chat-messages pa-4 flex-grow-1" style="overflow-y: auto; max-height: calc(100vh - 250px);">
            <v-skeleton-loader v-if="chatLoading" type="list-item-three-line@5" />
            
            <template v-else>
              <div v-if="!chatMessages.length" class="text-center text-medium-emphasis py-12">
                <v-icon icon="mdi-chat-outline" size="48" class="mb-4" />
                <p class="text-body-1">Начните общение с организатором!</p>
                <p class="text-caption">Напишите сообщение ниже</p>
              </div>
              
              <div v-else class="messages-list d-flex flex-column ga-3">
                <div
                  v-for="message in chatMessages"
                  :key="message.id"
                  class="message-item"
                  :class="{ 'message-item--own': message.sender_id === currentUser.value?.id }"
                >
                  <div class="d-flex ga-2" :class="{ 'flex-row-reverse': message.sender_id === currentUser.value?.id }">
                    <v-avatar size="32" color="primary-lighten-4">
                      <v-icon icon="mdi-account" color="primary" />
                    </v-avatar>
                    <div class="message-content" :class="{ 'text-right': message.sender_id === currentUser.value?.id }">
                      <div class="d-flex align-center ga-2 mb-1" :class="{ 'flex-row-reverse': message.sender_id === currentUser.value?.id }">
                        <span class="text-caption font-weight-medium">{{ message.sender_name }}</span>
                        <v-chip v-if="message.sender_is_organizer" size="x-small" color="primary" variant="tonal" class="text-none">
                          Организатор
                        </v-chip>
                        <span class="text-caption text-medium-emphasis">{{ new Date(message.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) }}</span>
                      </div>
                      <v-card
                        class="message-bubble pa-3"
                        :color="message.sender_id === currentUser.value?.id ? 'primary' : 'grey-lighten-4'"
                        variant="flat"
                      >
                        <p class="text-body-2 mb-0" :style="{ color: message.sender_id === currentUser.value?.id ? 'white' : 'inherit' }">
                          {{ message.text }}
                        </p>
                      </v-card>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </v-card-text>

          <v-divider />

          <v-card-text class="chat-input pa-4">
            <div class="d-flex ga-2">
              <v-textarea
                v-model="newMessageText"
                placeholder="Напишите сообщение..."
                variant="outlined"
                rows="1"
                auto-grow
                hide-details
                class="flex-grow-1"
                @keydown.enter.exact.prevent="handleSendMessage"
              />
              <v-btn
                color="primary"
                variant="flat"
                icon="mdi-send"
                :disabled="!newMessageText.trim() || sendingMessage"
                :loading="sendingMessage"
                @click="handleSendMessage"
              />
            </div>
          </v-card-text>
        </div>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.projects-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.gradient-card {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(240, 248, 255, 0.9));
  backdrop-filter: blur(6px);
}

@media (max-width: 960px) {
  .projects-page :deep(.v-card-title) {
    flex-wrap: wrap;
    gap: 12px;
  }
}

.link {
  color: inherit;
  text-decoration: none;
}

.chat-dialog {
  background: #f8ecc4; /* BirQadam background */
}

.chat-messages-container {
  background: rgba(255, 255, 255, 0.98);
}

.message-item {
  width: 100%;
}

.message-item--own {
  align-items: flex-end;
}

.message-content {
  max-width: 70%;
}

.message-bubble {
  border-radius: 12px;
  word-wrap: break-word;
}

.chat-input {
  background: rgba(255, 255, 255, 0.95);
}

.link:hover {
  text-decoration: underline;
}

.contact-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.project-details {
  margin-top: 16px;
  padding-top: 16px;
}

.tasks-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.task-card {
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}

.task-card:hover {
  box-shadow: 0 4px 12px rgba(139, 195, 74, 0.15); /* BirQadam primary */
  transform: translateY(-2px);
}

.project-map-container {
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
</style>

