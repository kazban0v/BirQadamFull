<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { useDashboardStore } from '@/stores/dashboard';
import { useAuthStore } from '@/stores/auth';
import { fetchVolunteerProjects, joinVolunteerProject, leaveVolunteerProject, fetchProjectTasks, fetchProjectDetail, type ProjectTask } from '@/services/projects';
import type { VolunteerProjectCatalogItem } from '@/services/projects';
import { getProjectChat, getChatMessages, sendMessage, markMessagesRead, type Chat, type ChatMessage } from '@/services/chat';
import { getOrganizerPortfolio, type OrganizerProfile } from '@/services/webPortal';

import ProjectCard from '@/components/volunteer/ProjectCard.vue';
import ProjectFilterSidebar from '@/components/volunteer/ProjectFilterSidebar.vue';
import { formatDate, getFullImageUrl } from '@/utils/formatters';

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
const searchTitle = ref('');
const cityFilter = ref<string>('all');
const dateFilter = ref<'all' | 'active' | 'upcoming'>('all');
const hasTasksFilter = ref(false);
const viewMode = ref<'grid' | 'list'>('grid');
const showMobileFilters = ref(false);
const showAllTags = ref(false);
const TAGS_PREVIEW_COUNT = 6;
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
const chatScrollRef = ref<HTMLElement | null>(null);
const modalTab = ref<'chat'>('chat'); // Для волонтера только чат, без участников

// Баннер уведомления о новом сообщении
const messageNotification = reactive<{
  show: boolean;
  projectId: number | null;
  projectTitle: string;
  unreadCount: number;
}>({
  show: false,
  projectId: null,
  projectTitle: '',
  unreadCount: 0,
});

// Получаем текущий проект для чата
const currentProject = computed(() => {
  if (!chatProjectId.value) return null;
  return projects.value.find(p => p.id === chatProjectId.value) || null;
});

// Функция для получения инициалов пользователя
function getUserInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

function scrollToBottom() {
  setTimeout(() => {
    if (chatScrollRef.value) chatScrollRef.value.scrollTop = chatScrollRef.value.scrollHeight;
  }, 50);
}

// Диалоги для TrustFactor
const joinConfirmDialog = ref(false);
const pendingJoinProjectId = ref<number | null>(null);
const leaveReasonDialog = ref(false);
const pendingLeaveProjectId = ref<number | null>(null);
const leaveReason = ref('');
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

const availableCities = computed(() => {
  const set = new Set<string>();
  projects.value.forEach((project) => {
    if (project.city) set.add(project.city);
  });
  return Array.from(set).sort();
});

const visibleTags = computed(() => {
  return availableTags.value.slice(0, TAGS_PREVIEW_COUNT);
});

const activeFiltersCount = computed(() => {
  let count = 0;
  if (filter.value !== 'all') count++;
  if (typeFilter.value !== 'all') count++;
  if (cityFilter.value !== 'all') count++;
  if (dateFilter.value !== 'all') count++;
  if (hasTasksFilter.value) count++;
  if (selectedTags.value.length) count++;
  if (searchTitle.value.trim()) count++;
  return count;
});

const hasActiveFilters = computed(() => activeFiltersCount.value > 0);

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

  // Фильтр по городу
  if (cityFilter.value !== 'all') {
    list = list.filter((project) => project.city === cityFilter.value);
  }

  // Фильтр по периоду
  if (dateFilter.value === 'active') {
    const today = new Date().toISOString().slice(0, 10);
    list = list.filter((project) => {
      const start = project.start_date || '';
      const end = project.end_date || '';
      return start <= today && (!end || end >= today);
    });
  } else if (dateFilter.value === 'upcoming') {
    const today = new Date().toISOString().slice(0, 10);
    list = list.filter((project) => (project.start_date || '') > today);
  }

  // Фильтр «Есть задачи»
  if (hasTasksFilter.value) {
    list = list.filter((project) => project.tasks_count > 0);
  }

  if (selectedTags.value.length) {
    list = list.filter((project) => {
      if (!project.tags?.length) return false;
      return selectedTags.value.every((tag) => project.tags?.includes(tag));
    });
  }

  // Поиск по названию
  if (searchTitle.value.trim()) {
    const searchLower = searchTitle.value.trim().toLowerCase();
    list = list.filter((project) => 
      project.title.toLowerCase().includes(searchLower)
    );
  }

  return list;
});

// Пагинация
const currentPage = ref(1);
const itemsPerPage = 6; // Количество проектов на странице

const totalPages = computed(() => {
  return Math.ceil(filteredProjects.value.length / itemsPerPage);
});

const paginatedProjects = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  return filteredProjects.value.slice(start, end);
});

// Сброс страницы при изменении фильтров
// Сброс страницы при изменении любого фильтра
watch([filter, typeFilter, selectedTags, searchTitle, cityFilter, dateFilter, hasTasksFilter], () => {
  currentPage.value = 1;
}, { deep: true });

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
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
    // Преобразуем URL фото проектов в полные, если нужно
    projects.value = data.projects.map(project => ({
      ...project,
      cover_image_url: project.cover_image_url ? getFullImageUrl(project.cover_image_url) : null,
    }));
    summary.total_available = data.summary.total_available;
    summary.joined_count = data.summary.joined_count;
    if (!availableTags.value.length) {
      selectedTags.value = [];
    }
  } catch (error: any) {
    // Обрабатываем ошибку 429
    if (error?.response?.status === 429) {
      showMessage('Слишком много запросов. Пожалуйста, подождите немного.', 'warning');
    } else {
      showMessage('Не удалось загрузить проекты.', 'error');
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
    const detail = await fetchProjectDetail(projectId);
    // Преобразуем URL фото проекта в полный, если нужно
    if (detail.cover_image_url) {
      detail.cover_image_url = getFullImageUrl(detail.cover_image_url) || null;
    }
    projectDetail.value = detail;
  } catch (error: any) {
    console.error('Failed to load project detail:', error);
    // Обрабатываем ошибку 429
    if (error?.response?.status === 429) {
      showMessage('Слишком много запросов. Пожалуйста, подождите немного.', 'warning');
    } else {
      const errorMessage = error?.response?.data?.detail || 'Не удалось загрузить детали проекта.';
      showMessage(errorMessage, 'error');
    }
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
    const portfolio = await getOrganizerPortfolio(organizerId);
    // Преобразуем URL фото в полный, если нужно
    if (portfolio.portfolio?.portfolio_photo_url) {
      portfolio.portfolio.portfolio_photo_url = getFullImageUrl(portfolio.portfolio.portfolio_photo_url) || null;
    }
    organizerPortfolio.value = portfolio;
  } catch (error: any) {
    console.error('Failed to load organizer portfolio:', error);
    // Обрабатываем ошибку 429
    if (error?.response?.status === 429) {
      showMessage('Слишком много запросов. Пожалуйста, подождите немного.', 'warning');
    } else {
      const errorMessage = error?.response?.data?.detail || 'Не удалось загрузить портфолио организатора.';
      showMessage(errorMessage, 'error');
    }
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

function toggleTag(tag: string) {
  const index = selectedTags.value.indexOf(tag);
  if (index === -1) {
    selectedTags.value.push(tag);
  } else {
    selectedTags.value.splice(index, 1);
  }
}

function clearFilters() {
  searchTitle.value = '';
  selectedTags.value = [];
}

function clearAllFilters() {
  searchTitle.value = '';
  selectedTags.value = [];
  filter.value = 'all';
  typeFilter.value = 'all';
  cityFilter.value = 'all';
  dateFilter.value = 'all';
  hasTasksFilter.value = false;
}

function requestJoin(projectId: number) {
  pendingJoinProjectId.value = projectId;
  joinConfirmDialog.value = true;
}

async function confirmJoin() {
  if (!pendingJoinProjectId.value) return;
  
  const projectId = pendingJoinProjectId.value;
  joinConfirmDialog.value = false;
  pendingJoinProjectId.value = null;
  
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
    const errorMessage = error?.response?.data?.error || error?.response?.data?.detail || 'Не удалось присоединиться к проекту.';
    showMessage(errorMessage, 'error');
    
    // Если ошибка связана с TrustFactor или лимитом проектов, показываем более подробное сообщение
    if (error?.response?.status === 403 || error?.response?.status === 400) {
      if (error?.response?.data?.trust_factor !== undefined) {
        showMessage(`Ваш Trust Factor: ${error.response.data.trust_factor}. ${errorMessage}`, 'error');
      }
    }
  } finally {
    loading.value = false;
  }
}

async function handleJoin(projectId: number) {
  requestJoin(projectId);
}

async function handleJoinFromDialog() {
  if (!projectDetail.value) return;
  // Используем project_id если есть, иначе id
  const projectId = projectDetail.value.project_id || projectDetail.value.id;
  requestJoin(projectId);
  // Закрываем диалог деталей проекта, откроется диалог подтверждения
  projectDialog.value = false;
}

function requestLeave(projectId: number) {
  pendingLeaveProjectId.value = projectId;
  leaveReason.value = '';
  leaveReasonDialog.value = true;
}

async function confirmLeave() {
  if (!pendingLeaveProjectId.value || !leaveReason.value.trim()) {
    showMessage('Необходимо указать причину выхода из проекта', 'error');
    return;
  }
  
  const projectId = pendingLeaveProjectId.value;
  const reason = leaveReason.value.trim();
  leaveReasonDialog.value = false;
  pendingLeaveProjectId.value = null;
  leaveReason.value = '';
  
  try {
    loading.value = true;
    const result = await leaveVolunteerProject(projectId, reason);
    
    // Перезагружаем список проектов
    await loadProjects();
    
    let message = result.message || 'Вы покинули проект.';
    if (result.penalty_applied && result.trust_factor !== undefined) {
      message += ` Ваш Trust Factor: ${result.trust_factor} (штраф -5 TF за выход из проекта)`;
    }
    showMessage(message, result.penalty_applied ? 'warning' : 'success');
    
    await dashboardStore.loadDashboard(true);
    
    // Обновляем профиль пользователя, чтобы обновить TF в интерфейсе
    try {
      // Принудительно обновляем trust_factor из ответа API сразу
      if (result.trust_factor !== undefined && authStore.user) {
        authStore.user.trust_factor = result.trust_factor;
        console.log('TF updated from API response:', result.trust_factor);
      }
      // Затем обновляем весь профиль для синхронизации
      const updatedProfile = await authStore.refreshProfile();
      console.log('Profile refreshed, TF:', updatedProfile.trust_factor);
    } catch (error) {
      console.error('Failed to refresh profile after leaving project:', error);
      // Даже если refreshProfile не сработал, используем значение из ответа
      if (result.trust_factor !== undefined && authStore.user) {
        authStore.user.trust_factor = result.trust_factor;
      }
    }
    
    // Обновляем детали проекта в диалоге, если он открыт
    if (projectDialog.value && projectDetail.value && (projectDetail.value.project_id === projectId || projectDetail.value.id === projectId)) {
      projectDetail.value = await fetchProjectDetail(projectId);
    }
  } catch (error: any) {
    const detail = error?.response?.data?.error || error?.response?.data?.detail || 'Не удалось покинуть проект.';
    showMessage(detail, 'error');
  } finally {
    loading.value = false;
  }
}

async function handleLeave(projectId: number) {
  requestLeave(projectId);
}

async function handleLeaveFromDialog() {
  if (!projectDetail.value) return;
  // Используем project_id если есть, иначе id
  const projectId = projectDetail.value.project_id || projectDetail.value.id;
  requestLeave(projectId);
  // Закрываем диалог деталей проекта, откроется диалог с причиной
  projectDialog.value = false;
}

// Функции чата
async function openProjectChat(projectId: number) {
  chatProjectId.value = projectId;
  chatDialog.value = true;
  chatLoading.value = true;
  chat.value = null;
  chatMessages.value = [];
  newMessageText.value = '';
  modalTab.value = 'chat';
  
  // Скрываем баннер уведомления при открытии чата
  if (messageNotification.projectId === projectId) {
    messageNotification.show = false;
  }
  
  try {
    chat.value = await getProjectChat(projectId);
    await loadChatMessages();
    
    if (chat.value.unread_count > 0) {
      await markMessagesRead(chat.value.id);
      chat.value.unread_count = 0;
      chatUnreadCounts.value[projectId] = 0;
    }
    
    startMessagesPolling();
    scrollToBottom();
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
    scrollToBottom();
  } catch (error: any) {
    console.error('Failed to send message:', error);
  } finally {
    sendingMessage.value = false;
  }
}

const isCheckingUnread = ref(false);

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
          scrollToBottom();
        }
      } catch (error) {
        // Игнорируем ошибки polling
      }
    } else {
      // Проверяем непрочитанные сообщения только если не идет другая проверка
      if (!isCheckingUnread.value) {
        await checkUnreadMessages();
      }
    }
  }, 10000); // Увеличиваем интервал до 10 секунд
}

