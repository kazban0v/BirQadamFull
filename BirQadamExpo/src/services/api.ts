import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// ✅ Настройка URL бэкенда
// Используйте переменную окружения EXPO_PUBLIC_API_BASE_URL для настройки
// Для production: установите EXPO_PUBLIC_API_BASE_URL=https://cleanup.almau.edu.kz
// Для development: можно использовать локальный IP или переменную окружения
const getApiBaseUrl = (): string => {
  // Проверяем переменную окружения (приоритет)
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (envUrl) {
    return envUrl;
  }
  
  // Production mode
  if (!__DEV__) {
    return 'https://cleanup.almau.edu.kz';
  }
  
  // Development mode - используем переменную окружения или определяем автоматически
  // Для физических устройств используйте переменную окружения EXPO_PUBLIC_API_BASE_URL
  // Например: EXPO_PUBLIC_API_BASE_URL=http://192.168.0.129:8000
  
  // Эмуляторы и симуляторы
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000';  // Android эмулятор
    // Для физического Android устройства раскомментируйте следующую строку:
    // return 'http://192.168.0.129:8000';
  } else if (Platform.OS === 'ios') {
    // Для iOS: используем IP адрес для физических устройств
    // Для iOS симулятора используйте: http://localhost:8000
    // Для физического устройства используйте IP адрес вашего компьютера
    return 'http://192.168.0.129:8000';  // Физическое iOS устройство
    // Для iOS симулятора раскомментируйте следующую строку:
    // return 'http://localhost:8000';
  }
  
  // Fallback - в development используйте переменную окружения!
  console.warn('⚠️ [API] Using fallback URL. Set EXPO_PUBLIC_API_BASE_URL environment variable for production!');
  return 'http://192.168.0.129:8000';  // Fallback для физических устройств
};

const API_BASE_URL = getApiBaseUrl();
  

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 секунд таймаут
  withCredentials: false, // ⚠️ React Native не поддерживает cookies так же как браузер
});

// Логирование для отладки
if (__DEV__) {
  console.log('🔧 [API] Base URL:', API_BASE_URL);
}

