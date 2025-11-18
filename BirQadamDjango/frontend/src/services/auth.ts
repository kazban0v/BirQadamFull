import { httpClient } from './http';

export interface LoginPayload {
  identifier: string;
  password: string;
}

export async function login(payload: LoginPayload) {
  const { data } = await httpClient.post('/api/web/login/', payload);
  return data;
}

export async function logout() {
  await httpClient.post('/api/web/logout/');
}

export async function fetchCurrentUser() {
  const { data } = await httpClient.get('/api/web/me/');
  return data;
}

export async function fetchVolunteerProfile() {
  const { data } = await httpClient.get('/api/web/volunteer/profile/');
  return data;
}

export async function updateVolunteerProfile(payload: Partial<{ name: string; phone_number: string; email: string }>) {
  const { data } = await httpClient.patch('/api/web/volunteer/profile/', payload);
  return data;
}

export interface TelegramSyncStatus {
  is_linked: boolean;
  telegram_id: string | null;
  active_code: string | null;
  registration_source: string;
}

export async function getTelegramSyncStatus(): Promise<TelegramSyncStatus> {
  const { data } = await httpClient.get('/api/web/telegram/sync/');
  return data;
}

export async function generateTelegramLinkCode(): Promise<{ code: string; message: string; expires_in_minutes: number }> {
  const { data } = await httpClient.post('/api/web/telegram/sync/');
  return data;
}

