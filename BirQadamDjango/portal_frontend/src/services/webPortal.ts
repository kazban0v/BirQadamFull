import { httpClient } from './http';

export interface VolunteerRegistrationPayload {
  full_name: string;
  phone_number: string;
  email?: string;
  password?: string;
}

export interface OrganizerRegistrationPayload extends VolunteerRegistrationPayload {
  organization_name: string;
  description?: string;
  city?: string;
  website?: string;
  contact_person?: string;
  notes?: string;
}

/** Базовый префикс веб-портала (совпадает с `path('api/web/', ...)` в Django) */
export const WEB_ENDPOINT = '/api/web';

export async function registerVolunteer(payload: VolunteerRegistrationPayload) {
  const { data } = await httpClient.post(`${WEB_ENDPOINT}/register/volunteer/`, payload);
  return data;
}

export async function registerOrganizer(payload: OrganizerRegistrationPayload) {
  const { data } = await httpClient.post(`${WEB_ENDPOINT}/register/organizer/`, payload);
  return data;
}

export async function verifyEmail(email: string, code: string) {
  const { data } = await httpClient.post(`${WEB_ENDPOINT}/verify-email/`, { email, code });
  return data;
}

export async function resendVerificationCode(email: string) {
  const { data } = await httpClient.post(`${WEB_ENDPOINT}/resend-verification-code/`, { email });
  return data;
}

export async function cancelRegistration(email: string) {
  const { data } = await httpClient.post(`${WEB_ENDPOINT}/cancel-registration/`, { email });
  return data;
}

export interface OrganizerPortfolio {
  age?: number | null;
  gender?: string | null;
  bio?: string | null;
  work_experience_years?: number | null;
  work_history?: string | null;
  portfolio_photo_url?: string | null;
}

export interface OrganizerProfile {
  id: number;
  username: string;
  full_name: string;
  email?: string;
  phone_number?: string;
  organization_name?: string;
  bio_filled?: boolean;
  profile_complete?: boolean;
  portfolio: OrganizerPortfolio;
}

export async function getOrganizerProfile(): Promise<OrganizerProfile> {
  const { data } = await httpClient.get(`${WEB_ENDPOINT}/organizer/profile/`);
  return data;
}

export async function updateOrganizerProfile(
  profile: Partial<OrganizerProfile> & { portfolio_photo?: File; organization_name?: string }
): Promise<OrganizerProfile> {
  const formData = new FormData();
  
  if (profile.full_name !== undefined) {
    formData.append('full_name', profile.full_name);
  }
  if (profile.organization_name !== undefined) {
    formData.append('organization_name', profile.organization_name);
  }
  if (profile.portfolio) {
    if (profile.portfolio.age !== undefined) {
      formData.append('age', profile.portfolio.age?.toString() || '');
    }
    if (profile.portfolio.gender !== undefined) {
      formData.append('gender', profile.portfolio.gender || '');
    }
    if (profile.portfolio.bio !== undefined) {
      formData.append('bio', profile.portfolio.bio || '');
    }
    if (profile.portfolio.work_experience_years !== undefined) {
      formData.append('work_experience_years', profile.portfolio.work_experience_years?.toString() || '');
    }
    if (profile.portfolio.work_history !== undefined) {
      formData.append('work_history', profile.portfolio.work_history || '');
    }
  }
  if (profile.portfolio_photo) {
    formData.append('portfolio_photo', profile.portfolio_photo);
  }
  
  const { data } = await httpClient.patch(`${WEB_ENDPOINT}/organizer/profile/`, formData);
  return data;
}

export async function getOrganizerPortfolio(organizerId: number): Promise<OrganizerProfile> {
  const { data } = await httpClient.get(`${WEB_ENDPOINT}/organizer/${organizerId}/portfolio/`);
  return data;
}

// ─── Публичная статистика платформы ───────────────────────────────────────

export interface PlatformStats {
  volunteers: number;
  funds: number;
  tasks_done: number;
  days_since: number;
}

export async function fetchPublicStats(): Promise<PlatformStats> {
  const { data } = await httpClient.get<PlatformStats>(`${WEB_ENDPOINT}/public/stats/`);
  return data;
}

export interface PublicAchievement {
  name: string;
  description: string;
  icon: string;
  unlocked_at: string;
}

export interface PublicVolunteerDocument {
  doc_type: 'resume' | 'certificate';
  label: string;
  original_name?: string | null;
  download_url: string | null;
}

export interface PublicVolunteer {
  id: number;
  full_name: string;
  username: string;
  bio: string | null;
  rating: number;
  average_rating: number;
  trust_factor: number;
  avatar_url: string | null;
  completed_tasks: number;
  date_joined: string;
  level: number;
  achievements: PublicAchievement[];
  reviews_count: number;
  documents?: PublicVolunteerDocument[];
}

