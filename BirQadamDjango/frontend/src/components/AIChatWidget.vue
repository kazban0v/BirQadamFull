<template>
    <!-- Главный контейнер чата -->
    <transition name="chat-slide">
      <v-card
        v-if="isOpen"
        class="ai-chat-widget elevation-24"
        :style="{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: isMobile ? 'calc(100vw - 32px)' : '420px',
          maxHeight: isMobile ? 'calc(100vh - 32px)' : '700px',
          zIndex: 2000,
        }"
      >
        <!-- Заголовок с градиентом -->
        <v-card-title class="chat-header pa-4">
          <div class="d-flex align-center justify-space-between w-100">
            <div class="d-flex align-center">
              <v-avatar size="44" class="avatar-pulse mr-3">
                <div class="avatar-inner">
                  <v-icon size="26" color="white">mdi-robot-excited</v-icon>
                </div>
              </v-avatar>
              <div>
                <div class="text-h6 font-weight-bold text-white">AI Помощник</div>
                <div class="status-indicator">
                  <span class="status-dot" :class="{ 'typing': isTyping }"></span>
                  <span class="text-caption text-white-80">
                    {{ isTyping ? 'печатает...' : 'всегда онлайн' }}
                  </span>
                </div>
              </div>
            </div>
            
            <div class="d-flex gap-1">
              <v-tooltip text="Обновить чат" location="bottom">
                <template v-slot:activator="{ props }">
                  <v-btn
                    icon
                    variant="text"
                    size="small"
                    v-bind="props"
                    @click="clearChat"
                    class="header-btn"
                  >
                    <v-icon>mdi-refresh</v-icon>
                  </v-btn>
                </template>
              </v-tooltip>
              
              <v-tooltip text="Свернуть" location="bottom">
                <template v-slot:activator="{ props }">
                  <v-btn
                    icon
                    variant="text"
                    size="small"
                    v-bind="props"
                    @click="minimizeChat"
                    class="header-btn"
                  >
                    <v-icon>mdi-window-minimize</v-icon>
                  </v-btn>
                </template>
              </v-tooltip>
            </div>
          </div>
        </v-card-title>
  
        <!-- Область сообщений -->
        <v-card-text class="pa-0 messages-wrapper" ref="messagesWrapper">
          <div class="messages-container pa-4" ref="messagesContainer">
            
            <!-- Приветственный экран -->
            <transition name="fade">
              <div v-if="messages.length === 0" class="welcome-screen">
                <div class="welcome-icon-wrapper mb-4">
                  <v-icon size="80" color="primary" class="welcome-icon">
                    mdi-robot-excited-outline
                  </v-icon>
                </div>
                
                <h2 class="text-h5 font-weight-bold mb-2 gradient-text">
                  Добро пожаловать!
                </h2>
                
                <p class="text-body-1 text-medium-emphasis mb-6 px-4">
                  Я ваш AI помощник BirQadam. Помогу с информацией о волонтерстве, проектах и платформе.
                </p>
                
                <div class="suggestions-title text-caption text-medium-emphasis mb-3">
                  Популярные вопросы:
                </div>
                
                <div class="suggested-questions">
                  <v-chip
                    v-for="(suggestion, idx) in suggestions"
                    :key="idx"
                    class="suggestion-chip ma-1"
                    variant="flat"
                    @click="useSuggestion(suggestion)"
                    color="primary"
                    size="default"
                    prepend-icon="mdi-lightbulb-outline"
                  >
                    {{ suggestion }}
                  </v-chip>
                </div>
              </div>
            </transition>
  
            <!-- Список сообщений -->
            <transition-group name="message-list" tag="div">
              <div
                v-for="(message, index) in messages"
                :key="message.id"
                class="message-wrapper mb-4"
                :class="message.type === 'user' ? 'user-wrapper' : 'ai-wrapper'"
              >
                <div class="message-container">
                  <!-- Аватар AI -->
                  <v-avatar
                    v-if="message.type === 'ai'"
                    size="36"
                    class="mr-2 flex-shrink-0 message-avatar"
                    color="primary"
                  >
                    <v-icon size="22" color="white">mdi-robot</v-icon>
                  </v-avatar>
  
                  <!-- Контент сообщения -->
                  <div class="message-content">
                    <div
                      :class="message.type === 'user' ? 'user-message' : 'ai-message'"
                      class="message-bubble"
                    >
                      <div 
                        class="message-text" 
                        v-html="formatMessage(message.text)"
                      ></div>
                      
                      <div class="message-meta mt-1">
                        <span class="message-time">{{ formatTime(message.timestamp) }}</span>
                        <v-icon 
                          v-if="message.type === 'user' && message.delivered"
                          size="14"
                          class="ml-1 message-status"
                          :color="message.read ? 'blue' : 'grey'"
                        >
                          {{ message.read ? 'mdi-check-all' : 'mdi-check' }}
                        </v-icon>
                      </div>
                    </div>
  
                    <!-- Действия для AI сообщений -->
                    <transition name="fade">
                      <div 
                        v-if="message.type === 'ai' && !loading" 
                        class="message-actions mt-2"
                        :class="{ 'show': hoveredMessage === index }"
                        @mouseenter="hoveredMessage = index"
                        @mouseleave="hoveredMessage = null"
                      >
                        <v-tooltip text="Копировать" location="top">
                          <template v-slot:activator="{ props }">
                            <v-btn
                              icon
                              variant="text"
                              size="x-small"
                              v-bind="props"
                              @click="copyMessage(message.text, message.id)"
                              :color="copiedMessageId === message.id ? 'success' : undefined"
                            >
                              <v-icon size="16">
                                {{ copiedMessageId === message.id ? 'mdi-check' : 'mdi-content-copy' }}
                              </v-icon>
                            </v-btn>
                          </template>
                        </v-tooltip>
                        
                        <v-tooltip text="Полезно" location="top">
                          <template v-slot:activator="{ props }">
                            <v-btn
                              icon
                              variant="text"
                              size="x-small"
                              v-bind="props"
                              @click="likeMessage(message.id)"
                              :color="message.liked ? 'success' : undefined"
                            >
                              <v-icon size="16">
                                {{ message.liked ? 'mdi-thumb-up' : 'mdi-thumb-up-outline' }}
                              </v-icon>
                            </v-btn>
                          </template>
                        </v-tooltip>
                        
                        <v-tooltip text="Не полезно" location="top">
                          <template v-slot:activator="{ props }">
                            <v-btn
                              icon
                              variant="text"
                              size="x-small"
                              v-bind="props"
                              @click="dislikeMessage(message.id)"
                              :color="message.disliked ? 'error' : undefined"
                            >
                              <v-icon size="16">
                                {{ message.disliked ? 'mdi-thumb-down' : 'mdi-thumb-down-outline' }}
                              </v-icon>
                            </v-btn>
                          </template>
                        </v-tooltip>
                        
                        <v-tooltip text="Повторить запрос" location="top">
                          <template v-slot:activator="{ props }">
                            <v-btn
                              icon
                              variant="text"
                              size="x-small"
                              v-bind="props"
                              @click="regenerateResponse(index)"
                            >
                              <v-icon size="16">mdi-refresh</v-icon>
                            </v-btn>
                          </template>
                        </v-tooltip>
                      </div>
                    </transition>
                  </div>
  
                  <!-- Аватар пользователя -->
                  <v-avatar
                    v-if="message.type === 'user'"
                    size="36"
                    class="ml-2 flex-shrink-0 message-avatar"
                    :color="userAvatarColor"
                  >
                    <v-icon size="22" color="white">mdi-account</v-icon>
                  </v-avatar>
                </div>
              </div>
            </transition-group>
  
            <!-- Индикатор печати -->
            <transition name="fade">
              <div v-if="loading" class="message-wrapper ai-wrapper mb-4">
                <div class="message-container">
                  <v-avatar size="36" class="mr-2 flex-shrink-0" color="primary">
                    <v-icon size="22" color="white">mdi-robot</v-icon>
                  </v-avatar>
                  
                  <div class="typing-bubble">
                    <div class="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              </div>
            </transition>
  
            <!-- Кнопка прокрутки вниз -->
            <transition name="fade">
              <v-btn
                v-if="showScrollButton"
                icon
                size="small"
                color="primary"
                class="scroll-to-bottom"
                @click="scrollToBottom(true)"
                elevation="4"
              >
                <v-icon>mdi-chevron-down</v-icon>
                <v-badge
                  v-if="unreadMessagesCount > 0"
                  :content="unreadMessagesCount"
                  color="error"
                  overlap
                  offset-x="-4"
                  offset-y="-4"
                ></v-badge>
              </v-btn>
            </transition>
          </div>
        </v-card-text>
  
        <v-divider></v-divider>
  
        <!-- Панель ввода -->
        <v-card-actions class="pa-4 input-area">
          <div class="input-container w-100">
            <!-- Предупреждение об авторизации -->
            <v-expand-transition>
              <v-alert
                v-if="!authStore.isAuthenticated"
                type="warning"
                variant="tonal"
                density="compact"
                class="mb-3"
                closable
              >
                <template v-slot:prepend>
                  <v-icon>mdi-account-alert</v-icon>
                </template>
                Войдите в систему для использования AI помощника
              </v-alert>
            </v-expand-transition>
  
            <!-- Поле ввода -->
            <div class="d-flex align-center gap-2">
              <div class="input-wrapper flex-grow-1">
                <v-textarea
                  v-model="currentQuestion"
                  placeholder="Введите сообщение... (Enter - отправить, Shift+Enter - новая строка)"
                  variant="outlined"
                  density="comfortable"
                  hide-details
                  rows="1"
                  auto-grow
                  max-rows="5"
                  @keydown.enter.exact.prevent="sendMessage"
                  @keydown.shift.enter.exact.prevent="addNewLine"
                  @input="onInput"
                  :disabled="loading || !authStore.isAuthenticated"
                  class="message-input"
                  bg-color="grey-lighten-5"
                >
                  <template v-slot:prepend-inner>
                    <v-tooltip text="Прикрепить файл" location="top">
                      <template v-slot:activator="{ props }">
                        <v-btn
                          icon
                          variant="text"
                          size="x-small"
                          v-bind="props"
                          :disabled="loading || !authStore.isAuthenticated"
                          class="attach-btn"
                        >
                          <v-icon size="20">mdi-paperclip</v-icon>
                        </v-btn>
                      </template>
                    </v-tooltip>
                  </template>
  
                  <template v-slot:append-inner>
                    <transition name="fade">
                      <v-btn
                        v-if="currentQuestion.trim()"
                        icon
                        variant="text"
                        size="x-small"
                        @click="clearInput"
                        class="clear-btn"
                      >
                        <v-icon size="20">mdi-close-circle</v-icon>
                      </v-btn>
                    </transition>
                  </template>
                </v-textarea>
              </div>
  
              <!-- Кнопка отправки -->
              <v-btn
                color="primary"
                icon
                size="large"
                @click="sendMessage"
                :disabled="!canSend"
                :loading="loading"
                elevation="0"
                class="send-button"
              >
                <v-icon>{{ loading ? 'mdi-dots-horizontal' : 'mdi-send' }}</v-icon>
              </v-btn>
            </div>
  
            <!-- Информация и статистика -->
            <div class="text-caption text-medium-emphasis mt-2 d-flex justify-space-between align-center">
              <div class="d-flex align-center gap-3">
                <span v-if="isTypingUser" class="typing-text">
                  <v-icon size="12" class="mr-1">mdi-keyboard</v-icon>
                  Печатаете...
                </span>
                <span v-else>
                  {{ characterCount }}/{{ maxCharacters }} символов
                </span>
              </div>
              
              <div class="d-flex align-center gap-2">
                <v-chip
                  size="x-small"
                  variant="text"
                  prepend-icon="mdi-message-outline"
                >
                  {{ messages.length }}
                </v-chip>
                
                <v-chip
                  v-if="authStore.isAuthenticated"
                  size="x-small"
                  variant="text"
                  color="success"
                  prepend-icon="mdi-shield-check"
                >
                  Защищено
                </v-chip>
              </div>
            </div>
          </div>
        </v-card-actions>
      </v-card>
    </transition>
  
    <!-- Кнопка открытия чата -->
    <transition name="fab-scale">
      <v-btn
        v-if="!isOpen"
        fab
        color="primary"
        size="x-large"
        :style="{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 1999,
        }"
        @click="openChat"
        class="chat-fab"
        elevation="8"
      >
        <v-badge
          v-if="unreadCount > 0"
          :content="unreadCount > 99 ? '99+' : unreadCount"
          color="error"
          overlap
          offset-x="-8"
          offset-y="-8"
        >
          <v-icon size="32">mdi-robot-excited</v-icon>
        </v-badge>
        <v-icon v-else size="32">mdi-robot-excited</v-icon>
        
        <!-- Пульсирующий эффект -->
        <span class="fab-pulse"></span>
      </v-btn>
    </transition>
  
    <!-- Snackbar для уведомлений -->
    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      :timeout="snackbar.timeout"
      location="top right"
      class="custom-snackbar"
    >
      <div class="d-flex align-center">
        <v-icon class="mr-2">{{ snackbar.icon }}</v-icon>
        <span>{{ snackbar.text }}</span>
      </div>
      <template v-slot:actions>
        <v-btn
          variant="text"
          size="small"
          @click="snackbar.show = false"
        >
          Закрыть
        </v-btn>
      </template>
    </v-snackbar>
  
    <!-- Диалог подтверждения очистки -->
    <v-dialog v-model="confirmDialog" max-width="400">
      <v-card>
        <v-card-title class="text-h6">
          <v-icon class="mr-2" color="warning">mdi-alert-circle</v-icon>
          Очистить историю?
        </v-card-title>
        <v-card-text>
          Вы уверены, что хотите очистить всю историю чата? Это действие нельзя отменить.
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="confirmDialog = false">
            Отмена
          </v-btn>
          <v-btn color="error" variant="flat" @click="confirmClearChat">
            Очистить
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </template>
  
  <script setup lang="ts">
  import { ref, computed, nextTick, watch, onMounted, onUnmounted } from 'vue';
  import { askAI } from '@/services/ai';
  import { useAuthStore } from '@/stores/auth';
  import { useDisplay } from 'vuetify';
  
  // Типы
  interface Message {
    id: string;
    type: 'user' | 'ai';
    text: string;
    timestamp: Date;
    liked?: boolean;
    disliked?: boolean;
    delivered?: boolean;
    read?: boolean;
  }
  
  interface Snackbar {
    show: boolean;
    text: string;
    color: string;
    icon: string;
    timeout: number;
  }
  
  // Композаблы
  const authStore = useAuthStore();
  const { mobile } = useDisplay();
  
  // Refs
  const isOpen = ref(false);
  const messages = ref<Message[]>([]);
  const currentQuestion = ref('');
  const loading = ref(false);
  const isTyping = ref(false);
  const isTypingUser = ref(false);
  const messagesContainer = ref<HTMLElement | null>(null);
  const messagesWrapper = ref<HTMLElement | null>(null);
  const unreadCount = ref(0);
  const hoveredMessage = ref<number | null>(null);
  const copiedMessageId = ref<string | null>(null);
  const showScrollButton = ref(false);
  const unreadMessagesCount = ref(0);
  const confirmDialog = ref(false);
  const userTypingTimeout = ref<number | null>(null);
  
  // Константы
  const maxCharacters = 2000;
  const suggestions = [
    'Как стать волонтером?',
    'Какие проекты доступны?',
    'Как создать мероприятие?',
    'Что такое BirQadam?',
    'Как найти проект?',
    'Преимущества волонтерства'
  ];
  
  const snackbar = ref<Snackbar>({
    show: false,
    text: '',
    color: 'success',
    icon: 'mdi-check-circle',
    timeout: 3000
  });
  
  // Computed
  const isMobile = computed(() => mobile.value);
  
  const canSend = computed(() => 
    currentQuestion.value.trim().length > 0 && 
    !loading.value && 
    authStore.isAuthenticated &&
    currentQuestion.value.length <= maxCharacters
  );
  
  const characterCount = computed(() => currentQuestion.value.length);
  
  const userAvatarColor = computed(() => {
    const colors = ['deep-purple', 'indigo', 'blue', 'teal', 'green'];
    return colors[Math.floor(Math.random() * colors.length)];
  });
  
  // Методы
  const generateMessageId = (): string => {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };
  
  const openChat = () => {
    isOpen.value = true;
    unreadCount.value = 0;
    nextTick(() => {
      scrollToBottom(true);
    });
  };
  
  const minimizeChat = () => {
    isOpen.value = false;
  };
  
  const clearChat = () => {
    confirmDialog.value = true;
  };
  
  const confirmClearChat = () => {
    messages.value = [];
    confirmDialog.value = false;
    showSnackbar('История чата очищена', 'info', 'mdi-delete-sweep');
  };
  
  const scrollToBottom = async (smooth = false) => {
    await nextTick();
    if (messagesContainer.value) {
      const scrollOptions: ScrollToOptions = {
        top: messagesContainer.value.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      };
      messagesContainer.value.scrollTo(scrollOptions);
    }
  };
  
  const handleScroll = () => {
    if (!messagesContainer.value) return;
    
    const { scrollTop, scrollHeight, clientHeight } = messagesContainer.value;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    
    showScrollButton.value = distanceFromBottom > 200;
    
    if (distanceFromBottom < 100) {
      unreadMessagesCount.value = 0;
    }
  };
  
  const onInput = () => {
    if (userTypingTimeout.value) {
      clearTimeout(userTypingTimeout.value);
    }
    
    isTypingUser.value = true;
    
    userTypingTimeout.value = window.setTimeout(() => {
      isTypingUser.value = false;
    }, 1000);
  };
  
  const addNewLine = () => {
    currentQuestion.value += '\n';
  };
  
  const clearInput = () => {
    currentQuestion.value = '';
  };
  
  const useSuggestion = (suggestion: string) => {
    currentQuestion.value = suggestion;
    sendMessage();
  };
  
  const sendMessage = async () => {
    const question = currentQuestion.value.trim();
    if (!canSend.value) return;
  
    if (!authStore.isAuthenticated) {
      showSnackbar('Пожалуйста, войдите в систему', 'warning', 'mdi-account-alert');
      return;
    }
  
    // Создаем сообщение пользователя
    const userMessage: Message = {
      id: generateMessageId(),
      type: 'user',
      text: question,
      timestamp: new Date(),
      delivered: false,
      read: false
    };
  
    messages.value.push(userMessage);
    currentQuestion.value = '';
    loading.value = true;
    isTyping.value = true;
  
    // Симуляция доставки
    setTimeout(() => {
      userMessage.delivered = true;
    }, 300);
  
    // Прокрутка вниз
    scrollToBottom(true);
  
    try {
      const response = await askAI(question);
      
      // Симуляция задержки печати
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Отметка как прочитанное
      userMessage.read = true;
      
      // Создаем ответ AI
      const aiMessage: Message = {
        id: generateMessageId(),
        type: 'ai',
        text: response.answer,
        timestamp: new Date()
      };
      
      messages.value.push(aiMessage);
      
      if (!isOpen.value) {
        unreadCount.value++;
      } else {
        scrollToBottom(true);
      }
      
    } catch (error: any) {
      console.error('Ошибка при запросе к AI:', error);
      
      let errorMessage = 'Извините, произошла ошибка при обработке запроса. Попробуйте позже.';
      let errorIcon = 'mdi-alert-circle';
      
      if (error?.response?.status === 403) {
        errorMessage = 'Ошибка авторизации. Пожалуйста, перезайдите в систему.';
        errorIcon = 'mdi-lock-alert';
      } else if (error?.response?.status === 401) {
        errorMessage = 'Сессия истекла. Пожалуйста, перезайдите в систему.';
        errorIcon = 'mdi-clock-alert';
      } else if (error?.response?.status === 429) {
        errorMessage = 'Слишком много запросов. Пожалуйста, подождите немного.';
        errorIcon = 'mdi-timer-sand';
      } else if (error?.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      }
      
      const errorAiMessage: Message = {
        id: generateMessageId(),
        type: 'ai',
        text: errorMessage,
        timestamp: new Date()
      };
      
      messages.value.push(errorAiMessage);
      showSnackbar('Ошибка при отправке сообщения', 'error', errorIcon);
      
    } finally {
      loading.value = false;
      isTyping.value = false;
    }
  };
  
  const formatMessage = (text: string): string => {
    let formatted = text;
    
    // URL в ссылки
    formatted = formatted.replace(
      /(https?:\/\/[^\s]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer" class="message-link">$1</a>'
    );
    
    // Переносы строк
    formatted = formatted.replace(/\n/g, '<br>');
    
    // Жирный текст **текст**
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Курсив *текст*
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Код `код`
    formatted = formatted.replace(/`(.*?)`/g, '<code class="inline-code">$1</code>');
    
    // Списки
    formatted = formatted.replace(/^- (.+)$/gm, '<li>$1</li>');
    formatted = formatted.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
    
    return formatted;
  };
  
  const formatTime = (timestamp: Date): string => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    
    // Меньше минуты
    if (diff < 60000) {
      return 'только что';
    }
    
    // Меньше часа
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes} ${getMinuteWord(minutes)} назад`;
    }
    
    // Сегодня
    if (now.toDateString() === timestamp.toDateString()) {
      return timestamp.toLocaleTimeString('ru-RU', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
    
    // Вчера
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (yesterday.toDateString() === timestamp.toDateString()) {
      return `вчера в ${timestamp.toLocaleTimeString('ru-RU', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })}`;
    }
    
    // Другие даты
    return timestamp.toLocaleDateString('ru-RU', { 
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  const getMinuteWord = (count: number): string => {
    const lastDigit = count % 10;
    const lastTwoDigits = count % 100;
    
    if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
      return 'минут';
    }
    if (lastDigit === 1) {
      return 'минуту';
    }
    if (lastDigit >= 2 && lastDigit <= 4) {
      return 'минуты';
    }
    return 'минут';
  };
  
  const copyMessage = async (text: string, messageId: string) => {
    try {
      // Убираем HTML теги для копирования
      const plainText = text.replace(/<[^>]*>/g, '');
      await navigator.clipboard.writeText(plainText);
      
      copiedMessageId.value = messageId;
      showSnackbar('Скопировано в буфер обмена', 'success', 'mdi-content-copy');
      
      setTimeout(() => {
        copiedMessageId.value = null;
      }, 2000);
    } catch (error) {
      showSnackbar('Ошибка при копировании', 'error', 'mdi-alert');
    }
  };
  
  const likeMessage = (messageId: string) => {
    const message = messages.value.find(m => m.id === messageId);
    if (!message) return;
    
    message.liked = !message.liked;
    if (message.liked) {
      message.disliked = false;
      showSnackbar('Спасибо за отзыв!', 'success', 'mdi-thumb-up');
    }
  };
  
  const dislikeMessage = (messageId: string) => {
    const message = messages.value.find(m => m.id === messageId);
    if (!message) return;
    
    message.disliked = !message.disliked;
    if (message.disliked) {
      message.liked = false;
      showSnackbar('Спасибо, мы учтем ваш отзыв', 'info', 'mdi-thumb-down');
    }
  };
  
  const regenerateResponse = async (index: number) => {
    if (index < 1 || loading.value) return;
    
    const previousUserMessage = messages.value[index - 1];
    if (previousUserMessage?.type !== 'user') return;
    
    // Удаляем старый ответ
    messages.value.splice(index, 1);
    
    // Повторяем запрос
    currentQuestion.value = previousUserMessage.text;
    await sendMessage();
  };
  
  const showSnackbar = (text: string, color: string = 'success', icon: string = 'mdi-check-circle') => {
    snackbar.value = {
      show: true,
      text,
      color,
      icon,
      timeout: 3000
    };
  };
  
  // Watchers
  watch(messages, () => {
    nextTick(() => {
      if (!showScrollButton.value) {
        scrollToBottom(true);
      }
    });
  }, { deep: true });
  
  // Lifecycle
  onMounted(() => {
    if (messagesContainer.value) {
      messagesContainer.value.addEventListener('scroll', handleScroll);
    }
    
    // Восстановление истории из localStorage (опционально)
    const savedMessages = localStorage.getItem('ai-chat-messages');
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages);
        messages.value = parsed.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        }));
      } catch (e) {
        console.error('Ошибка восстановления истории чата:', e);
      }
    }
  });
  
  onUnmounted(() => {
    if (messagesContainer.value) {
      messagesContainer.value.removeEventListener('scroll', handleScroll);
    }
    
    if (userTypingTimeout.value) {
      clearTimeout(userTypingTimeout.value);
    }
    
    // Сохранение истории в localStorage (опционально)
    localStorage.setItem('ai-chat-messages', JSON.stringify(messages.value));
  });
  </script>
  
  <style scoped>
  /* ==================== ОСНОВНЫЕ СТИЛИ ==================== */
  .ai-chat-widget {
    border-radius: 24px;
    overflow: hidden;
    backdrop-filter: blur(20px);
    background: rgba(255, 255, 255, 0.98);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  /* ==================== ЗАГОЛОВОК ==================== */
  .chat-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    position: relative;
    overflow: hidden;
  }
  
  .chat-header::before {
    content: '';
    position: absolute;
    top: -50%;
    right: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
    animation: headerShine 8s linear infinite;
  }
  
  @keyframes headerShine {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .text-white-80 {
    opacity: 0.8;
  }
  
  .header-btn {
    color: white !important;
    transition: all 0.2s;
  }
  
  .header-btn:hover {
    background: rgba(255, 255, 255, 0.2) !important;
    transform: scale(1.1);
  }
  
  /* ==================== АВАТАР ==================== */
  .avatar-pulse {
    position: relative;
    box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.7);
    animation: avatarPulse 2s infinite;
  }
  
  @keyframes avatarPulse {
    0% {
      box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.7);
    }
    50% {
      box-shadow: 0 0 0 8px rgba(255, 255, 255, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(255, 255, 255, 0);
    }
  }
  
  .avatar-inner {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 50%;
  }
  
  /* ==================== СТАТУС ==================== */
  .status-indicator {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  
  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #4caf50;
    box-shadow: 0 0 8px #4caf50;
    animation: statusBreathe 2s ease-in-out infinite;
  }
  
  .status-dot.typing {
    background: #ff9800;
    box-shadow: 0 0 8px #ff9800;
    animation: statusTyping 1s ease-in-out infinite;
  }
  
  @keyframes statusBreathe {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  
  @keyframes statusTyping {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.2); }
  }
  
  /* ==================== СООБЩЕНИЯ ==================== */
  .messages-wrapper {
    height: 520px;
    overflow-y: auto;
    background: linear-gradient(to bottom, #f8f9fa 0%, #ffffff 50%, #f8f9fa 100%);
    scroll-behavior: smooth;
  }
  
  .messages-container {
    min-height: 100%;
    position: relative;
  }
  
  /* ==================== ПРИВЕТСТВЕННЫЙ ЭКРАН ==================== */
  .welcome-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100%;
    text-align: center;
    padding: 32px 20px;
    animation: welcomeFadeIn 0.6s ease-out;
  }
  
  @keyframes welcomeFadeIn {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .welcome-icon-wrapper {
    position: relative;
    animation: welcomeIconFloat 3s ease-in-out infinite;
  }
  
  @keyframes welcomeIconFloat {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }
  
  .welcome-icon {
    filter: drop-shadow(0 4px 12px rgba(102, 126, 234, 0.3));
  }
  
  .gradient-text {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  
  .suggestions-title {
    font-weight: 500;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }
  
  .suggested-questions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    max-width: 360px;
  }
  
  .suggestion-chip {
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    font-weight: 500;
  }
  
  .suggestion-chip:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  }
  
  /* ==================== АНИМАЦИИ СООБЩЕНИЙ ==================== */
  .message-list-enter-active {
    animation: messageSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .message-list-leave-active {
    animation: messageSlideOut 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  @keyframes messageSlideIn {
    from {
      opacity: 0;
      transform: translateY(20px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
  
  @keyframes messageSlideOut {
    from {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    to {
      opacity: 0;
      transform: translateY(-20px) scale(0.95);
    }
  }
  
  /* ==================== КОНТЕЙНЕРЫ СООБЩЕНИЙ ==================== */
  .message-wrapper {
    display: flex;
    flex-direction: column;
    width: 100%;
  }
  
  .user-wrapper {
    align-items: flex-end;
  }
  
  .ai-wrapper {
    align-items: flex-start;
  }
  
  .message-container {
    display: flex;
    align-items: flex-end;
    max-width: 90%;
    gap: 8px;
  }
  
  .message-avatar {
    flex-shrink: 0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    transition: transform 0.2s;
  }
  
  .message-avatar:hover {
    transform: scale(1.1);
  }
  
  .message-content {
    display: flex;
    flex-direction: column;
    max-width: 100%;
  }
  
  /* ==================== ПУЗЫРИ СООБЩЕНИЙ ==================== */
  .message-bubble {
    padding: 14px 18px;
    border-radius: 18px;
    word-wrap: break-word;
    position: relative;
    max-width: 100%;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .user-message {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    box-shadow: 0 4px 16px rgba(102, 126, 234, 0.3);
    border-bottom-right-radius: 4px;
  }
  
  .user-message:hover {
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
    transform: translateY(-1px);
  }
  
  .ai-message {
    background: white;
    color: #1a1a1a;
    border: 1px solid #e8e8e8;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    border-bottom-left-radius: 4px;
  }
  
  .ai-message:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    transform: translateY(-1px);
  }
  
  /* ==================== ТЕКСТ И ФОРМАТИРОВАНИЕ ==================== */
  .message-text {
    font-size: 15px;
    line-height: 1.6;
    font-weight: 400;
    letter-spacing: 0.01em;
  }
  
  .message-text :deep(a.message-link) {
    color: inherit;
    text-decoration: underline;
    opacity: 0.85;
    transition: opacity 0.2s;
  }
  
  .message-text :deep(a.message-link):hover {
    opacity: 1;
  }
  
  .message-text :deep(strong) {
    font-weight: 600;
  }
  
  .message-text :deep(em) {
    font-style: italic;
  }
  
  .message-text :deep(.inline-code) {
    background: rgba(0, 0, 0, 0.1);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'Courier New', monospace;
    font-size: 0.9em;
  }
  
  .user-message .message-text :deep(.inline-code) {
    background: rgba(255, 255, 255, 0.2);
  }
  
  .message-text :deep(ul) {
    margin: 8px 0;
    padding-left: 20px;
  }
  
  .message-text :deep(li) {
    margin: 4px 0;
  }
  
  /* ==================== МЕТАДАННЫЕ СООБЩЕНИЯ ==================== */
  .message-meta {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 4px;
  }
  
  .message-time {
    font-size: 11px;
    opacity: 0.6;
    font-weight: 500;
  }
  
  .message-status {
    opacity: 0.7;
  }
  
  /* ==================== ДЕЙСТВИЯ С СООБЩЕНИЯМИ ==================== */
  .message-actions {
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    margin-left: 44px;
  }
  
  .message-actions.show,
  .message-wrapper:hover .message-actions {
    opacity: 1;
  }
  
  /* ==================== ИНДИКАТОР ПЕЧАТИ ==================== */
  .typing-bubble {
    background: white;
    border: 1px solid #e8e8e8;
    border-radius: 18px;
    padding: 16px 20px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    border-bottom-left-radius: 4px;
    animation: typingBubblePulse 1.5s ease-in-out infinite;
  }
  
  @keyframes typingBubblePulse {
    0%, 100% {
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    }
    50% {
      box-shadow: 0 4px 16px rgba(102, 126, 234, 0.2);
    }
  }
  
  .typing-indicator {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  
  .typing-indicator span {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    animation: typingDot 1.4s infinite ease-in-out;
  }
  
  .typing-indicator span:nth-child(1) {
    animation-delay: 0s;
  }
  
  .typing-indicator span:nth-child(2) {
    animation-delay: 0.2s;
  }
  
  .typing-indicator span:nth-child(3) {
    animation-delay: 0.4s;
  }
  
  @keyframes typingDot {
    0%, 60%, 100% {
      transform: translateY(0) scale(1);
      opacity: 0.7;
    }
    30% {
      transform: translateY(-10px) scale(1.2);
      opacity: 1;
    }
  }
  
  /* ==================== КНОПКА ПРОКРУТКИ ==================== */
  .scroll-to-bottom {
    position: absolute;
    bottom: 16px;
    right: 16px;
    z-index: 10;
    background: white !important;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .scroll-to-bottom:hover {
    transform: scale(1.1);
  }
  
  /* ==================== ОБЛАСТЬ ВВОДА ==================== */
  .input-area {
    background: white;
    border-top: 2px solid #f0f0f0;
    position: relative;
  }
  
  .input-container {
    position: relative;
  }
  
  .input-wrapper {
    position: relative;
  }
  
  .message-input {
    transition: all 0.3s;
  }
  
  .message-input :deep(.v-field--focused) {
    box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
  }
  
  .attach-btn,
  .clear-btn {
    transition: all 0.2s;
  }
  
  .attach-btn:hover,
  .clear-btn:hover {
    transform: scale(1.1);
  }
  
  /* ==================== КНОПКА ОТПРАВКИ ==================== */
  .send-button {
    min-width: 56px !important;
    min-height: 56px !important;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  }
  
  .send-button:not(:disabled):hover {
    transform: scale(1.1) rotate(15deg);
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
  }
  
  .send-button:active {
    transform: scale(0.95);
  }
  
  /* ==================== ИНФОРМАЦИЯ ==================== */
  .typing-text {
    color: #667eea;
    font-weight: 500;
    animation: typingTextPulse 1s ease-in-out infinite;
  }
  
  @keyframes typingTextPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }
  
  /* ==================== КНОПКА ОТКРЫТИЯ ЧАТА ==================== */
  .chat-fab {
    position: relative;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4);
  }
  
  .chat-fab:hover {
    transform: scale(1.15) rotate(5deg);
    box-shadow: 0 12px 32px rgba(102, 126, 234, 0.6);
  }
  
  .chat-fab:active {
    transform: scale(1.05);
  }
  
  .fab-pulse {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: rgba(102, 126, 234, 0.4);
    transform: translate(-50%, -50%);
    animation: fabPulseAnimation 2s ease-out infinite;
  }
  
  @keyframes fabPulseAnimation {
    0% {
      transform: translate(-50%, -50%) scale(1);
      opacity: 1;
    }
    100% {
      transform: translate(-50%, -50%) scale(1.8);
      opacity: 0;
    }
  }
  
  /* ==================== ПЕРЕХОДЫ ==================== */
  .chat-slide-enter-active,
  .chat-slide-leave-active {
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .chat-slide-enter-from {
    opacity: 0;
    transform: translateY(30px) scale(0.9);
  }
  
  .chat-slide-leave-to {
    opacity: 0;
    transform: translateY(30px) scale(0.9);
  }
  
  .fab-scale-enter-active,
  .fab-scale-leave-active {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .fab-scale-enter-from,
  .fab-scale-leave-to {
    opacity: 0;
    transform: scale(0);
  }
  
  .fade-enter-active,
  .fade-leave-active {
    transition: opacity 0.3s ease;
  }
  
  .fade-enter-from,
  .fade-leave-to {
    opacity: 0;
  }
  
  /* ==================== СКРОЛЛБАР ==================== */
  .messages-wrapper::-webkit-scrollbar {
    width: 8px;
  }
  
  .messages-wrapper::-webkit-scrollbar-track {
    background: transparent;
  }
  
  .messages-wrapper::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
    border-radius: 4px;
    transition: background 0.3s;
  }
  
  .messages-wrapper::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(180deg, #764ba2 0%, #667eea 100%);
  }
  
  /* ==================== АДАПТИВНОСТЬ ==================== */
  @media (max-width: 600px) {
    .ai-chat-widget {
      bottom: 0 !important;
      right: 0 !important;
      left: 0 !important;
      width: 100% !important;
      max-height: 100vh !important;
      border-radius: 0 !important;
    }
    
    .messages-wrapper {
      height: calc(100vh - 260px) !important;
    }
    
    .welcome-screen {
      padding: 24px 16px;
    }
    
    .suggested-questions {
      max-width: 100%;
    }
    
    .message-container {
      max-width: 95%;
    }
  }
  
  /* ==================== ТЕМНАЯ ТЕМА (ОПЦИОНАЛЬНО) ==================== */
  @media (prefers-color-scheme: dark) {
    .ai-chat-widget {
      background: rgba(30, 30, 30, 0.98);
    }
    
    .messages-wrapper {
      background: linear-gradient(to bottom, #1a1a1a 0%, #2a2a2a 50%, #1a1a1a 100%);
    }
    
    .ai-message {
      background: #2a2a2a;
      border-color: #3a3a3a;
      color: #e0e0e0;
    }
    
    .typing-bubble {
      background: #2a2a2a;
      border-color: #3a3a3a;
    }
    
    .input-area {
      background: #1a1a1a;
      border-top-color: #3a3a3a;
    }
  }
  </style>