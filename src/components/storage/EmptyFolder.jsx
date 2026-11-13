import { FolderOpen, SearchX } from 'lucide-react';

export default function EmptyFolder({ searching, onCreateFolder, onUpload }) {
  const Icon = searching ? SearchX : FolderOpen;
  return <div className="drive-empty-state"><span className="drive-empty-icon"><Icon size={28} /></span><h3>{searching ? 'No matching items' : 'This folder is empty'}</h3><p>{searching ? 'Try another search term.' : 'Add files or create a folder to get started.'}</p>{!searching && <div><button type="button" onClick={onUpload}>Upload files</button><button type="button" onClick={onCreateFolder}>Create folder</button></div>}</div>;
}
