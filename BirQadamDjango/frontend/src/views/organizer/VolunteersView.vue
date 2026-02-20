<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';

import { useOrganizerStore } from '@/stores/organizer';
import { useAuthStore } from '@/stores/auth';
import { getProjectChat, getChatMessages, sendMessage, markMessagesRead, type Chat, type ChatMessage } from '@/services/chat';

const organizerStore = useOrganizerStore();
const authStore = useAuthStore();

const isOrganizer = computed(() => organizerStore.isOrganizer);
const isApproved = computed(() => organizerStore.isApproved);
const currentUser = computed(() => authStore.user);

const projects = computed(() => organizerStore.projects);
const selectedProjectId = ref<number | null>(projects.value[0]?.id ?? null);

// Pagination for projects
const projectsPerPage = ref(5);
const currentProjectsPage = ref(1);

const paginatedProjects = computed(() => {
  const start = (currentProjectsPage.value - 1) * projectsPerPage.value;
  const end = start + projectsPerPage.value;
  return projects.value.slice(start, end);
});

const totalProjectsPages = computed(() => {
  return Math.ceil(projects.value.length / projectsPerPage.value);
});

function goToProjectsPage(page: number) {
  if (page >= 1 && page <= totalProjectsPages.value) {
    currentProjectsPage.value = page;
  }
}

watch(() => organizerStore.projects, (list) => {
  if (!list.length) { 
    selectedProjectId.value = null;
    currentProjectsPage.value = 1;
    return; 
  }
  if (!selectedProjectId.value || !list.some(p => p.id === selectedProjectId.value)) {
    selectedProjectId.value = list[0].id;
  }
  // Reset to first page when projects list changes
  currentProjectsPage.value = 1;
}, { immediate: true });

watch(selectedProjectId, (projectId) => {
  if (projectId) organizerStore.loadParticipants(projectId);
});

const currentProject = computed(() => projects.value.find(p => p.id === selectedProjectId.value) ?? null);

const participants = computed(() =>
  chatProjectId.value ? organizerStore.participantsByProject[chatProjectId.value] ?? [] : [],
);
const participantsLoading = computed(() =>
  chatProjectId.value ? organizerStore.participantsLoading[chatProjectId.value] ?? false : false,
);
const participantsError = computed(() =>
  selectedProjectId.value ? organizerStore.participantsError[selectedProjectId.value] ?? null : null,
);
const totalVolunteers = computed(() =>
  projects.value.reduce((acc, p) => acc + (p.volunteer_count ?? 0), 0),
);

const participantHeaders = [
  { title: 'Волонтёр', key: 'name', sortable: true },
  { title: 'Email', key: 'email', sortable: false },
  { title: 'Рейтинг', key: 'rating', sortable: true },
  { title: 'В проекте с', key: 'joined_at', sortable: true },
  { title: 'Задачи', key: 'tasks', sortable: false },
];

const dateFormatter = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  return dateFormatter.format(new Date(value));
}

function formatStatus(status: string) {
  const map: Record<string, string> = { pending: 'На модерации', approved: 'Активен', rejected: 'Отклонён' };
  return map[status] || status;
}

function statusColor(status: string) {
  const map: Record<string, string> = { approved: 'success', pending: 'deep-orange', rejected: 'error' };
  return map[status] || 'primary';
}

