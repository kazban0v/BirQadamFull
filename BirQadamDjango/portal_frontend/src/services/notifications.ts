import { httpClient } from './http';
import type { VolunteerNotificationSummary } from './dashboard';

export interface VolunteerNotificationsResponse {
  notifications: VolunteerNotificationSummary[];
  summary: {
    count: number;
    unread_count: number;
  };
}

export async function fetchNotifications(limit?: number): Promise<VolunteerNotificationsResponse> {
  const params = limit ? { params: { limit } } : undefined;
  const { data } = await httpClient.get<VolunteerNotificationsResponse>('/api/web/volunteer/notifications/', params);
  return data;
}

export async function markNotificationRead(notificationId: number, activityId?: number) {
  const payload = activityId ? { activity_id: activityId } : {};
  const { data } = await httpClient.post<{ message: string }>(
    `/api/web/volunteer/notifications/${notificationId}/read/`,
    payload,
  );
  return data;
}

export async function markAllNotificationsRead() {
  const { data } = await httpClient.post<{ message: string; updated_count: number }>(
    '/api/web/volunteer/notifications/read-all/',
  );
  return data;
}