// Проверка непрочитанных сообщений для показа баннера
async function checkUnreadMessages() {
  // Предотвращаем параллельные проверки
  if (isCheckingUnread.value) return;
  isCheckingUnread.value = true;
  
  try {
    // Если чат открыт для проекта, не показываем баннер
    if (chatDialog.value && chatProjectId.value) {
      // Обновляем счетчик для открытого чата, но не показываем баннер
      try {
        const projectChat = await getProjectChat(chatProjectId.value);
        chatUnreadCounts.value[chatProjectId.value] = projectChat.unread_count;
      } catch (error) {
        // Игнорируем ошибки
      }
      return;
    }
    
    // Если баннер уже показан, проверяем только этот проект
    if (messageNotification.show && messageNotification.projectId) {
      try {
        const projectChat = await getProjectChat(messageNotification.projectId);
        chatUnreadCounts.value[messageNotification.projectId] = projectChat.unread_count;
        if (projectChat.unread_count === 0) {
          messageNotification.show = false;
        } else {
          messageNotification.unreadCount = projectChat.unread_count;
        }
      } catch (error) {
        // Игнорируем ошибки
      }
    } else {
      // Ищем первый проект с непрочитанными сообщениями (только первые 5 присоединенных проектов для оптимизации)
      const joinedProjects = projects.value.filter((p) => p.joined).slice(0, 5);
      for (const project of joinedProjects) {
        try {
          const projectChat = await getProjectChat(project.id);
          if (projectChat.unread_count > 0) {
            chatUnreadCounts.value[project.id] = projectChat.unread_count;
            
            // Показываем баннер, если его еще нет или если это другой проект
            if (!messageNotification.show || messageNotification.projectId !== project.id) {
          messageNotification.show = true;
          messageNotification.projectId = project.id;
          messageNotification.projectTitle = project.title;
          messageNotification.unreadCount = projectChat.unread_count;
          break; // Показываем только одно уведомление
            } else {
              // Обновляем счетчик для уже показанного проекта
              messageNotification.unreadCount = projectChat.unread_count;
            }
          } else {
            // Если непрочитанных сообщений нет, убираем счетчик
            chatUnreadCounts.value[project.id] = 0;
            // Если это был проект с баннером, скрываем баннер
            if (messageNotification.projectId === project.id) {
              messageNotification.show = false;
            }
          }
        } catch (error) {
          // Прерываем проверку при 429 ошибке
          if (error && typeof error === 'object' && 'response' in error) {
            const axiosError = error as any;
            if (axiosError.response?.status === 429) {
              console.warn('[BANNER] Rate limit reached, skipping check');
              break;
            }
          }
          // Игнорируем другие ошибки
        }
      }
    }
  } finally {
    isCheckingUnread.value = false;
  }
}

function stopMessagesPolling() {
  if (messagesPollInterval.value) {
    clearInterval(messagesPollInterval.value);
    messagesPollInterval.value = null;
  }
}

async function loadUnreadCounts() {
  const joinedProjects = projects.value.filter((p) => p.joined);
  
  for (const project of joinedProjects) {
    try {
      const projectChat = await getProjectChat(project.id);
      
      if (projectChat.unread_count > 0) {
        chatUnreadCounts.value[project.id] = projectChat.unread_count;
        
        // Показываем баннер уведомления только для первого проекта с непрочитанными сообщениями
        // Баннер показываем, если чат не открыт или открыт для другого проекта
        if (!messageNotification.show && (!chatDialog.value || chatProjectId.value !== project.id)) {
          messageNotification.show = true;
          messageNotification.projectId = project.id;
          messageNotification.projectTitle = project.title;
          messageNotification.unreadCount = projectChat.unread_count;
          break; // Показываем только одно уведомление
        }
      } else {
        // Если непрочитанных сообщений нет, убираем счетчик
        chatUnreadCounts.value[project.id] = 0;
      }
    } catch (error) {
      // Игнорируем ошибки (включая 429)
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as any;
        if (axiosError.response?.status === 429) {
          console.warn('[BANNER] Rate limit reached, skipping loadUnreadCounts');
          break; // Прерываем проверку при 429
        }
      }
    }
  }
}

