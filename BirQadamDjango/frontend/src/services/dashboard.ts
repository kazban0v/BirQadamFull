import { httpClient } from './http';

export interface VolunteerTaskSummary {
  id: number;
  task_id: number;
  text: string;
  status: string;
  deadline_date: string | null;
  start_time: string | null;
  end_time: string | null;
  project_id: number;
  project_title: string;
  project_city: string | null;
  project_status: string;
  accepted: boolean;
  completed: boolean;
  is_expired: boolean;
  has_photo_report: boolean;
  photo_status: string | null;
  can_upload_photo: boolean;
}

export interface VolunteerProjectSummary {
  id: number;
  project_id: number;
  title: string;
  city: string | null;
  status: string;
  volunteer_type: string;
  start_date: string | null;
  end_date: string | null;
  joined_at: string;
  organizer_name: string;
  active_members: number;
}

export interface VolunteerPhotoSummary {
  id: number;
  project_id: number;
  project_title: string;
  task_id: number | null;
  status: string;
  image: string;
  image_url: string | null;
  uploaded_at: string;
  moderated_at: string | null;
  rating: number | null;
}

export interface VolunteerNotificationSummary {
  id: number;
  subject: string;
  message: string;
  notification_type: string;
  status: string;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  created_at: string;
  activity_id?: number;
  project_id?: number;
  project_title?: string;
}

export interface VolunteerDashboardResponse {
  summary: {
    active_tasks: number;
    completed_tasks: number;
    upcoming_tasks: number;
    active_projects: number;
    pending_photos: number;
    total_photos: number;
    unread_notifications: number;
  };
  tasks: VolunteerTaskSummary[];
  projects: VolunteerProjectSummary[];
  photos: VolunteerPhotoSummary[];
  notifications: VolunteerNotificationSummary[];
  moderation: {
    pending_photo_reports: number;
    unread_notifications: number;
  };
}

export async function fetchVolunteerDashboard(): Promise<VolunteerDashboardResponse> {
  const { data } = await httpClient.get<VolunteerDashboardResponse>('/api/web/volunteer/dashboard/');
  // Защита от undefined/null - всегда возвращаем валидную структуру с массивами
  return {
    summary: data?.summary || {
      active_tasks: 0,
      completed_tasks: 0,
      upcoming_tasks: 0,
      active_projects: 0,
      pending_photos: 0,
      total_photos: 0,
      unread_notifications: 0,
    },
    tasks: Array.isArray(data?.tasks) ? data.tasks : [],
    projects: Array.isArray(data?.projects) ? data.projects : [],
    photos: Array.isArray(data?.photos) ? data.photos : [],
    notifications: Array.isArray(data?.notifications) ? data.notifications : [],
    moderation: data?.moderation || {
      pending_photo_reports: 0,
      unread_notifications: 0,
    },
  };
}
