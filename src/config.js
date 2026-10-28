export const IS_DEVELOPMENT = import.meta.env.DEV;
// Browser requests always stay on the current origin. Vite proxies development
// routes; in production Flask serves the frontend and API on that same origin.
export const API_BASE_URL = '';

export function apiUrl(path) {
  const cleanPath = `/${String(path).replace(/^\/+/, '')}`;
  return `${API_BASE_URL}${cleanPath}`;
}

export const HEALTH_PATH = IS_DEVELOPMENT ? '/api/health' : '/';