function getUserInitials(name: string) {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ─── Modal tab (mobile) ───
const modalTab = ref<'participants' | 'chat'>('participants');

async function openProjectDialog(projectId: number) {
  selectedProjectId.value = projectId;
  if (!organizerStore.participantsByProject[projectId]) {
    await organizerStore.loadParticipants(projectId);
  }
  chatProjectId.value = projectId;
  chatDialog.value = true;
  chat.value = null;
  chatMessages.value = [];
  newMessageText.value = '';
  modalTab.value = 'participants';
}

async function startChat() {
  if (!chatProjectId.value) return;
  const projectId = chatProjectId.value;
  chatLoading.value = true;
  try {
    if (!organizerStore.participantsByProject[projectId]) {
      await organizerStore.loadParticipants(projectId);
    }
    chat.value = await getProjectChat(projectId);
    await loadChatMessages();
    if (chat.value.unread_count > 0) {
      await markMessagesRead(chat.value.id);
      chat.value.unread_count = 0;
      chatUnreadCounts.value[projectId] = 0;
    }
    startMessagesPolling();
    modalTab.value = 'chat';
    scrollToBottom();
  } catch (error: any) {
    console.error('Failed to load chat:', error);
  } finally {
    chatLoading.value = false;
  }
}

const refreshing = ref(false);

async function refreshParticipants() {
  if (!selectedProjectId.value || refreshing.value) return;
  refreshing.value = true;
  try {
    await organizerStore.loadProjects(true);
    await organizerStore.loadParticipants(selectedProjectId.value, true);
    await loadUnreadCounts();
  } catch (error) {
    console.error('Ошибка при обновлении данных:', error);
  } finally {
    refreshing.value = false;
  }
}

// ─── Chat ───
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

function scrollToBottom() {
  setTimeout(() => {
    if (chatScrollRef.value) chatScrollRef.value.scrollTop = chatScrollRef.value.scrollHeight;
  }, 50);
}

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
    if (!organizerStore.participantsByProject[projectId]) {
      await organizerStore.loadParticipants(projectId);
    }
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
            (msg: ChatMessage) => !msg.is_read && msg.sender_id !== currentUser.value?.id,
          );
          if (hasUnread && chat.value) {
            await markMessagesRead(chat.value.id);
            chat.value.unread_count = 0;
          }
          scrollToBottom();
        }
      } catch { /* ignore */ }
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
      // Ищем первый проект с непрочитанными сообщениями (только первые 5 проектов для оптимизации)
      const projectsToCheck = projects.value.slice(0, 5);
      for (const project of projectsToCheck) {
        try {
          const projectChat = await getProjectChat(project.id);
          if (projectChat.unread_count > 0) {
            chatUnreadCounts.value[project.id] = projectChat.unread_count;
            
            // Показываем баннер уведомления, если чат не открыт
            if (!chatDialog.value || chatProjectId.value !== project.id) {
              messageNotification.show = true;
              messageNotification.projectId = project.id;
              messageNotification.projectTitle = project.title;
              messageNotification.unreadCount = projectChat.unread_count;
              break; // Показываем только одно уведомление
            }
          }
        } catch (error) {
          // Игнорируем ошибки (включая 429)
          if (error && typeof error === 'object' && 'response' in error) {
            const axiosError = error as any;
            if (axiosError.response?.status === 429) {
              console.warn('[BANNER] Rate limit reached, skipping check');
              break; // Прерываем проверку при 429
            }
          }
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
  if (!organizerStore.projects.length) return;
  
  // Сбрасываем баннер перед проверкой
  messageNotification.show = false;
  
  for (const project of organizerStore.projects) {
    try {
      const projectChat = await getProjectChat(project.id);
      if (projectChat.unread_count > 0) {
        chatUnreadCounts.value[project.id] = projectChat.unread_count;
        
        // Показываем баннер уведомления только для первого проекта с непрочитанными сообщениями
        if (!messageNotification.show && (!chatDialog.value || chatProjectId.value !== project.id)) {
          messageNotification.show = true;
          messageNotification.projectId = project.id;
          messageNotification.projectTitle = project.title;
          messageNotification.unreadCount = projectChat.unread_count;
          break; // Показываем только одно уведомление
        }
      }
    } catch { /* ignore */ }
  }
}

onMounted(async () => {
  if (!organizerStore.isOrganizer) return;
  await organizerStore.loadProjects(true);
  await loadUnreadCounts();
});

onUnmounted(() => { stopMessagesPolling(); });
</script>

<template>
  <div class="volunteers-view">

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

    <!-- ─── Page Header ─── -->
    <div class="page-header">
      <div class="page-header__left">
        <h1 class="page-title">Команда</h1>
        <p class="page-subtitle">Управляйте волонтёрами и ведите переписку</p>
      </div>
      <div class="total-badge">
        <v-icon icon="mdi-account-group-outline" size="18" />
        <span>{{ totalVolunteers }} волонтёров</span>
      </div>
    </div>

    <!-- ─── Alerts ─── -->
    <v-alert v-if="!isOrganizer" type="error" variant="tonal" rounded="xl" border="start" icon="mdi-shield-alert-outline">
      Управление командой доступно только организаторам проектов.
    </v-alert>
    <v-alert v-else-if="!isApproved" type="info" variant="tonal" rounded="xl" border="start" icon="mdi-clock-outline">
      После одобрения заявки вы сможете управлять командой.
    </v-alert>

    <!-- ─── Main layout ─── -->
    <div v-else class="main-layout">

      <!-- Projects sidebar -->
      <div class="projects-col">
        <div class="section-card">
          <div class="section-card__head">
            <h2 class="section-card__title">Проекты</h2>
          </div>

          <div v-if="!projects.length" class="empty-state">
            <v-icon icon="mdi-folder-open-outline" size="36" color="primary" class="mb-2" />
            <p class="empty-state__text">Сначала создайте проект, чтобы управлять командой.</p>
          </div>

          <div v-else>
            <div class="projects-list">
              <div
                v-for="project in paginatedProjects"
                :key="project.id"
                class="project-item"
                :class="{ 'project-item--active': project.id === selectedProjectId }"
                @click="openProjectDialog(project.id)"
              >
                <div class="project-item__avatar">
                  <v-icon icon="mdi-briefcase-outline" size="18" />
                </div>
                <div class="project-item__content">
                  <div class="project-item__top">
                    <span class="project-item__name">{{ project.title }}</span>
                    <v-chip :color="statusColor(project.status)" size="x-small" variant="tonal" class="text-none project-item__status">
                      {{ formatStatus(project.status) }}
                    </v-chip>
                  </div>
                  <div class="project-item__meta">
                    <span><v-icon icon="mdi-map-marker-outline" size="12" />{{ project.city }}</span>
                    <span><v-icon icon="mdi-account-multiple-outline" size="12" />{{ project.volunteer_count }}</span>
                    <span><v-icon icon="mdi-clipboard-check-outline" size="12" />{{ project.task_count }}</span>
                  </div>
                </div>
                <button class="project-item__chat-btn" @click.stop="openProjectChat(project.id)">
                  <v-icon icon="mdi-chat-outline" size="18" />
                  <span v-if="chatUnreadCounts[project.id]" class="chat-badge">{{ chatUnreadCounts[project.id] }}</span>
                </button>
              </div>
            </div>
            
            <!-- Pagination -->
            <div v-if="totalProjectsPages > 1" class="projects-pagination">
              <button
                class="pagination-btn"
                :disabled="currentProjectsPage === 1"
                @click="goToProjectsPage(currentProjectsPage - 1)"
              >
                <v-icon icon="mdi-chevron-left" size="18" />
              </button>
              <div class="pagination-info">
                <span class="pagination-text">{{ currentProjectsPage }} / {{ totalProjectsPages }}</span>
              </div>
              <button
                class="pagination-btn"
                :disabled="currentProjectsPage === totalProjectsPages"
                @click="goToProjectsPage(currentProjectsPage + 1)"
              >
                <v-icon icon="mdi-chevron-right" size="18" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Participants table -->
      <div class="participants-col">
        <div class="section-card section-card--grow">
          <div class="section-card__head">
            <div>
              <h2 class="section-card__title">{{ currentProject ? currentProject.title : 'Участники' }}</h2>
              <p class="section-card__subtitle">Данные синхронизируются с Telegram-ботом</p>
            </div>
            <button
              class="refresh-btn"
              :disabled="!selectedProjectId || participantsLoading || refreshing"
              @click="refreshParticipants"
            >
              <v-icon
                :icon="(participantsLoading || refreshing) ? 'mdi-loading' : 'mdi-refresh'"
                size="18"
                :class="{ spin: participantsLoading || refreshing }"
              />
            </button>
          </div>

          <div v-if="!selectedProjectId" class="empty-state">
            <v-icon icon="mdi-cursor-pointer" size="40" color="primary" class="mb-3" />
            <p class="empty-state__text">Выберите проект слева</p>
          </div>
          <v-alert v-else-if="participantsError" type="error" variant="tonal" rounded="lg" border="start">
            {{ participantsError }}
          </v-alert>
          <div v-else-if="participantsLoading && !participants.length" class="loading-list">
            <v-skeleton-loader v-for="i in 4" :key="i" type="list-item-avatar-two-line" class="mb-2" />
          </div>
          <div v-else-if="!participants.length" class="empty-state">
            <v-icon icon="mdi-account-off-outline" size="40" color="primary" class="mb-3" />
            <p class="empty-state__text">Волонтёров пока нет</p>
            <p class="empty-state__sub">Пригласите участников через Telegram-бота</p>
          </div>

          <v-data-table
            v-else
            :items="participants"
            :headers="participantHeaders"
            density="comfortable"
            class="participants-table"
            :items-per-page="8"
          >
            <template #item.name="{ item }">
              <div class="d-flex align-center gap-3">
                <div class="p-avatar">{{ getUserInitials(item.name) }}</div>
                <div>
                  <div class="p-name">{{ item.name }}</div>
                  <div class="p-id">ID {{ item.id }}</div>
                </div>
              </div>
            </template>
            <template #item.email="{ item }">
              <span class="p-email">{{ item.email || '—' }}</span>
            </template>
            <template #item.rating="{ item }">
              <div class="d-flex align-center gap-1">
                <v-icon icon="mdi-star" size="15" color="amber-darken-1" />
                <span class="p-rating">{{ item.rating }}</span>
              </div>
            </template>
            <template #item.joined_at="{ item }">
              <span class="p-date">{{ formatDate(item.joined_at) }}</span>
            </template>
            <template #item.tasks="{ item }">
              <div class="d-flex align-center gap-2">
                <div class="task-bar">
                  <div class="task-bar__fill" :style="{ width: item.total_tasks ? `${(item.completed_tasks / item.total_tasks) * 100}%` : '0%' }" />
                </div>
                <span class="p-tasks">{{ item.completed_tasks }}/{{ item.total_tasks }}</span>
              </div>
            </template>
          </v-data-table>
        </div>
      </div>
    </div>

    <!-- ─── Chat / Participants Dialog ─── -->
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
              <div class="chat-modal__project-sub">{{ currentProject.city }} · {{ participants.length }} участников</div>
            </div>
          </div>
          <button class="chat-modal__close" @click="closeChatDialog">
            <v-icon icon="mdi-close" size="20" />
          </button>
        </div>

        <!-- ── Mobile tabs (hidden on desktop via CSS) ── -->
        <div class="modal-tabs">
          <button
            class="modal-tab"
            :class="{ 'modal-tab--active': modalTab === 'participants' }"
            @click="modalTab = 'participants'"
          >
            <v-icon icon="mdi-account-group-outline" size="16" />
            Участники
            <span class="modal-tab__count">{{ participants.length }}</span>
          </button>
          <button
            class="modal-tab"
            :class="{ 'modal-tab--active': modalTab === 'chat' }"
            @click="chat ? (modalTab = 'chat') : startChat()"
          >
            <v-icon icon="mdi-chat-outline" size="16" />
            Чат
            <span v-if="!chat" class="modal-tab__pill">Открыть</span>
            <span v-if="chat" class="modal-tab__dot" />
          </button>
        </div>

        <!-- Body -->
        <div class="chat-modal__body">

          <!-- Participants panel -->
          <div
            class="participants-panel"
            :class="{ 'panel--mobile-hidden': modalTab === 'chat' }"
          >
            <div class="participants-panel__hd">
              <span>Участники</span>
              <button v-if="!chat" class="open-chat-btn" :disabled="chatLoading" @click="startChat">
                <v-icon icon="mdi-chat-outline" size="14" />
                {{ chatLoading ? '...' : 'Открыть чат' }}
              </button>
            </div>
            <div class="participants-panel__list">
              <div v-if="participantsLoading" class="pa-3">
                <v-skeleton-loader v-for="i in 3" :key="i" type="list-item-avatar" class="mb-1" />
              </div>
              <div v-else-if="!participants.length" class="panel-empty">
                <v-icon icon="mdi-account-off-outline" size="30" />
                <span>Нет участников</span>
              </div>
              <div v-else>
                <div v-for="p in participants" :key="p.id" class="p-row">
                  <div class="p-row__av">{{ getUserInitials(p.name) }}</div>
                  <div class="p-row__info">
                    <div class="p-row__name">{{ p.name }}</div>
                    <div class="p-row__meta">
                      <span><v-icon icon="mdi-star" size="11" color="amber-darken-1" />{{ p.rating }}</span>
                      <span>{{ p.completed_tasks }}/{{ p.total_tasks }} задач</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Chat panel -->
          <div
            class="chat-panel"
            :class="{ 'panel--mobile-hidden': modalTab === 'participants' }"
          >
            <!-- Not started -->
            <div v-if="!chat" class="chat-panel__empty">
              <div class="chat-panel__empty-ico">
                <v-icon icon="mdi-chat-processing-outline" size="34" color="white" />
              </div>
              <p class="chat-panel__empty-title">Чат не открыт</p>
              <p class="chat-panel__empty-sub">Нажмите кнопку, чтобы начать общение с командой</p>
              <button class="open-chat-btn open-chat-btn--lg" :disabled="chatLoading" @click="startChat">
                <v-icon icon="mdi-chat-outline" size="17" />
                {{ chatLoading ? 'Загрузка...' : 'Открыть чат' }}
              </button>
            </div>

            <template v-else>
              <!-- Messages -->
              <div ref="chatScrollRef" class="messages">
                <div v-if="chatLoading" class="pa-4">
                  <v-skeleton-loader v-for="i in 4" :key="i" type="list-item-avatar-two-line" class="mb-2" />
                </div>
                <div v-else-if="!chatMessages.length" class="messages__empty">
                  <v-icon icon="mdi-chat-outline" size="40" color="grey-lighten-2" class="mb-3" />
                  <p>Начните общение с командой</p>
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

        </div><!-- /.chat-modal__body -->
      </div><!-- /.chat-modal -->
    </v-dialog>
  </div>
</template>

<style scoped>
/* ─── Animations ─── */
@keyframes spin { to { transform: rotate(360deg); } }
.spin { animation: spin 1s linear infinite; }

/* ─── Base ─── */
.volunteers-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* ─── Page header ─── */
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

.total-badge {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 16px;
  background: #fff;
  border: 1px solid rgba(139, 195, 74, 0.25);
  border-radius: 100px;
  font-size: 0.875rem;
  font-weight: 700;
  color: #3a7422;
  box-shadow: 0 2px 8px rgba(139, 195, 74, 0.12);
}

/* ─── Main layout ─── */
.main-layout {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 16px;
  align-items: start;
}

@media (max-width: 860px) {
  .main-layout { grid-template-columns: 1fr; }
}

/* ─── Section card ─── */
.section-card {
  background: #fff;
  border-radius: 18px;
  border: 1px solid rgba(0, 0, 0, 0.07);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-card--grow { min-height: 400px; }

.section-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.section-card__title    { font-size: 1rem; font-weight: 800; color: #1a1a1a; margin: 0 0 2px; }
.section-card__subtitle { font-size: 0.775rem; color: rgba(0, 0, 0, 0.4); margin: 0; }

/* ─── Refresh button ─── */
.refresh-btn {
  width: 34px; height: 34px;
  border-radius: 10px;
  border: 1px solid rgba(139, 195, 74, 0.25);
  background: rgba(139, 195, 74, 0.06);
  color: #558b2f;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s;
  flex-shrink: 0;
}
.refresh-btn:hover    { background: rgba(139, 195, 74, 0.14); }
.refresh-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* ─── Empty / loading ─── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  text-align: center;
}
.empty-state__text { font-size: 0.85rem; color: rgba(0, 0, 0, 0.5); margin: 0; }
.empty-state__sub  { font-size: 0.78rem; color: rgba(0, 0, 0, 0.38); margin: 4px 0 0; }
.loading-list      { display: flex; flex-direction: column; }

/* ─── Projects list ─── */
.projects-list { 
  display: flex; 
  flex-direction: column; 
  gap: 6px;
  max-height: calc(100vh - 400px);
  overflow-y: auto;
}

/* Projects pagination */
.projects-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.pagination-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid rgba(139, 195, 74, 0.25);
  background: rgba(139, 195, 74, 0.06);
  color: #558b2f;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, opacity 0.15s;
}

.pagination-btn:hover:not(:disabled) {
  background: rgba(139, 195, 74, 0.14);
}

.pagination-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.pagination-info {
  display: flex;
  align-items: center;
  min-width: 60px;
  justify-content: center;
}

.pagination-text {
  font-size: 0.8rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.5);
}