onMounted(async () => {
  await loadProjects();
  
  // Загружаем счетчики непрочитанных сообщений
  await loadUnreadCounts();
  
  // Запускаем polling для проверки непрочитанных сообщений
  startMessagesPolling();
  
  // Проверяем, нужно ли открыть чат из query параметра
  const openChatParam = route.query.openChat;
  if (openChatParam) {
    const projectId = Number(openChatParam);
    if (projectId && !isNaN(projectId)) {
      await openProjectChat(projectId);
    }
  }
  
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
    <!-- Баннер уведомления о новом сообщении -->
    <v-card
      v-if="messageNotification.show"
      class="message-notification-banner mb-4"
      elevation="4"
      rounded="xl"
    >
      <div class="d-flex align-center justify-space-between pa-4 flex-wrap ga-2">
        <div class="d-flex align-center ga-3 flex-grow-1 min-width-0">
          <v-icon icon="mdi-message-text" size="24" color="primary" />
          <div class="flex-grow-1 min-width-0">
            <div class="text-body-1 font-weight-bold mb-1">Новое сообщение.</div>
            <div class="text-body-2 text-medium-emphasis text-truncate">{{ messageNotification.projectTitle }}</div>
            <v-chip
              v-if="messageNotification.unreadCount > 0"
              size="small"
              color="primary"
              variant="flat"
              class="mt-1"
            >
              {{ messageNotification.unreadCount }} {{ messageNotification.unreadCount === 1 ? 'сообщение' : 'сообщений' }}
            </v-chip>
          </div>
        </div>
        <v-btn
          color="primary"
          variant="flat"
          class="text-none font-weight-bold"
          @click="messageNotification.projectId && openProjectChat(messageNotification.projectId)"
        >
          Открыть
        </v-btn>
      </div>
    </v-card>

    <!-- Шапка страницы с inline-статистикой -->
    <div class="page-header d-flex align-center justify-space-between mb-6 flex-wrap ga-3">
      <div>
        <h1 class="text-h5 font-weight-bold">Проекты</h1>
        <div class="d-flex ga-3 mt-2 flex-wrap">
          <v-chip prepend-icon="mdi-folder-multiple" color="primary" variant="tonal" size="small" class="font-weight-medium">
            Всего: {{ summary.total_available }}
          </v-chip>
          <v-chip prepend-icon="mdi-account-check" color="success" variant="tonal" size="small" class="font-weight-medium">
            Мои: {{ summary.joined_count }}
          </v-chip>
          <v-chip
            v-if="filteredProjects.length !== projects.length"
            prepend-icon="mdi-filter-variant"
            color="warning"
            variant="tonal"
            size="small"
            class="font-weight-medium"
          >
            Найдено: {{ filteredProjects.length }}
          </v-chip>
        </div>
      </div>
      <div class="d-flex align-center ga-2">
        <!-- View mode toggle -->
        <v-btn-toggle
          v-model="viewMode"
          color="primary"
          variant="outlined"
          mandatory
          rounded="lg"
        >
          <v-btn value="grid" icon="mdi-view-grid" size="large"></v-btn>
          <v-btn value="list" icon="mdi-format-list-bulleted" size="large"></v-btn>
        </v-btn-toggle>

        <!-- Mobile filter trigger -->
        <v-btn
          class="d-md-none filter-mobile-btn"
        prepend-icon="mdi-filter-variant"
        color="primary"
        variant="tonal"
        rounded="lg"
        @click="showMobileFilters = true"
      >
        Фильтры
        <v-badge
          v-if="activeFiltersCount > 0"
          :content="activeFiltersCount"
          color="error"
          inline
          class="ms-1"
        />
      </v-btn>
      </div>
    </div>

    <!-- Мобильное offcanvas-меню для фильтров (bottom sheet) -->
    <v-dialog
      v-model="showMobileFilters"
      class="align-end"
      max-width="100%"
      content-class="filter-dialog-mobile"
      scrim="rgba(0,0,0,0.5)"
    >
      <template #default>
        <v-card
          class="filter-bottom-sheet"
          style="width: 100%; max-height: 88vh; border-radius: 24px 24px 0 0; overflow: hidden; display: flex; flex-direction: column;"
        >
          <!-- Хэндл -->
          <div class="d-flex justify-center pt-3 pb-1">
            <div style="width: 40px; height: 4px; border-radius: 2px; background: rgba(0,0,0,0.15);"></div>
          </div>
          <!-- Заголовок -->
          <div class="d-flex align-center justify-space-between px-4 pb-2">
            <span class="text-body-1 font-weight-bold">Фильтры</span>
            <div class="d-flex align-center ga-2">
              <v-btn v-if="hasActiveFilters" size="small" variant="tonal" color="error" @click="clearAllFilters" class="text-none">
                Сбросить
              </v-btn>
              <v-btn icon="mdi-close" variant="text" size="small" @click="showMobileFilters = false" />
            </div>
          </div>
          <v-divider />
          <!-- Контент с прокруткой -->
          <div class="pa-4 overflow-y-auto flex-grow-1">
            <!-- Поиск -->
            <div class="sidebar-section">
              <div class="sidebar-label">Поиск</div>
              <v-text-field
                v-model="searchTitle"
                placeholder="Найти проект..."
                prepend-inner-icon="mdi-magnify"
                variant="outlined"
                density="compact"
                clearable
                hide-details
                rounded="lg"
              />
            </div>

            <!-- Статус -->
            <div class="sidebar-section">
              <div class="sidebar-label">Статус</div>
              <v-radio-group v-model="filter" hide-details density="compact">
                <v-radio label="Все" value="all" color="primary" />
                <v-radio label="Доступные" value="available" color="primary" />
                <v-radio label="Вступил" value="joined" color="primary" />
              </v-radio-group>
            </div>

            <!-- Тип волонтёрства -->
            <div class="sidebar-section">
              <div class="sidebar-label">Тип волонтёрства</div>
              <v-radio-group v-model="typeFilter" hide-details density="compact">
                <v-radio label="Все" value="all" color="primary" />
                <v-radio label="Социальное" value="social" color="primary" />
                <v-radio label="Экологическое" value="environmental" color="primary" />
                <v-radio label="Культурное" value="cultural" color="primary" />
              </v-radio-group>
            </div>

            <!-- Город -->
            <div class="sidebar-section" v-if="availableCities.length">
              <div class="sidebar-label">Город</div>
              <v-select
                v-model="cityFilter"
                :items="[{ title: 'Все города', value: 'all' }, ...availableCities.map(c => ({ title: c, value: c }))]"
                item-title="title"
                item-value="value"
                variant="outlined"
                density="compact"
                hide-details
                rounded="lg"
              />
            </div>

            <!-- Период -->
            <div class="sidebar-section">
              <div class="sidebar-label">Период</div>
              <v-radio-group v-model="dateFilter" hide-details density="compact">
                <v-radio label="Все" value="all" color="primary" />
                <v-radio label="Активные" value="active" color="primary" />
                <v-radio label="Скоро начнутся" value="upcoming" color="primary" />
              </v-radio-group>
            </div>

            <!-- Задачи -->
            <div class="sidebar-section">
              <v-checkbox
                v-model="hasTasksFilter"
                label="Есть открытые задачи"
                hide-details
                density="compact"
                color="primary"
              />
            </div>

            <!-- Теги -->
            <div class="sidebar-section" v-if="availableTags.length">
              <div class="sidebar-label d-flex align-center justify-space-between">
                <span>Теги</span>
                <v-chip v-if="selectedTags.length" size="x-small" color="primary" variant="flat">{{ selectedTags.length }}</v-chip>
              </div>
              <div v-for="tag in availableTags" :key="tag + '_mob'">
                <v-checkbox
                  density="compact"
                  hide-details
                  :label="tag"
                  :model-value="selectedTags.includes(tag)"
                  @update:model-value="toggleTag(tag)"
                  color="primary"
                />
              </div>
            </div>

            <!-- Кнопка Применить -->
            <v-btn
              color="primary"
              variant="flat"
              block
              class="text-none font-weight-bold mt-4"
              @click="showMobileFilters = false"
            >
              Применить фильтры
              <v-chip v-if="activeFiltersCount > 0" size="x-small" color="white" text-color="primary" class="ms-2">
                {{ activeFiltersCount }}
              </v-chip>
            </v-btn>
          </div>
        </v-card>
      </template>
    </v-dialog>


    <!-- Основная двухколоночная сетка -->
    <v-row>
      <!-- LEFT SIDEBAR (desktop only) -->
      <v-col cols="12" md="3" class="d-none d-md-flex flex-column">
        <div class="sidebar">
          <!-- Поиск -->
          <div class="sidebar-section">
            <div class="sidebar-label">Поиск</div>
            <v-text-field
              v-model="searchTitle"
              placeholder="Найти проект..."
              prepend-inner-icon="mdi-magnify"
              variant="outlined"
              density="compact"
              clearable
              hide-details
              rounded="lg"
            />
          </div>

          <!-- Статус -->
          <div class="sidebar-section">
            <div class="sidebar-label">Статус</div>
            <v-radio-group v-model="filter" hide-details density="compact">
              <v-radio label="Все" value="all" color="primary" />
              <v-radio label="Доступные" value="available" color="primary" />
              <v-radio label="Вступил" value="joined" color="primary" />
            </v-radio-group>
          </div>

          <!-- Тип волонтёрства -->
          <div class="sidebar-section">
            <div class="sidebar-label">Тип волонтёрства</div>
            <v-radio-group v-model="typeFilter" hide-details density="compact">
              <v-radio label="Все" value="all" color="primary" />
              <v-radio label="Социальное" value="social" color="primary" />
              <v-radio label="Экологическое" value="environmental" color="primary" />
              <v-radio label="Культурное" value="cultural" color="primary" />
            </v-radio-group>
          </div>

          <!-- Город -->
          <div class="sidebar-section" v-if="availableCities.length">
            <div class="sidebar-label">Город</div>
            <v-select
              v-model="cityFilter"
              :items="[{ title: 'Все города', value: 'all' }, ...availableCities.map(c => ({ title: c, value: c }))]"
              item-title="title"
              item-value="value"
              variant="outlined"
              density="compact"
              hide-details
              rounded="lg"
            />
          </div>

          <!-- Период -->
          <div class="sidebar-section">
            <div class="sidebar-label">Период</div>
            <v-radio-group v-model="dateFilter" hide-details density="compact">
              <v-radio label="Все" value="all" color="primary" />
              <v-radio label="Активные" value="active" color="primary" />
              <v-radio label="Скоро начнутся" value="upcoming" color="primary" />
            </v-radio-group>
          </div>

          <!-- Задачи -->
          <div class="sidebar-section">
            <v-checkbox
              v-model="hasTasksFilter"
              label="Есть открытые задачи"
              hide-details
              density="compact"
              color="primary"
            />
          </div>

          <!-- Теги -->
          <div class="sidebar-section" v-if="availableTags.length">
            <div class="sidebar-label d-flex align-center justify-space-between">
              <span>Теги</span>
              <v-chip v-if="selectedTags.length" size="x-small" color="primary" variant="flat">{{ selectedTags.length }}</v-chip>
            </div>
            <div v-for="tag in visibleTags" :key="tag">
              <v-checkbox
                density="compact"
                hide-details
                :label="tag"
                :model-value="selectedTags.includes(tag)"
                @update:model-value="toggleTag(tag)"
                color="primary"
              />
            </div>
            <v-expand-transition>
              <div v-if="showAllTags">
                <div v-for="tag in availableTags.slice(TAGS_PREVIEW_COUNT)" :key="tag + '_extra'">
                  <v-checkbox
                    density="compact"
                    hide-details
                    :label="tag"
                    :model-value="selectedTags.includes(tag)"
                    @update:model-value="toggleTag(tag)"
                    color="primary"
                  />
                </div>
              </div>
            </v-expand-transition>
            <v-btn
              v-if="availableTags.length > TAGS_PREVIEW_COUNT"
              variant="text"
              size="small"
              color="primary"
              class="text-none mt-1 px-0"
              @click="showAllTags = !showAllTags"
            >
              {{ showAllTags ? 'Скрыть' : `Показать все (${availableTags.length})` }}
              <v-icon :icon="showAllTags ? 'mdi-chevron-up' : 'mdi-chevron-down'" end size="16" />
            </v-btn>
          </div>

          <!-- Сбросить все -->
          <v-btn
            v-if="hasActiveFilters"
            color="error"
            variant="tonal"
            block
            class="text-none mt-2"
            prepend-icon="mdi-filter-off"
            @click="clearAllFilters"
          >
            Сбросить фильтры
          </v-btn>
        </div>
      </v-col>

      <!-- MAIN CONTENT -->
      <v-col cols="12" md="9">
        <v-alert
          v-if="!loading && !filteredProjects.length"
          type="info"
          variant="tonal"
          class="mb-6"
        >
          Проекты не найдены. Попробуйте изменить фильтры или сбросить их, чтобы увидеть все доступные волонтёрские проекты.
        </v-alert>

        <v-row class="ga-4" v-if="filteredProjects.length">
          <v-col
            v-for="project in paginatedProjects"
            :key="project.id"
            cols="12"
            :sm="viewMode === 'grid' ? 6 : 12"
            :md="viewMode === 'grid' ? 6 : 12"
          >
            <v-card
              :data-project-id="project.id"
              elevation="1"
              rounded="xl"
              class="project-card h-100 d-flex"
              :class="viewMode === 'grid' ? 'flex-column' : 'flex-row'"
            >
              <!-- Обложка -->
              <div 
                class="project-card-image-wrapper d-flex align-center justify-center bg-white flex-shrink-0" 
                :class="viewMode === 'grid' ? 'grid-mode-img' : 'list-mode-img'"
              >
                <v-img
                  v-if="project.cover_image_url"
                  :src="getFullImageUrl(project.cover_image_url) || ''"
                  height="100%"
                  width="100%"
                  contain
                  class="project-cover-img"
                >
                  <template #error>
                    <div class="d-flex align-center justify-center fill-height bg-grey-lighten-4 w-100">
                      <v-icon icon="mdi-image-off" size="48" color="grey-lighten-1" />
                    </div>
                  </template>
                  <template #placeholder>
                    <div class="d-flex align-center justify-center fill-height bg-grey-lighten-4 w-100">
                      <v-icon icon="mdi-image-off" size="48" color="grey-lighten-1" />
                    </div>
                  </template>
                </v-img>
                <div v-else class="d-flex align-center justify-center bg-grey-lighten-4 w-100 fill-height">
                  <v-icon icon="mdi-image-off" size="48" color="grey-lighten-1" />
                </div>
              </div>

              <!-- Тело карточки -->
              <div class="pa-4 d-flex flex-column flex-grow-1" style="min-width: 0;">
                <!-- Тип волонтёрства + статус -->
                <div class="d-flex align-center justify-space-between mb-2">
                  <v-chip size="x-small" color="primary" variant="tonal" class="font-weight-medium">
                    {{ volunteerTypeMap[project.volunteer_type] || project.volunteer_type }}
                  </v-chip>
                  <v-chip
                    :color="statusMap[project.status]?.color || 'primary'"
                    variant="tonal"
                    size="x-small"
                    class="font-weight-medium"
                  >
                    {{ statusMap[project.status]?.text || project.status }}
                  </v-chip>
                </div>

                <!-- Название -->
                <h2 class="text-body-1 font-weight-bold mb-1 card-title-clamp">{{ project.title }}</h2>

                <!-- Город + даты -->
                <div class="text-caption text-medium-emphasis mb-2 d-flex align-center gap-2 flex-wrap">
                  <span v-if="project.city" class="d-flex align-center">
                    <v-icon icon="mdi-map-marker-outline" size="13" class="me-1" />{{ project.city }}
                  </span>
                  <span v-if="project.start_date" class="d-flex align-center">
                    <v-icon icon="mdi-calendar-outline" size="13" class="me-1" />
                    {{ formatDate(project.start_date) }}
                    <template v-if="project.end_date"> — {{ formatDate(project.end_date) }}</template>
                  </span>
                </div>

                <!-- Описание (3 строки) -->
                <p class="text-body-2 project-desc text-medium-emphasis mb-3">
                  {{ project.description }}
                </p>

                <v-spacer />

                <!-- Кнопки действий -->
                <div class="d-flex ga-2 mt-2 flex-wrap">
                  <!-- Подробнее -->
                  <v-btn
                    variant="outlined"
                    color="primary"
                    class="text-none font-weight-bold flex-grow-1"
                    @click="openProjectDialog(project.id)"
                  >
                    <v-icon icon="mdi-information-outline" start size="16" />
                    Подробнее
                  </v-btn>

                  <!-- Присоединиться / Выйти -->
                  <v-btn
                    v-if="!project.joined"
                    color="primary"
                    variant="flat"
                    class="text-none font-weight-bold flex-grow-1"
                    :disabled="loading"
                    @click="handleJoin(project.id)"
                  >
                    Вступить
                  </v-btn>
                  <v-btn
                    v-else
                    color="error"
                    variant="outlined"
                    class="text-none font-weight-bold flex-grow-1"
                    :disabled="loading"
                    @click="handleLeave(project.id)"
                  >
                    Выйти
                  </v-btn>

                  <!-- Чат (только для вступивших) -->
                  <v-btn
                    v-if="project.joined"
                    variant="outlined"
                    color="primary"
                    size="small"
                    class="text-none font-weight-bold"
                    @click="openProjectChat(project.id)"
                  >
                    <v-icon icon="mdi-chat-outline" size="16" />
                    <v-badge v-if="chatUnreadCounts[project.id]" :content="chatUnreadCounts[project.id]" color="error" inline class="ms-1">
                      <template #badge><span>{{ chatUnreadCounts[project.id] }}</span></template>
                    </v-badge>
                  </v-btn>

                  <!-- Задачи (только для вступивших) -->
                  <v-btn
                    v-if="project.joined"
                    variant="outlined"
                    color="primary"
                    size="small"
                    class="text-none font-weight-bold"
                    @click="toggleProjectDetails(project.id)"
                  >
                    <v-icon :icon="expandedProjectId === project.id ? 'mdi-chevron-up' : 'mdi-chevron-down'" size="16" />
                    <v-chip
                      v-if="project.tasks_count > 0"
                      size="x-small"
                      class="ms-1"
                      color="primary"
                      variant="flat"
                    >{{ project.tasks_count }}</v-chip>
                  </v-btn>
                </div>

                <!-- Развернутые задачи -->
                <v-expand-transition>
                  <div v-if="expandedProjectId === project.id && project.joined" class="project-details mt-3 pt-3" style="border-top: 1px solid rgba(0,0,0,0.08);">
                    <div class="text-body-2 font-weight-bold mb-3">Задачи проекта</div>

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
                        class="mb-3 pa-3 task-card"
                      >
                        <div class="d-flex justify-space-between align-start mb-2 flex-wrap ga-2">
                          <div class="flex-grow-1 min-width-0">
                            <div class="text-body-2 font-weight-medium mb-1">{{ task.text }}</div>
                            <div class="d-flex flex-wrap ga-2 text-caption text-medium-emphasis task-info">
                              <span v-if="task.deadline_date" class="d-flex align-center task-info-item">
                                <v-icon icon="mdi-calendar-clock" size="14" class="me-1 flex-shrink-0" />
                                <span>Срок: {{ formatDate(task.deadline_date) }}</span>
                                <span v-if="task.start_time && task.end_time" class="ms-1">
                                  ({{ task.start_time }} - {{ task.end_time }})
                                </span>
                              </span>
                              <span class="d-flex align-center task-info-item">
                                <v-icon icon="mdi-clock-outline" size="14" class="me-1 flex-shrink-0" />
                                <span>Создано: {{ formatDateTime(task.created_at) }}</span>
                              </span>
                            </div>
                          </div>
                          <v-chip
                            :color="taskStatusMap[task.status]?.color || 'primary'"
                            variant="tonal"
                            size="small"
                            class="flex-shrink-0 task-status-chip"
                          >
                            {{ taskStatusMap[task.status]?.text || task.status }}
                          </v-chip>
                        </div>
                        <div class="d-flex justify-end">
                          <v-btn
                            color="primary"
                            variant="outlined"
                            size="small"
                            class="text-none font-weight-bold task-action-btn"
                            :to="{ name: 'volunteer-task-detail', params: { id: task.id } }"
                          >
                            Перейти к задаче
                            <v-icon icon="mdi-arrow-right" end size="16" class="flex-shrink-0" />
                          </v-btn>
                        </div>
                      </v-card>
                    </div>

                    <v-alert
                      v-else
                      type="info"
                      variant="tonal"
                      class="mb-0"
                      density="compact"
                    >
                      В этом проекте нет задач. Следите за обновлениями от организатора.
                    </v-alert>
                  </div>
                </v-expand-transition>
              </div>
            </v-card>
          </v-col>
        </v-row>

        <!-- Пагинация -->
        <div class="d-flex justify-center mt-6 mb-4" v-if="totalPages > 1">
          <v-pagination
            v-model="currentPage"
            :length="totalPages"
            :total-visible="4"
            active-color="primary"
            rounded="circle"
            elevation="2"
          />
        </div>

        <v-skeleton-loader
          v-if="loading"
          type="list-item-three-line@4"
        />
      </v-col>
    </v-row>

    <!-- Диалог подтверждения входа в проект -->
    <v-dialog 
      v-model="joinConfirmDialog" 
      :max-width="$vuetify.display.mobile ? '100%' : '450'"
      :fullscreen="$vuetify.display.mobile"
      persistent
    >
      <v-card rounded="xl" class="pa-4 text-center">
        <v-card-text class="pa-4">
          <div class="mb-4">
            <v-avatar color="primary-lighten-4" size="64">
              <v-icon icon="mdi-handshake-outline" color="primary" size="32" />
            </v-avatar>
          </div>
          <h3 class="text-h6 font-weight-bold mb-2">Присоединиться к проекту?</h3>
          <p class="text-body-2 mb-6 text-medium-emphasis">
            Вы собираетесь стать частью этого проекта. После присоединения все задачи будут обязательными для выполнения.
          </p>
          <div class="d-flex flex-column ga-3">
            <v-btn 
              color="primary" 
              variant="flat" 
              size="large"
              rounded="pill"
              class="font-weight-bold w-100 text-none"
              @click="confirmJoin" 
              :loading="loading"
            >
              Да, присоединиться
            </v-btn>
            <v-btn 
              variant="text" 
              size="large"
              rounded="pill"
              class="font-weight-medium w-100 text-none text-medium-emphasis"
              @click="joinConfirmDialog = false; pendingJoinProjectId = null"
            >
              Отмена
            </v-btn>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- Диалог выхода из проекта с причиной -->
    <v-dialog 
      v-model="leaveReasonDialog" 
      :max-width="$vuetify.display.mobile ? '100%' : '500'" 
      :fullscreen="$vuetify.display.mobile"
      persistent
    >
      <v-card>
        <v-card-title class="d-flex align-center">
          <v-icon icon="mdi-alert" color="warning" class="mr-3" />
          <span class="text-wrap">Выход из проекта</span>
        </v-card-title>
        <v-card-text class="pa-4">
          <p class="text-body-1 mb-4 text-wrap">
            Пожалуйста, укажите причину выхода из проекта:
          </p>
          <v-textarea
            v-model="leaveReason"
            label="Причина выхода"
            placeholder="Например: изменились планы, нет времени, другие обстоятельства..."
            variant="outlined"
            rows="4"
            :rules="[(v) => !!v || 'Необходимо указать причину выхода']"
            auto-grow
            class="mb-4"
            :maxlength="500"
            counter
          />
          <v-alert type="warning" variant="tonal" density="compact" class="text-wrap">
            <div class="text-caption" style="word-wrap: break-word; overflow-wrap: break-word;">
              <strong>Внимание:</strong> За выход из проекта будет начислен штраф -5 Trust Factor.
              Если проект был отменен организатором, штраф не начисляется.
            </div>
          </v-alert>
        </v-card-text>
        <v-card-actions class="pa-4 flex-wrap">
          <v-btn 
            variant="text" 
            @click="leaveReasonDialog = false; pendingLeaveProjectId = null; leaveReason = ''"
            class="flex-grow-1 flex-md-grow-0"
          >
            Отмена
          </v-btn>
          <v-btn 
            color="error" 
            variant="flat" 
            @click="confirmLeave" 
            :loading="loading" 
            :disabled="!leaveReason.trim()"
            class="flex-grow-1 flex-md-grow-0"
          >
            Покинуть проект
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="3500">
      {{ snackbar.message }}
    </v-snackbar>

    <!-- Диалог с деталями проекта -->
    <v-dialog v-model="projectDialog" max-width="800" scrollable :fullscreen="$vuetify.display.mobile">
      <v-card v-if="projectDetail" class="project-detail-card">
        <v-card-title class="project-detail-title d-flex justify-space-between align-center flex-wrap">
          <h2 class="project-detail-title-text">{{ projectDetail.title }}</h2>
          <v-btn icon="mdi-close" variant="text" @click="projectDialog = false" class="project-detail-close-btn" />
        </v-card-title>

        <v-card-text class="project-detail-content">
          <v-skeleton-loader v-if="loadingProject" type="article@3" />

          <div v-else>
            <!-- Обложка проекта -->
            <div class="bg-grey-lighten-5 rounded-xl mb-6 pa-6 d-flex align-center justify-center border" style="min-height: 200px; box-shadow: inset 0 2px 8px rgba(0,0,0,0.02);">
              <v-img
                v-if="projectDetail.cover_image_url"
                :src="getFullImageUrl(projectDetail.cover_image_url) || ''"
                :height="$vuetify.display.mobile ? '160' : '240'"
                class="project-detail-cover"
                contain
                @error="(e) => console.error('Error loading project cover:', e, projectDetail.cover_image_url)"
                @load="() => console.log('Project cover loaded successfully')"
              />
            </div>

            <!-- Описание -->
            <div class="project-detail-section mb-6">
              <h3 class="project-detail-section-title">Описание</h3>
              <p class="project-detail-description">{{ projectDetail.description }}</p>
            </div>

            <v-divider class="project-detail-divider my-6" />

            <!-- Основная информация -->
            <v-row class="project-detail-info mb-6 ga-4">
              <v-col cols="12" md="6">
                <div class="project-detail-info-item mb-3">
                  <v-icon icon="mdi-map-marker" size="20" class="me-2" />
                  <strong>Город:</strong> {{ projectDetail.city || '—' }}
                </div>
                <div class="project-detail-info-item mb-3">
                  <v-icon icon="mdi-calendar" size="20" class="me-2" />
                  <strong>Период:</strong>
                  <template v-if="projectDetail.start_date && projectDetail.end_date">
                    {{ formatDate(projectDetail.start_date) }} - {{ formatDate(projectDetail.end_date) }}
                  </template>
                  <template v-else-if="projectDetail.start_date">
                    С {{ formatDate(projectDetail.start_date) }}
                  </template>
                  <span v-else>—</span>
                </div>
                <div v-if="projectDetail.address" class="project-detail-info-item mb-3">
                  <v-icon icon="mdi-map-marker-outline" size="20" class="me-2" />
                  <strong>Адрес:</strong> {{ projectDetail.address }}
                </div>
              </v-col>
              <v-col cols="12" md="6">
                <div class="project-detail-info-item mb-3">
                  <v-icon icon="mdi-account-group" size="20" class="me-2" />
                  <strong>Участников:</strong> {{ projectDetail.active_members }}
                </div>
                <div class="project-detail-info-item mb-3">
                  <v-icon icon="mdi-clipboard-check" size="20" class="me-2" />
                  <strong>Заданий:</strong> {{ projectDetail.tasks_count }}
                </div>
                <div class="project-detail-info-item mb-3 d-flex align-center flex-wrap ga-2">
                  <v-icon icon="mdi-account-tie" size="20" class="me-2" />
                  <strong>Организатор:</strong>
                  <v-btn
                    variant="text"
                    size="small"
                    color="primary"
                    class="text-none pa-0 project-detail-organizer-btn"
                    style="min-width: auto; text-transform: none;"
                    @click="openOrganizerPortfolio(projectDetail.organizer_id || projectDetail.organizer?.id || projectDetail.organizer_id)"
                  >
                    {{ projectDetail.organizer_name || projectDetail.organizer?.name }}
                    <v-icon icon="mdi-account-circle" size="16" class="ms-1" />
                  </v-btn>
                </div>
              </v-col>
            </v-row>

            <!-- Теги -->
            <div v-if="projectDetail.tags && projectDetail.tags.length" class="project-detail-section mb-6">
              <h3 class="project-detail-section-title">Теги</h3>
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
              class="project-detail-section mb-6"
            >
              <h3 class="project-detail-section-title mb-3">Местоположение</h3>
              <div class="project-map-container mb-3">
                <iframe
                  :src="`https://yandex.ru/map-widget/v1/?ll=${projectDetail.longitude},${projectDetail.latitude}&z=15&pt=${projectDetail.longitude},${projectDetail.latitude}`"
                  width="100%"
                  :height="$vuetify.display.mobile ? '200' : '300'"
                  style="border:0; border-radius: 8px;"
                  allowfullscreen
                  loading="lazy"
                />
              </div>
              <!-- Ссылка на 2ГИС -->
              <div v-if="projectDetail.gis2_url" class="d-flex flex-wrap ga-2">
                <v-btn
                  :href="projectDetail.gis2_url"
                  target="_blank"
                  color="primary"
                  variant="outlined"
                  prepend-icon="mdi-map-marker"
                  size="small"
                  class="text-none"
                >
                  Открыть в 2ГИС
                  <v-icon icon="mdi-open-in-new" size="16" class="ms-1" />
                </v-btn>
                <v-btn
                  href="https://2gis.kz"
                  target="_blank"
                  color="primary"
                  variant="text"
                  prepend-icon="mdi-web"
                  size="small"
                  class="text-none"
                >
                  Сайт 2ГИС
                </v-btn>
              </div>
            </div>

            <!-- Контакты -->
            <div
              v-if="projectDetail.contact_person || projectDetail.contact_phone || projectDetail.contact_email || projectDetail.contact_telegram || projectDetail.info_url || projectDetail.gis2_url"
              class="project-detail-section mb-6"
            >
              <h3 class="project-detail-section-title mb-3">Контакты</h3>
              <v-list density="compact" class="project-detail-contacts pa-0">
                <v-list-item v-if="projectDetail.contact_person" class="px-0">
                  <template #prepend>
                    <v-icon icon="mdi-account-tie" size="20" class="me-2" />
                  </template>
                  <v-list-item-title>{{ projectDetail.contact_person }}</v-list-item-title>
                </v-list-item>
                <v-list-item v-if="projectDetail.contact_phone" class="px-0">
                  <template #prepend>
                    <v-icon icon="mdi-phone" size="20" class="me-2 text-primary" />
                  </template>
                  <v-list-item-title>
                    <a :href="`tel:${projectDetail.contact_phone}`" class="text-primary font-weight-medium text-decoration-none contact-link">
                      {{ projectDetail.contact_phone }}
                    </a>
                  </v-list-item-title>
                </v-list-item>
                <v-list-item v-if="projectDetail.contact_email" class="px-0">
                  <template #prepend>
                    <v-icon icon="mdi-email-outline" size="20" class="me-2 text-primary" />
                  </template>
                  <v-list-item-title>
                    <a :href="`mailto:${projectDetail.contact_email}`" class="text-primary font-weight-medium text-decoration-none contact-link">
                      {{ projectDetail.contact_email }}
                    </a>
                  </v-list-item-title>
                </v-list-item>
                <v-list-item v-if="projectDetail.contact_telegram" class="px-0">
                  <template #prepend>
                    <v-icon icon="mdi-telegram" size="20" class="me-2 text-primary" />
                  </template>
                  <v-list-item-title>
                    <a :href="projectDetail.contact_telegram" target="_blank" class="text-primary font-weight-medium text-decoration-none contact-link">
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
                <v-list-item v-if="projectDetail.gis2_url" class="px-0">
                  <template #prepend>
                    <v-icon icon="mdi-map-marker" size="20" class="me-2" />
                  </template>
                  <v-list-item-title>
                    <a :href="projectDetail.gis2_url" target="_blank" class="text-decoration-none">
                      Открыть в 2ГИС
                      <v-icon icon="mdi-open-in-new" size="14" class="ms-1" />
                    </a>
                  </v-list-item-title>
                </v-list-item>
              </v-list>
            </div>
          </div>
        </v-card-text>

        <v-card-actions class="project-detail-actions flex-wrap ga-2">
          <v-spacer class="d-none d-md-flex" />
          <v-btn
            v-if="!projectDetail.joined"
            color="primary"
            variant="flat"
            class="text-none font-weight-bold project-detail-action-btn"
            :disabled="loading"
            @click="handleJoinFromDialog"
            block
          >
            Присоединиться к проекту
            <v-icon icon="mdi-account-plus" end />
          </v-btn>
          <v-btn
            v-if="projectDetail.joined"
            color="error"
            variant="outlined"
            class="text-none font-weight-bold project-detail-action-btn"
            :disabled="loading"
            @click="handleLeaveFromDialog"
            block
          >
            Выйти из проекта
            <v-icon icon="mdi-exit-to-app" end />
          </v-btn>
          <v-btn
            color="grey"
            variant="text"
            class="text-none project-detail-action-btn"
            @click="projectDialog = false"
            block
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
            <v-avatar 
              color="primary" 
              size="56"
            >
            <v-img
              v-if="organizerPortfolio.portfolio?.portfolio_photo_url"
              :src="getFullImageUrl(organizerPortfolio.portfolio.portfolio_photo_url) || ''"
              cover
              alt="Фото организатора"
              :lazy-src="getFullImageUrl(organizerPortfolio.portfolio.portfolio_photo_url) || ''"
              @error="(e) => {
                console.error('Error loading organizer photo:', e);
                console.error('URL:', getFullImageUrl(organizerPortfolio.portfolio.portfolio_photo_url));
              }"
              @load="() => console.log('Organizer photo loaded successfully')"
            />
              <v-icon v-else icon="mdi-account-tie" color="white" size="32" />
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
            <!-- Фото 3x4 -->
            <div v-if="organizerPortfolio.portfolio?.portfolio_photo_url" class="mb-6 d-flex justify-center">
              <v-avatar
                size="200"
                color="primary"
              >
                <v-img
                  :src="getFullImageUrl(organizerPortfolio.portfolio.portfolio_photo_url) || ''"
                  cover
                  alt="Фото организатора"
                  @error="(e) => console.error('Error loading organizer portfolio photo:', e, organizerPortfolio.portfolio?.portfolio_photo_url, getFullImageUrl(organizerPortfolio.portfolio.portfolio_photo_url))"
                  @load="() => console.log('Organizer portfolio photo loaded successfully')"
                />
              </v-avatar>
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
            </v-row>

            <!-- О себе -->
            <div v-if="organizerPortfolio.portfolio?.bio" class="mb-6">
              <h3 class="text-h6 font-weight-bold mb-2">
                <v-icon icon="mdi-account-circle" size="20" class="me-2" />
                О себе
              </h3>
              <p class="text-body-1" style="word-wrap: break-word; word-break: break-word; overflow-wrap: break-word; white-space: pre-wrap;">{{ organizerPortfolio.portfolio.bio }}</p>
            </div>


            <v-alert
              v-if="!organizerPortfolio.portfolio?.bio && !organizerPortfolio.portfolio?.age && !organizerPortfolio.portfolio?.portfolio_photo_url"
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
    <v-dialog
      v-model="chatDialog"
      :max-width="960"
      :fullscreen="false"
    >
      <div v-if="chatProjectId && currentProject" class="chat-modal">
        <!-- Header -->
        <div class="chat-modal__hd">
          <div class="chat-modal__project">
            <div class="chat-modal__project-ico">
              <v-icon icon="mdi-briefcase-outline" size="20" color="white" />
            </div>
            <div class="chat-modal__project-text">
              <div class="chat-modal__project-name">{{ currentProject.title }}</div>
              <div class="chat-modal__project-sub">{{ currentProject.city || 'Проект' }} · Чат с организатором</div>
          </div>
          </div>
          <button class="chat-modal__close" @click="closeChatDialog">
            <v-icon icon="mdi-close" size="20" />
          </button>
        </div>

        <!-- Body -->
        <div class="chat-modal__body">
          <!-- Chat panel -->
          <div class="chat-panel">
            <!-- Loading state -->
            <div v-if="chatLoading" class="chat-panel__empty">
              <div class="chat-panel__empty-ico">
                <v-icon icon="mdi-chat-processing-outline" size="34" color="white" />
              </div>
              <p class="chat-panel__empty-title">Загрузка чата...</p>
            </div>

            <!-- Chat not started -->
            <div v-else-if="!chat" class="chat-panel__empty">
              <div class="chat-panel__empty-ico">
                <v-icon icon="mdi-chat-processing-outline" size="34" color="white" />
              </div>
              <p class="chat-panel__empty-title">Чат не открыт</p>
              <p class="chat-panel__empty-sub">Загрузка чата...</p>
            </div>
            
            <template v-else>
              <!-- Messages -->
              <div ref="chatScrollRef" class="messages">
                <div v-if="!chatMessages.length" class="messages__empty">
                  <v-icon icon="mdi-chat-outline" size="40" color="grey-lighten-2" class="mb-3" />
                  <p>Начните общение с организатором</p>
              </div>
                <div v-else class="messages__list">
                <div
                    v-for="msg in chatMessages"
                    :key="msg.id"
                    class="msg"
                    :class="msg.sender_id === currentUser?.id ? 'msg--own' : 'msg--other'"
                  >
                    <div v-if="msg.sender_id !== currentUser?.id" class="msg__av">
                      {{ getUserInitials(msg.sender_name || '?') }}
                      </div>
                    <div class="msg__body">
                      <div class="msg__meta">
                        <span v-if="msg.sender_id !== currentUser?.id" class="msg__sender">{{ msg.sender_name }}</span>
                        <span v-if="msg.sender_is_organizer" class="msg__org">Орг.</span>
                        <span class="msg__time">
                          {{ new Date(msg.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) }}
                        </span>
                    </div>
                      <div class="msg__bubble">{{ msg.text }}</div>
                  </div>
                </div>
          </div>
        </div>

              <!-- Input -->
              <div class="chat-input">
              <v-textarea
                v-model="newMessageText"
                  placeholder="Написать команде..."
                variant="outlined"
                rows="1"
                auto-grow
                hide-details
                  density="comfortable"
                  class="chat-input__field"
                @keydown.enter.exact.prevent="handleSendMessage"
              />
                <button
                  class="send-btn"
                :disabled="!newMessageText.trim() || sendingMessage"
                @click="handleSendMessage"
                >
                  <v-icon icon="mdi-send" size="20" />
                </button>
            </div>
            </template>
          </div>
        </div>
      </div>
    </v-dialog>
  </div>
</template>

<style scoped>
.projects-page {
  /* Block container */
}

/* Hide mobile filter button on desktop */
@media (min-width: 960px) {
  .filter-mobile-btn {
    display: none !important;
  }
}

/* Mobile tweaks */
@media (max-width: 599px) {
  .page-header {
    flex-direction: row;
    align-items: flex-start;
    gap: 8px;
  }
}

/* ═══════════════════════════════════════════
   PAGE HEADER
═══════════════════════════════════════════ */
.page-header {
  min-height: 56px;
}

/* ═══════════════════════════════════════════
   SIDEBAR
═══════════════════════════════════════════ */
.sidebar {
  position: sticky;
  top: 80px;
  background: #fff;
  border-radius: 16px;
  border: 1px solid rgba(0, 0, 0, 0.07);
  padding: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  /* Must be visible so v-expand-transition works */
  overflow: visible;
  max-height: calc(100vh - 100px);
  overflow-y: auto;
}

.sidebar-section {
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  padding: 12px 0;
}

.sidebar-section:first-child {
  padding-top: 0;
}

.sidebar-section:last-of-type {
  border-bottom: none;
  padding-bottom: 4px;
}

.sidebar-label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(0, 0, 0, 0.38);
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* ═══════════════════════════════════════════
   MOBILE FILTER BOTTOM SHEET
═══════════════════════════════════════════ */
.filter-mobile-btn {
  flex-shrink: 0;
}

/* Align dialog to bottom of screen */
:deep(.filter-dialog-mobile) {
  align-self: flex-end !important;
  margin: 0 !important;
  max-width: 100% !important;
  width: 100% !important;
}

.filter-bottom-sheet {
  /* Scoped inner styles - see inline style */
}

/* Scrollbar for mobile filter sheet */
.filter-bottom-sheet .overflow-y-auto::-webkit-scrollbar {
  width: 4px;
}

.filter-bottom-sheet .overflow-y-auto::-webkit-scrollbar-thumb {
  background: rgba(76, 175, 80, 0.3);
  border-radius: 2px;
}


.project-card {
  transition: all 0.3s ease;
  border: 1px solid rgba(0,0,0,0.05);
}

.project-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(76, 175, 80, 0.12) !important;
}

