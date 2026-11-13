import { ChevronRight, HardDrive } from 'lucide-react';

export default function Breadcrumbs({ path, onNavigate }) {
  const segments = path ? path.split('/').filter(Boolean) : [];
  return <nav className="drive-breadcrumbs" aria-label="Folder breadcrumb"><button type="button" onClick={() => onNavigate('')}><HardDrive size={15} /> My Drive</button>{segments.map((segment, index) => {
    const targetPath = segments.slice(0, index + 1).join('/');
    const current = index === segments.length - 1;
    return <span className="breadcrumb-segment" key={targetPath}><ChevronRight size={14} /><button type="button" onClick={() => onNavigate(targetPath)} aria-current={current ? 'page' : undefined}>{segment}</button></span>;
  })}</nav>;
}
