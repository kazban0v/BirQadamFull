import { httpClient } from './http';

export interface ChatParticipant {
  id: number;
  name: string;
  email: string;
  is_organizer: boolean;
}

export interface Chat {
  id: number;
  project_id: number;
  project_title: string;
  chat_type: string;
  participants: ChatParticipant[];
  unread_count: number;
  created: boolean;
}

export interface ChatMessage {
  id: number;
  text: string;
  sender_id: number;
  sender_name: string;
  sender_is_organizer: boolean;
  message_type: string;
  image_url?: string | null;
  file_url?: string | null;
  is_read: boolean;
  created_at: string;
}

export interface ChatMessagesResponse {
  messages: ChatMessage[];
  count: number;
}

/**
 * Получить или создать чат для проекта
 */
export async function getProjectChat(projectId: number): Promise<Chat> {
  const { data } = await httpClient.get<Chat>(`/custom-admin/api/v1/projects/${projectId}/chat/`);
  return data;
}

/**
 * Получить сообщения чата
 */
export async function getChatMessages(chatId: number, limit = 50, offset = 0): Promise<ChatMessagesResponse> {
  const { data } = await httpClient.get<ChatMessagesResponse>(`/custom-admin/api/v1/chats/${chatId}/messages/`, {
    params: { limit, offset },
  });
  return data;
}

/**
 * Отправить сообщение в чат
 */
export async function sendMessage(chatId: number, text: string): Promise<ChatMessage> {
  const { data } = await httpClient.post<ChatMessage>(`/custom-admin/api/v1/chats/${chatId}/send/`, {
    text,
  });
  return data;
}

/**
 * Отметить сообщения как прочитанные
 */
export async function markMessagesRead(chatId: number): Promise<{ message: string; updated_count: number }> {
  const { data } = await httpClient.post<{ message: string; updated_count: number }>(
    `/custom-admin/api/v1/chats/${chatId}/read/`,
  );
  return data;
}



