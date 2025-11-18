<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

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

watch(
  () => organizerStore.projects,
  (list) => {
    if (!list.length) {
      selectedProjectId.value = null;
      return;
    }
    if (!selectedProjectId.value || !list.some((project) => project.id === selectedProjectId.value)) {
      selectedProjectId.value = list[0].id;
    }
  },
  { immediate: true },
);

watch(
  selectedProjectId,
  (projectId) => {
    if (projectId) {
      organizerStore.loadParticipants(projectId);
    }
  },
);

const currentProject = computed(() =>
  projects.value.find((project) => project.id === selectedProjectId.value) ?? null,
);

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
  projects.value.reduce((acc, project) => acc + (project.volunteer_count ?? 0), 0),
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
  switch (status) {
    case 'pending':
      return 'На модерации';
    case 'approved':
      return 'Активен';
    case 'rejected':
      return 'Отклонён';
    default:
      return status;
  }
}

function statusColor(status: string) {
  switch (status) {
    case 'approved':
      return 'success';
    case 'pending':
      return 'deep-orange';
    case 'rejected':
      return 'error';
    default:
      return 'primary';
  }
}

function selectProject(projectId: number) {
  selectedProjectId.value = projectId;
}

async function openProjectDialog(projectId: number) {
  // Устанавливаем выбранный проект
  selectedProjectId.value = projectId;
  
  // Загружаем участников если их еще нет
  if (!organizerStore.participantsByProject[projectId]) {
    await organizerStore.loadParticipants(projectId);
  }
  
  // Открываем диалог с волонтерами (без чата)
  chatProjectId.value = projectId;
  chatDialog.value = true;
  
  // Не загружаем чат сразу, только участников
  chat.value = null;
  chatMessages.value = [];
  newMessageText.value = '';
}

async function startChat() {
  if (!chatProjectId.value) return;
  
  const projectId = chatProjectId.value;
  chatLoading.value = true;
  
  try {
    // Загружаем участников проекта если их еще нет
    if (!organizerStore.participantsByProject[projectId]) {
      await organizerStore.loadParticipants(projectId);
    }
    
    // Получаем чат проекта
    chat.value = await getProjectChat(projectId);
    
    // Загружаем сообщения
    await loadChatMessages();
    
    // Отмечаем сообщения как прочитанные
    if (chat.value.unread_count > 0) {
      await markMessagesRead(chat.value.id);
      chat.value.unread_count = 0;
      chatUnreadCounts.value[projectId] = 0;
    }
    
    // Начинаем polling для новых сообщений
    startMessagesPolling();
  } catch (error: any) {
    console.error('Failed to load chat:', error);
  } finally {
    chatLoading.value = false;
  }
}

function refreshParticipants() {
  if (selectedProjectId.value) {
    organizerStore.loadParticipants(selectedProjectId.value, true);
  }
}

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

async function openProjectChat(projectId: number) {
  // Эта функция теперь используется только из кнопки чата рядом с проектом
  chatProjectId.value = projectId;
  chatDialog.value = true;
  chatLoading.value = true;
  chat.value = null;
  chatMessages.value = [];
  newMessageText.value = '';
  
  try {
    // Загружаем участников проекта если их еще нет
    if (!organizerStore.participantsByProject[projectId]) {
      await organizerStore.loadParticipants(projectId);
    }
    
    // Получаем чат проекта
    chat.value = await getProjectChat(projectId);
    
    // Загружаем сообщения
    await loadChatMessages();
    
    // Отмечаем сообщения как прочитанные
    if (chat.value.unread_count > 0) {
      await markMessagesRead(chat.value.id);
      chat.value.unread_count = 0;
      chatUnreadCounts.value[projectId] = 0;
    }
    
    // Начинаем polling для новых сообщений
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
    
    // Обновляем время чата
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
        
        // Обновляем сообщения если есть новые
        if (response.messages.length > chatMessages.value.length) {
          chatMessages.value = response.messages;
          
          // Отмечаем новые сообщения как прочитанные
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
  }, 3000); // Poll каждые 3 секунды
}

function stopMessagesPolling() {
  if (messagesPollInterval.value) {
    clearInterval(messagesPollInterval.value);
    messagesPollInterval.value = null;
  }
}

// Загружаем счетчики непрочитанных для всех проектов
async function loadUnreadCounts() {
  if (!organizerStore.projects.length) return;
  
  for (const project of organizerStore.projects) {
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
  if (!organizerStore.isOrganizer) return;
  await organizerStore.loadProjects(true);
  await loadUnreadCounts();
});

