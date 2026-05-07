import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  API_BASE_URL,
  getCurrentApiBaseUrl,
  getFallbackApiBaseUrl,
  switchApiBaseUrl,
} from '../utils/network';
import type { CalendarEvent, PhotoReport } from '../types';

const isWeb = Platform.OS === 'web';

/** SimpleJWT TokenRefreshView подключён в admin_panel под префиксом custom-admin (см. birqadam_project.urls). */
const JWT_REFRESH_PATH = '/custom-admin/api/token/refresh/';

type AppAxiosRequestConfig = InternalAxiosRequestConfig & {
  skipAuthRefresh?: boolean;
  _retryAfterRefresh?: boolean;
  __backendFallbackAttempted?: boolean;
};

const isFormDataPayload = (value: unknown): value is FormData =>
  typeof FormData !== 'undefined' && value instanceof FormData;

const isAuthenticationFailure = (status?: number, data?: unknown) => {
  if (status !== 403) {
    return false;
  }

  const detail =
    typeof data === 'object' && data !== null
      ? typeof (data as { detail?: unknown }).detail === 'string'
        ? ((data as { detail: string }).detail as string)
        : typeof (data as { error?: unknown }).error === 'string'
          ? ((data as { error: string }).error as string)
          : ''
      : '';

  if (!detail) {
    return false;
  }

  const normalized = detail.toLowerCase();
  return (
    normalized.includes('authentication credentials were not provided') ||
    normalized.includes('given token not valid') ||
    normalized.includes('token is invalid or expired') ||
    normalized.includes('not authenticated')
  );
};

const shouldAttemptFallback = (error: unknown): boolean => {
  if (!__DEV__) {
    return false;
  }

  const err = error as { config?: AppAxiosRequestConfig; response?: { status?: number; data?: unknown } };
  if (!err?.config) {
    return false;
  }

  if (!err.response) {
    return true;
  }

  if (err.response.status !== 404) {
    return false;
  }

  const requestUrl = String(err.config?.url || '');
  if (!requestUrl.startsWith('/api/web/')) {
    return false;
  }

  const responseData = err.response?.data;
  if (typeof responseData === 'string') {
    return responseData.includes('Page not found') || responseData.includes('DEBUG = True');
  }

  return false;
};

let refreshInFlight: Promise<void> | null = null;

