import { useEffect, useState } from 'react';
import { Download, Eye, EyeOff, LogOut, Trash2 } from 'lucide-react';
import { cloudApi, UnauthorizedError } from './api/cloudApi.js';

export default function App() {
  const [authState, setAuthState] = useState('checking');
  const [authError, setAuthError] = useState('');
  const [loginMessage, setLoginMessage] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [health, setHealth] = useState(null);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [deleting, setDeleting] = useState('');
  const [confirmingFile, setConfirmingFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(null);

  async function verifySession() {
    setAuthState('checking');
    setAuthError('');
    try {
      const listing = await cloudApi.listFiles();
      setFiles(Array.isArray(listing?.files) ? listing.files : []);
      setAuthState('authenticated');
      cloudApi.health().then(setHealth).catch(() => setHealth(null));
    } catch (e) {
      setFiles([]);
      if (e instanceof UnauthorizedError) {
        setAuthState('unauthenticated');
      } else {
        setAuthError(e.message);
        setAuthState('error');
      }
    }
  }

  useEffect(() => { verifySession(); }, []);

  function handleProtectedError(e) {
    if (e instanceof UnauthorizedError) {
      setFiles([]);
      setAuthState('unauthenticated');
      setLoginMessage('Your session has expired. Please log in again.');
      setError('');
    } else {
      setError(e.message || 'Something went wrong. Please try again.');
    }
  }

  async function refreshFiles() {
    setError('');
    try {
      const listing = await cloudApi.listFiles();
      setFiles(Array.isArray(listing?.files) ? listing.files : []);
    } catch (e) {
      handleProtectedError(e);
      throw e;
    }
  }

  async function login(event) {
    event.preventDefault();
    setLoginBusy(true);
    setAuthError('');
    setLoginMessage('');
    let credentialsAccepted = false;
    try {
      await cloudApi.login(username.trim(), password);
      credentialsAccepted = true;
      const listing = await cloudApi.listFiles();
      setFiles(Array.isArray(listing?.files) ? listing.files : []);
      setPassword('');
      setAuthState('authenticated');
      cloudApi.health().then(setHealth).catch(() => setHealth(null));
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        setLoginMessage('Login succeeded, but the session could not be verified. Please try again.');
        setAuthState('unauthenticated');
      } else if (e.code === 'INVALID_CREDENTIALS') {
        setLoginMessage('The username or password is incorrect. Please try again.');
        setAuthState('unauthenticated');
      } else if (credentialsAccepted) {
        setAuthError(e.message || 'Login succeeded, but Vivo Cloud could not load your files.');
        setAuthState('error');
      } else {
        setLoginMessage(e.message || 'Unable to log in. Please try again.');
        setAuthState('unauthenticated');
      }
    } finally {
      setLoginBusy(false);
    }
  }

  async function logout() {
    setLoggingOut(true);
    setError('');
    try {
      await cloudApi.logout();
      setFiles([]);
      setLoginMessage('You have been logged out.');
      setPassword('');
      setAuthState('unauthenticated');
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        handleProtectedError(e);
      } else {
        setError(`Could not log out: ${e.message}`);
      }
    } finally {
      setLoggingOut(false);
    }
  }

  async function upload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError('');
    setUploadProgress({ filename: file.name, percent: 0, complete: false });
    try {
      await cloudApi.upload(file, (percent) => setUploadProgress({ filename: file.name, percent, complete: false }));
      setUploadProgress({ filename: file.name, percent: 100, complete: true });
      await refreshFiles();
      window.setTimeout(() => setUploadProgress(null), 1800);
    } catch (e) {
      handleProtectedError(e);
      setUploadProgress(null);
    } finally { setBusy(false); event.target.value = ''; }
  }

  async function downloadFile(filename) {
    setError('');
    setDownloadProgress({ filename, stage: 'preparing', percent: 0, complete: false });
    try {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const blob = await cloudApi.download(filename, ({ percent }) => {
        setDownloadProgress({ filename, stage: 'downloading', percent, complete: false });
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDownloadProgress({ filename, stage: 'complete', percent: 100, complete: true });
      window.setTimeout(() => setDownloadProgress(null), 1800);
    } catch (e) {
      handleProtectedError(e);
      setDownloadProgress(null);
    }
  }

  async function removeFile() {
    if (!confirmingFile) return;
    const filename = confirmingFile;
    setDeleting(filename);
    setError('');
    try {
      await cloudApi.deleteFile(filename);
      setConfirmingFile(null);
      await refreshFiles();
    } catch (e) {
      handleProtectedError(e);
      setConfirmingFile(null);
    } finally {
      setDeleting('');
    }
  }

  if (authState === 'checking') {
    return <main className="auth-shell"><div className="auth-card auth-status-card"><div className="brand auth-brand"><span className="brand-mark">V</span>Vivo<span>Cloud</span></div><p className="auth-loading"><span className="spinner" /> Checking your session…</p></div></main>;
  }

  if (authState === 'error') {
    return <main className="auth-shell"><section className="auth-card auth-status-card"><div className="brand auth-brand"><span className="brand-mark">V</span>Vivo<span>Cloud</span></div><h1>Can't connect right now</h1><p className="auth-description">{authError}</p><button className="login-submit" type="button" onClick={verifySession}>Try again</button></section></main>;
  }

  if (authState === 'unauthenticated') {
    return <main className="auth-shell"><section className="auth-card"><div className="brand auth-brand"><span className="brand-mark">V</span>Vivo<span>Cloud</span></div><p className="eyebrow auth-eyebrow">YOUR PERSONAL CLOUD</p><h1>Welcome back</h1><p className="auth-description">Sign in to access your files.</p>{loginMessage && <p className="auth-message" role="alert">{loginMessage}</p>}<form className="login-form" onSubmit={login}><label htmlFor="username">Username</label><input id="username" name="username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required disabled={loginBusy} /><label htmlFor="password">Password</label><div className="password-input-wrap"><input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={loginBusy} /><button className="password-toggle" type="button" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} disabled={loginBusy}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div><button className="login-submit" type="submit" disabled={loginBusy || !username.trim() || !password}>{loginBusy ? <><span className="spinner" /> Signing in…</> : 'Sign in'}</button></form><p className="auth-security-note">Private access to your personal cloud.</p></section></main>;
  }

  return (
    <main className="shell">
      <header className="topbar"><a className="brand" href="/"><span className="brand-mark">V</span>Vivo<span>Cloud</span></a><div className="topbar-actions"><span className={`status ${health?.status === 'online' ? 'online' : ''}`}><i />{health?.status === 'online' ? 'Server online' : 'Server'}</span><button className="logout-button" type="button" onClick={logout} disabled={loggingOut}>{loggingOut ? <span className="spinner" /> : <LogOut size={16} />}<span>{loggingOut ? 'Signing out…' : 'Log out'}</span></button></div></header>
      <section className="hero"><p className="eyebrow">YOUR PERSONAL CLOUD</p><h1>Your files,<br /><em>within reach.</em></h1><p className="intro">A private space for the things you want to keep close.</p><label className="upload-button">{busy ? 'Uploading…' : '↑  Upload a file'}<input type="file" onChange={upload} disabled={busy} /></label></section>
      <section className="files-panel"><div className="panel-heading"><div><p className="eyebrow">YOUR LIBRARY</p><h2>Files <span>{files.length}</span></h2></div><button className="refresh" onClick={refreshFiles} aria-label="Refresh files">↻</button></div>
        {error && <p className="notice" role="alert">{error}</p>}
        {files.length ? <ul className="file-list">{files.map((file) => <li key={file.name}><div className="file-icon">▤</div><div className="file-meta"><strong>{file.name}</strong><small>{formatSize(file.size_bytes)}</small></div><div className="file-actions"><button className="download" type="button" onClick={() => downloadFile(file.name)} disabled={Boolean(downloadProgress && !downloadProgress.complete)} aria-label={`Download ${file.name}`} title="Download"><Download size={17} strokeWidth={1.8} /></button><button className="delete-button" type="button" onClick={() => setConfirmingFile(file.name)} disabled={deleting === file.name} aria-label={`Delete ${file.name}`} title={deleting === file.name ? 'Deleting…' : 'Delete'}><Trash2 size={17} strokeWidth={1.8} /></button></div></li>)}</ul> : <div className="empty"><div className="empty-icon">▧</div><strong>{error ? 'Files are unavailable' : 'Nothing here yet'}</strong><p>{error ? 'Check your connection and try again.' : 'Upload your first file to get started.'}</p></div>}
      </section>
      <footer>Vivo Cloud <span>·</span> Your own little corner of the internet</footer>
      {confirmingFile && <div className="confirm-overlay"><section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-description"><div className="confirm-icon"><Trash2 size={21} /></div><h2 id="delete-title">Delete this file?</h2><p id="delete-description"><strong>{confirmingFile}</strong> will be permanently deleted. This action cannot be undone.</p><div className="confirm-actions"><button className="cancel-button" type="button" onClick={() => setConfirmingFile(null)} disabled={Boolean(deleting)}>Cancel</button><button className="confirm-delete-button" type="button" onClick={removeFile} disabled={Boolean(deleting)}>{deleting ? 'Deleting…' : 'Delete file'}</button></div></section></div>}
      {uploadProgress && <aside className="upload-progress" role="status" aria-live="polite"><div className="upload-progress-heading"><span className="upload-progress-title">{uploadProgress.complete ? 'Upload complete' : 'Uploading file'}</span><span className="upload-progress-percent">{uploadProgress.percent}%</span></div><p title={uploadProgress.filename}>{uploadProgress.filename}</p><div className="progress-track"><div className="progress-fill" style={{ width: `${uploadProgress.percent}%` }} /></div></aside>}
      {downloadProgress && <aside className={`upload-progress download-progress${uploadProgress ? ' download-progress-stacked' : ''}`} role="status" aria-live="polite"><div className="upload-progress-heading"><span className="upload-progress-title">{downloadProgress.stage === 'preparing' ? 'Preparing download' : downloadProgress.complete ? 'Download ready' : 'Downloading file'}</span><span className="upload-progress-percent">{downloadProgress.percent == null ? '' : `${downloadProgress.percent}%`}</span></div><p title={downloadProgress.filename}>{downloadProgress.filename}</p><div className="progress-track"><div className={`progress-fill ${downloadProgress.percent == null && !downloadProgress.complete ? 'indeterminate' : ''}`} style={downloadProgress.percent == null ? undefined : { width: `${downloadProgress.percent}%` }} /></div></aside>}
    </main>
  );
}

function formatSize(size = 0) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