onUnmounted(() => {
  stopMessagesPolling();
});
</script>

<template>
  <div class="volunteers-view">
    <v-row class="ga-6">
      <v-col cols="12" lg="4">
        <v-card class="projects-card" rounded="xl" elevation="6">
          <div class="projects-card__header">
            <div>
              <h1 class="text-h5 font-weight-bold mb-1">Проекты и команды</h1>
              <p class="text-body-2 text-medium-emphasis mb-0">
                Выберите проект, чтобы посмотреть участников, их контакты и прогресс по заданиям.
              </p>
            </div>
            <v-chip color="primary" class="text-none font-weight-semibold" variant="flat">
              Всего волонтёров: {{ totalVolunteers }}
            </v-chip>
          </div>

          <v-divider class="my-4" />

          <template v-if="!isOrganizer">
            <v-alert type="error" variant="tonal" border="start" class="mb-0">
              Управление командой доступно только организаторам проектов.
            </v-alert>
          </template>

          <template v-else-if="!isApproved">
            <v-alert type="info" variant="tonal" border="start" class="mb-0">
              После одобрения заявки организатора вы сможете приглашать волонтёров, управлять задачами и отслеживать
              их прогресс из веб-портала.
            </v-alert>
          </template>

          <template v-else>
            <v-alert
              v-if="!projects.length"
              type="info"
              variant="tonal"
              border="start"
              class="mb-0"
            >
              Сначала создайте проект. После этого вы сможете приглашать волонтёров и отслеживать их прогресс в этом
              разделе.
            </v-alert>

            <v-list
              v-else
              class="projects-list"
              lines="two"
              select-strategy="single"
              nav
            >
              <v-list-item
                v-for="project in projects"
                :key="project.id"
                :value="project.id"
                :active="project.id === selectedProjectId"
                rounded="lg"
                class="projects-list__item"
                @click="openProjectDialog(project.id)"
              >
                <template #prepend>
                  <v-avatar color="primary-lighten-4" size="44">
                    <v-icon icon="mdi-briefcase-outline" color="primary" />
                  </v-avatar>
                </template>
                <div class="d-flex justify-space-between align-start flex-wrap gap-2">
                  <div>
                    <v-list-item-title class="font-weight-semibold">{{ project.title }}</v-list-item-title>
                    <v-list-item-subtitle class="text-medium-emphasis">
                      {{ project.city }}
                      <span v-if="project.start_date">• старт {{ formatDate(project.start_date) }}</span>
                    </v-list-item-subtitle>
                  </div>
                  <v-chip :color="statusColor(project.status)" size="small" variant="tonal" class="text-none">
                    {{ formatStatus(project.status) }}
                  </v-chip>
                </div>
                <div class="projects-list__meta">
                  <span>
                    <v-icon icon="mdi-account-group-outline" size="18" class="me-1" />
                    {{ project.volunteer_count }} волонтёров
                  </span>
                  <span>
                    <v-icon icon="mdi-check-circle-outline" size="18" class="me-1" />
                    {{ project.task_count }} задач
                  </span>
                </div>
                <template #append>
                  <v-btn
                    icon="mdi-chat-outline"
                    variant="text"
                    size="small"
                    color="primary"
                    @click.stop="openProjectChat(project.id)"
                  >
                    <v-badge v-if="chatUnreadCounts[project.id]" :content="chatUnreadCounts[project.id]" color="error">
                      <template #badge>
                        <span>{{ chatUnreadCounts[project.id] }}</span>
                      </template>
                    </v-badge>
                  </v-btn>
                </template>
              </v-list-item>
            </v-list>
          </template>
        </v-card>
      </v-col>

      <v-col cols="12" lg="8">
        <v-card class="participants-card" rounded="xl" elevation="6">
          <div class="participants-card__header">
            <div>
              <h2 class="text-h6 font-weight-bold mb-1">
                {{ currentProject ? currentProject.title : 'Участники проекта' }}
              </h2>
              <p class="text-body-2 text-medium-emphasis mb-0">
                Прогресс синхронизируется с Telegram-ботом автоматически.
              </p>
            </div>
            <v-btn
              icon="mdi-refresh"
              variant="text"
              color="primary"
              :disabled="!selectedProjectId || participantsLoading"
              :loading="participantsLoading"
              @click="refreshParticipants"
            />
          </div>

          <v-divider class="my-4" />

          <template v-if="!isOrganizer">
            <v-alert type="error" variant="tonal" border="start">
              У вас нет прав организатора. Войдите под аккаунтом организатора, чтобы просматривать команду.
            </v-alert>
          </template>

          <template v-else-if="!isApproved">
            <v-alert type="info" variant="tonal" border="start">
              После одобрения статуса организатора вы увидите здесь участников проекта и их прогресс.
            </v-alert>
          </template>

          <template v-else-if="!selectedProjectId">
            <v-alert type="info" variant="tonal" border="start">
              Выберите проект слева, чтобы увидеть список волонтёров и их активность.
            </v-alert>
          </template>

          <template v-else>
            <v-alert
              v-if="participantsError"
              type="error"
              variant="tonal"
              border="start"
              class="mb-4"
            >
              {{ participantsError }}
            </v-alert>

            <v-skeleton-loader
              v-else-if="participantsLoading && !participants.length"
              type="table"
              class="mb-4"
            />

            <div v-else>
              <v-alert
                v-if="!participants.length"
                type="info"
                variant="tonal"
                border="start"
                class="mb-0"
              >
                Пока в проекте нет волонтёров. Пригласите участников через Telegram-бота.
              </v-alert>

              <v-data-table
                v-else
                :items="participants"
                :headers="participantHeaders"
                density="comfortable"
                class="participants-table"
                :items-per-page="8"
              >
                <template #item.name="{ item }">
                  <div class="d-flex flex-column">
                    <span class="font-weight-semibold">{{ item.name }}</span>
                    <span class="text-caption text-medium-emphasis">ID: {{ item.id }}</span>
                  </div>
                </template>

                <template #item.email="{ item }">
                  <span>{{ item.email || '—' }}</span>
                </template>

                <template #item.rating="{ item }">
                  <div class="d-flex align-center ga-2">
                    <v-icon icon="mdi-star" size="18" color="amber" />
                    <span>{{ item.rating }}</span>
                  </div>
                </template>

                <template #item.joined_at="{ item }">
                  <span>{{ formatDate(item.joined_at) }}</span>
                </template>

                <template #item.tasks="{ item }">
                  <div class="d-flex align-center ga-2">
                    <v-chip size="small" color="success" variant="tonal" class="text-none">
                      {{ item.completed_tasks }}
                    </v-chip>
                    <span class="text-body-2 text-medium-emphasis">из {{ item.total_tasks }}</span>
                  </div>
                </template>
              </v-data-table>
            </div>
          </template>
        </v-card>
      </v-col>
    </v-row>

    <!-- Диалог с волонтерами и чатом -->
    <v-dialog v-model="chatDialog" max-width="1200" fullscreen hide-overlay transition="dialog-bottom-transition">
      <v-card v-if="chatProjectId && currentProject" class="chat-dialog d-flex flex-column h-100">
        <v-card-title class="d-flex justify-space-between align-center pa-4">
          <div class="d-flex align-center ga-3">
            <v-avatar color="primary" size="40">
              <v-icon icon="mdi-account-group" color="white" />
            </v-avatar>
            <div>
              <h2 class="text-h6 font-weight-bold mb-0">{{ currentProject.title }}</h2>
              <p class="text-caption text-medium-emphasis mb-0">Участники проекта</p>
            </div>
          </div>
          <v-btn icon="mdi-close" variant="text" @click="closeChatDialog" />
        </v-card-title>

        <v-divider />

        <div class="chat-container d-flex flex-grow-1" style="height: calc(100vh - 200px);">
          <!-- Список волонтеров -->
          <v-card class="volunteers-sidebar d-flex flex-column" variant="outlined" rounded="0" style="width: 400px; border-right: 1px solid rgba(0,0,0,0.12);">
            <v-card-title class="pa-4 d-flex justify-space-between align-center">
              <h3 class="text-subtitle-1 font-weight-bold">Участники проекта</h3>
              <v-btn
                v-if="!chat"
                color="primary"
                variant="flat"
                class="text-none font-weight-bold"
                :loading="chatLoading"
                @click="startChat"
              >
                <v-icon icon="mdi-chat-outline" start />
                Начать чат
              </v-btn>
            </v-card-title>
            <v-divider />
            <v-card-text class="flex-grow-1 pa-0" style="overflow-y: auto;">
              <v-skeleton-loader
                v-if="chatProjectId && participantsLoading"
                type="list-item-three-line@3"
                class="pa-4"
              />
              
              <v-list v-else-if="chatProjectId && participants.length" density="comfortable" class="pa-0">
                <v-list-item
                  v-for="participant in participants"
                  :key="participant.id"
                  class="pa-3"
                >
                  <template #prepend>
                    <v-avatar color="primary-lighten-4" size="48">
                      <v-icon icon="mdi-account" color="primary" />
                    </v-avatar>
                  </template>
                  <v-list-item-title class="font-weight-medium">{{ participant.name }}</v-list-item-title>
                  <v-list-item-subtitle>
                    <div class="d-flex flex-column ga-1 mt-1">
                      <span class="text-caption">{{ participant.email || '—' }}</span>
                      <div class="d-flex ga-2 mt-1">
                        <v-chip size="x-small" color="success" variant="tonal" class="text-none">
                          Выполнено: {{ participant.completed_tasks || 0 }}/{{ participant.total_tasks || 0 }}
                        </v-chip>
                        <v-chip size="x-small" color="amber" variant="tonal" class="text-none">
                          <v-icon icon="mdi-star" size="12" class="me-1" />
                          {{ participant.rating || 0 }}
                        </v-chip>
                      </div>
                    </div>
                  </v-list-item-subtitle>
                </v-list-item>
              </v-list>
              
              <v-alert
                v-else-if="chatProjectId && !participantsLoading && !participants.length"
                type="info"
                variant="tonal"
                class="ma-4"
              >
                В проекте пока нет волонтёров
              </v-alert>
            </v-card-text>
          </v-card>

          <!-- Чат (показывается только после нажатия "Начать чат") -->
          <div v-if="chat" class="chat-messages-container d-flex flex-column flex-grow-1">
            <v-card-text class="chat-messages pa-4 flex-grow-1" style="overflow-y: auto; max-height: calc(100vh - 300px);">
              <v-skeleton-loader v-if="chatLoading" type="list-item-three-line@5" />
              
              <template v-else>
                <div v-if="!chatMessages.length" class="text-center text-medium-emphasis py-12">
                  <v-icon icon="mdi-chat-outline" size="48" class="mb-4" />
                  <p class="text-body-1">Начните общение!</p>
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
                          :variant="message.sender_id === currentUser.value?.id ? 'flat' : 'flat'"
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

            <!-- Поле ввода сообщения -->
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
          
          <!-- Заглушка когда чат не запущен -->
          <div v-else class="chat-messages-container d-flex flex-column flex-grow-1 align-center justify-center" style="background: rgba(255, 255, 255, 0.5);">
            <v-icon icon="mdi-chat-outline" size="64" color="primary-lighten-2" class="mb-4" />
            <p class="text-h6 font-weight-medium text-medium-emphasis mb-2">Чат не запущен</p>
            <p class="text-body-2 text-medium-emphasis mb-4">Нажмите кнопку "Начать чат" рядом со списком участников</p>
            <v-btn
              color="primary"
              variant="flat"
              class="text-none font-weight-bold"
              :loading="chatLoading"
              @click="startChat"
            >
              <v-icon icon="mdi-chat-outline" start />
              Начать чат
            </v-btn>
          </div>
        </div>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.volunteers-view {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.projects-card {
  padding: clamp(24px, 5vw, 36px);
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(224, 242, 255, 0.96));
}

