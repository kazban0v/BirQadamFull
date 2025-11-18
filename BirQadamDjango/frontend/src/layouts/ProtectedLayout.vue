<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { RouterView, useRouter } from 'vue-router';

import { useAuthStore } from '@/stores/auth';
import { useDashboardStore } from '@/stores/dashboard';
import { useOrganizerStore } from '@/stores/organizer';

const authStore = useAuthStore();
const dashboardStore = useDashboardStore();
const organizerStore = useOrganizerStore();
const router = useRouter();
const drawer = ref(true);
const isMobile = ref(false);

const handleResize = () => {
  isMobile.value = window.matchMedia('(max-width: 960px)').matches;
  drawer.value = !isMobile.value;
};

onMounted(async () => {
  authStore.initialize();
  handleResize();
  window.addEventListener('resize', handleResize, { passive: true });
  // Загружаем данные дашборда для счетчиков
  if (authStore.isAuthenticated) {
    if (isOrganizer.value) {
      await organizerStore.loadProjects();
      await organizerStore.loadPhotoReports();
    } else {
      await dashboardStore.loadDashboard();
    }
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
});

const isOrganizer = computed(
  () => !!authStore.user && (authStore.user.role === 'organizer' || authStore.user.is_organizer),
);

const menuItems = computed(() => {
  const summary = dashboardStore.summary;
  const moderation = dashboardStore.moderation;
  
  if (isOrganizer.value) {
    const photoCount = organizerStore.photoCounters?.pending || 0;
    return [
      { title: 'Главная', icon: 'mdi-view-dashboard-outline', to: '/organizer/dashboard', badge: null },
      { title: 'Задачи', icon: 'mdi-clipboard-check-outline', to: '/organizer/tasks', badge: null },
      { title: 'Проекты', icon: 'mdi-briefcase-outline', to: '/organizer/projects', badge: organizerStore.projects.length || null },
      { title: 'Команда', icon: 'mdi-account-multiple-outline', to: '/organizer/volunteers', badge: null },
      { title: 'Фотоотчёты', icon: 'mdi-image-search-outline', to: '/organizer/photo-moderation', badge: photoCount > 0 ? photoCount : null },
      { title: 'Профиль', icon: 'mdi-account-circle-outline', to: '/organizer/profile', badge: null },
    ];
  }
  
  const activeTasks = summary?.active_tasks || 0;
  const activeProjects = summary?.active_projects || 0;
  
  // Вычисляем непрочитанные уведомления с учетом Activity из localStorage
  // Используем функцию для получения прочитанных Activity ID
  function getReadActivityCount(): number {
    if (!authStore.user) return 0;
    const key = `read_activities_${authStore.user.id}`;
    const stored = localStorage.getItem(key);
    if (!stored) return 0;
    try {
      const ids = JSON.parse(stored) as number[];
      return ids.length;
    } catch {
      return 0;
    }
  }
  
  // Базовый счетчик из dashboard (включает все Activity)
  const baseUnread = summary?.unread_notifications || 0;
  // Вычитаем прочитанные Activity (хранятся в localStorage)
  const readActivityCount = getReadActivityCount();
  // Итоговый счетчик непрочитанных
  const computedUnreadNotifications = Math.max(0, baseUnread - readActivityCount);
  
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
  if (isOrganizer.value) {
    return authStore.user.organization_name || authStore.user.full_name || authStore.user.username || 'Организатор';
  }
  return authStore.user.full_name || authStore.user.username || 'Волонтёр';
});

const profileRoute = computed(() => (isOrganizer.value ? '/organizer/profile' : '/volunteer/profile'));

const handleLogout = async () => {
  await authStore.logout();
  dashboardStore.reset();
  organizerStore.reset();
  router.push('/');
};
</script>

<template>
  <v-app class="protected-layout">
    <v-navigation-drawer
      v-model="drawer"
      app
      class="text-white"
      color="primary"
      :temporary="isMobile"
      :permanent="!isMobile"
      width="280"
    >
      <div class="d-flex align-center pa-4 justify-space-between">
        <h2 class="text-h6 font-weight-bold mb-0">BirQadam</h2>
        <v-btn
          icon="mdi-close"
          variant="text"
          color="white"
          class="d-lg-none"
          @click="drawer = false"
        />
      </div>
      <v-divider class="opacity-50" />
      <v-list nav density="comfortable">
        <v-list-item
          v-for="item in menuItems"
          :key="item.title"
          :to="item.to"
          link
          rounded="lg"
          class="text-white"
          @click="isMobile && (drawer = false)"
        >
          <template #prepend>
            <v-icon :icon="item.icon" />
          </template>
          <v-list-item-title>{{ item.title }}</v-list-item-title>
          <template #append v-if="item.badge != null && item.badge > 0">
            <v-badge
              :content="String(item.badge)"
              :model-value="true"
              color="error"
              inline
            />
          </template>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>

    <v-app-bar app elevation="0" color="white" height="72" class="protected-app-bar">
      <v-container class="app-bar__container">
        <div class="app-bar__title-block d-flex align-center ga-3">
          <v-btn
            icon="mdi-menu"
            class="d-lg-none"
            variant="text"
            color="primary"
            @click="drawer = !drawer"
          />
          <div class="app-bar__title-text">
            <h1 class="text-h6 text-md-h5 font-weight-bold mb-0">{{ headerTitle }}</h1>
            <span class="text-body-2 text-medium-emphasis">{{ accountName }}</span>
          </div>
        </div>
        <div class="app-bar__actions d-flex align-center ga-2 ga-sm-3 flex-wrap justify-end">
          <v-btn
            v-if="!isOrganizer"
            variant="text"
            color="primary"
            class="text-none font-weight-bold"
            :to="profileRoute"
          >
            Профиль
          </v-btn>
          <v-btn
            v-else
            variant="text"
            color="primary"
            class="text-none font-weight-bold"
            :to="profileRoute"
          >
            Профиль
          </v-btn>
          <v-btn
            variant="outlined"
            color="primary"
            class="text-none font-weight-bold"
            @click="handleLogout"
          >
            Выйти
          </v-btn>
        </div>
      </v-container>
    </v-app-bar>

    <v-main style="background-color: #f8ecc4;"> <!-- BirQadam background -->
      <v-container fluid class="main-container py-6 py-sm-8">
        <RouterView />
      </v-container>
    </v-main>
  </v-app>
</template>

<style scoped>
.protected-layout :deep(.v-navigation-drawer) {
  backdrop-filter: blur(8px);
}

.protected-app-bar :deep(.v-toolbar__content) {
  min-height: 72px;
  padding-top: 6px;
  padding-bottom: 6px;
}

.app-bar__container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.app-bar__title-block {
  flex: 1 1 auto;
  min-width: 0;
}

.app-bar__title-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.app-bar__title-text h1,
.app-bar__title-text span {
  white-space: normal;
  word-break: break-word;
}

.app-bar__actions {
  flex-shrink: 0;
}

.main-container {
  padding-left: clamp(16px, 5vw, 48px);
  padding-right: clamp(16px, 5vw, 48px);
}

@media (max-width: 960px) {
  .main-container {
    padding-left: clamp(12px, 4vw, 24px);
    padding-right: clamp(12px, 4vw, 24px);
  }
}

@media (max-width: 600px) {
  .protected-app-bar {
    height: 96px;
  }

  .protected-app-bar :deep(.v-toolbar__content) {
    min-height: 96px;
  }

  .app-bar__container {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .app-bar__title-block {
    width: 100%;
    justify-content: space-between;
    gap: 12px;
  }

  .app-bar__title-text {
    flex: 1 1 auto;
  }

  .app-bar__title-text span {
    font-size: 0.85rem;
  }

  .app-bar__actions {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
