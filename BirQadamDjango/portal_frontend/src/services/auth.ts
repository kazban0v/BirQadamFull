import { httpClient } from './http';
import { WEB_ENDPOINT } from './webPortal';

export interface LoginPayload {
  identifier: string;
  password: string;
}

export async function login(payload: LoginPayload) {
  const { data } = await httpClient.post(`${WEB_ENDPOINT}/login/`, payload);
  return data;
}


export async function logout() {
  await httpClient.post(
    `${WEB_ENDPOINT}/logout/`,
    {},
    {
      withCredentials: true,
    },
  );
}

export async function fetchCurrentUser() {
  const { data } = await httpClient.get(`${WEB_ENDPOINT}/me/`);
  return data;
}

export async function fetchVolunteerProfile() {
  const { data } = await httpClient.get(`${WEB_ENDPOINT}/volunteer/profile/`);
  return data;
}

export async function updateVolunteerProfile(payload: Partial<{ name: string; phone_number: string; email: string }>) {
  // Очищаем payload от пустых значений и null
  const cleanPayload: Record<string, string> = {};
  
  if (payload.name !== undefined && payload.name !== null && payload.name.trim() !== '') {
    cleanPayload.name = payload.name.trim();
  }
  if (payload.phone_number !== undefined && payload.phone_number !== null && payload.phone_number.trim() !== '') {
    cleanPayload.phone_number = payload.phone_number.trim();
  }
  if (payload.email !== undefined && payload.email !== null && payload.email.trim() !== '') {
    cleanPayload.email = payload.email.trim();
  }
  
  // Проверяем, что есть хотя бы одно поле для обновления
  if (Object.keys(cleanPayload).length === 0) {
    console.warn('Попытка обновить профиль без данных');
    throw new Error('Нет данных для обновления профиля');
  }
  
  console.log('Отправка данных для обновления профиля:', cleanPayload);
  
  try {
    const { data } = await httpClient.patch(`${WEB_ENDPOINT}/volunteer/profile/`, cleanPayload);
    return data;
  } catch (error: any) {
    console.error('Ошибка при обновлении профиля:', error);
    console.error('Отправленные данные:', cleanPayload);
    console.error('Ответ сервера:', error?.response?.data);
    throw error;
  }
}

export interface TelegramSyncStatus {
  is_linked: boolean;
  telegram_id: string | null;
  active_code: string | null;
  registration_source: string;
}

export async function getTelegramSyncStatus(): Promise<TelegramSyncStatus> {
  const { data } = await httpClient.get(`${WEB_ENDPOINT}/telegram/sync/`);
  return data;
}

export async function generateTelegramLinkCode(): Promise<{ code: string; message: string; expires_in_minutes: number }> {
  const { data } = await httpClient.post(`${WEB_ENDPOINT}/telegram/sync/`);
  return data;
}

