import { Grid2X2, List, Search, SlidersHorizontal, Upload } from 'lucide-react';

export default function StorageHeader({ query, onQueryChange, viewMode, onViewChange, sortBy, onSortChange, onUpload }) {
  return (
    <div className="drive-toolbar">
      <label className="drive-search"><Search size={17} /><input type="search" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search in this folder" aria-label="Search files and folders" />{query && <button type="button" onClick={() => onQueryChange('')} aria-label="Clear search">×</button>}</label>
      <div className="drive-toolbar-actions">
        <label className="drive-sort"><SlidersHorizontal size={15} /><span className="sr-only">Sort by</span><select value={sortBy} onChange={(event) => onSortChange(event.target.value)} aria-label="Sort files"><option value="name">Name</option><option value="size">Size</option><option value="type">File type</option></select></label>
        <div className="view-toggle" role="group" aria-label="File display mode"><button className={viewMode === 'grid' ? 'selected' : ''} type="button" onClick={() => onViewChange('grid')} aria-label="Grid view"><Grid2X2 size={17} /></button><button className={viewMode === 'list' ? 'selected' : ''} type="button" onClick={() => onViewChange('list')} aria-label="List view"><List size={18} /></button></div>
        <button className="drive-upload-top" type="button" onClick={onUpload}><Upload size={16} /><span>Upload</span></button>
      </div>
    </div>
  );
}
