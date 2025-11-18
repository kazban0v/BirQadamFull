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
    if (loading.value) return;
    if (!force && summary.value) return;

    loading.value = true;
    try {
      const data = await fetchVolunteerDashboard();
      summary.value = data.summary;
      tasks.value = data.tasks;
      projects.value = data.projects;
      photos.value = data.photos;
      notifications.value = data.notifications;
      moderation.value = data.moderation;
    } finally {
      loading.value = false;
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
