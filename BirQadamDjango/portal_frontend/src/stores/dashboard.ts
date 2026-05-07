import { defineStore } from 'pinia';
import { ref } from 'vue';

import type {
  VolunteerDashboardResponse,
  VolunteerNotificationSummary,
  VolunteerPhotoSummary,
  VolunteerProjectSummary,
  VolunteerTaskSummary,
} from '@/services/dashboard';
import { fetchVolunteerDashboard } from '@/services/dashboard';

export const useDashboardStore = defineStore('dashboard', () => {
  const loading = ref(false);
  const summary = ref<VolunteerDashboardResponse['summary'] | null>(null);
  const tasks = ref<VolunteerTaskSummary[]>([]);
  const projects = ref<VolunteerProjectSummary[]>([]);
  const photos = ref<VolunteerPhotoSummary[]>([]);
  const notifications = ref<VolunteerNotificationSummary[]>([]);
  const moderation = ref<VolunteerDashboardResponse['moderation'] | null>(null);

  async function loadDashboard(force = false) {
    if (loading.value) {
      console.log('[DASHBOARD STORE] loadDashboard: already loading, skipping');
      return;
    }
    if (!force && summary.value) {
      console.log('[DASHBOARD STORE] loadDashboard: data already loaded, skipping (use force=true to reload)');
      return;
    }

    console.log('[DASHBOARD STORE] loadDashboard: loading...', { force, hasExistingData: !!summary.value });
    loading.value = true;
    try {
      const data = await fetchVolunteerDashboard();
      console.log('[DASHBOARD STORE] loadDashboard: data received:', {
        summary: data.summary,
        projectsCount: data.projects?.length ?? 0,
        tasksCount: data.tasks?.length ?? 0,
        photosCount: data.photos?.length ?? 0,
      });
      // Принудительно создаём новые объекты/массивы для гарантии реактивности
      summary.value = data.summary ? { ...data.summary } : null;
      // Защита от undefined/null - всегда используем массив, создаём новый массив для реактивности
      tasks.value = data.tasks ? [...(data.tasks ?? [])] : [];
      projects.value = data.projects ? [...(data.projects ?? [])] : [];
      photos.value = data.photos ? [...(data.photos ?? [])] : [];
      notifications.value = data.notifications ? [...(data.notifications ?? [])] : [];
      moderation.value = data.moderation;
      console.log('[DASHBOARD STORE] loadDashboard: store updated:', {
        summary: summary.value,
        projectsCount: projects.value.length,
        tasksCount: tasks.value.length,
        photosCount: photos.value.length,
      });
    } finally {
      loading.value = false;
      console.log('[DASHBOARD STORE] loadDashboard: completed');
    }
  }

  function reset() {
    summary.value = null;
    tasks.value = [];
    projects.value = [];
    photos.value = [];
    notifications.value = [];
    moderation.value = null;
  }

  return {
    loading,
    summary,
    tasks,
    projects,
    photos,
    notifications,
    moderation,
    loadDashboard,
    reset,
  };
});
