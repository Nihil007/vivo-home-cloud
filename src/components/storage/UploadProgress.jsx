import { X } from 'lucide-react';

export default function UploadProgress({ progress, onCancel }) {
  if (!progress) return null;
  return <aside className="drive-upload-progress" role="status" aria-live="polite"><div className="drive-progress-heading"><div><strong>{progress.complete ? 'Upload complete' : progress.cancelling ? 'Cancelling upload…' : 'Uploading files'}</strong><small>{progress.count === 1 ? progress.filename : `${progress.count} files`}</small></div><span>{progress.percent}%</span><button type="button" onClick={onCancel} disabled={progress.complete || progress.cancelling} aria-label="Cancel upload"><X size={16} /></button></div><div className="drive-progress-track"><span style={{ width: `${progress.percent}%` }} /></div></aside>;
}
