import axios from 'axios';

// ✅ PRODUCTION: Frontend на /portal/, API на /api/web/ (в корне домена)
// Абсолютные пути /api/web/... всегда идут на корень домена: https://birqadam.almau.edu.kz/api/web/...
// В development проксируется через vite.config.ts
// В production: страница на https://birqadam.almau.edu.kz/portal/, запросы на https://birqadam.almau.edu.kz/api/web/...
// Пустой baseURL гарантирует, что абсолютные пути из сервисов не будут изменены
// Можно задать VITE_API_BASE_URL для использования другого домена для API
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';

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
  
  // Логирование для отладки (только в development)
  if (import.meta.env.DEV) {
    const fullURL = config.baseURL && config.url 
      ? `${config.baseURL}${config.url}` 
      : (config.url || config.baseURL);
    console.log('🌐 Request:', {
      method: config.method?.toUpperCase(),
      url: config.url,
      baseURL: config.baseURL,
      fullURL: fullURL,
    });
  }
  
  return config;
});

// Response interceptor для логирования всех ошибок
httpClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Формируем полный URL правильно
    const baseURL = error?.config?.baseURL || '';
    const url = error?.config?.url || '';
    const fullURL = baseURL && url ? `${baseURL}${url}` : (url || baseURL);
    
    // Логируем все ошибки в консоль для отладки
    console.error('HTTP Error:', {
      message: error?.message,
      url: error?.config?.url,
      method: error?.config?.method,
      baseURL: error?.config?.baseURL,
      fullURL: fullURL,
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
