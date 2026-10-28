import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = (env.VITE_DEV_API_TARGET || '').trim();
  let proxy;

  if (target) {
    try {
      const url = new URL(target);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Use http or https.');
      if (url.pathname !== '/' || url.search || url.hash) throw new Error('Set the target to the Flask server origin without a path, query, or fragment.');
      const proxyRoute = { target: url.origin, changeOrigin: true };
      proxy = {
        '^/api/health$': { ...proxyRoute, rewrite: () => '/' },
        '^/login$': proxyRoute,
        '^/logout$': proxyRoute,
        '^/files$': proxyRoute,
        '^/files/.*': proxyRoute,
        '^/upload$': proxyRoute,
        '^/download/.*': proxyRoute,
      };
    } catch (error) {
      console.warn(`[Vivo Cloud] Invalid VITE_DEV_API_TARGET: ${error.message}`);
    }
  } else if (mode === 'development') {
    console.warn('[Vivo Cloud] VITE_DEV_API_TARGET is missing or empty; API proxy is disabled. Edit .env.development.local.');
  }

  return { plugins: [react()], server: { proxy } };
});
