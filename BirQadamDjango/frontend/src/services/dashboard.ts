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
  return data;
}
