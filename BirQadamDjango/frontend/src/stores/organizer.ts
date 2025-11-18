import { defineStore } from 'pinia';
import { computed, reactive, ref } from 'vue';

import {
  createOrganizerProject,
  createProjectTask,
  fetchOrganizerProjects,
  fetchProjectTasks,
  fetchOrganizerPhotoReports,
  approveOrganizerPhotoReport,
  rejectOrganizerPhotoReport,
  fetchOrganizerPhotoReportDetail,
  fetchProjectParticipants,
  type CreateProjectPayload,
  type CreateTaskPayload,
  type OrganizerProject,
  type OrganizerTask,
  type OrganizerPhotoReport,
  type OrganizerPhotoReportDetail,
  type OrganizerPhotoCounters,
  type ProjectParticipant,
} from '@/services/organizer';
import { useAuthStore } from './auth';

export const useOrganizerStore = defineStore('organizer', () => {
  const authStore = useAuthStore();
  const projects = ref<OrganizerProject[]>([]);
  const loadingProjects = ref(false);
  const projectError = ref<string | null>(null);

  const tasksByProject = reactive<Record<number, OrganizerTask[]>>({});
  const loadingTasks = reactive<Record<number, boolean>>({});
  const taskErrors = reactive<Record<number, string | null>>({});

  const photoReports = ref<OrganizerPhotoReport[]>([]);
  const photoCounters = ref<OrganizerPhotoCounters>({
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0,
  });
  const photoStatus = ref<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const photoProjectFilter = ref<number | null>(null);
  const photoLimit = ref(30);
  const photoOffset = ref(0);
  const photoFilteredCount = ref(0);
  const photoLoading = ref(false);
  const photoError = ref<string | null>(null);
  const photoActionLoading = reactive<Record<number, boolean>>({});
  const photoActionError = reactive<Record<number, string | null>>({});
  const photoDetails = reactive<Record<number, OrganizerPhotoReportDetail>>({});
  const photoDetailsLoading = reactive<Record<number, boolean>>({});
  const photoDetailsError = reactive<Record<number, string | null>>({});

  const participantsByProject = reactive<Record<number, ProjectParticipant[]>>({});
  const participantsLoading = reactive<Record<number, boolean>>({});
  const participantsError = reactive<Record<number, string | null>>({});

  const isOrganizer = computed(
    () => !!authStore.user && (authStore.user.role === 'organizer' || authStore.user.is_organizer),
  );
  const isApproved = computed(() => authStore.user?.organizer_status === 'approved');

  async function loadProjects(force = false) {
    if (!isOrganizer.value) return;
    if (!isApproved.value) {
      projectError.value = null;
      if (!force) {
        projects.value = [];
      }
      return;
    }
    if (loadingProjects.value) return;
    if (!force && projects.value.length > 0) return;

    loadingProjects.value = true;
    projectError.value = null;
    try {
      const data = await fetchOrganizerProjects();
      projects.value = data;
    } catch (error: any) {
      const detail = error?.response?.data?.error || error?.message || 'Не удалось загрузить проекты.';
      projectError.value = detail;
    } finally {
      loadingProjects.value = false;
    }
  }

  async function createProject(payload: CreateProjectPayload) {
    if (!isOrganizer.value) throw new Error('Недостаточно прав');
    await createOrganizerProject(payload);
    await loadProjects(true);
  }

  async function loadTasks(projectId: number, force = false) {
    if (!isOrganizer.value) return;
    if (loadingTasks[projectId]) return;
    if (!force && tasksByProject[projectId]) return;

    loadingTasks[projectId] = true;
    taskErrors[projectId] = null;
    try {
      const data = await fetchProjectTasks(projectId);
      tasksByProject[projectId] = data;
    } catch (error: any) {
      const detail = error?.response?.data?.error || error?.message || 'Не удалось загрузить задачи.';
      taskErrors[projectId] = detail;
    } finally {
      loadingTasks[projectId] = false;
    }
  }

  async function createTask(projectId: number, payload: CreateTaskPayload) {
    if (!isOrganizer.value) throw new Error('Недостаточно прав');
    await createProjectTask(projectId, payload);
    await loadTasks(projectId, true);
  }

  async function loadPhotoReports(options?: {
    status?: 'all' | 'pending' | 'approved' | 'rejected';
    projectId?: number | null;
    limit?: number;
    offset?: number;
    force?: boolean;
  }) {
    if (!isOrganizer.value) return;
    if (!isApproved.value) return;
    if (photoLoading.value) return;

    const nextStatus = options?.status ?? photoStatus.value;
    const nextProject = options?.projectId ?? photoProjectFilter.value;
    const nextLimit = options?.limit ?? photoLimit.value;
    const nextOffset = options?.offset ?? 0;

    const shouldReload =
      options?.force ||
      photoReports.value.length === 0 ||
      nextStatus !== photoStatus.value ||
      nextProject !== photoProjectFilter.value ||
      nextLimit !== photoLimit.value ||
      nextOffset !== photoOffset.value;

    if (!shouldReload && photoReports.value.length > 0) {
      return;
    }

    photoLoading.value = true;
    photoError.value = null;

    try {
      const response = await fetchOrganizerPhotoReports({
        status: nextStatus,
        project: nextProject ?? undefined,
        limit: nextLimit,
        offset: nextOffset,
      });

      photoReports.value = response.photos;
      photoCounters.value = response.counters;
      photoStatus.value = response.status;
      photoProjectFilter.value = response.project_id;
      photoLimit.value = response.limit;
      photoOffset.value = response.offset;
      photoFilteredCount.value = response.filtered_count;
    } catch (error: any) {
      const detail = error?.response?.data?.error || error?.message || 'Не удалось загрузить фотоотчёты.';
      photoError.value = detail;
    } finally {
      photoLoading.value = false;
    }
  }

  async function refreshPhotoReports() {
    await loadPhotoReports({ force: true, offset: photoOffset.value });
  }

  async function ensurePhotoDetail(photoId: number, force = false) {
    if (photoDetails[photoId] && !force) return photoDetails[photoId];
    if (photoDetailsLoading[photoId]) return photoDetails[photoId];

    photoDetailsLoading[photoId] = true;
    photoDetailsError[photoId] = null;
    try {
      const detail = await fetchOrganizerPhotoReportDetail(photoId);
      photoDetails[photoId] = detail;
      return detail;
    } catch (error: any) {
      const detailMessage =
        error?.response?.data?.error || error?.message || 'Не удалось загрузить детали фотоотчёта.';
      photoDetailsError[photoId] = detailMessage;
      throw error;
    } finally {
      photoDetailsLoading[photoId] = false;
    }
  }

  async function approvePhotoReport(
    photoId: number,
    payload: { rating?: number; feedback?: string; skip?: boolean } = {},
  ) {
    if (!isOrganizer.value) throw new Error('Недостаточно прав');
    photoActionLoading[photoId] = true;
    photoActionError[photoId] = null;
    try {
      await approveOrganizerPhotoReport(photoId, payload);
      await refreshPhotoReports();
      if (photoDetails[photoId]) {
        await ensurePhotoDetail(photoId, true);
      }
    } catch (error: any) {
      const detail =
        error?.response?.data?.error || error?.message || 'Не удалось одобрить фотоотчёт. Попробуйте еще раз.';
      photoActionError[photoId] = detail;
      throw error;
    } finally {
      photoActionLoading[photoId] = false;
    }
  }

  async function rejectPhotoReport(photoId: number, feedback: string) {
    if (!isOrganizer.value) throw new Error('Недостаточно прав');
    photoActionLoading[photoId] = true;
    photoActionError[photoId] = null;
    try {
      await rejectOrganizerPhotoReport(photoId, { feedback });
      await refreshPhotoReports();
      if (photoDetails[photoId]) {
        await ensurePhotoDetail(photoId, true);
      }
    } catch (error: any) {
      const detail =
        error?.response?.data?.error || error?.message || 'Не удалось отклонить фотоотчёт. Попробуйте еще раз.';
      photoActionError[photoId] = detail;
      throw error;
    } finally {
      photoActionLoading[photoId] = false;
    }
  }

  async function loadParticipants(projectId: number, force = false) {
    if (!isOrganizer.value) return;
    if (!isApproved.value) return;
    if (participantsLoading[projectId]) return;
    if (participantsByProject[projectId] && !force) return;

    participantsLoading[projectId] = true;
    participantsError[projectId] = null;
    try {
      const participants = await fetchProjectParticipants(projectId);
      participantsByProject[projectId] = participants;
    } catch (error: any) {
      const detail = error?.response?.data?.error || error?.message || 'Не удалось загрузить участников проекта.';
      participantsError[projectId] = detail;
    } finally {
      participantsLoading[projectId] = false;
    }
  }

  function reset() {
    projects.value = [];
    projectError.value = null;
    Object.keys(tasksByProject).forEach((key) => {
      delete tasksByProject[Number(key)];
    });
    Object.keys(loadingTasks).forEach((key) => {
      delete loadingTasks[Number(key)];
    });
    Object.keys(taskErrors).forEach((key) => {
      delete taskErrors[Number(key)];
    });
    photoReports.value = [];
    photoCounters.value = { pending: 0, approved: 0, rejected: 0, total: 0 };
    photoStatus.value = 'pending';
    photoProjectFilter.value = null;
    photoLimit.value = 30;
    photoOffset.value = 0;
    photoFilteredCount.value = 0;
    photoError.value = null;
    Object.keys(photoActionLoading).forEach((key) => delete photoActionLoading[Number(key)]);
    Object.keys(photoActionError).forEach((key) => delete photoActionError[Number(key)]);
    Object.keys(photoDetails).forEach((key) => delete photoDetails[Number(key)]);
    Object.keys(photoDetailsLoading).forEach((key) => delete photoDetailsLoading[Number(key)]);
    Object.keys(photoDetailsError).forEach((key) => delete photoDetailsError[Number(key)]);
    Object.keys(participantsByProject).forEach((key) => delete participantsByProject[Number(key)]);
    Object.keys(participantsLoading).forEach((key) => delete participantsLoading[Number(key)]);
    Object.keys(participantsError).forEach((key) => delete participantsError[Number(key)]);
  }

  return {
    projects,
    loadingProjects,
    projectError,
    tasksByProject,
    loadingTasks,
    taskErrors,
    photoReports,
    photoCounters,
    photoStatus,
    photoProjectFilter,
    photoLimit,
    photoOffset,
    photoFilteredCount,
    photoLoading,
    photoError,
    photoActionLoading,
    photoActionError,
    photoDetails,
    photoDetailsLoading,
    photoDetailsError,
    participantsByProject,
    participantsLoading,
    participantsError,
    isOrganizer,
    isApproved,
    loadProjects,
    createProject,
    loadTasks,
    createTask,
    loadPhotoReports,
    refreshPhotoReports,
    ensurePhotoDetail,
    approvePhotoReport,
    rejectPhotoReport,
    loadParticipants,
    reset,
  };
});


