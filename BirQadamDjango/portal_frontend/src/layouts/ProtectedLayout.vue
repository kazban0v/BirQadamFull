<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, reactive, watch } from 'vue';
import { RouterView, useRouter, useRoute } from 'vue-router';

import { useAuthStore } from '@/stores/auth';
import { useDashboardStore } from '@/stores/dashboard';
import { useOrganizerStore } from '@/stores/organizer';
import { getProjectChat, getChatMessages, type ChatMessage } from '@/services/chat';
import { fetchVolunteerProjects } from '@/services/projects';
import AIChatWidget from '@/components/AIChatWidget.vue';

const authStore = useAuthStore();
const dashboardStore = useDashboardStore();
const organizerStore = useOrganizerStore();
const router = useRouter();
const route = useRoute();
const drawer = ref(true);
const isMobile = ref(false);
const isNavigating = ref(false);
const lastScrollY = ref(0);
const isHeaderVisible = ref(true);
const isScrollingDown = ref(false);

const handleResize = () => {
  isMobile.value = window.matchMedia('(max-width: 960px)').matches;
  drawer.value = !isMobile.value;
};

const handleScroll = () => {
  if (!isMobile.value) {
    isHeaderVisible.value = true;
    return;
  }
  const currentScrollY = Math.max(
    window.scrollY || 0,
    document.documentElement.scrollTop || 0,
    document.body.scrollTop || 0
  );
  const scrollDifference = currentScrollY - lastScrollY.value;
  const threshold = 5;
  if (scrollDifference > threshold && currentScrollY > 50) {
    if (!isScrollingDown.value) { isScrollingDown.value = true; isHeaderVisible.value = false; }
  } else if (scrollDifference < -threshold) {
    if (isScrollingDown.value) { isScrollingDown.value = false; isHeaderVisible.value = true; }
  }
  if (currentScrollY <= 50) { isHeaderVisible.value = true; isScrollingDown.value = false; }
  lastScrollY.value = currentScrollY;
};

const chatNotification = reactive({
  show: false,
  message: '',
  projectTitle: '',
  projectId: null as number | null,
  chatId: null as number | null,
});

let chatPollingInterval: ReturnType<typeof setInterval> | null = null;
const lastCheckedMessages = ref<Record<number, number>>({});