// Интерцептор для добавления токена авторизации
api.interceptors.request.use(
  async (config) => {
    try {
      if (__DEV__) {
        console.log('📤 [API] Request:', config.method?.toUpperCase(), config.url);
      }
      // Получаем JWT токен из AsyncStorage
      const token = await AsyncStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      
      // Session ID для Django session auth
      const sessionId = await AsyncStorage.getItem('sessionid');
      if (sessionId) {
        config.headers.Cookie = `sessionid=${sessionId}`;
      }
      
      // CSRF токен (если используется)
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

// Интерцептор для обработки ответов
api.interceptors.response.use(
  async (response) => {
    if (__DEV__) {
      console.log('📥 [API] Response:', response.status, response.config.url);
    }
    // Сохраняем CSRF токен если он пришёл
    const csrfToken = response.headers['x-csrftoken'];
    if (csrfToken) {
      await AsyncStorage.setItem('csrftoken', csrfToken);
    }
    
    // Сохраняем Session ID из cookies (для Django session auth)
    const setCookie = response.headers['set-cookie'];
    if (setCookie) {
      // set-cookie может быть массивом или строкой
      const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : setCookie;
      // Извлекаем sessionid из Set-Cookie header
      const sessionMatch = cookieStr.match(/sessionid=([^;]+)/);
      if (sessionMatch) {
        await AsyncStorage.setItem('sessionid', sessionMatch[1]);
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
    if (error.response?.status === 401 || error.response?.status === 403) {
      // Обработка неавторизованного доступа
      await AsyncStorage.multiRemove(['auth_token', 'user', 'sessionid']);
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  // Вход
  login: (identifier: string, password: string) =>
    api.post('/api/web/login/', { identifier, password }),
  
  // Регистрация волонтёра
  registerVolunteer: (data: {
    username: string;
    name: string;
    phone_number: string;
    email: string;
    password: string;
  }) => {
    // Нормализуем номер телефона - добавляем + если его нет
    const normalizedPhone = data.phone_number.startsWith('+') 
      ? data.phone_number 
      : `+${data.phone_number}`;
    
    return api.post('/api/web/register/volunteer/', {
      full_name: data.name,  // Бэкенд ожидает full_name вместо name
      phone_number: normalizedPhone,
      email: data.email,
      password: data.password,
    });
  },
  
  // Регистрация организатора
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
    // Нормализуем номер телефона - добавляем + если его нет
    const normalizedPhone = data.phone_number.startsWith('+') 
      ? data.phone_number 
      : `+${data.phone_number}`;
    
    return api.post('/api/web/register/organizer/', {
      full_name: data.name,  // Бэкенд ожидает full_name вместо name
      organization_name: data.organization_name,
      phone_number: normalizedPhone,
      email: data.email,
      password: data.password,
      inn: data.inn,
      bin: data.bin,
    });
  },
  
  // Подтверждение email
  verifyEmail: (email: string, code: string) =>
    api.post('/api/web/verify-email/', { email, code }),
  
  // Повторная отправка кода
  resendVerificationCode: (email: string) =>
    api.post('/api/web/resend-verification-code/', { email }),
  
  // Отмена регистрации
  cancelRegistration: (email: string) =>
    api.post('/api/web/cancel-registration/', { email }),
  
  // Запрос сброса пароля
  requestPasswordReset: (email: string) =>
    api.post('/api/web/password-reset/request/', { email }),
  
  // Подтверждение сброса пароля
  confirmPasswordReset: (email: string, code: string, new_password: string) =>
    api.post('/api/web/password-reset/confirm/', { email, code, new_password }),
  
  // Смена пароля
  changePassword: (old_password: string, new_password: string) =>
    api.post('/api/web/change-password/', { old_password, new_password }),
  
  // Выход
  logout: () => api.post('/api/web/logout/'),
  
  // Получение текущего пользователя
  getMe: () => api.get('/api/web/me/'),
};

export const volunteerAPI = {
  // Dashboard
  getDashboard: () => api.get('/api/web/volunteer/dashboard/'),
  
  // Профиль
  getProfile: () => api.get('/api/web/volunteer/profile/'),
  updateProfile: (data: any) => api.patch('/api/web/volunteer/profile/', data),
  
  // Статистика
  getStats: () => api.get('/api/web/volunteer/stats/'),
  getActivity: (params?: any) => api.get('/api/web/volunteer/activity/', { params }),
  
  // Проекты
  getProjects: (params?: any) => api.get('/api/web/volunteer/projects/', { params }),
  getProjectDetail: (id: number) => api.get(`/api/web/volunteer/projects/${id}/`),
  joinProject: (projectId: number) => api.post(`/api/web/volunteer/projects/${projectId}/join/`),
  leaveProject: (projectId: number, reason: string) => 
    api.post(`/api/web/volunteer/projects/${projectId}/leave/`, { reason }),
  
  // Организаторы
  getOrganizerPortfolio: (organizerId: number) => api.get(`/api/web/organizer/${organizerId}/portfolio/`),
  
  // Задачи - используем v1 API через custom-admin
  getTasks: (params?: any) => api.get('/custom-admin/api/v1/tasks/', { params }),
  getTaskDetail: (id: number) => api.get(`/custom-admin/api/v1/tasks/${id}/`),
  acceptTask: (taskId: number) => api.post(`/custom-admin/api/v1/tasks/${taskId}/accept/`),
  declineTask: (taskId: number) => api.post(`/custom-admin/api/v1/tasks/${taskId}/decline/`),
  completeTask: (taskId: number) => api.post(`/custom-admin/api/v1/tasks/${taskId}/complete/`),
  retryTask: (taskId: number) => api.post(`/custom-admin/api/v1/tasks/${taskId}/retry/`),
  archiveTask: (taskId: number) => api.post(`/custom-admin/api/v1/tasks/${taskId}/archive/`),
  submitPhotoReportV1: (taskId: number, photos: FormData) =>
    api.post(`/custom-admin/api/v1/tasks/${taskId}/photo-reports/`, photos, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  
  // Уведомления
  getNotifications: () => api.get('/api/web/volunteer/notifications/'),
  markNotificationRead: (id: number) => api.post(`/api/web/volunteer/notifications/${id}/read/`),
  markAllNotificationsRead: () => api.post('/api/web/volunteer/notifications/read-all/'),
  
  // Фотоотчёты
  getPhotoReports: (params?: any) => api.get('/api/web/volunteer/photo-reports/', { params }),
  submitPhotoReport: (taskId: number, photos: FormData) =>
    api.post(`/api/web/volunteer/tasks/${taskId}/photo-reports/`, photos, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  
  // Telegram синхронизация
  getTelegramSync: () => api.get('/api/web/telegram/sync/'),
};

export const organizerAPI = {
  // Dashboard
  getDashboard: () => api.get('/api/web/organizer/dashboard/'),
  
  // Профиль
  getProfile: () => api.get('/api/web/organizer/profile/'),
  updateProfile: (data: any) => api.patch('/api/web/organizer/profile/', data),
  
  // Проекты
  getProjects: (params?: any) => api.get('/api/web/organizer/projects/', { params }),
  createProject: (data: any) => api.post('/api/web/organizer/projects/', data),
  updateProject: (id: number, data: any) => api.patch(`/api/web/organizer/projects/${id}/`, data),
  deleteProject: (id: number) => api.delete(`/api/web/organizer/projects/${id}/`),
  
  // Волонтёры
  getVolunteers: (params?: any) => api.get('/api/web/organizer/volunteers/', { params }),
  getVolunteerDetail: (id: number) => api.get(`/api/web/organizer/volunteers/${id}/`),
  
  // Задачи
  getTasks: (params?: any) => api.get('/api/web/organizer/tasks/', { params }),
  createTask: (projectId: number, data: any) => api.post(`/api/web/organizer/projects/${projectId}/tasks/`, data),
  updateTask: (id: number, data: any) => api.patch(`/api/web/organizer/tasks/${id}/`, data),
  deleteTask: (id: number) => api.delete(`/api/web/organizer/tasks/${id}/`),
  
  // Модерация фото
  getPhotoModeration: () => api.get('/api/web/organizer/photo-moderation/'),
  approvePhoto: (id: number) => api.post(`/api/web/organizer/photos/${id}/approve/`),
  rejectPhoto: (id: number, reason: string) => api.post(`/api/web/organizer/photos/${id}/reject/`, { reason }),
  
  // Аналитика
  getAnalytics: (params?: any) => api.get('/api/web/organizer/analytics/', { params }),
};

export default api;