/* Mobile adjustments for pagination */
@media (max-width: 720px) {
  .projects-list {
    max-height: none;
  }
  
  .projects-pagination {
    margin-top: 10px;
    padding-top: 10px;
  }
  
  .pagination-btn {
    width: 36px;
    height: 36px;
  }
  
  .pagination-text {
    font-size: 0.85rem;
  }
}

.project-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 10px;
  border-radius: 12px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: background 0.18s, border-color 0.18s;
}
.project-item:hover     { background: rgba(139,195,74,0.06); border-color: rgba(139,195,74,0.15); }
.project-item--active   { background: rgba(139,195,74,0.1) !important; border-color: rgba(139,195,74,0.3) !important; }

.project-item__avatar {
  width: 36px; height: 36px;
  border-radius: 10px;
  background: rgba(139,195,74,0.12);
  color: #558b2f;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  transition: background 0.18s, color 0.18s;
}
.project-item--active .project-item__avatar {
  background: linear-gradient(135deg, #8bc34a, #558b2f);
  color: white;
}

.project-item__content { flex: 1; min-width: 0; }

.project-item__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 3px;
}

.project-item__name {
  font-size: 0.85rem;
  font-weight: 700;
  color: #1a1a1a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.project-item__status { flex-shrink: 0; }

.project-item__meta {
  display: flex;
  gap: 8px;
  font-size: 0.74rem;
  color: rgba(0, 0, 0, 0.45);
}
.project-item__meta span { display: inline-flex; align-items: center; gap: 3px; }

.project-item__chat-btn {
  position: relative;
  width: 32px; height: 32px;
  border-radius: 8px;
  border: 1px solid rgba(139,195,74,0.2);
  background: transparent;
  color: #8bc34a;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s;
}
.project-item__chat-btn:hover { background: rgba(139,195,74,0.1); color: #558b2f; }

.chat-badge {
  position: absolute;
  top: -4px; right: -4px;
  min-width: 16px; height: 16px;
  padding: 0 4px;
  background: #f44336;
  color: white;
  font-size: 0.65rem;
  font-weight: 700;
  border-radius: 100px;
  display: flex; align-items: center; justify-content: center;
}

/* ─── Table atoms ─── */
.p-avatar {
  width: 34px; height: 34px;
  border-radius: 50%;
  background: linear-gradient(135deg, #8bc34a, #558b2f);
  color: white;
  font-size: 0.72rem;
  font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.p-name   { font-size: 0.875rem; font-weight: 600; color: #1a1a1a; }
.p-id     { font-size: 0.75rem; color: rgba(0,0,0,0.38); }
.p-email  { font-size: 0.85rem; color: rgba(0,0,0,0.6); }
.p-rating { font-size: 0.875rem; font-weight: 600; }
.p-date   { font-size: 0.85rem; color: rgba(0,0,0,0.55); }
.p-tasks  { font-size: 0.8rem; color: rgba(0,0,0,0.5); }

.task-bar { width: 56px; height: 6px; background: rgba(0,0,0,0.08); border-radius: 100px; overflow: hidden; }
.task-bar__fill { height: 100%; background: linear-gradient(90deg, #8bc34a, #558b2f); border-radius: 100px; transition: width 0.3s; }

.participants-table { border-radius: 12px; overflow: hidden; }
:deep(.v-data-table__th) { font-size: 0.78rem !important; font-weight: 700 !important; text-transform: uppercase; letter-spacing: 0.5px; color: rgba(0,0,0,0.45) !important; }
:deep(.v-data-table__tr:hover > td) { background: rgba(139,195,74,0.04) !important; }

/* ════════════════════════════════════
   CHAT MODAL
════════════════════════════════════ */
.chat-modal {
  background: #fff;
  border-radius: 20px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  /* Desktop fixed height */
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

/* ── Tabs: hidden on desktop, shown on mobile ── */
.modal-tabs {
  display: none;          /* hidden by default; shown via media query */
  flex-shrink: 0;
  border-bottom: 1px solid rgba(0,0,0,0.08);
  background: #fff;
}

.modal-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px 8px;
  border: none;
  background: transparent;
  font-size: 0.875rem;
  font-weight: 600;
  color: rgba(0,0,0,0.42);
  cursor: pointer;
  position: relative;
  transition: color 0.15s, background 0.15s;
}

.modal-tab--active { color: #558b2f; }

.modal-tab--active::after {
  content: '';
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, #8bc34a, #558b2f);
  border-radius: 2px 2px 0 0;
}

.modal-tab__count {
  padding: 1px 7px;
  border-radius: 100px;
  background: rgba(0,0,0,0.07);
  font-size: 0.72rem;
  font-weight: 800;
  color: rgba(0,0,0,0.42);
}

.modal-tab--active .modal-tab__count {
  background: rgba(139,195,74,0.15);
  color: #558b2f;
}

.modal-tab__pill {
  padding: 1px 7px;
  border-radius: 100px;
  background: rgba(139,195,74,0.15);
  color: #558b2f;
  font-size: 0.7rem;
  font-weight: 800;
}

.modal-tab__dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: #8bc34a;
}

/* ── Body (side-by-side on desktop) ── */
.chat-modal__body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* ── Participants panel ── */
.participants-panel {
  width: 260px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid rgba(0,0,0,0.07);
  background: #fafafa;
  /* Always visible on desktop */
}

.participants-panel__hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 14px;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: rgba(0,0,0,0.38);
  border-bottom: 1px solid rgba(0,0,0,0.06);
  flex-shrink: 0;
}

.participants-panel__list {
  flex: 1;
  overflow-y: auto;
}

.panel-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 28px 14px;
  font-size: 0.8rem;
  color: rgba(0,0,0,0.35);
  gap: 6px;
  text-align: center;
}

.p-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 14px;
  border-bottom: 1px solid rgba(0,0,0,0.04);
  transition: background 0.14s;
}
.p-row:hover { background: rgba(139,195,74,0.05); }

.p-row__av {
  width: 30px; height: 30px;
  border-radius: 50%;
  background: linear-gradient(135deg, #8bc34a, #558b2f);
  color: white;
  font-size: 0.65rem;
  font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}

.p-row__info { flex: 1; min-width: 0; }

.p-row__name {
  font-size: 0.815rem;
  font-weight: 600;
  color: #1a1a1a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.p-row__meta { display: flex; gap: 8px; font-size: 0.7rem; color: rgba(0,0,0,0.42); margin-top: 2px; }
.p-row__meta span { display: inline-flex; align-items: center; gap: 3px; }

/* ── Open chat button ── */
.open-chat-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  background: linear-gradient(135deg, #8bc34a, #558b2f);
  color: white;
  border: none;
  border-radius: 7px;
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s;
  white-space: nowrap;
}
.open-chat-btn:disabled          { opacity: 0.6; cursor: not-allowed; }
.open-chat-btn:hover:not(:disabled) { opacity: 0.88; }

.open-chat-btn--lg {
  padding: 10px 22px;
  font-size: 0.875rem;
  border-radius: 12px;
  gap: 8px;
}

/* ── Chat panel ── */
.chat-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #f8f9fa;
  /* Always visible on desktop */
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
   MOBILE & TABLET  (≤ 720px)
   — tabs visible, panels switch
════════════════════════════════════ */
@media (max-width: 720px) {
  
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

  /* Page chrome */
  .page-header  { padding: 16px 18px; border-radius: 16px; }
  .page-title   { font-size: 1.35rem; }
  .total-badge  { padding: 6px 12px; font-size: 0.82rem; }

  /* Modal: fill screen */
  .chat-modal {
    border-radius: 0;
    height: 100dvh;
    max-height: 100dvh;
  }

  /* Show tabs */
  .modal-tabs { display: flex; }

  /* Stack body */
  .chat-modal__body { flex-direction: column; }

  /* Each panel takes full space when active */
  .participants-panel,
  .chat-panel {
    width: 100%;
    border-right: none;
    flex: 1;
    min-height: 0;
  }

  /* Hide inactive panel */
  .panel--mobile-hidden { display: none !important; }

  /* Wider bubbles on narrow screens */
  .msg__body { max-width: 82%; }

  /* Comfortable touch targets */
  .project-item          { padding: 13px 10px; }
  .project-item__chat-btn { width: 38px; height: 38px; }
  .send-btn              { width: 40px; height: 40px; border-radius: 10px; }
  .chat-input            { padding: 8px 12px; }
}
</style>