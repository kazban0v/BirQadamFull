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

const WEB_ENDPOINT = '/api/web';

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
  portfolio: OrganizerPortfolio;
}

export async function getOrganizerProfile(): Promise<OrganizerProfile> {
  const { data } = await httpClient.get(`${WEB_ENDPOINT}/organizer/profile/`);
  return data;
}

export async function updateOrganizerProfile(
  profile: Partial<OrganizerProfile> & { portfolio_photo?: File }
): Promise<OrganizerProfile> {
  const formData = new FormData();
  
  if (profile.full_name !== undefined) {
    formData.append('full_name', profile.full_name);
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
  
  const { data } = await httpClient.patch(`${WEB_ENDPOINT}/organizer/profile/`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return data;
}

export async function getOrganizerPortfolio(organizerId: number): Promise<OrganizerProfile> {
  const { data } = await httpClient.get(`${WEB_ENDPOINT}/organizer/${organizerId}/portfolio/`);
  return data;
}

