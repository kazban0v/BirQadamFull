import axios from 'axios';

// ✅ PRODUCTION: Бэкенд на cleanup.almau.edu.kz, фронтенд на birqadam.almau.edu.kz
// В development пустой baseURL (проксируется через vite.config.ts)
// В production используем cleanup.almau.edu.kz для API запросов
// Можно переопределить через переменную окружения VITE_API_BASE_URL
const apiBaseUrl = import.meta.env.DEV
  ? '' // В разработке пустой - проксируется через Vite
  : (import.meta.env.VITE_API_BASE_URL || 'https://cleanup.almau.edu.kz');

export const httpClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 15000,
  withCredentials: true,
  xsrfCookieName: 'csrftoken',
  xsrfHeaderName: 'X-CSRFToken',
});

export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
    ?.split('=')[1];
  return value ? decodeURIComponent(value) : null;
}

httpClient.interceptors.request.use((config) => {
  // ✅ КРИТИЧНО: Исправляем формирование URL перед каждым запросом
  if (config.url && typeof window !== 'undefined') {
    // Если URL абсолютный (начинается с /), гарантируем правильный baseURL
    if (config.url.startsWith('/')) {
      // В production используем cleanup.almau.edu.kz для API запросов
      // (бэкенд и фронтенд на разных доменах)
      if (import.meta.env.PROD && !config.baseURL) {
        config.baseURL = import.meta.env.VITE_API_BASE_URL || 'https://cleanup.almau.edu.kz';
      }
      // В development baseURL остается пустым (проксируется через Vite)
    }
    
    // ✅ Защита: убираем любые признаки внутреннего IP из URL
    if (config.url.includes('192.168.') || config.url.includes('10.0.') || config.url.includes('172.')) {
      // Если в URL есть внутренний IP, очищаем его
      const cleanUrl = config.url.replace(/\/\d+\.\d+\.\d+\.\d+:\d+\//g, '/').replace(/\/\d+\.\d+\.\d+\.\d+:\d+/g, '');
      config.url = cleanUrl;
      console.warn('⚠️ Обнаружен внутренний IP в URL, очищен:', config.url);
    }
  }

  const token = localStorage.getItem('access');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  config.withCredentials = true;

  // Логирование для отладки (всегда, чтобы видеть проблемы)
  const fullURL =
    config.baseURL && config.url
      ? `${config.baseURL}${config.url}`
      : config.url || config.baseURL;
  
  console.log('🌐 Request:', {
    method: config.method?.toUpperCase(),
    url: config.url,
    baseURL: config.baseURL,
    fullURL,
  });

  return config;
});

httpClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const baseURL = error?.config?.baseURL || '';
    const url = error?.config?.url || '';
    const fullURL = baseURL && url ? `${baseURL}${url}` : url || baseURL;

    console.error('HTTP Error:', {
      message: error?.message,
      url: error?.config?.url,
      method: error?.config?.method,
      baseURL: error?.config?.baseURL,
      fullURL,
      status: error?.response?.status,
      statusText: error?.response?.statusText,
      data: error?.response?.data,
      code: error?.code,
      isNetworkError: !error?.response,
      isCORS:
        error?.message?.includes('CORS') ||
        error?.code === 'ERR_NETWORK',
    });

    return Promise.reject(error);
  }
);