.project-card-image-wrapper {
  background-color: #f8f9fa;
  border-bottom: 1px solid rgba(0,0,0,0.05);
}

.project-cover-img {
  /* No padding - contain mode shows full image */
  border-radius: 0;
}

.project-desc {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  min-height: 54px; /* ~3 lines */
}

.card-title-clamp {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  min-height: 44px;
}

.gap-2 {
  gap: 8px;
}


/* tags-scroll-container removed — replaced by sidebar checkboxes */


.gradient-card {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.95));
  backdrop-filter: blur(8px);
  border: 1px solid rgba(76, 175, 80, 0.1);
  transition: all 0.3s ease;
}

.gradient-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(76, 175, 80, 0.15) !important;
}

.stats-card {
  background: linear-gradient(135deg, rgba(76, 175, 80, 0.05), rgba(139, 195, 74, 0.08));
}

.filter-card {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.95));
}

.search-field {
  transition: all 0.3s ease;
}

.search-field:hover {
  transform: translateY(-1px);
}

.clear-btn {
  transition: all 0.3s ease;
}

.clear-btn:hover {
  transform: scale(1.05);
}

.result-chip {
  font-weight: 600;
  font-size: 14px;
}

.tags-card {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.95));
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

.contact-link {
  transition: all 0.2s ease;
  position: relative;
}

