<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const drawer = ref(false);
const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();

const AUTH_ROUTE_NAMES = new Set([
  'login',
  'register-volunteer',
  'register-organizer',
  'password-reset',
]);
const isAuthChromeRoute = computed(() => AUTH_ROUTE_NAMES.has(String(route.name ?? '')));

// ── Scroll hide/show ──────────────────────────────────────────
const navbarVisible = ref(true);
let lastScrollY = 0;

const onScroll = () => {
  const currentY = window.scrollY;
  if (currentY <= 10) {
    navbarVisible.value = true;
  } else if (currentY > lastScrollY + 5) {
    navbarVisible.value = false;
  } else if (currentY < lastScrollY - 5) {
    navbarVisible.value = true;
  }
  lastScrollY = currentY;
};

onMounted(() => {
  authStore.initialize();
  window.addEventListener('scroll', onScroll, { passive: true });
});

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll);
});

const navigationLinks = [
  { title: 'Главная', to: { path: '/' }, icon: 'mdi-home-outline' },
];

const isAuthenticated = computed(() => authStore.isAuthenticated);

const volunteerName = computed(() => {
  if (!authStore.user) return 'Мой кабинет';
  if (authStore.user.role === 'organizer' || authStore.user.is_organizer) {
    return (
      authStore.user.organization_name ||
      authStore.user.full_name ||
      authStore.user.username ||
      'Организатор'
    );
  }
  return authStore.user.full_name || authStore.user.username || 'Мой кабинет';
});

const userInitials = computed(() => {
  const name = volunteerName.value;
  if (!name || name === 'Мой кабинет') return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    const a = parts[0]?.[0];
    const b = parts[1]?.[0];
    if (a && b) return (a + b).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
});

const dashboardRoute = computed(() => {
  if (authStore.isRejectedOrganizer) return { name: 'organizer-application-rejected' };
  if (authStore.isOrganizerRole) return { name: 'organizer-dashboard' };
  return { name: 'volunteer-dashboard' };
});

const handleLogout = async () => {
  await authStore.logout();
  router.push({ name: 'home' });
};
</script>