export interface PublicVolunteerReview {
  id: number;
  organization_name: string;
  organizer_avatar_url: string | null;
  project_title: string;
  rating: number;
  text: string;
  created_at: string;
}

export interface PublicVolunteerDetail {
  volunteer: PublicVolunteer;
  related_volunteers: PublicVolunteer[];
  reviews: PublicVolunteerReview[];
}

export type VolunteerSort = 'rating' | 'tasks' | 'newest';

export async function fetchPublicVolunteers(search = '', sort: VolunteerSort = 'rating'): Promise<PublicVolunteer[]> {
  const { data } = await httpClient.get<{ volunteers: PublicVolunteer[] }>(`${WEB_ENDPOINT}/public/volunteers/`, {
    params: { search, sort }
  });
  return data.volunteers;
}

export async function fetchPublicVolunteerDetail(id: number | string): Promise<PublicVolunteerDetail> {
  const { data } = await httpClient.get<PublicVolunteerDetail>(`${WEB_ENDPOINT}/public/volunteers/${id}/`);
  return data;
}

/** @deprecated Use fetchPublicVolunteerDetail */
export async function fetchPublicVolunteer(id: number | string): Promise<PublicVolunteer> {
  const { data } = await fetchPublicVolunteerDetail(id);
  return data.volunteer;
}

export interface PublicOrganizer {
  id: number;
  organization_name: string;
  city: string | null;
  website: string | null;
  avatar_url: string | null;
  date_joined: string;
  completed_projects: number;
}

export interface PublicOrganizerProject {
  id: number;
  title: string;
  description: string;
  city: string;
  volunteer_type: string;
  volunteer_type_display: string;
  cover_url: string | null;
  start_date: string | null;
  end_date: string | null;
}

export interface PublicOrganizerDetail extends PublicOrganizer {
  bio: string | null;
  description: string | null;
  active_projects: number;
  total_projects: number;
  projects: PublicOrganizerProject[];
  work_experience_years: number | null;
  work_history: string | null;
}

export interface PublicOrganizerDetailResponse {
  organizer: PublicOrganizerDetail;
  related_organizers: PublicOrganizer[];
}

export async function fetchPublicOrganizers(search = ''): Promise<PublicOrganizer[]> {
  const { data } = await httpClient.get<{ organizers: PublicOrganizer[] }>(`${WEB_ENDPOINT}/public/organizers/`, {
    params: { search }
  });
  return data.organizers;
}

export async function fetchPublicOrganizerDetail(id: number | string): Promise<PublicOrganizerDetailResponse> {
  const { data } = await httpClient.get<PublicOrganizerDetailResponse>(`${WEB_ENDPOINT}/public/organizers/${id}/`);
  return data;
}

export async function inviteVolunteerToProject(
  volunteerId: number,
  projectId: number,
): Promise<{ message: string; project_id: number; volunteer_id: number; created: boolean }> {
  const { data } = await httpClient.post(
    `${WEB_ENDPOINT}/organizer/volunteers/${volunteerId}/invite/`,
    { project_id: projectId },
    { withCredentials: true },
  );
  return data;
}

export async function submitVolunteerReview(
  volunteerId: number,
  payload: { project_id: number; rating: number; text: string },
): Promise<{ message: string; review: PublicVolunteerReview }> {
  const { data } = await httpClient.post(
    `${WEB_ENDPOINT}/organizer/volunteers/${volunteerId}/reviews/`,
    payload,
    { withCredentials: true },
  );
  return data;
}

export interface VolunteerDocumentItem {
  id: number;
  doc_type: 'resume' | 'certificate';
  label: string;
  original_name: string;
  uploaded_at: string;
  download_url: string | null;
}

export async function fetchVolunteerDocuments(): Promise<VolunteerDocumentItem[]> {
  const { data } = await httpClient.get<{ documents: VolunteerDocumentItem[] }>(
    `${WEB_ENDPOINT}/volunteer/documents/`,
  );
  return data.documents;
}

export async function uploadVolunteerDocument(docType: 'resume' | 'certificate', file: File): Promise<VolunteerDocumentItem> {
  const formData = new FormData();
  formData.append('doc_type', docType);
  formData.append('file', file);
  const { data } = await httpClient.post<VolunteerDocumentItem>(
    `${WEB_ENDPOINT}/volunteer/documents/`,
    formData,
  );
  return data;
}

export async function deleteVolunteerDocument(documentId: number): Promise<void> {
  await httpClient.delete(`${WEB_ENDPOINT}/volunteer/documents/${documentId}/`);
}
