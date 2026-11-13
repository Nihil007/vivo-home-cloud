import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FolderPlus, RefreshCw, Upload } from 'lucide-react';
import { cloudApi, UnauthorizedError } from '../api/cloudApi.js';
import Breadcrumbs from '../components/storage/Breadcrumbs.jsx';
import FilePreviewModal from '../components/storage/FilePreviewModal.jsx';
import StorageCollection, { isPreviewSupported } from '../components/storage/StorageCollection.jsx';
import StorageDialog from '../components/storage/StorageDialog.jsx';
import StorageHeader from '../components/storage/StorageHeader.jsx';
import StorageSidebar from '../components/storage/StorageSidebar.jsx';
import UploadProgress from '../components/storage/UploadProgress.jsx';

const VIEW_TITLES = { drive: 'My Drive', recent: 'Recent', images: 'Images', videos: 'Videos', documents: 'Documents' };
const EXTENSION_FILTERS = {
  images: new Set(['jpg', 'jpeg', 'png', 'gif', 'webp']),
  videos: new Set(['mp4', 'webm']),
  documents: new Set(['pdf', 'txt', 'log', 'csv']),
};

export default function StoragePage({ onUnauthorized }) {
  const [currentPath, setCurrentPath] = useState(() => new URLSearchParams(window.location.search).get('path') || '');
  const [activeView, setActiveView] = useState('drive');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [notice, setNotice] = useState(null);
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState(() => window.localStorage.getItem('vivo-storage-view') || 'grid');
  const [sortBy, setSortBy] = useState('name');
  const [selectedPath, setSelectedPath] = useState('');
  const [modal, setModal] = useState(null);
  const [working, setWorking] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [preview, setPreview] = useState(null);
  const [storageUsage, setStorageUsage] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const xhrRef = useRef(null);
  const loadRequestRef = useRef(0);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  const loadContents = useCallback(async (path = currentPath) => {
    const requestId = ++loadRequestRef.current;
    setLoading(true);
    setListError('');
    setNotice(null);
    try {
      const response = await cloudApi.getFiles(path);
      if (requestId !== loadRequestRef.current) return false;
      const itemList = Array.isArray(response?.items) ? response.items : [];
      const legacyList = Array.isArray(response?.files) ? response.files : [];
      // Prefer the canonical `items` list, but fall back to the legacy list
      // when a backend version returns an empty `items` alongside populated
      // `files` (both fields are present for compatibility on some servers).
      const rawItems = itemList.length || !legacyList.length ? itemList : legacyList;
      const canonicalPath = normalizePath(response?.current_path ?? path);
      setItems(rawItems.map((entry) => {
        // Older Flask responses may put filename strings in `files`; the newer
        // contract returns item objects in `items`. Normalize both shapes so
        // nested names remain visible while the backend is being upgraded.
        const item = typeof entry === 'string' ? { name: entry } : entry || {};
        const itemPath = item.path || joinPath(canonicalPath, item.name || item.filename);
        const name = item.name || item.filename || itemPath.split('/').filter(Boolean).at(-1) || '';
        return {
          ...item,
          name,
          type: item.type === 'folder' ? 'folder' : 'file',
          path: itemPath || joinPath(canonicalPath, name),
        };
      }).filter((item) => item.name));
      if (canonicalPath !== normalizePath(path)) setCurrentPath(canonicalPath);
      return true;
    } catch (error) {
      if (requestId !== loadRequestRef.current) return false;
      if (error instanceof UnauthorizedError) onUnauthorized(error);
      setListError(error.message || 'Unable to load this folder. Please try again.');
      return false;
    } finally {
      if (requestId === loadRequestRef.current) setLoading(false);
    }
  }, [currentPath, onUnauthorized]);

  useEffect(() => {
    loadContents(currentPath);
  }, [currentPath, loadContents]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (currentPath) url.searchParams.set('path', currentPath);
    else url.searchParams.delete('path');
    window.history.replaceState({}, '', url);
  }, [currentPath]);

  useEffect(() => {
    const onPopState = () => setCurrentPath(normalizePath(new URLSearchParams(window.location.search).get('path') || ''));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    window.localStorage.setItem('vivo-storage-view', viewMode);
  }, [viewMode]);

  useEffect(() => {
    let active = true;
    cloudApi.monitorStats().then((response) => {
      if (!active || !response?.storage) return;
      const storage = response.storage;
      if (![storage.used_bytes, storage.free_bytes, storage.total_bytes].every((value) => Number.isFinite(Number(value)))) return;
      setStorageUsage({ used: formatBytes(storage.used_bytes), available: formatBytes(storage.free_bytes), total: formatBytes(storage.total_bytes), usagePercent: validPercent(storage.usage_percent) ? Number(storage.usage_percent) : null });
    }).catch((error) => {
      if (active && error instanceof UnauthorizedError) onUnauthorized(error);
    });
    return () => { active = false; };
  }, [onUnauthorized]);

  useEffect(() => () => {
    if (preview?.src) URL.revokeObjectURL(preview.src);
  }, [preview?.src]);

  const visibleItems = useMemo(() => {
    let result = items;
    if (activeView !== 'drive') {
      if (activeView === 'recent') {
        result = result.filter((item) => item.modified_at || item.modified || item.last_modified);
      } else {
        const allowed = EXTENSION_FILTERS[activeView];
        result = result.filter((item) => item.type === 'file' && allowed.has(extension(item.name)));
      }
    }
    if (query.trim()) {
      const search = query.trim().toLocaleLowerCase();
      result = result.filter((item) => item.name.toLocaleLowerCase().includes(search));
    }
    return [...result].sort((a, b) => {
      if (sortBy === 'size') {
        if (a.type === 'folder' && b.type !== 'folder') return -1;
        if (b.type === 'folder' && a.type !== 'folder') return 1;
        return (Number(a.size_bytes) || 0) - (Number(b.size_bytes) || 0);
      }
      if (sortBy === 'type') return extension(a.name).localeCompare(extension(b.name)) || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [items, activeView, query, sortBy]);

  const title = currentPath ? currentPath.split('/').filter(Boolean).at(-1) : VIEW_TITLES[activeView];

  function changeView(view) {
    setActiveView(view);
    setCurrentPath('');
    setSelectedPath('');
    setQuery('');
  }

  function navigate(path) {
    const nextPath = normalizePath(path);
    const url = new URL(window.location.href);
    if (nextPath) url.searchParams.set('path', nextPath);
    else url.searchParams.delete('path');
    window.history.pushState({}, '', url);
    setActiveView('drive');
    setCurrentPath(nextPath);
    setSelectedPath('');
  }

  function openFolder(item) {
    navigate(item.path);
  }

  function showModal(mode, item = null) {
    setModal({ mode, item });
  }

  async function submitModal(values) {
    if (!modal || working) return;
    setWorking(true);
    try {
      if (modal.mode === 'create') await cloudApi.createFolder(values.name, currentPath);
      if (modal.mode === 'rename') await cloudApi.renameItem(modal.item.path, values.name);
      if (modal.mode === 'move') {
        const destination = normalizePath(values.destination);
        if (modal.item.type === 'folder' && (destination === modal.item.path || destination.startsWith(modal.item.path + '/'))) {
          throw new Error('A folder cannot be moved into itself or one of its child folders.');
        }
        await cloudApi.moveItem(modal.item.path, destination);
      }
      if (modal.mode === 'delete') await cloudApi.deleteItem(modal.item.path);
      const successMessage = modal.mode === 'create' ? 'Folder created.' : modal.mode === 'rename' ? 'Item renamed.' : modal.mode === 'move' ? 'Item moved.' : 'Item deleted.';
      setModal(null);
      if (await loadContents(currentPath)) setNotice({ type: 'success', message: successMessage });
    } catch (error) {
      if (error instanceof UnauthorizedError) onUnauthorized(error);
      else setNotice({ type: 'error', message: error.message });
    } finally {
      setWorking(false);
    }
  }

  async function uploadFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length || xhrRef.current) return;
    setNotice(null);
    setUploadProgress({ count: files.length, filename: files[0].name, percent: 0, cancelling: false });
    try {
      await cloudApi.uploadFiles(files, currentPath, (percent) => setUploadProgress((current) => current && ({ ...current, percent })), (xhr) => { xhrRef.current = xhr; });
      setUploadProgress({ count: files.length, filename: files[0].name, percent: 100, complete: true });
      if (await loadContents(currentPath)) setNotice({ type: 'success', message: `${files.length} ${files.length === 1 ? 'file' : 'files'} uploaded.` });
      window.setTimeout(() => setUploadProgress(null), 2200);
    } catch (error) {
      if (error.code !== 'UPLOAD_CANCELLED') {
        if (error instanceof UnauthorizedError) onUnauthorized(error);
        else setNotice({ type: 'error', message: error.message });
      }
      setUploadProgress(null);
      await loadContents(currentPath);
    } finally {
      xhrRef.current = null;
    }
  }

  function cancelUpload() {
    if (!xhrRef.current) return;
    setUploadProgress((current) => current && ({ ...current, cancelling: true }));
    xhrRef.current.abort();
  }

  async function downloadItem(item) {
    if (downloadProgress && !downloadProgress.complete) return;
    setDownloadProgress({ filename: item.name, percent: 0, stage: 'preparing' });
    try {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const blob = await cloudApi.downloadFile(item.path, ({ percent }) => setDownloadProgress({ filename: item.name, percent, stage: 'downloading' }));
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = item.name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDownloadProgress({ filename: item.name, percent: 100, stage: 'complete', complete: true });
      window.setTimeout(() => setDownloadProgress(null), 1800);
    } catch (error) {
      setDownloadProgress(null);
      if (error instanceof UnauthorizedError) onUnauthorized(error);
      else setNotice({ type: 'error', message: error.message });
    }
  }

  async function openPreview(item) {
    if (!isPreviewSupported(item)) {
      setPreview({ item, unsupported: true });
      return;
    }
    setPreview({ item, loading: true });
    try {
      const responseBlob = await cloudApi.getPreview(item.path);
      const blob = withPreviewMime(responseBlob, item.name);
      const src = URL.createObjectURL(blob);
      const text = ['txt', 'log', 'csv'].includes(extension(item.name)) ? await blob.text() : null;
      setPreview({ item, src, text, loading: false });
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        setPreview(null);
        onUnauthorized(error);
      } else setPreview({ item, error: error.message, loading: false });
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragActive(false);
    uploadFiles(event.dataTransfer.files);
  }

  return <div className="storage-app" onDragOver={(event) => { event.preventDefault(); setDragActive(true); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragActive(false); }} onDrop={handleDrop}>
    <StorageSidebar activeView={activeView} onViewChange={changeView} storage={storageUsage} onCreateFolder={() => showModal('create')} onUploadFiles={() => fileInputRef.current?.click()} onUploadFolder={() => folderInputRef.current?.click()} />
    <main className="storage-main">
      <StorageHeader query={query} onQueryChange={setQuery} viewMode={viewMode} onViewChange={setViewMode} sortBy={sortBy} onSortChange={setSortBy} onUpload={() => fileInputRef.current?.click()} />
      <div className="storage-content">
        <Breadcrumbs path={currentPath} onNavigate={navigate} />
        <div className="drive-folder-heading"><div><h1>{title}</h1><p>{loading ? 'Loading items…' : listError ? 'Items could not be loaded' : `${visibleItems.length} ${visibleItems.length === 1 ? 'item' : 'items'}`}</p></div><div className="folder-heading-actions"><button type="button" className="drive-secondary-button" onClick={() => showModal('create')}><FolderPlus size={16} /><span>New folder</span></button><button type="button" className="drive-primary-button" onClick={() => fileInputRef.current?.click()}><Upload size={16} /><span>Upload</span></button><button type="button" className="drive-icon-button" onClick={() => loadContents(currentPath)} disabled={loading} aria-label="Refresh current folder"><RefreshCw size={16} className={loading ? 'refresh-spinning' : ''} /></button></div></div>
        {activeView === 'recent' && !items.some((item) => item.modified_at || item.modified || item.last_modified) && !loading && <p className="drive-info-note">The backend does not provide modification dates for recent items yet.</p>}
        {notice && <div className={`drive-notice ${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>{notice.message}<button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message">×</button></div>}
        {listError ? <div className="drive-notice error" role="alert"><span>{listError}</span><button type="button" onClick={() => loadContents(currentPath)}>Retry</button></div> : <StorageCollection items={visibleItems} viewMode={viewMode} selectedPath={selectedPath} onSelect={(item) => setSelectedPath(item.path)} onOpenFolder={openFolder} onPreview={openPreview} onDownload={downloadItem} onRename={(item) => showModal('rename', item)} onMove={(item) => showModal('move', item)} onDelete={(item) => showModal('delete', item)} onCreateFolder={() => showModal('create')} onUpload={() => fileInputRef.current?.click()} searching={Boolean(query || activeView !== 'drive')} loading={loading} />}
      </div>
      <input ref={fileInputRef} className="storage-hidden-input" type="file" multiple onChange={(event) => { uploadFiles(event.target.files); event.target.value = ''; }} />
      <input ref={folderInputRef} className="storage-hidden-input" type="file" multiple webkitdirectory="true" directory="true" onChange={(event) => { uploadFiles(event.target.files); event.target.value = ''; }} />
      {dragActive && <div className="storage-drop-overlay"><div><Upload size={30} /><strong>Drop files to upload</strong><span>Files will be added to {currentPath || 'My Drive'}</span></div></div>}
      <UploadProgress progress={uploadProgress} onCancel={cancelUpload} />
      {downloadProgress && <aside className="drive-upload-progress" role="status" aria-live="polite"><div className="drive-progress-heading"><div><strong>{downloadProgress.stage === 'preparing' ? 'Preparing download' : downloadProgress.complete ? 'Download ready' : 'Downloading file'}</strong><small>{downloadProgress.filename}</small></div><span>{downloadProgress.percent == null ? '' : `${downloadProgress.percent}%`}</span></div><div className="drive-progress-track"><span className={downloadProgress.percent == null ? 'indeterminate' : ''} style={downloadProgress.percent == null ? undefined : { width: `${downloadProgress.percent}%` }} /></div></aside>}
      {modal && <StorageDialog mode={modal.mode} item={modal.item} currentPath={currentPath} busy={working} onCancel={() => !working && setModal(null)} onSubmit={submitModal} onUnauthorized={onUnauthorized} />}
      {preview && <FilePreviewModal item={preview.item} src={preview.src} text={preview.text} loading={preview.loading} error={preview.error} onClose={() => setPreview(null)} onDownload={downloadItem} />}
    </main>
  </div>;
}

function normalizePath(path = '') {
  return String(path).split('/').filter(Boolean).join('/');
}

function joinPath(parent, child) {
  return [normalizePath(parent), String(child || '')].filter(Boolean).join('/');
}

function extension(name = '') {
  const index = name.lastIndexOf('.');
  return index > 0 ? name.slice(index + 1).toLowerCase() : '';
}

function validPercent(value) {
  const number = Number(value);
  return value != null && Number.isFinite(number) && number >= 0 && number <= 100;
}

function formatBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes)) return 'Unavailable';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) { size /= 1024; index += 1; }
  return `${size.toFixed(index ? 1 : 0)} ${units[index]}`;
}

function withPreviewMime(blob, filename = '') {
  if (blob.type && blob.type !== 'application/octet-stream') return blob;
  const mediaTypes = { mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg' };
  const type = mediaTypes[extension(filename)];
  return type ? new Blob([blob], { type }) : blob;
}
