import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

// https://vite.dev/config/
export default defineConfig({
  // ✅ Базовый путь для развертывания на /portal
  base: '/',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: '@use "sass:math";\n',
      },
    },
  },
  ssr: {
    noExternal: ['vuetify'],
  },
  // ✅ Прокси для разработки - избегаем CORS проблем
  // Используйте локальный Django сервер (http://localhost:8000) если он запущен
  // Или production сервер (https://cleanup.almau.edu.kz)
  server: {
    proxy: {
      '/api': {
        // Можно использовать локальный сервер: 'http://localhost:8000'
        // Или production: 'https://cleanup.almau.edu.kz'
        target: process.env.VITE_API_TARGET || 'http://localhost:8000',
        changeOrigin: true,
        secure: false, // Отключаем проверку SSL для разработки
        ws: true, // Поддержка WebSocket
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.error('❌ Proxy error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('➡️  Proxying:', req.method, req.url, '→', proxyReq.path);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            const status = proxyRes.statusCode || 0;
            const statusIcon = status >= 200 && status < 300 ? '✅' : status >= 400 ? '❌' : '⚠️';
            console.log(`${statusIcon} Response:`, status, req.url);
          });
        },
      },
      '/custom-admin/api': {
        // Прокси для custom-admin API
        target: process.env.VITE_API_TARGET || 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        ws: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.error('❌ Proxy error (custom-admin):', err);
          });
        },
      },
      // Прокси для Django-страниц (services, faq и т.д.)
      '/services': {
        target: process.env.VITE_API_TARGET || 'https://cleanup.almau.edu.kz',
        changeOrigin: true,
        secure: false,
      },
      '/faq': {
        target: process.env.VITE_API_TARGET || 'https://cleanup.almau.edu.kz',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
