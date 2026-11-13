import { useState } from 'react';
import { Cloud, ChevronDown, Clock3, FileText, FolderPlus, HardDrive, Images, Plus, Upload, Video } from 'lucide-react';

const VIEWS = [
  { id: 'drive', label: 'My Drive', Icon: HardDrive },
  { id: 'recent', label: 'Recent', Icon: Clock3 },
  { id: 'images', label: 'Images', Icon: Images },
  { id: 'videos', label: 'Videos', Icon: Video },
  { id: 'documents', label: 'Documents', Icon: FileText },
];

export default function StorageSidebar({ activeView, onViewChange, storage, onCreateFolder, onUploadFiles, onUploadFolder }) {
  const [newOpen, setNewOpen] = useState(false);

  function choose(action) {
    setNewOpen(false);
    action();
  }

  return (
    <aside className="drive-sidebar">
      <a className="drive-brand" href="#storage" aria-label="Vivo Home Cloud storage"><span><Cloud size={21} /></span><strong>Vivo Home Cloud</strong></a>
      <div className="new-menu-wrap">
        <button className="drive-new-button" type="button" onClick={() => setNewOpen((open) => !open)} aria-expanded={newOpen}><Plus size={18} /> New <ChevronDown size={14} /></button>
        {newOpen && <div className="drive-new-menu"><button type="button" onClick={() => choose(onCreateFolder)}><FolderPlus size={16} /> New folder</button><button type="button" onClick={() => choose(onUploadFiles)}><Upload size={16} /> Upload files</button><button type="button" onClick={() => choose(onUploadFolder)}><HardDrive size={16} /> Upload folder</button></div>}
      </div>
      <nav className="drive-side-nav" aria-label="Storage views">{VIEWS.map(({ id, label, Icon }) => <button className={activeView === id ? 'active' : ''} type="button" key={id} onClick={() => onViewChange(id)}><Icon size={17} strokeWidth={1.8} /><span>{label}</span></button>)}</nav>
      <section className="storage-usage-card" aria-label="Storage usage">
        <div className="storage-usage-heading"><HardDrive size={15} /><span>Storage</span></div>
        {storage ? <>{Number.isFinite(storage.usagePercent) && <div className="storage-usage-bar"><span style={{ width: `${storage.usagePercent}%` }} /></div>}<p>{storage.used} used of {storage.total}</p><small>{storage.available} available</small></> : <p className="storage-unavailable">Storage details unavailable</p>}
      </section>
      <div className="drive-sidebar-foot">Private cloud storage<br />on your Vivo device</div>
    </aside>
  );
}