.contact-link:hover {
  text-decoration: underline !important;
  opacity: 0.8;
}

/* ════════════════════════════════════
   MESSAGE NOTIFICATION BANNER
   ════════════════════════════════════ */
.message-notification-banner {
  background: linear-gradient(135deg, rgba(139, 195, 74, 0.1), rgba(139, 195, 74, 0.05));
  border: 1px solid rgba(139, 195, 74, 0.2);
  animation: slideInDown 0.3s ease-out;
}

@keyframes slideInDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
}
}

/* ════════════════════════════════════
   CHAT MODAL
════════════════════════════════════ */
.chat-modal {
  background: #fff;
  border-radius: 20px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: 80vh;
  max-height: 720px;
}

/* ── Header ── */
.chat-modal__hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  background: linear-gradient(135deg, #2d5a1b, #4a8f2a);
  flex-shrink: 0;
}

.chat-modal__project { display: flex; align-items: center; gap: 12px; min-width: 0; }

.chat-modal__project-ico {
  width: 38px; height: 38px;
  border-radius: 10px;
  background: rgba(255,255,255,0.2);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}

.chat-modal__project-text { min-width: 0; }
.chat-modal__project-name { font-size: 0.975rem; font-weight: 800; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.chat-modal__project-sub  { font-size: 0.74rem; color: rgba(255,255,255,0.62); margin-top: 1px; }

.chat-modal__close {
  width: 32px; height: 32px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.2);
  background: transparent;
  color: rgba(255,255,255,0.85);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s;
  margin-left: 8px;
}
.chat-modal__close:hover { background: rgba(255,255,255,0.15); }

