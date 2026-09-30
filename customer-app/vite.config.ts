import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

/**
 * Subscriber app.
 *
 * The dev server proxies /api to the Trigon Links server so the app is
 * same-origin in development and the httpOnly session cookie is sent. In
 * production the customer app is served by the same host as the API, or
 * VITE_API_BASE points at it.
 */
export default defineConfig(({ mode }) => {
  // Vite only exposes variables prefixed with VITE_ to the client, and it does
  // not put the rest of .env on process.env either. The proxy target is a
  // build-time value, so the file is read here instead. Reading process.env
  // alone is what made the proxy silently fall back to port 3000 and refuse
  // every connection when the server ran on another port.
  const env = loadEnv(mode, process.cwd(), '');
  const API_TARGET = env.TRIGON_API_ORIGIN || 'http://localhost:3010';

  return {
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
  };
});
