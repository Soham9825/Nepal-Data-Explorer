import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev the SPA is served from :5173 and Django from :8000, which makes every
// request cross-origin. Because the calls carry `Authorization: Bearer ...` (and
// several GETs also set `Content-Type: application/json`), neither of which is
// CORS-safelisted, the browser had to send an `OPTIONS` preflight for nearly
// every single request. Proxying the API prefixes keeps dev same-origin, so no
// preflight is issued at all and the CORS/cookie edge cases disappear.
const DJANGO_TARGET = process.env.VITE_DEV_API_TARGET || 'http://localhost:8000';

const proxy = {
  target: DJANGO_TARGET,
  changeOrigin: true,
};

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': proxy,
      '/accounts': proxy,
      '/admin': proxy,
      '/static': proxy,
      '/media': proxy,
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    css: false,
    include: ['src/**/*.test.{js,jsx}'],
  },
});
