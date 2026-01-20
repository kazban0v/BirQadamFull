import axios from 'axios';

// ✅ PRODUCTION: VITE_API_BASE_URL должен быть задан через переменную окружения
// В development используем относительный путь (проксируется через vite.config.ts)
// В production используем полный URL из переменной окружения или текущий домен
const apiBaseUrl = import.meta.env.DEV 
  ? '' // В разработке используем относительный путь (проксируется через vite)
  : (import.meta.env.VITE_API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : ''));

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
  // ✅ КРИТИЧНО: Нормализуем URL для правильного формирования абсолютных путей
  // Когда baseURL = window.location.origin, а URL абсолютный (начинается с /),
  // axios правильно объединяет их: origin + /api/web/... = https://domain.com/api/web/...
  // Но нужно убедиться, что baseURL установлен для всех случаев
  if (config.url && typeof window !== 'undefined') {
    // Если URL абсолютный (начинается с /), убеждаемся что baseURL установлен
    if (config.url.startsWith('/') && !config.baseURL) {
      config.baseURL = window.location.origin;
    }
  }
  
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
