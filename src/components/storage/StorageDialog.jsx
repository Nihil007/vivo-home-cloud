import { useEffect, useRef, useState } from 'react';
import { FolderPlus, MoveRight, Pencil, Trash2, X } from 'lucide-react';
import { cloudApi, UnauthorizedError } from '../../api/cloudApi.js';

export default function StorageDialog({ mode, item, currentPath, busy, onCancel, onSubmit, onUnauthorized }) {
  const [name, setName] = useState(() => mode === 'rename' ? editableName(item) : '');
  const [destination, setDestination] = useState(currentPath || '');
  const [folderSuggestions, setFolderSuggestions] = useState([]);
  const nameRef = useRef(null);
  const destinationRef = useRef(null);
  const skipCompletionRef = useRef(false);
  const isDelete = mode === 'delete';
  const fixedExtension = mode === 'rename' && item?.type === 'file' ? fileExtension(item?.name || '') : '';
  const title = mode === 'create' ? 'Create a folder' : mode === 'rename' ? 'Rename item' : mode === 'move' ? 'Move item' : 'Delete item';
  const Icon = mode === 'create' ? FolderPlus : mode === 'rename' ? Pencil : mode === 'move' ? MoveRight : Trash2;

  useEffect(() => {
    if (mode === 'create' || mode === 'rename') nameRef.current?.focus();
    if (mode === 'move') destinationRef.current?.focus();
  }, [mode]);

  const parentPath = mode === 'move' ? getDestinationParent(destination) : '';
  useEffect(() => {
    if (mode !== 'move') return undefined;
    let active = true;
    cloudApi.getFiles(parentPath).then((response) => {
      if (!active) return;
      const entries = Array.isArray(response?.items) ? response.items : response?.files || [];
      setFolderSuggestions(entries.filter((entry) => entry?.type === 'folder' && entry.name)
        .map((entry) => joinPath(parentPath, entry.name)));
    }).catch((error) => {
      if (!active) return;
      setFolderSuggestions([]);
      if (error instanceof UnauthorizedError) onUnauthorized?.(error);
    });
    return () => { active = false; };
  }, [mode, parentPath, onUnauthorized]);

  function submit(event) {
    event.preventDefault();
    if (mode === 'create') onSubmit({ name: name.trim() });
    else if (mode === 'rename') onSubmit({ name: `${name.trim()}${fixedExtension}` });
    else if (mode === 'move') onSubmit({ destination: destination.trim().replace(/^\/+|\/+$/g, '') });
    else onSubmit({});
  }

  function updateDestination(event) {
    const typed = event.target.value;
    if (skipCompletionRef.current) {
      skipCompletionRef.current = false;
      setDestination(typed);
      return;
    }
    const normalizedTyped = typed.toLocaleLowerCase();
    const match = typed && folderSuggestions
      .filter((path) => path.toLocaleLowerCase().startsWith(normalizedTyped) && path.length > typed.length)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))[0];
    if (!match) {
      setDestination(typed);
      return;
    }
    setDestination(match);
    requestAnimationFrame(() => destinationRef.current?.setSelectionRange(typed.length, match.length));
  }

  return <div className="storage-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}><section className="storage-modal" role="dialog" aria-modal="true" aria-labelledby="storage-modal-title" onKeyDown={(event) => { if (event.key === 'Escape' && !busy) onCancel(); }}><header><span className={`storage-modal-icon ${isDelete ? 'danger' : ''}`}><Icon size={18} /></span><h2 id="storage-modal-title">{title}</h2><button type="button" onClick={onCancel} aria-label="Close dialog" disabled={busy}><X size={18} /></button></header><form onSubmit={submit}>
    {mode === 'create' && <label>Folder name<input ref={nameRef} value={name} onChange={(event) => setName(event.target.value)} required maxLength={180} autoComplete="off" /></label>}
    {mode === 'rename' && <label>New name<input ref={nameRef} value={name} onChange={(event) => setName(event.target.value)} required maxLength={Math.max(1, 180 - fixedExtension.length)} autoComplete="off" />{fixedExtension && <small className="storage-destination-hint">The {fixedExtension} extension will stay unchanged.</small>}</label>}
    {mode === 'move' && <><p className="storage-modal-copy">Move <strong>{item?.name}</strong> into a destination folder. Leave empty to move it to My Drive.</p><label>Destination path<input ref={destinationRef} value={destination} onChange={updateDestination} onKeyDown={(event) => { skipCompletionRef.current = event.key === 'Backspace' || event.key === 'Delete'; }} placeholder="Type a folder name, for example: Men" autoComplete="off" /><small className="storage-destination-hint">Suggested text is selected; keep typing to refine it. Type / to find nested folders.</small></label></>}
    {isDelete && <p className="storage-modal-copy">{item?.type === 'folder' ? <>Delete the folder <strong>{item?.name}</strong> and all of its contents? This cannot be undone.</> : <>Delete <strong>{item?.name}</strong>? This cannot be undone.</>}</p>}
    <footer><button className="storage-modal-cancel" type="button" onClick={onCancel} disabled={busy}>Cancel</button><button className={isDelete ? 'storage-modal-submit danger' : 'storage-modal-submit'} type="submit" disabled={busy || ((mode === 'create' || mode === 'rename') && !name.trim())}>{busy ? 'Working…' : isDelete ? 'Delete' : mode === 'move' ? 'Move' : mode === 'rename' ? 'Save name' : 'Create folder'}</button></footer>
  </form></section></div>;
}

function getDestinationParent(destination) {
  const rawPath = String(destination || '').replace(/^\/+/, '');
  const trailingSlash = rawPath.endsWith('/');
  const normalized = trailingSlash ? rawPath.slice(0, -1) : rawPath;
  if (trailingSlash) return normalized;
  const separator = normalized.lastIndexOf('/');
  return separator < 0 ? '' : normalized.slice(0, separator);
}

function joinPath(parent, child) {
  return [parent, child].filter(Boolean).join('/');
}

function fileExtension(filename) {
  const dot = filename.lastIndexOf('.');
  return dot > 0 ? filename.slice(dot) : '';
}

function editableName(item) {
  const filename = item?.name || '';
  if (item?.type !== 'file') return filename;
  const extension = fileExtension(filename);
  return extension ? filename.slice(0, -extension.length) : filename;
}
