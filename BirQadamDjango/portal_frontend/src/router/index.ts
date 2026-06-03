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
        path: 'password-reset',
        name: 'password-reset',
        component: () => import('@/views/auth/PasswordResetView.vue'),
      },
      {
        path: 'privacy',
        name: 'privacy-policy',
        component: () => import('@/views/legal/PrivacyPolicyView.vue'),
      },
      {
        path: 'terms',
        name: 'terms-of-use',
        component: () => import('@/views/legal/TermsOfUseView.vue'),
      },
      {
        path: 'instructions',
        name: 'instructions',
        component: () => import('@/views/InstructionsView.vue'),
      },
      {
        path: 'volunteers',
        name: 'public-volunteers',
        component: () => import('@/views/public/VolunteersView.vue'),
      },
      {
        path: 'volunteers/:id',
        name: 'public-volunteer-detail',
        component: () => import('@/views/public/VolunteerDetailView.vue'),
      },
      {
        path: 'organizers',
        name: 'public-organizers',
        component: () => import('@/views/public/OrganizersView.vue'),
      },
      {
        path: 'organizers/:id',
        name: 'public-organizer-detail',
        component: () => import('@/views/public/OrganizerDetailView.vue'),
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
    meta: { requiresAuth: true, requiresOrganizerRole: true },
    children: [
      {
        path: 'application-rejected',
        name: 'organizer-application-rejected',
        meta: { requiresOrganizerRole: true },
        component: () => import('@/views/organizer/OrganizerApplicationRejectedView.vue'),
      },
      {
        path: 'dashboard',
        name: 'organizer-dashboard',
        meta: { requiresOrganizerRole: true },
        component: () => import('@/views/organizer/DashboardView.vue'),
      },
      {
        path: 'projects',
        name: 'organizer-projects',
        meta: { requiresOrganizerRole: true, requiresApprovedOrganizer: true },
        component: () => import('@/views/organizer/ProjectsView.vue'),
      },
      {
        path: 'volunteers',
        name: 'organizer-volunteers',
        meta: { requiresOrganizerRole: true, requiresApprovedOrganizer: true },
        component: () => import('@/views/organizer/VolunteersView.vue'),
      },
      {
        path: 'tasks',
        name: 'organizer-tasks',
        meta: { requiresOrganizerRole: true, requiresApprovedOrganizer: true },
        component: () => import('@/views/organizer/TasksView.vue'),
      },
      {
        path: 'photo-moderation',
        name: 'organizer-photo-moderation',
        meta: { requiresOrganizerRole: true, requiresApprovedOrganizer: true },
        component: () => import('@/views/organizer/PhotoModerationView.vue'),
      },
      {
        path: 'profile',
        name: 'organizer-profile',
        meta: { requiresOrganizerRole: true },
        component: () => import('@/views/organizer/ProfileView.vue'),
      },
      {
        path: 'analytics',
        name: 'organizer-analytics',
        meta: { requiresOrganizerRole: true, requiresApprovedOrganizer: true },
        component: () => import('@/views/organizer/AnalyticsView.vue'),
      },
    ],
  },
  {
    path: '/organizer/:pathMatch(.*)*',
    redirect: { name: 'organizer-dashboard' },
  },
];

export const router = createRouter({
  history: createWebHistory('/portal/'),
  routes,
  scrollBehavior() {
    return { top: 0, left: 0 };
  },
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

  if (auth.isAuthenticated) {
    const user = auth.user;
    const isOrganizerRole = !!(user && (user.role === 'organizer' || user.is_organizer));
    const isApprovedOrganizer = isOrganizerRole && user.organizer_status === 'approved';
    const isRejectedOrganizer = isOrganizerRole && user.organizer_status === 'rejected';

    if (isRejectedOrganizer && to.path.startsWith('/organizer') && to.name !== 'organizer-application-rejected') {
      next({ name: 'organizer-application-rejected' });
      return;
    }

    if (isOrganizerRole && to.path.startsWith('/volunteer')) {
      next(isRejectedOrganizer ? { name: 'organizer-application-rejected' } : { name: 'organizer-dashboard' });
      return;
    }

    const requiresOrganizerRole = to.matched.some((record) => record.meta?.requiresOrganizerRole);
    if (requiresOrganizerRole && !isOrganizerRole) {
      next({ name: 'volunteer-dashboard' });
      return;
    }

    const requiresApprovedOrganizer = to.matched.some((record) => record.meta?.requiresApprovedOrganizer);
    if (requiresApprovedOrganizer && !isApprovedOrganizer) {
      next({ name: 'organizer-dashboard' });
      return;
    }

    const isVolunteerOnly = !isOrganizerRole;
    if (
      isVolunteerOnly
      && !user?.profile_complete
      && to.path.startsWith('/volunteer')
      && to.name !== 'volunteer-profile'
    ) {
      next({ name: 'volunteer-profile', query: { complete: '1' } });
      return;
    }

    if (
      isApprovedOrganizer
      && !user?.bio_filled
      && to.path.startsWith('/organizer')
      && to.name !== 'organizer-profile'
      && to.name !== 'organizer-application-rejected'
    ) {
      next({ name: 'organizer-profile', query: { complete: '1' } });
      return;
    }
  }

  next();
});
