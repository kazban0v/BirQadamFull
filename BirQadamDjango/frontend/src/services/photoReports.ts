import { httpClient } from './http';
import type { VolunteerPhotoSummary } from './dashboard';

export async function uploadPhotoReport(taskId: number, file: File, comment?: string) {
  const formData = new FormData();
  // Бэкенд ожидает 'photos' (множественное число) как список файлов
  formData.append('photos', file);
  if (comment) {
    formData.append('comment', comment);
  }
  
  const { data } = await httpClient.post<{ message: string; photos: VolunteerPhotoSummary[] }>(
    `/api/web/volunteer/tasks/${taskId}/photo-reports/`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    },
  );
  return data;
}

export async function fetchTaskPhotos(taskId: number) {
  const { data } = await httpClient.get<{ photos: VolunteerPhotoSummary[] }>(
    `/api/web/volunteer/tasks/${taskId}/photo-reports/`,
  );
  return data;
}

export interface VolunteerPhotoReportsResponse {
  photos: VolunteerPhotoSummary[];
  summary: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
}

export async function fetchVolunteerPhotoReports(params?: { status?: string; limit?: number }) {
  const { data } = await httpClient.get<VolunteerPhotoReportsResponse>('/api/web/volunteer/photo-reports/', {
    params,
  });
  return data;
}
