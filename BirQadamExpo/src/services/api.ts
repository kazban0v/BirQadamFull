import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { API_BASE_URL } from '../utils/network';
import type { CalendarEvent, PhotoReport } from '../types';

const isWeb = Platform.OS === 'web';

const isFormDataPayload = (value: unknown): value is FormData =>
  typeof FormData !== 'undefined' && value instanceof FormData;

const isAuthenticationFailure = (status?: number, data?: any) => {
  if (status === 401) {
    return true;
  }

  if (status !== 403) {
    return false;
  }

  const detail =
    typeof data?.detail === 'string'
      ? data.detail
      : typeof data?.error === 'string'
        ? data.error
        : '';

  if (!detail) {
    return false;
  }

  const normalized = detail.toLowerCase();
  return (
    normalized.includes('учетные данные не были предоставлены') ||
    normalized.includes('authentication credentials were not provided') ||
    normalized.includes('given token not valid') ||
    normalized.includes('token is invalid or expired') ||
    normalized.includes('not authenticated')
  );
};

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  withCredentials: isWeb,
});

if (__DEV__) {
  console.log('🔧 [API] Base URL:', API_BASE_URL);
}

api.interceptors.request.use(
  async (config) => {
    try {
      if (__DEV__) {
        console.log('📤 [API] Request:', config.method?.toUpperCase(), config.url);
      }

      // Устанавливаем Content-Type динамически
      if (isFormDataPayload(config.data)) {
        // Для FormData удаляем Content-Type — axios сам поставит multipart/form-data с boundary
        delete config.headers['Content-Type'];
      } else if (!config.headers['Content-Type']) {
        config.headers['Content-Type'] = 'application/json';
      }

      const token = await AsyncStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      if (!isWeb) {
        const sessionId = await AsyncStorage.getItem('sessionid');
        if (sessionId) {
          config.headers.Cookie = `sessionid=${sessionId}`;
        }
      }

      const csrfToken = await AsyncStorage.getItem('csrftoken');
      if (csrfToken) {
        config.headers['X-CSRFToken'] = csrfToken;
      }
    } catch (error) {
      console.error('❌ [API] Error reading tokens:', error);
    }

    return config;
  },
  (error) => {
    console.error('❌ [API] Request error:', error);
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  async (response) => {
    if (__DEV__) {
      console.log('📥 [API] Response:', response.status, response.config.url);
    }

    const csrfToken = response.headers['x-csrftoken'];
    if (csrfToken) {
      await AsyncStorage.setItem('csrftoken', csrfToken);
    }

    if (!isWeb) {
      const setCookie = response.headers['set-cookie'];
      if (setCookie) {
        const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : setCookie;
        const sessionMatch = cookieStr.match(/sessionid=([^;]+)/);
        if (sessionMatch) {
          await AsyncStorage.setItem('sessionid', sessionMatch[1]);
        }
      }
    }

    return response;
  },
  async (error) => {
    if (__DEV__) {
      console.error('❌ [API] Response error:', error.message);
      if (error.response) {
        console.error('   Status:', error.response.status);
        console.error('   Data:', error.response.data);
      } else if (error.request) {
        console.error('   No response received. Check network connection.');
        console.error('   URL:', error.config?.url);
        console.error('   Base URL:', error.config?.baseURL);
      }
    }

    if (isAuthenticationFailure(error.response?.status, error.response?.data)) {
      try {
        const { useAuthStore } = require('../store/authStore');
        const logout = useAuthStore.getState().logout;
        if (logout) {
          await logout();
        }
      } catch (err) {
        console.error('❌ Error during emergency logout:', err);
        await AsyncStorage.multiRemove(['auth_token', 'user', 'sessionid']);
      }
    }

    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (identifier: string, password: string) =>
    api.post('/api/web/login/', { identifier, password }),

  registerVolunteer: (data: {
    name: string;
    phone_number: string;
    email: string;
    password: string;
  }) => {
    const normalizedPhone = data.phone_number.startsWith('+')
      ? data.phone_number
      : `+${data.phone_number}`;

    return api.post('/api/web/register/volunteer/', {
      full_name: data.name,
      phone_number: normalizedPhone,
      email: data.email,
      password: data.password,
    });
  },

  registerOrganizer: (data: {
    username: string;
    name: string;
    phone_number: string;
    email: string;
    password: string;
    organization_name: string;
    inn: string;
    bin: string;
  }) => {
    const normalizedPhone = data.phone_number.startsWith('+')
      ? data.phone_number
      : `+${data.phone_number}`;

    return api.post('/api/web/register/organizer/', {
      full_name: data.name,
      organization_name: data.organization_name,
      phone_number: normalizedPhone,
      email: data.email,
      password: data.password,
      inn: data.inn,
      bin: data.bin,
    });
  },

  verifyEmail: (email: string, code: string) =>
    api.post('/api/web/verify-email/', { email, code }),

  resendVerificationCode: (email: string) =>
    api.post('/api/web/resend-verification-code/', { email }),

  cancelRegistration: (email: string) =>
    api.post('/api/web/cancel-registration/', { email }),

  requestPasswordReset: (email: string) =>
    api.post('/api/web/password-reset/request/', { email }),

  confirmPasswordReset: (email: string, code: string, new_password: string) =>
    api.post('/api/web/password-reset/confirm/', { email, code, new_password }),

  changePassword: (current_password: string, new_password: string) =>
    api.post('/api/web/change-password/', { current_password, new_password }),

  logout: () => api.post('/api/web/logout/'),

  getMe: () => api.get('/api/web/me/'),
};

export const volunteerAPI = {
  getDashboard: () => api.get('/api/web/volunteer/dashboard/'),

  getProfile: () => api.get('/api/web/volunteer/profile/'),
  updateProfile: (data: any) =>
    isFormDataPayload(data)
      ? api.patch('/api/web/volunteer/profile/', data)
      : api.patch('/api/web/volunteer/profile/', data),

  getStats: () => api.get<import('../types').VolunteerStats>('/api/web/volunteer/stats/'),
  getActivity: (params?: { start_date?: string; end_date?: string }) => 
    api.get<import('../types').VolunteerActivity>('/api/web/volunteer/activity/', { params }),

  getProjects: (params?: any) => api.get('/api/web/volunteer/projects/', { params }),
  getProjectDetail: (id: number) => api.get(`/api/web/volunteer/projects/${id}/`),
  joinProject: (projectId: number) => api.post(`/api/web/volunteer/projects/${projectId}/join/`),
  leaveProject: (projectId: number, reason: string) =>
    api.post(`/api/web/volunteer/projects/${projectId}/leave/`, { reason }),

  getOrganizerPortfolio: (organizerId: number) => api.get(`/api/web/organizer/${organizerId}/portfolio/`),

  getTasks: (params?: any) => api.get('/api/web/volunteer/tasks/', { params }),
  getTaskDetail: (id: number) => api.get(`/api/web/volunteer/tasks/${id}/`),
  acceptTask: (taskId: number) => api.post(`/api/web/volunteer/tasks/${taskId}/accept/`),
  declineTask: (taskId: number) => api.post(`/api/web/volunteer/tasks/${taskId}/decline/`),
  completeTask: (taskId: number) => api.post(`/api/web/volunteer/tasks/${taskId}/complete/`),
  retryTask: (taskId: number) => api.post(`/api/web/volunteer/tasks/${taskId}/retry/`),
  archiveTask: (taskId: number) => api.post(`/api/web/volunteer/tasks/${taskId}/archive/`),
  submitPhotoReportV1: (taskId: number, photos: FormData) =>
    api.post(`/api/web/volunteer/tasks/${taskId}/photo-reports/`, photos),

  getTaskPhotoReports: (taskId: number) =>
    api.get<{ photos: PhotoReport[] }>(`/api/web/volunteer/tasks/${taskId}/photo-reports/`),

  getCalendarEvents: (month?: string) =>
    api.get<{ month: string; events: CalendarEvent[] }>('/api/web/volunteer/calendar/', {
      params: month ? { month } : undefined,
    }),

  getNotifications: () => api.get('/api/web/volunteer/notifications/'),
  markNotificationRead: (id: number, activityId?: number) =>
    api.post(`/api/web/volunteer/notifications/${id}/read/`, { activity_id: activityId }),
  markAllNotificationsRead: () => api.post('/api/web/volunteer/notifications/read-all/'),

  getPhotoReports: (params?: any) => api.get('/api/web/volunteer/photo-reports/', { params }),
  submitPhotoReport: (taskId: number, photos: FormData) =>
    api.post(`/api/web/volunteer/tasks/${taskId}/photo-reports/`, photos),

  getTelegramSync: () => api.get('/api/web/telegram/sync/'),

  // Chat APIs
  getChats: () => api.get('/api/web/volunteer/chats/'),
  getChatMessages: (chatId: number, params?: { limit?: number; offset?: number }) =>
    api.get(`/api/web/volunteer/chats/${chatId}/messages/`, { params }),
  sendMessage: (chatId: number, message: string | FormData) =>
    api.post(`/api/web/volunteer/chats/${chatId}/send/`, typeof message === 'string' ? { text: message } : message),
  markMessagesRead: (chatId: number) =>
    api.post(`/api/web/volunteer/chats/${chatId}/read/`),
};

export const organizerAPI = {
  getDashboard: () => api.get('/api/web/organizer/dashboard/'),

  getProfile: () => api.get('/api/web/organizer/profile/'),
  updateProfile: (data: any) => api.patch('/api/web/organizer/profile/', data),

  getProjects: (params?: any) => api.get('/api/web/organizer/projects/', { params }),
  createProject: (data: any) => api.post('/api/web/organizer/projects/', data),
  updateProject: (id: number, data: any) => api.patch(`/api/web/organizer/projects/${id}/`, data),
  deleteProject: (id: number) => api.delete(`/api/web/organizer/projects/${id}/`),

  getVolunteers: (params?: any) => api.get('/api/web/organizer/volunteers/', { params }),
  getVolunteerDetail: (id: number) => api.get(`/api/web/organizer/volunteers/${id}/`),

  getTasks: (params?: any) => api.get('/api/web/organizer/tasks/', { params }),
  createTask: (projectId: number, data: any) => api.post(`/api/web/organizer/projects/${projectId}/tasks/`, data),
  updateTask: (id: number, data: any) => api.patch(`/api/web/organizer/tasks/${id}/`, data),
  deleteTask: (id: number) => api.delete(`/api/web/organizer/tasks/${id}/`),

  getPhotoModeration: () => api.get('/api/web/organizer/photo-moderation/'),
  approvePhoto: (id: number) => api.post(`/api/web/organizer/photos/${id}/approve/`),
  rejectPhoto: (id: number, reason: string) => api.post(`/api/web/organizer/photos/${id}/reject/`, { reason }),

  getAnalytics: (params?: any) => api.get('/api/web/organizer/analytics/', { params }),
};

export default api;
