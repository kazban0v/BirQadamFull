import { httpClient } from './http';

export interface VolunteerProjectCatalogItem {
  id: number;
  project_id?: number; // Опционально, т.к. API деталей проекта возвращает это поле
  title: string;
  description: string;
  city: string | null;
  volunteer_type: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
  joined: boolean;
  active_members: number;
  tasks_count: number;
  organizer_name: string;
  joined_at: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  contact_person?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  contact_telegram?: string | null;
  info_url?: string | null;
  tags?: string[];
  cover_image_url?: string | null;
  created_at?: string | null;
}

export interface VolunteerProjectsResponse {
  projects: VolunteerProjectCatalogItem[];
  summary: {
    total_available: number;
    joined_count: number;
  };
  message?: string;
}

export async function fetchVolunteerProjects(): Promise<VolunteerProjectsResponse> {
  const { data } = await httpClient.get<VolunteerProjectsResponse>('/api/web/volunteer/projects/');
  return data;
}

export async function joinVolunteerProject(projectId: number): Promise<VolunteerProjectsResponse> {
  const { data } = await httpClient.post<VolunteerProjectsResponse>(
    `/api/web/volunteer/projects/${projectId}/join/`,
  );
  return data;
}

export interface ProjectTask {
  id: number;
  text: string;
  status: string;
  created_at: string;
  deadline_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
}

export async function fetchProjectTasks(projectId: number): Promise<ProjectTask[]> {
  // Используем правильный endpoint для получения заданий проекта
  const { data } = await httpClient.get<ProjectTask[]>(`/custom-admin/api/projects/${projectId}/tasks/`);
  return data;
}

export async function fetchProjectDetail(projectId: number): Promise<VolunteerProjectCatalogItem> {
  const { data } = await httpClient.get<VolunteerProjectCatalogItem>(`/api/web/volunteer/projects/${projectId}/`);
  return data;
}