<template>
  <v-app>

    <!-- ─── Mobile Drawer ─────────────────────────────────── -->
    <v-navigation-drawer v-model="drawer" class="d-md-none modern-drawer" temporary width="300">
      <div class="drawer-header px-5 py-6">
        <div class="d-flex align-center ga-3 mb-4">
          <div class="drawer-logo-icon">
            <v-icon size="24" color="white">mdi-leaf</v-icon>
          </div>
          <div>
            <div class="text-h6 font-weight-bold text-white lh-1">BirQadam</div>
            <div class="text-caption text-white" style="opacity:0.75">Один шаг к лучшему</div>
          </div>
        </div>
        <div v-if="isAuthenticated" class="drawer-user-card">
          <v-avatar size="38" color="white" class="mr-3">
            <span class="font-weight-bold text-success text-body-2">{{ userInitials }}</span>
          </v-avatar>
          <div class="overflow-hidden">
            <div class="text-body-2 font-weight-semibold text-white text-truncate">{{ volunteerName }}</div>
            <div class="text-caption text-white" style="opacity:0.7">Личный кабинет</div>
          </div>
        </div>
      </div>

      <div class="pa-3">
        <p class="text-caption font-weight-bold text-medium-emphasis px-2 mb-1 mt-2">НАВИГАЦИЯ</p>
        <v-list nav density="compact" class="pa-0">
          <v-list-item
            v-for="link in navigationLinks"
            :key="link.title"
            :to="link.to"
            :prepend-icon="link.icon"
            rounded="lg"
            class="mb-1 drawer-nav-item"
            @click="drawer = false"
          >
            <v-list-item-title class="font-weight-medium">{{ link.title }}</v-list-item-title>
          </v-list-item>
        </v-list>

        <v-divider class="my-3" />

        <template v-if="!isAuthenticated">
          <p class="text-caption font-weight-bold text-medium-emphasis px-2 mb-1">АККАУНТ</p>
          <v-list nav density="compact" class="pa-0">
            <v-list-item
              to="/login"
              prepend-icon="mdi-login"
              rounded="lg"
              class="mb-1 drawer-nav-item"
              @click="drawer = false"
            >
              <v-list-item-title class="font-weight-medium">Войти</v-list-item-title>
            </v-list-item>
          </v-list>
          <v-divider class="my-3" />
          <p class="text-caption font-weight-bold text-medium-emphasis px-2 mb-2">ПРИСОЕДИНИТЬСЯ</p>
          <v-btn
            block rounded="lg"
            class="drawer-btn-volunteer mb-2 text-none"
            to="/register/volunteer"
            elevation="0"
            @click="drawer = false"
          >
            <v-icon start size="18">mdi-hand-heart</v-icon>
            Стать волонтёром
          </v-btn>
          <v-btn
            block rounded="lg"
            variant="outlined"
            class="drawer-btn-organizer text-none"
            to="/register/organizer"
            elevation="0"
            @click="drawer = false"
          >
            <v-icon start size="18">mdi-domain</v-icon>
            Стать организатором
          </v-btn>
        </template>

        <template v-else>
          <p class="text-caption font-weight-bold text-medium-emphasis px-2 mb-1">АККАУНТ</p>
          <v-list nav density="compact" class="pa-0">
            <v-list-item
              :to="dashboardRoute"
              prepend-icon="mdi-view-dashboard-outline"
              rounded="lg"
              class="mb-1 drawer-nav-item"
              @click="drawer = false"
            >
              <v-list-item-title class="font-weight-medium">Мой кабинет</v-list-item-title>
            </v-list-item>
            <v-list-item
              prepend-icon="mdi-logout"
              rounded="lg"
              class="mb-1 text-error"
              @click="() => { handleLogout(); drawer = false; }"
            >
              <v-list-item-title class="font-weight-medium">Выйти</v-list-item-title>
            </v-list-item>
          </v-list>
        </template>
      </div>
    </v-navigation-drawer>

    <!-- ─── App Bar ───────────────────────────────────────────── -->
    <v-app-bar
      class="modern-app-bar"
      :class="{ 'navbar-hidden': !navbarVisible }"
      :elevation="0"
      height="70"
    >
      <!-- Круги ТОЛЬКО на auth-страницах -->
      <template v-if="isAuthChromeRoute">
        <div class="bar-deco bar-deco--1" />
        <div class="bar-deco bar-deco--2" />
        <div class="bar-deco bar-deco--3" />
      </template>

      <v-container class="d-flex align-center fill-height bar-inner">
        <RouterLink to="/" class="logo-link d-flex align-center ga-2 text-decoration-none flex-shrink-0">
          <div class="logo-box">
            <v-icon size="20" color="white">mdi-leaf</v-icon>
          </div>
          <span class="logo-text">BirQadam</span>
        </RouterLink>

        <nav class="d-none d-md-flex align-center ga-1 flex-grow-1 justify-center">
          <RouterLink
            v-for="link in navigationLinks"
            :key="link.title"
            :to="link.to"
            class="nav-pill"
            active-class="nav-pill--active"
          >
            {{ link.title }}
          </RouterLink>
        </nav>

        <v-spacer class="d-md-none" />

        <div class="d-none d-md-flex align-center ga-2 flex-shrink-0">
          <template v-if="!isAuthenticated">
            <v-btn variant="text" class="btn-ghost text-none" to="/login" rounded="pill" height="40">
              Войти
            </v-btn>
            <v-btn class="btn-volunteer text-none" to="/register/volunteer" rounded="pill" height="40" elevation="0">
              <v-icon start size="16">mdi-hand-heart</v-icon>
              Волонтёр
            </v-btn>
            <v-btn variant="outlined" class="btn-organizer text-none" to="/register/organizer" rounded="pill" height="40">
              Организатор
            </v-btn>
          </template>

          <template v-else>
            <v-menu offset="10" location="bottom end" transition="scale-transition">
              <template #activator="{ props }">
                <v-btn v-bind="props" class="btn-user text-none" rounded="pill" height="44" elevation="0">
                  <v-avatar size="28" color="white" class="mr-2">
                    <span class="font-weight-bold text-success" style="font-size:11px">{{ userInitials }}</span>
                  </v-avatar>
                  <span class="text-white font-weight-medium">{{ volunteerName }}</span>
                  <v-icon size="16" class="ml-1 text-white opacity-80">mdi-chevron-down</v-icon>
                </v-btn>
              </template>
              <v-list rounded="xl" min-width="210" class="dropdown-menu pa-1" elevation="4">
                <v-list-item :to="dashboardRoute" prepend-icon="mdi-view-dashboard-outline" rounded="lg" class="mb-1">
                  <v-list-item-title class="font-weight-medium">Мой кабинет</v-list-item-title>
                </v-list-item>
                <v-divider class="my-1" />
                <v-list-item prepend-icon="mdi-logout" rounded="lg" class="text-error" @click="handleLogout">
                  <v-list-item-title class="font-weight-medium">Выйти</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu>
          </template>
        </div>

        <v-app-bar-nav-icon class="d-md-none" color="white" @click="drawer = !drawer" />
      </v-container>
    </v-app-bar>

    <!-- ─── Main ──────────────────────────────────────────────── -->
    <v-main>
      <RouterView />
    </v-main>

    <!-- ─── Footer ────────────────────────────────────────────── -->
    <v-footer class="legal-footer py-5">
      <v-container class="text-center text-white">
        <div class="d-flex flex-wrap justify-center align-center ga-3 ga-sm-4 text-caption">
          <RouterLink to="/privacy" class="text-white text-decoration-none font-weight-medium">
            Политика конфиденциальности
          </RouterLink>
          <span class="d-none d-sm-inline opacity-40">·</span>
          <RouterLink to="/terms" class="text-white text-decoration-none font-weight-medium">
            Пользовательское соглашение
          </RouterLink>
        </div>
        <p class="text-caption mt-3 mb-0 opacity-60">© BirQadam — платформа волонтёрских проектов</p>
      </v-container>
    </v-footer>

  </v-app>
