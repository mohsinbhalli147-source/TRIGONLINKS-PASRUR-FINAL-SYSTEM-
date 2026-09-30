import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Subscriber app.
 *
 * The dev server proxies /api to the Trigon Links server so the app is
 * same-origin in development and the httpOnly session cookie is sent. In
 * production the customer app is served by the same host as the API, or
 * VITE_API_BASE points at it.
 */
const API_TARGET = process.env.TRIGON_API_ORIGIN ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    // A phone app should not ship a desktop-sized vendor bundle.
    target: 'es2020',
  },
});
