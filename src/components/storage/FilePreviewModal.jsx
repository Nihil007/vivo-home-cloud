import { useState } from 'react';
import { Download, Minus, Plus, X } from 'lucide-react';
import { getFileKind } from './StorageCollection.jsx';

export default function FilePreviewModal({ item, src, text, loading, error, onClose, onDownload }) {
  const [zoom, setZoom] = useState(1);
  const kind = getFileKind(item);
  const unsupported = kind === 'file';

  return <div className="storage-preview-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="storage-preview-modal" role="dialog" aria-modal="true" aria-label={`Preview ${item.name}`} onKeyDown={(event) => { if (event.key === 'Escape') onClose(); }}>
    <header className="storage-preview-header"><div><strong>{item.name}</strong><small>{formatSize(item.size_bytes)}{item.modified_at ? ` · ${new Date(item.modified_at).toLocaleString()}` : ''}</small></div>{kind === 'image' && <div className="preview-zoom"><button type="button" onClick={() => setZoom((value) => Math.max(.5, value - .25))} aria-label="Zoom out"><Minus size={16} /></button><span>{Math.round(zoom * 100)}%</span><button type="button" onClick={() => setZoom((value) => Math.min(2, value + .25))} aria-label="Zoom in"><Plus size={16} /></button></div>}<button className="preview-download" type="button" onClick={() => onDownload(item)}><Download size={16} /> Download</button><button className="preview-close" type="button" onClick={onClose} aria-label="Close preview"><X size={19} /></button></header>
    <div className="storage-preview-body">{loading ? <p className="preview-state">Preparing preview…</p> : error ? <p className="preview-state error">{error}</p> : unsupported ? <div className="preview-state"><h3>Preview unavailable</h3><p>This file type is not supported for preview. You can still download it.</p></div> : kind === 'image' ? <div className="preview-image-scroll"><img src={src} alt={item.name} style={{ transform: `scale(${zoom})` }} /></div> : kind === 'document' && extension(item.name) === 'pdf' ? <iframe src={src} title={`Preview of ${item.name}`} /> : kind === 'document' ? <pre className="preview-text">{text}</pre> : kind === 'audio' ? <div className="preview-media"><p>{item.name}</p><audio controls src={src}>Your browser cannot play this audio file.</audio></div> : kind === 'video' ? <video className="preview-video" controls muted={false} playsInline src={src}>Your browser cannot play this video.</video> : null}</div>
  </section></div>;
}

function extension(name = '') {
  const index = name.lastIndexOf('.');
  return index > 0 ? name.slice(index + 1).toLowerCase() : '';
}

function formatSize(value) {
  if (value == null || !Number.isFinite(Number(value))) return 'Size unavailable';
  let size = Number(value);
  if (size === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let index = 0;
  while (size >= 1024 && index < units.length - 1) { size /= 1024; index += 1; }
  return `${size.toFixed(index ? 1 : 0)} ${units[index]}`;
}
