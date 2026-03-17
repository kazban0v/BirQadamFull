import axios from 'axios';

// ✅ PRODUCTION: VITE_API_BASE_URL должен быть задан через переменную окружения
// В development можно задать в .env файле или через vite.config.ts
// Для production используйте переменную окружения или production URL
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 
  (import.meta.env.PROD ? 'https://cleanup.almau.edu.kz' : 'http://localhost:8000');

export const httpClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 60000, // Увеличен таймаут до 60 секунд для операций с уведомлениями
  withCredentials: true,
  xsrfCookieName: 'csrftoken',
  xsrfHeaderName: 'X-CSRFToken',
});

//
// const CSRF_SAFE_METHODS = ['get', 'head', 'options', 'trace'];

export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
    ?.split('=')[1];
  return value ? decodeURIComponent(value) : null;
}

const CSRF_SAFE_METHODS = ['get', 'head', 'options', 'trace'];

httpClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("access");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Добавляем CSRF токен для POST, PUT, PATCH, DELETE запросов
  const method = config.method?.toLowerCase();
  if (method && !CSRF_SAFE_METHODS.includes(method)) {
    const csrfToken = getCookie('csrftoken');
    if (csrfToken) {
      config.headers['X-CSRFToken'] = csrfToken;
    }
  }
  
  return config;
});
