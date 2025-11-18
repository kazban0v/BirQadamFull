<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink, RouterView } from 'vue-router';

import { useAuthStore } from '@/stores/auth';

const drawer = ref(false);
const year = new Date().getFullYear();
const authStore = useAuthStore();

onMounted(() => {
  authStore.initialize();
});

const navigationLinks = [
  { title: 'Главная', to: { path: '/' } },
  { title: 'Услуги', to: { path: '/', hash: '#services' } },
  { title: 'FAQ', to: { path: '/', hash: '#faq' } },
];

const isAuthenticated = computed(() => authStore.isAuthenticated);
const volunteerName = computed(() => {
  if (!authStore.user) return 'Мой кабинет';
  if (authStore.user.role === 'organizer' || authStore.user.is_organizer) {
    return authStore.user.organization_name || authStore.user.full_name || authStore.user.username || 'Организатор';
  }
  return authStore.user.full_name || authStore.user.username || 'Мой кабинет';
});

const dashboardRoute = computed(() =>
  authStore.user && (authStore.user.role === 'organizer' || authStore.user.is_organizer)
    ? '/organizer/dashboard'
    : '/volunteer/dashboard',
);

const handleLogout = async () => {
  await authStore.logout();
};
</script>

<template>
  <v-app>
    <v-navigation-drawer
      v-model="drawer"
      class="d-md-none"
      color="primary"
      temporary
    >
      <v-list nav>
        <v-list-item
          v-for="link in navigationLinks"
          :key="link.title"
          :to="link.to"
          link
          class="text-white"
          @click="drawer = false"
        >
          <v-list-item-title>{{ link.title }}</v-list-item-title>
        </v-list-item>
        <v-divider class="my-4" />
        <template v-if="isAuthenticated">
          <v-list-item :to="dashboardRoute" link class="text-white" @click="drawer = false">
            Кабинет
          </v-list-item>
          <v-list-item @click="handleLogout" class="text-white">
            Выйти
          </v-list-item>
        </template>
        <template v-else>
          <v-list-item to="/login" link class="text-white" @click="drawer = false">
            Войти
          </v-list-item>
          <v-list-item to="/register/volunteer" link class="text-white" @click="drawer = false">
            Стать волонтёром
          </v-list-item>
          <v-list-item to="/register/organizer" link class="text-white" @click="drawer = false">
            Стать организатором
          </v-list-item>
        </template>
      </v-list>
    </v-navigation-drawer>

    <v-app-bar elevation="1" color="primary" density="comfortable">
      <v-container class="d-flex align-center justify-space-between">
        <RouterLink to="/" class="text-white text-decoration-none text-h6 font-weight-bold">
          BirQadam
        </RouterLink>

        <div class="d-none d-md-flex align-center ga-6">
          <RouterLink
            v-for="link in navigationLinks"
            :key="link.title"
            :to="link.to"
            class="text-white text-decoration-none font-weight-medium"
          >
            {{ link.title }}
          </RouterLink>
        </div>

        <div class="d-none d-md-flex align-center ga-3">
          <template v-if="isAuthenticated">
            <v-btn variant="text" color="white" class="text-none font-weight-bold" :to="dashboardRoute">
              {{ volunteerName }}
            </v-btn>
            <v-btn variant="text" color="white" class="text-none font-weight-bold" @click="handleLogout">
              Выйти
            </v-btn>
          </template>
          <template v-else>
            <v-btn variant="text" color="white" class="text-none font-weight-bold" to="/login">
              Войти
            </v-btn>
            <v-btn color="warning" class="text-none font-weight-bold" to="/register/volunteer">
              Стать волонтёром
            </v-btn>
            <v-btn
              variant="outlined"
              color="white"
              class="text-none font-weight-bold"
              to="/register/organizer"
            >
              Стать организатором
            </v-btn>
          </template>
        </div>

        <v-app-bar-nav-icon class="d-md-none" color="white" @click="drawer = !drawer" />
      </v-container>
    </v-app-bar>

    <v-main>
      <RouterView />
    </v-main>

    <v-footer height="auto" color="primary-darken-2" class="py-6">
      <v-container class="text-center text-white">
        © {{ year }} BirQadam. Все права защищены.
      </v-container>
    </v-footer>
  </v-app>
</template>