/* ── Body ── */
.chat-modal__body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* ── Chat panel ── */
.chat-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #f8f9fa;
}

.chat-panel__empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-align: center;
  padding: 32px 24px;
}

.chat-panel__empty-ico {
  width: 64px; height: 64px;
  border-radius: 50%;
  background: linear-gradient(135deg, #8bc34a, #3a7422);
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 6px;
}

.chat-panel__empty-title { font-size: 1rem; font-weight: 700; color: #1a1a1a; margin: 0; }
.chat-panel__empty-sub   { font-size: 0.825rem; color: rgba(0,0,0,0.45); margin: 0 0 12px; max-width: 240px; }

/* Messages */
.messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
}

.messages__empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: rgba(0,0,0,0.3);
  font-size: 0.875rem;
}

.messages__list { display: flex; flex-direction: column; gap: 12px; }

/* Bubbles */
.msg { display: flex; align-items: flex-end; gap: 8px; }
.msg--own { flex-direction: row-reverse; }

.msg__av {
  width: 28px; height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #8bc34a, #558b2f);
  color: white;
  font-size: 0.65rem;
  font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}

.msg__body { max-width: 65%; display: flex; flex-direction: column; gap: 3px; }
.msg--own   .msg__body { align-items: flex-end; }
.msg--other .msg__body { align-items: flex-start; }

