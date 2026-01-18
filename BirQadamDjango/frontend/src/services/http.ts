import axios from 'axios';

// ✅ PRODUCTION: VITE_API_BASE_URL должен быть задан через переменную окружения
// В development используем относительный путь (проксируется через vite.config.ts)
// В production используем полный URL
const apiBaseUrl = import.meta.env.DEV 
  ? '' // В разработке используем относительный путь (проксируется через vite)
  : (import.meta.env.VITE_API_BASE_URL || 'https://cleanup.almau.edu.kz');

export const httpClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 15000,
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
  // Используем сессионную авторизацию через cookies
  // Токен не нужен, так как используется CsrfExemptSessionAuthentication
  // Но если токен есть, используем его
  const token = localStorage.getItem("access");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Убеждаемся, что cookies отправляются
  config.withCredentials = true;
  return config;
});

// Response interceptor для логирования всех ошибок
httpClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Логируем все ошибки в консоль для отладки
    console.error('HTTP Error:', {
      message: error?.message,
      url: error?.config?.url,
      method: error?.config?.method,
      baseURL: error?.config?.baseURL,
      fullURL: error?.config?.baseURL + error?.config?.url,
      status: error?.response?.status,
      statusText: error?.response?.statusText,
      data: error?.response?.data,
      code: error?.code,
      isNetworkError: !error?.response,
      isCORS: error?.message?.includes('CORS') || error?.code === 'ERR_NETWORK',
    });
    
    return Promise.reject(error);
  }
);
