import { httpClient } from './http';
import type { VolunteerPhotoSummary } from './dashboard';

export async function uploadPhotoReport(taskId: number, files: File | File[], comment?: string) {
  const formData = new FormData();
  // Бэкенд ожидает 'photos' (множественное число) как список файлов
  const fileArray = Array.isArray(files) ? files : [files];
  fileArray.forEach(file => {
    formData.append('photos', file);
  });
  if (comment) {
    formData.append('comment', comment);
  }
  
  const { data } = await httpClient.post<{ message: string; photos: VolunteerPhotoSummary[] }>(
    `/api/web/volunteer/tasks/${taskId}/photo-reports/`,
    formData
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

export async function deletePhotoReport(taskId: number) {
  // Сначала пробуем DELETE
  try {
    const { data } = await httpClient.delete<{ message: string }>(
      `/api/web/volunteer/tasks/${taskId}/photo-reports/`,
    );
    return data;
  } catch (error: any) {
    // Если DELETE не разрешен (405 Method Not Allowed или 403 Forbidden), используем POST с action
    if (error?.response?.status === 405 || error?.response?.status === 403) {
      const formData = new FormData();
      formData.append('action', 'withdraw');
      const { data } = await httpClient.post<{ message: string }>(
        `/api/web/volunteer/tasks/${taskId}/photo-reports/`,
        formData
      );
      return data;
    }
    // Если это другая ошибка, пробуем также через POST
    try {
      const formData = new FormData();
      formData.append('action', 'withdraw');
      const { data } = await httpClient.post<{ message: string }>(
        `/api/web/volunteer/tasks/${taskId}/photo-reports/`,
        formData
      );
      return data;
    } catch (postError: any) {
      // Если и POST не работает, выбрасываем оригинальную ошибку
      throw error;
    }
  }
}