.msg__meta { display: flex; align-items: center; gap: 5px; font-size: 0.72rem; color: rgba(0,0,0,0.38); }
.msg__sender { font-weight: 600; color: rgba(0,0,0,0.55); }
.msg__org    { background: rgba(139,195,74,0.15); color: #558b2f; padding: 1px 5px; border-radius: 4px; font-size: 0.67rem; font-weight: 700; }
  
.msg__bubble {
  padding: 9px 13px;
  border-radius: 16px;
  font-size: 0.875rem;
  line-height: 1.45;
  word-break: break-word;
  }
  
.msg--other .msg__bubble {
  background: #fff;
  color: #1a1a1a;
  border-bottom-left-radius: 4px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  }
  
.msg--own .msg__bubble {
  background: linear-gradient(135deg, #8bc34a, #558b2f);
  color: #fff;
  border-bottom-right-radius: 4px;
}

/* Chat input */
.chat-input {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 10px 14px;
  background: #fff;
  border-top: 1px solid rgba(0,0,0,0.07);
  flex-shrink: 0;
  }
  
.chat-input__field { flex: 1; }
  
.send-btn {
  width: 42px; height: 42px;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg, #8bc34a, #558b2f);
  color: white;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  transition: opacity 0.15s, transform 0.15s;
}
.send-btn:hover:not(:disabled) { opacity: 0.9; transform: scale(1.05); }
.send-btn:disabled             { opacity: 0.45; cursor: not-allowed; }

/* ════════════════════════════════════
   MOBILE & TABLET  (≤ 720px)
════════════════════════════════════ */
@media (max-width: 720px) {
  .chat-modal {
    border-radius: 0;
    height: 100dvh;
    max-height: 100dvh;
  }
  
  .msg__body { max-width: 82%; }
  
  .send-btn              { width: 40px; height: 40px; border-radius: 10px; }
  .chat-input            { padding: 8px 12px; }
  
  .message-notification-banner {
    margin-bottom: 16px;
    border-radius: 16px;
  }
  
  .message-notification-banner .d-flex {
    flex-direction: column;
    align-items: flex-start !important;
  }
  
  .message-notification-banner .v-btn {
    width: 100%;
    margin-top: 8px;
  }
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

.task-info {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.task-info-item {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
  flex-shrink: 0;
}

.task-info-item .v-icon {
  flex-shrink: 0;
  min-width: 16px;
}

.task-status-chip {
  flex-shrink: 0;
  white-space: nowrap;
}

/* Мобильная адаптация карточек задач */
@media (max-width: 600px) {
  .task-card {
    padding: 12px !important;
  }
  
  .task-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }
  
  .task-info-item {
    width: 100%;
    white-space: normal;
  }
  
  .task-info-item span {
    word-break: break-word;
  }
  
  .task-status-chip {
    margin-left: 0 !important;
    margin-top: 8px;
    align-self: flex-start;
  }
  
  .task-action-btn {
    width: 100%;
    justify-content: center;
  }
  
  .task-action-btn :deep(.v-icon) {
    flex-shrink: 0;
    margin-left: 4px;
  }
}

.project-map-container {
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* Стили для диалога деталей проекта */
.project-detail-card {
  padding: 24px;
}

.project-detail-title {
  padding: 0 0 16px 0 !important;
  margin-bottom: 16px;
}

.project-detail-title-text {
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.3;
  flex: 1;
  min-width: 0;
  word-break: break-word;
}

.project-detail-close-btn {
  flex-shrink: 0;
  margin-left: 12px;
}

.project-detail-content {
  padding: 0 !important;
}

.project-detail-cover {
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
}

.project-detail-section {
  margin-bottom: 24px;
}

.project-detail-section-title {
  font-size: 1.125rem;
  font-weight: 700;
  margin-bottom: 8px;
  color: #1a1a1a;
}

.project-detail-description {
  font-size: 0.9375rem;
  line-height: 1.6;
  color: rgba(0, 0, 0, 0.7);
  margin: 0;
}

.project-detail-divider {
  margin: 24px 0;
  opacity: 0.12;
}

.project-detail-info {
  margin-bottom: 24px;
}

.project-detail-info-item {
  display: flex;
  align-items: flex-start;
  font-size: 0.9375rem;
  line-height: 1.5;
  color: rgba(0, 0, 0, 0.7);
}

.project-detail-info-item strong {
  color: #1a1a1a;
  font-weight: 600;
  margin-right: 4px;
}

.project-detail-organizer-btn {
  margin-left: 4px;
}

.project-detail-contacts {
  background: transparent;
}

.project-detail-contacts :deep(.v-list-item) {
  padding: 8px 0;
  min-height: 40px;
}

.project-detail-contacts :deep(.v-list-item-title) {
  font-size: 0.9375rem;
  line-height: 1.5;
}

.project-detail-actions {
  padding: 16px 0 0 0 !important;
  margin-top: 24px;
  border-top: 1px solid rgba(0, 0, 0, 0.12);
}

.project-detail-action-btn {
  margin: 0;
}

/* Мобильная адаптация диалога */
@media (max-width: 960px) {
  .projects-page :deep(.v-dialog > .v-card) {
    margin: 0;
    border-radius: 0;
  }
  
  .project-detail-card {
    padding: 16px;
  }
  
  .project-detail-title {
    padding: 0 0 12px 0 !important;
    margin-bottom: 12px;
  }
  
  .project-detail-title-text {
    font-size: 1.25rem;
  }
  
  .project-detail-content {
    padding: 0 !important;
  }
  
  .project-detail-section {
    margin-bottom: 20px;
  }
  
  .project-detail-section-title {
    font-size: 1rem;
    margin-bottom: 6px;
  }
  
  .project-detail-description {
    font-size: 0.875rem;
    line-height: 1.5;
  }
  
  .project-detail-divider {
    margin: 20px 0;
  }
  
  .project-detail-info {
    margin-bottom: 20px;
  }
  
  .project-detail-info-item {
    font-size: 0.875rem;
    margin-bottom: 12px;
  }
  
  .project-detail-info-item :deep(.v-icon) {
    font-size: 18px !important;
    width: 18px !important;
    height: 18px !important;
    margin-right: 6px;
  }
  
  .project-detail-actions {
    padding: 12px 0 0 0 !important;
    margin-top: 20px;
    flex-direction: column;
    gap: 8px;
  }
  
  .project-detail-action-btn {
    width: 100%;
    margin: 0;
  }
  
  .project-detail-contacts :deep(.v-list-item) {
    padding: 10px 0;
    min-height: 44px;
  }
  
  .project-detail-contacts :deep(.v-list-item-title) {
    font-size: 0.875rem;
  }
  
  .project-detail-contacts :deep(.v-icon) {
    font-size: 18px !important;
    width: 18px !important;
    height: 18px !important;
    margin-right: 8px;
  }
}

@media (max-width: 600px) {
  .project-detail-card {
    padding: 12px;
  }
  
  .project-detail-title-text {
    font-size: 1.125rem;
  }
  
  .project-detail-cover {
    margin-bottom: 16px !important;
    border-radius: 8px;
  }
  
  .project-detail-section {
    margin-bottom: 16px;
  }
  
  .project-detail-section-title {
    font-size: 0.9375rem;
  }
  
  .project-detail-description {
    font-size: 0.8125rem;
  }
  
  .project-detail-info-item {
    font-size: 0.8125rem;
    margin-bottom: 10px;
  }
  
  .project-detail-actions {
    padding: 12px 0 0 0 !important;
    gap: 6px;
  }
}

.cursor-pointer {
  cursor: pointer;
  transition: all 0.2s ease;
}

.cursor-pointer:hover {
  transform: scale(1.05);
}

/* Улучшенные стили для фильтров */
.tags-filter-card {
  background: white;
}

.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-width: 100%;
  width: 100%;
}

.tag-chip {
  transition: all 0.2s ease;
  font-size: 12px;
  height: 24px;
  margin: 0 !important;
  flex-shrink: 0;
}

.tag-chip:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(76, 175, 80, 0.2);
}

.stats-card {
  transition: all 0.3s ease;
}

.stats-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.15);
}

