import { apiUrl, HEALTH_PATH } from '../config.js';

export class ApiError extends Error {
  constructor(message, status = 0, code = 'API_ERROR') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Your session has expired. Please log in again.') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

async function readResponse(response) {
  const type = response.headers.get('content-type') || '';
  if (type.includes('application/json')) {
    try { return await response.json(); } catch { return null; }
  }
  try { return await response.text(); } catch { return ''; }
}

function responseError(response, data, fallback) {
  const detail = data && typeof data === 'object' ? data.error || data.message : '';
  const message = detail || `${fallback} (${response.status}).`;
  return response.status === 401 ? new UnauthorizedError() : new ApiError(message, response.status);
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(apiUrl(path), { ...options, credentials: 'include' });
  } catch {
    throw new ApiError('Could not reach Vivo Cloud. Check the network and server address.', 0, 'NETWORK_ERROR');
  }

  const data = await readResponse(response);
  if (!response.ok) throw responseError(response, data, 'Request failed');
  return data;
}

function uploadFile(file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const body = new FormData();
    body.append('file', file);
    xhr.open('POST', apiUrl('/upload'));
    xhr.withCredentials = true;
    xhr.responseType = 'text';
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    });
    xhr.addEventListener('error', () => reject(new ApiError('Could not reach Vivo Cloud. Check the network and server address.', 0, 'NETWORK_ERROR')));
    xhr.addEventListener('load', () => {
      const contentType = xhr.getResponseHeader('content-type') || '';
      let data = xhr.responseText;
      if (contentType.includes('application/json')) {
        try { data = JSON.parse(xhr.responseText); } catch { data = null; }
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        const detail = data && typeof data === 'object' ? data.error || data.message : '';
        reject(xhr.status === 401 ? new UnauthorizedError() : new ApiError(detail || `Upload failed (${xhr.status}).`, xhr.status));
        return;
      }
      resolve(data);
    });
    xhr.send(body);
  });
}

export const cloudApi = {
  health: () => request(HEALTH_PATH),
  login: async (username, password) => {
    try {
      return await request('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        throw new ApiError('Invalid username or password.', 401, 'INVALID_CREDENTIALS');
      }
      throw error;
    }
  },
  logout: () => request('/logout', { method: 'POST' }),
  listFiles: () => request('/files'),
  deleteFile: (filename) => {
    const safeName = String(filename).split(/[\\/]/).pop();
    return request(`/files/${encodeURIComponent(safeName)}`, { method: 'DELETE' });
  },
  upload: uploadFile,
  download: (filename, onProgress) => new Promise((resolve, reject) => {
    const safeName = String(filename).split(/[\\/]/).pop();
    const xhr = new XMLHttpRequest();
    xhr.open('GET', apiUrl(`/download/${encodeURIComponent(safeName)}`));
    xhr.withCredentials = true;
    xhr.responseType = 'blob';
    xhr.addEventListener('progress', (event) => onProgress?.({
      loaded: event.loaded,
      total: event.lengthComputable ? event.total : null,
      percent: event.lengthComputable ? Math.round((event.loaded / event.total) * 100) : null,
    }));
    xhr.addEventListener('error', () => reject(new ApiError('Could not reach Vivo Cloud. Check the network and server address.', 0, 'NETWORK_ERROR')));
    xhr.addEventListener('load', async () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        const contentType = xhr.getResponseHeader('content-type') || '';
        let data = '';
        try {
          const text = await xhr.response.text();
          data = contentType.includes('application/json') ? JSON.parse(text) : text;
        } catch { data = ''; }
        reject(xhr.status === 401 ? new UnauthorizedError() : new ApiError(
          data && typeof data === 'object' ? data.error || data.message : `Download failed (${xhr.status}).`,
          xhr.status,
        ));
        return;
      }
      resolve(xhr.response);
    });
    xhr.send();
  }),
};
