// @ts-nocheck
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('@/layouts/PublicLayout.vue'),
    children: [
      {
        path: '',
        name: 'home',
        component: () => import('@/views/HomeView.vue'),
      },
      {
        path: 'register/volunteer',
        name: 'register-volunteer',
        component: () => import('@/views/auth/RegisterVolunteerView.vue'),
      },
      {
        path: 'register/organizer',
        name: 'register-organizer',
        component: () => import('@/views/auth/RegisterOrganizerView.vue'),
      },
      {
        path: 'login',
        name: 'login',
        component: () => import('@/views/auth/LoginView.vue'),
      },
      {
        path: ':pathMatch(.*)*',
        name: 'not-found',
        component: () => import('@/views/NotFoundView.vue'),
      },
    ],
  },
  {
    path: '/volunteer',
    component: () => import('@/layouts/ProtectedLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: 'dashboard',
        name: 'volunteer-dashboard',
        component: () => import('@/views/volunteer/DashboardView.vue'),
      },
      {
        path: 'profile',
        name: 'volunteer-profile',
        component: () => import('@/views/volunteer/ProfileView.vue'),
      },
      {
        path: 'projects',
        name: 'volunteer-projects',
        component: () => import('@/views/volunteer/ProjectsView.vue'),
      },
      {
        path: 'tasks',
        name: 'volunteer-tasks',
        component: () => import('@/views/volunteer/TasksView.vue'),
      },
      {
        path: 'tasks/:id',
        name: 'volunteer-task-detail',
        component: () => import('@/views/volunteer/TaskDetailView.vue'),
      },
      {
        path: 'notifications',
        name: 'volunteer-notifications',
        component: () => import('@/views/volunteer/NotificationsView.vue'),
      },
      {
        path: 'achievements',
        name: 'volunteer-achievements',
        component: () => import('@/views/volunteer/AchievementsView.vue'),
      },
      {
        path: 'photo-reports',
        name: 'volunteer-photo-reports',
        component: () => import('@/views/volunteer/PhotoReportsView.vue'),
      },
    ],
  },
  {
    path: '/volunteer/:pathMatch(.*)*',
    redirect: { name: 'volunteer-dashboard' },
  },
  {
    path: '/organizer',
    component: () => import('@/layouts/ProtectedLayout.vue'),
    meta: { requiresAuth: true, requiresOrganizer: true },
    children: [
      {
        path: 'dashboard',
        name: 'organizer-dashboard',
        component: () => import('@/views/organizer/DashboardView.vue'),
      },
      {
        path: 'projects',
        name: 'organizer-projects',
        component: () => import('@/views/organizer/ProjectsView.vue'),
      },
      {
        path: 'volunteers',
        name: 'organizer-volunteers',
        component: () => import('@/views/organizer/VolunteersView.vue'),
      },
      {
        path: 'tasks',
        name: 'organizer-tasks',
        component: () => import('@/views/organizer/TasksView.vue'),
      },
      {
        path: 'photo-moderation',
        name: 'organizer-photo-moderation',
        component: () => import('@/views/organizer/PhotoModerationView.vue'),
      },
      {
        path: 'profile',
        name: 'organizer-profile',
        component: () => import('@/views/organizer/ProfileView.vue'),
      },
    ],
  },
  {
    path: '/organizer/:pathMatch(.*)*',
    redirect: { name: 'organizer-dashboard' },
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to, from, next) => {
  const auth = useAuthStore();
  if (!auth.initialized) {
    await auth.initialize();
  }

  const requiresAuth = to.matched.some((record) => record.meta?.requiresAuth);

  if (requiresAuth && !auth.isAuthenticated) {
    next({ name: 'login', query: { redirect: to.fullPath } });
    return;
  }

  const requiresOrganizer = to.matched.some((record) => record.meta?.requiresOrganizer);
  if (requiresOrganizer) {
    const user = auth.user;
    const isOrganizer = !!user && (user.role === 'organizer' || user.is_organizer);
    if (!isOrganizer) {
      next({ name: 'home' });
      return;
    }
  }

  const user = auth.user;
  const isOrganizer = !!user && (user.role === 'organizer' || user.is_organizer);

  if (isOrganizer && to.path.startsWith('/volunteer')) {
    next({ name: 'organizer-dashboard' });
    return;
  }

  if (!isOrganizer && to.path.startsWith('/organizer')) {
    next({ name: 'volunteer-dashboard' });
    return;
  }

  next();
});