async function checkForNewChatMessages() {
  if (isOrganizer.value || !authStore.isAuthenticated) return;
  try {
    const data = await fetchVolunteerProjects();
    const joinedProjects = data.projects.filter((p: any) => p.joined);
    for (const project of joinedProjects) {
      try {
        const chat = await getProjectChat(project.id);
        if (!chat || !chat.id) continue;
        const response = await getChatMessages(chat.id, 5, 0);
        if (!response.messages || response.messages.length === 0) continue;
        const lastOrganizerMessage = response.messages
          .filter((msg: ChatMessage) => msg.sender_is_organizer && !msg.is_read)
          .sort((a: ChatMessage, b: ChatMessage) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        if (lastOrganizerMessage) {
          const lastMessageId = lastOrganizerMessage.id;
          const lastCheckedId = lastCheckedMessages.value[chat.id] || 0;
          if (lastMessageId > lastCheckedId) {
            chatNotification.show = true;
            chatNotification.message = lastOrganizerMessage.text;
            chatNotification.projectTitle = project.title;
            chatNotification.projectId = project.id;
            chatNotification.chatId = chat.id;
            lastCheckedMessages.value[chat.id] = lastMessageId;
            setTimeout(() => { chatNotification.show = false; }, 10000);
          }
        }
      } catch (error) {
        console.error(`Failed to check chat for project ${project.id}:`, error);
      }
    }
  } catch (error) {
    console.error('Failed to check for new chat messages:', error);
  }
}

function startChatPolling() {
  if (isOrganizer.value) return;
  stopChatPolling();
  chatPollingInterval = setInterval(checkForNewChatMessages, 5000);
  checkForNewChatMessages();
}

function stopChatPolling() {
  if (chatPollingInterval) { clearInterval(chatPollingInterval); chatPollingInterval = null; }
}

function closeChatNotification() { chatNotification.show = false; }

function openChatFromNotification() {
  if (chatNotification.projectId) {
    chatNotification.show = false;
    router.push({ name: 'volunteer-projects', query: { openChat: chatNotification.projectId.toString() } });
  }
}

// Navigation loading handler
function handleNavigationClick(event: MouseEvent) {
  // Close mobile drawer
  if (isMobile.value) {
    drawer.value = false;
  }
  
  // Show loading immediately when clicking navigation item
  // The router guards will handle hiding it
  isNavigating.value = true;
}

// Router navigation guards for loading state
router.beforeEach((to, from, next) => {
  // Only show loading if navigating to a different route
  if (to.path !== from.path) {
    isNavigating.value = true;
  }
  next();
});

router.afterEach(() => {
  // Hide loading after navigation completes
  // Small delay to ensure smooth transition
  setTimeout(() => {
    isNavigating.value = false;
  }, 500);
});

onMounted(async () => {
  authStore.initialize();
  handleResize();
  lastScrollY.value = window.scrollY || document.documentElement.scrollTop || 0;
  window.addEventListener('resize', handleResize, { passive: true });
  window.addEventListener('scroll', handleScroll, { passive: true });
  const mainElement = document.querySelector('.v-main');
  if (mainElement) mainElement.addEventListener('scroll', handleScroll, { passive: true });
  if (authStore.isAuthenticated) {
    if (isOrganizer.value) {
      await organizerStore.loadProjects();
      await organizerStore.loadPhotoReports();
    } else {
      await dashboardStore.loadDashboard();
      startChatPolling();
    }
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('scroll', handleScroll);
  stopChatPolling();
});

const isOrganizer = computed(
  () => !!authStore.user &&
    (authStore.user.role === 'organizer' || authStore.user.is_organizer) &&
    authStore.user.organizer_status === 'approved',
);

const menuItems = computed(() => {
  const summary = dashboardStore.summary;
  if (isOrganizer.value) {
    const photoCount = organizerStore.photoCounters?.pending || 0;
    return [
      { title: 'Главная', icon: 'mdi-view-dashboard-outline', to: '/organizer/dashboard', badge: null },
      { title: 'Проекты и задачи', icon: 'mdi-briefcase-outline', to: '/organizer/projects', badge: organizerStore.projects.length || null },
      { title: 'Команда', icon: 'mdi-account-multiple-outline', to: '/organizer/volunteers', badge: null },
      { title: 'Фотоотчёты', icon: 'mdi-image-multiple-outline', to: '/organizer/photo-moderation', badge: photoCount > 0 ? photoCount : null },
      { title: 'Аналитика', icon: 'mdi-chart-line', to: '/organizer/analytics', badge: null },
      { title: 'Профиль', icon: 'mdi-account-circle-outline', to: '/organizer/profile', badge: null },
    ];
  }
  const activeTasks = summary?.active_tasks || 0;
  const activeProjects = summary?.active_projects || 0;
  function getReadActivityCount(): number {
    if (!authStore.user) return 0;
    const key = `read_activities_${authStore.user.id}`;
    const stored = localStorage.getItem(key);
    if (!stored) return 0;
    try { return (JSON.parse(stored) as number[]).length; } catch { return 0; }
  }
  const baseUnread = summary?.unread_notifications || 0;
  const computedUnreadNotifications = Math.max(0, baseUnread - getReadActivityCount());
  return [
    { title: 'Главная', icon: 'mdi-view-dashboard-outline', to: '/volunteer/dashboard', badge: null },
    { title: 'Проекты', icon: 'mdi-map-search-outline', to: '/volunteer/projects', badge: activeProjects > 0 ? activeProjects : null },
    { title: 'Задачи', icon: 'mdi-clipboard-check-outline', to: '/volunteer/tasks', badge: activeTasks > 0 ? activeTasks : null },
    { title: 'Уведомления', icon: 'mdi-bell-outline', to: '/volunteer/notifications', badge: computedUnreadNotifications > 0 ? computedUnreadNotifications : null },
    { title: 'Фотоотчёты', icon: 'mdi-camera-outline', to: '/volunteer/photo-reports', badge: summary?.pending_photos ? summary.pending_photos : null },
    { title: 'Достижения', icon: 'mdi-trophy-outline', to: '/volunteer/achievements', badge: null },
    { title: 'Мой профиль', icon: 'mdi-account-circle-outline', to: '/volunteer/profile', badge: null },
  ];
});

const headerTitle = computed(() => (isOrganizer.value ? 'Кабинет организатора' : 'Кабинет волонтёра'));

const accountName = computed(() => {
  if (!authStore.user) return 'Гость';
  return authStore.user.full_name || authStore.user.username || (isOrganizer.value ? 'Организатор' : 'Волонтёр');
});

const userInitials = computed(() => {
  const name = accountName.value;
  if (!name) return '??';
  const parts = name.split(' ').filter(Boolean);
  if (parts.length >= 2) {
    const first = parts[0]?.[0];
    const second = parts[1]?.[0];
    if (first && second) {
      return (first + second).toUpperCase();
    }
  }
  return name.slice(0, 2).toUpperCase();
});

const profileRoute = computed(() => (isOrganizer.value ? '/organizer/profile' : '/volunteer/profile'));

const headerStyle = computed(() => {
  if (!isMobile.value) return {};
  return {
    transform: isHeaderVisible.value ? 'translateY(0)' : 'translateY(-100%)',
    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  };
});

const handleLogout = async () => {
  await authStore.logout();
  dashboardStore.reset();
  organizerStore.reset();
  router.push({ name: 'home' });
};
</script>

<template>
  <v-app class="protected-layout">

    <!-- ─── Navigation Drawer ─── -->
    <v-navigation-drawer
      v-model="drawer"
      app
      :temporary="isMobile"
      :permanent="!isMobile"
      width="260"
      class="nav-drawer"
    >
      <!-- Logo / Brand -->
      <div class="nav-brand">
        <div class="nav-brand__logo">
          <v-icon icon="mdi-leaf" size="22" color="white" />
        </div>
        <span class="nav-brand__name">BirQadam</span>
        <v-spacer />
        <v-btn
          icon="mdi-close"
          variant="text"
          size="small"
          class="d-lg-none nav-close-btn"
          @click="drawer = false"
        />
      </div>

      <!-- Role label -->
      <div class="nav-role-badge">
        <v-icon :icon="isOrganizer ? 'mdi-briefcase-outline' : 'mdi-hand-heart-outline'" size="14" />
        {{ isOrganizer ? 'Организатор' : 'Волонтёр' }}
      </div>

      <!-- Menu -->
      <nav class="nav-menu">
        <router-link
          v-for="item in menuItems"
          :key="item.title"
          :to="item.to"
          class="nav-item"
          active-class="nav-item--active"
          @click="handleNavigationClick"
        >
          <v-icon :icon="item.icon" size="20" class="nav-item__icon" />
          <span class="nav-item__label">{{ item.title }}</span>
          <span v-if="item.badge" class="nav-item__badge">{{ item.badge }}</span>
        </router-link>
      </nav>

      <!-- User footer -->
      <div class="nav-footer">
        <div class="nav-user">
          <div class="nav-user__avatar">{{ userInitials }}</div>
          <div class="nav-user__info">
            <div class="nav-user__name">{{ accountName }}</div>
            <div class="nav-user__role">{{ isOrganizer ? 'Организатор' : 'Волонтёр' }}</div>
          </div>
        </div>
      </div>
    </v-navigation-drawer>

    <!-- ─── App Bar ─── -->
    <v-app-bar
      app
      elevation="0"
      color="transparent"
      height="68"
      class="protected-app-bar"
      :style="headerStyle"
    >
      <div class="app-bar__inner">
        <!-- Left: Hamburger + Title -->
        <div class="app-bar__left">
          <v-btn
            icon="mdi-menu"
            variant="text"
            class="d-lg-none menu-btn"
            @click="drawer = !drawer"
          />
          <div class="app-bar__heading">
            <h1 class="app-bar__title">{{ headerTitle }}</h1>
            <span class="app-bar__subtitle">{{ accountName }}</span>
          </div>
        </div>

        <!-- Right: Actions -->
        <div class="app-bar__right">
          <v-btn
            :to="profileRoute"
            variant="text"
            class="text-none app-bar__profile-btn"
            rounded="pill"
          >
            <div class="app-bar__avatar">{{ userInitials }}</div>
            <span class="app-bar__profile-name d-none d-sm-inline">{{ accountName }}</span>
          </v-btn>
          <v-btn
            variant="outlined"
            class="text-none app-bar__logout-btn"
            rounded="pill"
            @click="handleLogout"
          >
            <v-icon icon="mdi-logout" size="16" start />
            <span class="d-none d-sm-inline">Выйти</span>
          </v-btn>
        </div>
      </div>
    </v-app-bar>

    <!-- ─── Main Content ─── -->
    <v-main class="main-area">
      <div class="main-content">
        <RouterView />
      </div>
      
      <!-- Navigation Loading Overlay -->
      <v-overlay
        v-model="isNavigating"
        class="navigation-overlay"
        persistent
        opacity="0.8"
        scrim="rgba(0, 0, 0, 0.5)"
      >
        <div class="navigation-loader">
          <v-progress-circular
            indeterminate
            color="primary"
            :size="isMobile ? 56 : 64"
            :width="isMobile ? 5 : 6"
            class="navigation-loader__spinner"
          />
          <p class="navigation-loader__text">Загрузка...</p>
        </div>
      </v-overlay>
    </v-main>

    <!-- ─── Chat notification snackbar ─── -->
    <v-snackbar
      v-model="chatNotification.show"
      :timeout="10000"
      location="top right"
      color="primary"
      elevation="6"
      rounded="xl"
      class="chat-snackbar"
    >
      <div class="chat-snackbar__body">
        <div class="chat-snackbar__icon">
          <v-icon icon="mdi-chat-processing-outline" size="22" />
        </div>
        <div class="chat-snackbar__content">
          <div class="chat-snackbar__from">Новое сообщение · {{ chatNotification.projectTitle }}</div>
          <div class="chat-snackbar__text">
            {{ chatNotification.message.length > 60 ? chatNotification.message.substring(0, 60) + '…' : chatNotification.message }}
          </div>
        </div>
        <v-btn icon="mdi-close" variant="text" size="x-small" @click="closeChatNotification" />
      </div>
      <template #actions>
        <v-btn
          variant="flat"
          color="white"
          size="small"
          rounded="pill"
          class="text-none font-weight-bold"
          style="color: #558b2f"
          @click="openChatFromNotification"
        >
          Открыть
        </v-btn>
      </template>
    </v-snackbar>

    <!-- AI Chat Widget -->
    <AIChatWidget />
  </v-app>
</template>

<style scoped>
/* ─── Layout base ─── */
.protected-layout {
  background: #f4f7f2 !important;
}

/* ─── Navigation Drawer ─── */
.nav-drawer {
  background: linear-gradient(180deg, #2d5a1b 0%, #3a7422 55%, #4a8f2a 100%) !important;
  border-right: none !important;
  box-shadow: 4px 0 24px rgba(0, 0, 0, 0.12) !important;
}

/* Brand */
.nav-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px 20px 12px;
}

.nav-brand__logo {
  width: 36px;
  height: 36px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.nav-brand__name {
  font-size: 1.25rem;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: -0.3px;
}

.nav-close-btn {
  color: rgba(255, 255, 255, 0.7) !important;
}

/* Role badge */
.nav-role-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin: 0 20px 16px;
  padding: 4px 10px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 100px;
  font-size: 0.72rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
  text-transform: uppercase;
  letter-spacing: 0.6px;
  width: fit-content;
}

/* Menu */
.nav-menu {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 12px;
  flex: 1;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 12px;
  text-decoration: none;
  color: rgba(255, 255, 255, 0.75);
  font-size: 0.9rem;
  font-weight: 500;
  transition: background 0.18s, color 0.18s;
  position: relative;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

.nav-item--active {
  background: rgba(255, 255, 255, 0.18) !important;
  color: #ffffff !important;
  font-weight: 700;
}

.nav-item--active .nav-item__icon {
  opacity: 1;
}

.nav-item__icon {
  opacity: 0.75;
  flex-shrink: 0;
}

.nav-item__label {
  flex: 1;
}

.nav-item__badge {
  background: #ff5252;
  color: #fff;
  font-size: 0.68rem;
  font-weight: 700;
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  border-radius: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Footer */
.nav-footer {
  padding: 14px 16px;
  margin: 8px 12px 12px;
  background: rgba(0, 0, 0, 0.15);
  border-radius: 14px;
}

.nav-user {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.nav-user__avatar {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.25);
  color: #fff;
  font-size: 0.75rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.nav-user__name {
  font-size: 0.825rem;
  font-weight: 600;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nav-user__role {
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.55);
}

/* ─── App Bar ─── */
.protected-app-bar {
  background: transparent !important;
  box-shadow: none !important;
  will-change: transform;
}

.protected-app-bar :deep(.v-toolbar__content) {
  padding: 0 !important;
  height: 68px !important;
}

.app-bar__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 68px;
  padding: 0 24px;
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(139, 195, 74, 0.12);
  box-shadow: 0 1px 12px rgba(0, 0, 0, 0.06);
}

.app-bar__left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.menu-btn {
  color: #558b2f !important;
}

.app-bar__heading {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.app-bar__title {
  font-size: 1.05rem;
  font-weight: 800;
  line-height: 1.2;
  color: #1a1a1a;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.app-bar__subtitle {
  font-size: 0.775rem;
  color: rgba(0, 0, 0, 0.45);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.app-bar__right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.app-bar__profile-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px 4px 4px !important;
  color: #1a1a1a !important;
}

.app-bar__avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #8bc34a, #558b2f);
  color: #fff;
  font-size: 0.72rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.app-bar__profile-name {
  font-size: 0.875rem;
  font-weight: 600;
}

.app-bar__logout-btn {
  border-color: rgba(139, 195, 74, 0.4) !important;
  color: #558b2f !important;
  font-weight: 600;
  font-size: 0.85rem;
}

.app-bar__logout-btn:hover {
  background: rgba(139, 195, 74, 0.08) !important;
}

/* ─── Main area ─── */
.main-area {
  background: #f0f5ee !important;
}

.main-content {
  padding: clamp(16px, 3vw, 36px) clamp(16px, 4vw, 40px);
  max-width: 100%;
  position: relative;
}

.navigation-overlay {
  z-index: 9999 !important;
}

.navigation-overlay :deep(.v-overlay__content) {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 100% !important;
  height: 100% !important;
}

.navigation-loader {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 24px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  min-width: 160px;
  
  &__spinner {
    flex-shrink: 0;
  }
  
  &__text {
    color: #1a1a1a;
    font-size: 1rem;
    font-weight: 600;
    margin: 0;
    text-align: center;
  }
  
  /* Mobile adaptation */
  @media (max-width: 960px) {
    gap: 16px;
    padding: 20px;
    min-width: 140px;
    border-radius: 12px;
    
    &__text {
      font-size: 0.9rem;
      font-weight: 500;
    }
  }
  
  /* Small mobile devices */
  @media (max-width: 600px) {
    gap: 12px;
    padding: 16px;
    min-width: 120px;
    border-radius: 10px;
    
    &__text {
      font-size: 0.85rem;
    }
  }
}

/* ─── Chat notification ─── */
.chat-snackbar :deep(.v-snackbar__wrapper) {
  border-radius: 16px !important;
  min-width: 320px;
  max-width: 400px;
}

.chat-snackbar__body {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
}

.chat-snackbar__icon {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.chat-snackbar__content {
  flex: 1;
  min-width: 0;
}

.chat-snackbar__from {
  font-size: 0.8rem;
  font-weight: 700;
  opacity: 0.9;
  margin-bottom: 2px;
}

.chat-snackbar__text {
  font-size: 0.825rem;
  opacity: 0.75;
  line-height: 1.4;
}

/* ─── Mobile adjustments ─── */
@media (max-width: 960px) {
  .protected-app-bar {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    z-index: 1000 !important;
  }

  .main-content {
    padding-top: 24px;
  }
}

@media (max-width: 600px) {
  .app-bar__inner {
    padding: 0 14px;
  }

  .app-bar__title {
    font-size: 0.95rem;
  }

  .main-content {
    padding: 16px 14px 32px;
  }
}
</style>