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
  let text;
  try { text = await response.text(); } catch { return ''; }
  if (!text) return null;
  text = text.replace(/^\uFEFF/, '');
  // Some Flask/proxy responses contain valid JSON but are mislabeled as
  // text/plain. Parse by content as well as MIME type so the listing doesn't
  // silently become an empty array.
  if (type.includes('application/json') || /^[\s]*[\[{]/.test(text)) {
    try {
      const parsed = JSON.parse(text);
      // A few wrappers serialize the already-serialized Flask JSON body.
      if (typeof parsed === 'string' && /^[\s]*[\[{]/.test(parsed)) return JSON.parse(parsed);
      return parsed;
    } catch {
      if (type.includes('application/json')) return null;
    }
  }
  return text;
}

function responseError(response, data, fallback) {
  const detail = data && typeof data === 'object' ? data.error || data.message : '';
  const statusMessages = {
    400: 'The request was invalid. Check the name or folder path and try again.',
    404: 'The requested file or folder could not be found.',
    409: 'An item with that name already exists or the operation conflicts with the current folder.',
    413: 'The selected upload is too large for this request.',
    415: 'This file type cannot be previewed.',
    507: 'There is not enough storage space to complete this operation.',
  };
  const message = detail || statusMessages[response.status] || `${fallback} (${response.status}).`;
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
  listFiles: (path = '') => {
    const query = path ? `?${new URLSearchParams({ path })}` : '';
    return request(`/files${query}`, { cache: 'no-store' });
  },
  getFiles: (path = '') => {
    const query = path ? `?${new URLSearchParams({ path })}` : '';
    // Directory listings change after uploads and file operations. Bypass the
    // browser HTTP cache so a stale ETag/304 cannot replay another folder's
    // previously cached listing.
    return request(`/files${query}`, { cache: 'no-store' }).then((data) => normalizeFilesResponse(data));
  },
  monitorStats: () => request('/api/monitor/stats'),
  createFolder: (name, path = '') => request('/folders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, path }),
  }),
  uploadFiles: (files, path = '', onProgress, onXhr) => uploadFiles(files, path, onProgress, onXhr),
  downloadFile: (path, onProgress) => downloadFile(path, onProgress),
  getPreview: (path) => getPreview(path),
  getPreviewUrl: (path) => apiUrl(`/preview/${encodePath(path)}`),
  renameItem: (path, newName) => request('/files/rename', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, new_name: newName }),
  }),
  moveItem: (path, destination) => request('/files/move', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, destination }),
  }),
  deleteItem: (path) => request(`/files/${encodePath(path)}`, { method: 'DELETE' }),
  deleteFile: (filename) => {
    return request(`/files/${encodePath(filename)}`, { method: 'DELETE' });
  },
  upload: (file, onProgress, onXhr) => uploadFiles([file], '', onProgress, onXhr),
  download: (filename, onProgress) => downloadFile(filename, onProgress),
};

function normalizeFilesResponse(data) {
  let payload = data;
  if (typeof payload === 'string') {
    try { payload = JSON.parse(payload); } catch { /* handled as invalid below */ }
  }
  if (Array.isArray(payload)) return { items: payload, files: payload };

  // Flask deployments may wrap the listing or serialize the list field as a
  // JSON string. Walk only response objects (not the file records themselves)
  // and normalize the first recognized items/files arrays for the page.
  const queue = [payload];
  const visited = new Set();
  while (queue.length) {
    const candidate = queue.shift();
    if (!candidate || typeof candidate !== 'object' || visited.has(candidate)) continue;
    visited.add(candidate);

    let items = candidate.items;
    let files = candidate.files;
    for (const [key, value] of [['items', items], ['files', files]]) {
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) {
            if (key === 'items') items = parsed;
            else files = parsed;
          }
        } catch { /* ignore non-JSON string fields */ }
      }
    }
    if (Array.isArray(items) || Array.isArray(files)) {
      return { ...candidate, items: Array.isArray(items) ? items : files, files: Array.isArray(files) ? files : items };
    }
    for (const value of Object.values(candidate)) {
      if (value && typeof value === 'object') queue.push(value);
      else if (typeof value === 'string' && /^[\s]*[\[{]/.test(value)) {
        try {
          const parsed = JSON.parse(value);
          if (parsed && typeof parsed === 'object') queue.push(parsed);
        } catch { /* not an embedded JSON object */ }
      }
    }
  }

  throw new ApiError('Vivo Cloud returned a folder listing without an items or files array. Check the response structure and retry.', 0, 'INVALID_LIST_RESPONSE');
}

function encodePath(path = '') {
  return String(path).split('/').filter(Boolean).map((part) => encodeURIComponent(part)).join('/');
}

function uploadFiles(files, path, onProgress, onXhr) {
  return new Promise((resolve, reject) => {
    if (!files?.length) {
      reject(new ApiError('Choose at least one file to upload.', 0, 'EMPTY_UPLOAD'));
      return;
    }
    const xhr = new XMLHttpRequest();
    const body = new FormData();
    body.append('path', path || '');
    const useMultipleField = files.length > 1 || files.some((file) => file.webkitRelativePath);
    for (const file of files) {
      const relativeName = file.webkitRelativePath || file.name;
      if (useMultipleField) body.append('files', file, relativeName);
      else body.append('file', file, relativeName);
    }
    xhr.open('POST', apiUrl('/upload'));
    xhr.withCredentials = true;
    xhr.responseType = 'text';
    onXhr?.(xhr);
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    });
    xhr.addEventListener('error', () => reject(new ApiError('Could not reach Vivo Cloud. Check the network and server address.', 0, 'NETWORK_ERROR')));
    xhr.addEventListener('abort', () => reject(new ApiError('Upload cancelled.', 0, 'UPLOAD_CANCELLED')));
    xhr.addEventListener('load', () => {
      const contentType = xhr.getResponseHeader('content-type') || '';
      let data = xhr.responseText;
      if (contentType.includes('application/json')) {
        try { data = JSON.parse(xhr.responseText); } catch { data = null; }
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        const detail = data && typeof data === 'object' ? data.error || data.message : '';
        reject(xhr.status === 401 ? new UnauthorizedError() : new ApiError(detail || statusError(xhr.status), xhr.status));
        return;
      }
      resolve(data);
    });
    xhr.send(body);
  });
}

function downloadFile(path, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', apiUrl(`/download/${encodePath(path)}`));
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
        const message = data && typeof data === 'object' ? data.error || data.message : statusError(xhr.status);
        reject(xhr.status === 401 ? new UnauthorizedError() : new ApiError(message, xhr.status));
        return;
      }
      resolve(xhr.response);
    });
    xhr.send();
  });
}

async function getPreview(path) {
  let response;
  try {
    response = await fetch(apiUrl(`/preview/${encodePath(path)}`), { credentials: 'include' });
  } catch {
    throw new ApiError('Could not reach Vivo Cloud. Check the network and server address.', 0, 'NETWORK_ERROR');
  }
  if (!response.ok) throw responseError(response, await readResponse(response), 'Preview failed');
  return response.blob();
}

function statusError(status) {
  const messages = {
    400: 'The request was invalid. Check the name or folder path and try again.',
    404: 'The requested file or folder could not be found.',
    409: 'An item with that name already exists or the operation conflicts with the current folder.',
    413: 'The selected upload is too large for this request.',
    415: 'This file type cannot be previewed.',
    507: 'There is not enough storage space to complete this operation.',
  };
  return messages[status] || `Request failed (${status}).`;
}