/* Адаптация кнопок действий проекта для мобильных */
@media (max-width: 960px) {
  .project-actions {
    width: 100%;
  }
  
  .project-action-btn {
    flex: 1 1 auto;
    min-width: 0;
    font-size: 0.875rem !important;
  }
  
  .project-action-btn :deep(.v-btn__content) {
    font-size: 0.875rem;
    white-space: nowrap;
    overflow: visible;
    text-overflow: ellipsis;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  
  .project-action-btn :deep(.v-icon) {
    font-size: 20px !important;
    width: 20px !important;
    height: 20px !important;
    min-width: 20px !important;
    flex-shrink: 0 !important;
    display: inline-flex !important;
  }
  
  .tasks-btn :deep(.v-btn__content) {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: nowrap;
  }
  
  .tasks-btn-text {
    flex-shrink: 1;
    min-width: 0;
    white-space: nowrap;
  }
  
  .tasks-count-chip {
    flex-shrink: 0;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    font-size: 11px;
    line-height: 20px;
  }
  
  .tasks-count-chip :deep(.v-chip__content) {
    padding: 0;
    min-width: auto;
  }
}

@media (max-width: 600px) {
  .project-action-btn {
    flex: 1 1 100%;
    width: 100%;
    margin-bottom: 8px;
    padding: 12px 16px !important;
  }
  
  .project-action-btn:last-child {
    margin-bottom: 0;
  }
  
  .project-action-btn :deep(.v-btn__content) {
    justify-content: flex-start;
    gap: 8px;
  }
  
  .project-action-btn :deep(.v-icon) {
    font-size: 22px !important;
    width: 22px !important;
    height: 22px !important;
    min-width: 22px !important;
    margin-right: 4px !important;
  }
  
  .tasks-btn :deep(.v-btn__content) {
    justify-content: flex-start;
    gap: 6px;
    flex-wrap: nowrap;
  }
  
  .tasks-count-chip {
    margin-left: 4px !important;
    flex-shrink: 0;
  }
  
  .project-join-section {
    flex-direction: column;
    align-items: stretch;
  }
  
  .project-status-text {
    width: 100%;
    margin-bottom: 8px;
    text-align: center;
  }
  
  .project-join-btn {
    width: 100%;
  }
}

/* View Mode Toggle */
.grid-mode-img {
  height: 170px;
  width: 100%;
  border-radius: 12px 12px 0 0;
}
.list-mode-img {
  height: 100%;
  min-height: 120px;
  width: 120px;
  border-radius: 12px 0 0 12px;
  border-right: 1px solid rgba(0,0,0,0.05);
  border-bottom: none;
}
@media (min-width: 600px) {
  .list-mode-img {
    min-height: 200px;
    width: 250px;
  }
}
</style>

