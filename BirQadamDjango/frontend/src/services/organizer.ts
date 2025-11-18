import { httpClient } from './http';

export interface OrganizerProject {
  id: number;
  title: string;
  description: string;
  city: string;
  status: string;
  volunteer_count: number;
  task_count: number;
  created_at: string;
  start_date?: string | null;
  end_date?: string | null;
  volunteer_type?: string | null;
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
}

export interface CreateProjectPayload {
  title: string;
  description: string;
  city: string;
  volunteer_type?: string;
  start_date?: string | null;
  end_date?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  address?: string;
  contact_person?: string;
  contact_phone?: string;
  contact_email?: string;
  contact_telegram?: string;
  info_url?: string;
  tags?: string[];
  cover_image?: File | null;
}

export interface OrganizerTask {
  id: number;
  text: string;
  status: string;
  created_at: string;
  deadline_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
}

export interface CreateTaskPayload {
  text: string;
  deadline_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
}

export interface OrganizerPhotoReport {
  id: number;
  volunteer: {
    id: number;
    name: string;
    username: string;
    rating: number;
    phone_number: string | null;
  };
  task: {
    id: number | null;
    text: string;
    deadline_date: string | null;
    start_time: string | null;
    end_time: string | null;
  };
  project: {
    id: number;
    title: string;
    city: string;
  };
  image_url: string | null;
  volunteer_comment: string;
  organizer_comment: string;
  rejection_reason: string;
  status: 'pending' | 'approved' | 'rejected';
  rating: number | null;
  uploaded_at: string;
  moderated_at: string | null;
}

export interface OrganizerPhotoCounters {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}

export interface OrganizerPhotoReportsResponse {
  photos: OrganizerPhotoReport[];
  counters: OrganizerPhotoCounters;
  new_count: number;
  total_count: number;
  filtered_count: number;
  limit: number;
  offset: number;
  status: 'pending' | 'approved' | 'rejected' | 'all';
  project_id: number | null;
}

export interface OrganizerPhotoReportDetail {
  id: number;
  volunteer_name: string;
  volunteer_id: number;
  task_text: string;
  task_id: number | null;
  project_title: string;
  project_id: number;
  image_url: string | null;
  volunteer_comment: string;
  organizer_comment: string;
  rejection_reason: string;
  status: 'pending' | 'approved' | 'rejected';
  rating: number | null;
  uploaded_at: string;
  moderated_at: string | null;
  photos: Array<{
    id: number;
    image_url: string | null;
    uploaded_at: string;
  }>;
}

export interface ProjectParticipant {
  id: number;
  name: string;
  email: string | null;
  rating: number;
  joined_at: string;
  completed_tasks: number;
  total_tasks: number;
}

type PhotoMutationResponse = {
  message: string;
  photo: {
    id: number;
    status: 'pending' | 'approved' | 'rejected';
    rating: number | null;
    organizer_comment?: string | null;
    rejection_reason?: string | null;
    moderated_at: string | null;
  };
};

const ORGANIZER_PROJECTS_URL = '/custom-admin/api/organizer/projects/';

export async function fetchOrganizerProjects(): Promise<OrganizerProject[]> {
  const { data } = await httpClient.get<OrganizerProject[]>(ORGANIZER_PROJECTS_URL);
  return data;
}

export async function createOrganizerProject(payload: CreateProjectPayload): Promise<OrganizerProject> {
  const formData = new FormData();

  formData.append('title', payload.title);
  formData.append('description', payload.description);
  formData.append('city', payload.city);
  if (payload.volunteer_type) formData.append('volunteer_type', payload.volunteer_type);
  if (payload.start_date) formData.append('start_date', payload.start_date);
  if (payload.end_date) formData.append('end_date', payload.end_date);
  if (payload.latitude !== undefined && payload.latitude !== null) formData.append('latitude', String(payload.latitude));
  if (payload.longitude !== undefined && payload.longitude !== null) formData.append('longitude', String(payload.longitude));
  if (payload.address) formData.append('address', payload.address);
  if (payload.contact_person) formData.append('contact_person', payload.contact_person);
  if (payload.contact_phone) formData.append('contact_phone', payload.contact_phone);
  if (payload.contact_email) formData.append('contact_email', payload.contact_email);
  if (payload.contact_telegram) formData.append('contact_telegram', payload.contact_telegram);
  if (payload.info_url) formData.append('info_url', payload.info_url);
  if (payload.tags && payload.tags.length) formData.append('tags', payload.tags.join(','));
  if (payload.cover_image) formData.append('cover_image', payload.cover_image);

  const { data } = await httpClient.post<OrganizerProject>(ORGANIZER_PROJECTS_URL, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function fetchProjectTasks(projectId: number): Promise<OrganizerTask[]> {
  const { data } = await httpClient.get<OrganizerTask[]>(`/custom-admin/api/projects/${projectId}/tasks/`);
  return data;
}

export async function deleteTask(projectId: number, taskId: number) {
  const { data } = await httpClient.delete<{ message: string }>(
    `/custom-admin/api/projects/${projectId}/tasks/`,
    { params: { task_id: taskId } },
  );
  return data;
}

export async function createProjectTask(projectId: number, payload: CreateTaskPayload): Promise<OrganizerTask> {
  const { data } = await httpClient.post<OrganizerTask>(`/custom-admin/api/projects/${projectId}/tasks/`, payload);
  return data;
}

export async function fetchOrganizerPhotoReports(params?: {
  status?: 'pending' | 'approved' | 'rejected' | 'all';
  project?: number | null;
  limit?: number;
  offset?: number;
}): Promise<OrganizerPhotoReportsResponse> {
  const query: Record<string, any> = {};
  if (params?.status && params.status !== 'all') query.status = params.status;
  if (params?.project) query.project = params.project;
  if (typeof params?.limit === 'number') query.limit = params.limit;
  if (typeof params?.offset === 'number') query.offset = params.offset;

  const { data } = await httpClient.get<OrganizerPhotoReportsResponse>('/custom-admin/api/v1/organizer/photo-reports/', {
    params: query,
  });
  return data;
}

export async function fetchOrganizerPhotoReportDetail(photoId: number): Promise<OrganizerPhotoReportDetail> {
  const { data } = await httpClient.get<OrganizerPhotoReportDetail>(`/custom-admin/api/v1/photo-reports/${photoId}/`);
  return data;
}

export async function approveOrganizerPhotoReport(
  photoId: number,
  payload: { rating?: number; feedback?: string; skip?: boolean },
): Promise<PhotoMutationResponse> {
  const { data } = await httpClient.post<PhotoMutationResponse>(
    `/custom-admin/api/v1/photo-reports/${photoId}/rate/`,
    payload,
  );
  return data;
}

export async function rejectOrganizerPhotoReport(
  photoId: number,
  payload: { feedback: string },
): Promise<PhotoMutationResponse> {
  const { data } = await httpClient.post<PhotoMutationResponse>(
    `/custom-admin/api/v1/photo-reports/${photoId}/reject/`,
    payload,
  );
  return data;
}

export async function fetchProjectParticipants(projectId: number): Promise<ProjectParticipant[]> {
  const { data } = await httpClient.get<{ participants: ProjectParticipant[] }>(
    `/custom-admin/api/v1/projects/${projectId}/participants/`,
  );
  return data.participants;
}