.projects-card__header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  flex-wrap: wrap;
}

.projects-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0;
}

.projects-list__item {
  border: 1px solid rgba(139, 195, 74, 0.12); /* BirQadam primary */
  backdrop-filter: blur(6px);
  background-color: rgba(255, 255, 255, 0.78);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.projects-list__item--active,
.projects-list__item.v-list-item--active {
  border-color: rgba(139, 195, 74, 0.4); /* BirQadam primary */
  box-shadow: 0 6px 18px rgba(139, 195, 74, 0.1); /* BirQadam primary */
}

.projects-list__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 12px;
  color: rgba(33, 33, 33, 0.65);
  font-size: 0.95rem;
}

.participants-card {
  padding: clamp(24px, 5vw, 40px);
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(255, 250, 246, 0.95)); /* BirQadam background */
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.participants-card__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
}

.participants-table {
  border-radius: 16px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.86);
}

.participants-table ::v-deep(.v-data-table__th) {
  font-weight: 600;
}

.participants-table ::v-deep(.v-data-table__tr:hover) {
  background: rgba(139, 195, 74, 0.06); /* BirQadam primary */
}

.chat-dialog {
  background: #f8ecc4; /* BirQadam background */
}

.chat-container {
  background: white;
}

.volunteers-sidebar {
  background: rgba(255, 255, 255, 0.95);
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
</style>


