import { useState } from 'react';
import { AudioLines, Download, Eye, File, FileText, Folder, Image, MoreVertical, MoveRight, Pencil, PlaySquare, Trash2 } from 'lucide-react';
import EmptyFolder from './EmptyFolder.jsx';

const IMAGE = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp']);
const VIDEO = new Set(['mp4', 'webm']);
const AUDIO = new Set(['mp3', 'wav', 'ogg']);
const DOCUMENT = new Set(['pdf', 'txt', 'log', 'csv']);

export function getFileKind(item) {
  if (item.type === 'folder') return 'folder';
  const extension = extensionOf(item.name);
  if (IMAGE.has(extension)) return 'image';
  if (VIDEO.has(extension)) return 'video';
  if (AUDIO.has(extension)) return 'audio';
  if (DOCUMENT.has(extension)) return 'document';
  return 'file';
}

export function isPreviewSupported(item) {
  return ['image', 'video', 'audio', 'document'].includes(getFileKind(item));
}

export default function StorageCollection({ items, viewMode, selectedPath, onSelect, onOpenFolder, onPreview, onDownload, onRename, onMove, onDelete, onCreateFolder, onUpload, searching, loading }) {
  if (loading) return <div className={viewMode === 'grid' ? 'file-grid drive-skeleton-grid' : 'file-list drive-skeleton-list'} aria-label="Loading files">{Array.from({ length: 8 }, (_, index) => <div className="file-skeleton" key={index} />)}</div>;
  if (!items.length) return <EmptyFolder searching={searching} onCreateFolder={onCreateFolder} onUpload={onUpload} />;
  return <div className={viewMode === 'grid' ? 'file-grid' : 'file-list'}>{items.map((item) => <StorageItem key={item.path || item.name} item={item} viewMode={viewMode} selected={selectedPath === (item.path || item.name)} onSelect={onSelect} onOpenFolder={onOpenFolder} onPreview={onPreview} onDownload={onDownload} onRename={onRename} onMove={onMove} onDelete={onDelete} />)}</div>;
}

function StorageItem({ item, viewMode, selected, onSelect, onOpenFolder, onPreview, onDownload, onRename, onMove, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const folder = item.type === 'folder';
  const kind = getFileKind(item);
  const Icon = folder ? Folder : kind === 'image' ? Image : kind === 'video' ? PlaySquare : kind === 'audio' ? AudioLines : kind === 'document' ? FileText : File;
  const size = folder ? '' : formatSize(item.size_bytes);
  const modified = item.modified_at || item.modified || item.last_modified;
  const activate = () => folder ? onOpenFolder(item) : onSelect(item);

  function action(event, callback) {
    event.stopPropagation();
    setMenuOpen(false);
    callback(item);
  }

  return <article className={`${viewMode === 'grid' ? 'file-tile' : 'file-row'}${selected ? ' selected' : ''}${folder ? ' folder-item' : ''}${menuOpen ? ' menu-open' : ''}`} tabIndex={0} role="button" aria-pressed={!folder ? selected : undefined} aria-label={`${folder ? 'Folder' : 'File'} ${item.name}`} onClick={activate} onDoubleClick={() => !folder && onPreview(item)} onContextMenu={(event) => { event.preventDefault(); setMenuOpen(true); }} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); activate(); } }} title={folder ? 'Open folder' : 'Select file; double-click to preview'}>
    <div className={`item-type-icon ${kind}`}><Icon size={viewMode === 'grid' ? 24 : 19} strokeWidth={1.7} /></div>
    <div className="item-info"><strong title={item.name}>{item.name}</strong><span>{folder ? 'Folder' : size}{modified ? ` · ${formatDate(modified)}` : ''}</span></div>
    {viewMode === 'list' && <span className="item-kind-label">{folder ? 'Folder' : extensionOf(item.name).toUpperCase() || 'File'}</span>}
    <div className="item-menu-wrap"><button className="item-menu-trigger" type="button" aria-label={`Actions for ${item.name}`} aria-expanded={menuOpen} onClick={(event) => { event.stopPropagation(); setMenuOpen((open) => !open); }}> <MoreVertical size={17} /></button>{menuOpen && <div className="item-context-menu" role="menu" onClick={(event) => event.stopPropagation()}>{!folder && isPreviewSupported(item) && <button role="menuitem" type="button" onClick={(event) => action(event, onPreview)}><Eye size={15} /> Preview</button>}{!folder && <button role="menuitem" type="button" onClick={(event) => action(event, onDownload)}><Download size={15} /> Download</button>}<button role="menuitem" type="button" onClick={(event) => action(event, onRename)}><Pencil size={15} /> Rename</button><button role="menuitem" type="button" onClick={(event) => action(event, onMove)}><MoveRight size={15} /> Move</button><button className="danger" role="menuitem" type="button" onClick={(event) => action(event, onDelete)}><Trash2 size={15} /> Delete</button></div>}</div>
  </article>;
}

function extensionOf(name = '') {
  const index = name.lastIndexOf('.');
  return index > 0 ? name.slice(index + 1).toLowerCase() : '';
}

function formatSize(size) {
  if (!Number.isFinite(Number(size))) return 'Size unavailable';
  const bytes = Number(size);
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
  return `${value.toFixed(unit ? 1 : 0)} ${units[unit]}`;
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
}
