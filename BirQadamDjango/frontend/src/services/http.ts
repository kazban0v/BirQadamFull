import axios from 'axios';

// ✅ PRODUCTION: VITE_API_BASE_URL должен быть задан через переменную окружения
// В development можно задать в .env файле или через vite.config.ts
const apiBaseUrl ='http://127.0.0.1:8002';
// PROD https://cleanup.almau.edu.kz
// const apiBaseUrl = '/custom-admin/api';

export const httpClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 15000,
  withCredentials: true,
  xsrfCookieName: 'csrftoken',
  xsrfHeaderName: 'X-CSRFToken',
});


const CSRF_SAFE_METHODS = ['get', 'head', 'options', 'trace'];

export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
    ?.split('=')[1];
  return value ? decodeURIComponent(value) : null;
}

// httpClient.interceptors.request.use((config) => {
//   const method = config.method?.toLowerCase();
//   if (method && !CSRF_SAFE_METHODS.includes(method)) {
//     const csrfToken = getCookie('csrftoken');
//     if (csrfToken) {
//       if (!config.headers) config.headers = {};
//       config.headers['X-CSRFToken'] = csrfToken;
//     }
//   }
//   return config;
// });
//

httpClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("access"); // или где хранишь
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