async function refreshAccessTokenSilently(): Promise<void> {
  if (refreshInFlight) {
    await refreshInFlight;
    return;
  }

  refreshInFlight = (async () => {
    const refreshToken = await AsyncStorage.getItem('refresh_token');
    if (!refreshToken) {
      throw new Error('No refresh token');
    }

    const base = getCurrentApiBaseUrl().replace(/\/+$/, '');
    const url = `${base}${JWT_REFRESH_PATH}`;

    const { data } = await axios.post<{ access?: string; access_token?: string; refresh?: string }>(
      url,
      { refresh: refreshToken },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 20000,
        withCredentials: isWeb,
      }
    );

    const access = data.access ?? data.access_token;
    if (!access || typeof access !== 'string') {
      throw new Error('Invalid token refresh response');
    }

    await AsyncStorage.setItem('auth_token', access);
    if (data.refresh) {
      await AsyncStorage.setItem('refresh_token', data.refresh);
    }
  })();

  try {
    await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

async function clearSessionAfterAuthFailure(): Promise<void> {
  try {
    const { useAuthStore } = require('../store/authStore') as typeof import('../store/authStore');
    await useAuthStore.getState().clearSessionAfterAuthFailure();
  } catch (e) {
    console.error('clearSessionAfterAuthFailure:', e);
    await AsyncStorage.multiRemove(['auth_token', 'refresh_token', 'sessionid']);
  }
}

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
      config.baseURL = config.baseURL || getCurrentApiBaseUrl();

      if (__DEV__) {
        console.log('📤 [API] Request:', config.method?.toUpperCase(), config.url);
      }

      if (isFormDataPayload(config.data)) {
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
  async (error: AxiosError) => {
    const originalConfig = error.config as AppAxiosRequestConfig | undefined;

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

    if (originalConfig?.skipAuthRefresh) {
      return Promise.reject(error);
    }

    const status = error.response?.status;

    if (
      status === 401 &&
      originalConfig &&
      !originalConfig._retryAfterRefresh &&
      !String(originalConfig.url || '').includes(JWT_REFRESH_PATH)
    ) {
      const storedRefresh = await AsyncStorage.getItem('refresh_token');
      if (!storedRefresh) {
        return Promise.reject(error);
      }

      originalConfig._retryAfterRefresh = true;
      try {
        await refreshAccessTokenSilently();
        const newAccess = await AsyncStorage.getItem('auth_token');
        if (newAccess) {
          originalConfig.headers = originalConfig.headers ?? {};
          originalConfig.headers.Authorization = `Bearer ${newAccess}`;
        }
        return api.request(originalConfig);
      } catch (refreshErr) {
        if (__DEV__) {
          console.error('❌ [API] Token refresh failed:', refreshErr);
        }
        await clearSessionAfterAuthFailure();
        return Promise.reject(error);
      }
    }

    if (__DEV__ && originalConfig && !originalConfig.__backendFallbackAttempted && shouldAttemptFallback(error)) {
      const fallbackBaseUrl = getFallbackApiBaseUrl();

      if (fallbackBaseUrl && fallbackBaseUrl !== originalConfig.baseURL) {
        const nextBaseUrl = switchApiBaseUrl(fallbackBaseUrl);

        if (__DEV__) {
          console.log('🔄 [API] Switching backend to fallback:', nextBaseUrl);
        }

        return api.request({
          ...originalConfig,
          baseURL: nextBaseUrl,
          __backendFallbackAttempted: true,
        } as AppAxiosRequestConfig);
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
        await AsyncStorage.multiRemove(['auth_token', 'refresh_token', 'sessionid']);
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

  verifyEmail: (email: string, code: string) =>
    api.post('/api/web/verify-email/', { email, code }),

  resendVerificationCode: (email: string) =>
    api.post('/api/web/resend-verification-code/', { email }),

  cancelRegistration: (email: string) =>
    api.post('/api/web/cancel-registration/', { email }),

  requestPasswordReset: (email: string) =>
    api.post('/api/web/password-reset/', { email }),

  confirmPasswordReset: (email: string, code: string, new_password: string) =>
    api.post('/api/web/password-reset/confirm/', { email, code, new_password }),

  changePassword: (current_password: string, new_password: string) =>
    api.post('/api/web/change-password/', { current_password, new_password }),

  logout: () =>
    api.post('/api/web/logout/', null, {
      skipAuthRefresh: true,
    } as AppAxiosRequestConfig),

  getMe: () => api.get('/api/web/me/'),
};

export const volunteerAPI = {
  getDashboard: () => api.get('/api/web/volunteer/dashboard/'),

  getProfile: () => api.get('/api/web/volunteer/profile/'),
  updateProfile: (data: any) => api.patch('/api/web/volunteer/profile/', data),

  getStats: () => api.get<import('../types').VolunteerStats>('/api/web/volunteer/stats/'),
  getActivity: (params?: { start_date?: string; end_date?: string }) =>
    api.get<import('../types').VolunteerActivity>('/api/web/volunteer/activity/', { params }),

  getProjects: (params?: any) => api.get('/api/web/volunteer/projects/', { params }),
  getProjectDetail: (id: number) => api.get(`/api/web/volunteer/projects/${id}/`),
  joinProject: (projectId: number) => api.post(`/api/web/volunteer/projects/${projectId}/join/`),
  leaveProject: (projectId: number, reason: string) =>
    api.post(`/api/web/volunteer/projects/${projectId}/leave/`, { reason }),

  /** Публичная карточка организатора проекта (только чтение, для волонтёра). */
  getPublicOrganizerPortfolio: (organizerId: number) =>
    api.get(`/api/web/organizer/${organizerId}/portfolio/`),

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

  getChats: () => api.get('/api/web/volunteer/chats/'),
  getChatMessages: (chatId: number, params?: { limit?: number; offset?: number }) =>
    api.get(`/api/web/volunteer/chats/${chatId}/messages/`, { params }),
  sendMessage: (chatId: number, message: string | FormData) =>
    api.post(
      `/api/web/volunteer/chats/${chatId}/send/`,
      typeof message === 'string' ? { text: message } : message
    ),
  markMessagesRead: (chatId: number) => api.post(`/api/web/volunteer/chats/${chatId}/read/`),
};

export default api;