</template>

<style scoped>
/* ─── App Bar ───────────────────────────────────────────────── */
.modern-app-bar {
  background: linear-gradient(135deg, #1b5e20 0%, #2e7d32 50%, #388e3c 100%) !important;
  box-shadow: 0 2px 20px rgba(27, 94, 32, 0.25) !important;
  overflow: hidden;
  position: relative;
  /* плавный transition для скрытия/показа */
  transition: transform 0.32s cubic-bezier(0.4, 0, 0.2, 1) !important;
}

/* Скрыть navbar при скролле вниз */
.navbar-hidden {
  transform: translateY(-100%) !important;
}

/* ─── Декоративные круги (только auth) ─────────────────────── */
.bar-deco {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  z-index: 0;
}
.bar-deco--1 {
  width: 150px; height: 150px;
  top: -60px; right: 200px;
  background: rgba(255, 255, 255, 0.1);
}
.bar-deco--2 {
  width: 95px; height: 95px;
  top: -28px; right: 95px;
  background: rgba(255, 255, 255, 0.08);
}
.bar-deco--3 {
  width: 65px; height: 65px;
  bottom: -22px; left: 38%;
  background: rgba(255, 255, 255, 0.07);
}

.bar-inner {
  position: relative;
  z-index: 1;
}

/* ─── Logo ──────────────────────────────────────────────────── */
.logo-link { transition: opacity 0.2s; }
.logo-link:hover { opacity: 0.85; }

.logo-box {
  width: 38px; height: 38px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.22);
  display: flex; align-items: center; justify-content: center;
}

.logo-text {
  color: #fff;
  font-size: 1.3rem;
  font-weight: 700;
  letter-spacing: 0.3px;
}

/* ─── Nav pills ─────────────────────────────────────────────── */
.nav-pill {
  color: rgba(255, 255, 255, 0.88);
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 500;
  padding: 7px 16px;
  border-radius: 8px;
  transition: background 0.18s, color 0.18s;
}
.nav-pill:hover { color: #fff; background: rgba(255, 255, 255, 0.1); }
.nav-pill--active {
  color: #fff;
  background: rgba(255, 255, 255, 0.16);
  font-weight: 600;
}

/* ─── Кнопки ────────────────────────────────────────────────── */
.btn-ghost {
  color: rgba(255, 255, 255, 0.92) !important;
  font-weight: 600 !important;
  padding: 0 16px !important;
}
.btn-ghost:hover { background: rgba(255, 255, 255, 0.1) !important; color: #fff !important; }

.btn-volunteer {
  background: linear-gradient(135deg, #ffa726, #f57c00) !important;
  color: #fff !important;
  font-weight: 700 !important;
  box-shadow: 0 3px 12px rgba(245, 124, 0, 0.45) !important;
  transition: all 0.22s ease !important;
}
.btn-volunteer:hover {
  transform: translateY(-1px);
  box-shadow: 0 5px 18px rgba(245, 124, 0, 0.6) !important;
}

.btn-organizer {
  color: #fff !important;
  border-color: rgba(255, 255, 255, 0.5) !important;
  font-weight: 600 !important;
}
.btn-organizer:hover { background: rgba(255, 255, 255, 0.1) !important; border-color: #fff !important; }

.btn-user {
  background: rgba(255, 255, 255, 0.12) !important;
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
  padding: 0 14px 0 6px !important;
  transition: background 0.2s;
}
.btn-user:hover { background: rgba(255, 255, 255, 0.2) !important; }

/* ─── Dropdown ──────────────────────────────────────────────── */
.dropdown-menu { border: 1px solid rgba(0, 0, 0, 0.07); }

/* ─── Mobile Drawer ─────────────────────────────────────────── */
.modern-drawer { background: #f8f9fa !important; }

.drawer-header {
  background: linear-gradient(135deg, #1b5e20 0%, #2e7d32 50%, #388e3c 100%);
}

.drawer-logo-icon {
  width: 42px; height: 42px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.28);
  display: flex; align-items: center; justify-content: center;
}

.drawer-user-card {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.18);
}

.drawer-nav-item { color: #2e2e2e; }

.drawer-btn-volunteer {
  background: linear-gradient(135deg, #ffa726, #f57c00) !important;
  color: #fff !important;
  font-weight: 700 !important;
  box-shadow: 0 3px 10px rgba(245, 124, 0, 0.3) !important;
}
.drawer-btn-organizer {
  color: #2e7d32 !important;
  border-color: #2e7d32 !important;
  font-weight: 600 !important;
}

/* ─── Footer ────────────────────────────────────────────────── */
.legal-footer {
  background: linear-gradient(135deg, #1b5e20 0%, #2e7d32 50%, #388e3c 100%) !important;
  color: #fff !important;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}
</style>