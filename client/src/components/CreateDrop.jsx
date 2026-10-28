import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileArchive, FileAudio, FileImage, FileText, FileVideo, File as FileIcon, LoaderCircle, Plus, ShieldCheck, Trash2, UploadCloud, X } from 'lucide-react';
import { io } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import api, { errorMessage } from '../services/api.js';

const chunkSize = 8 * 1024 * 1024;
const formatBytes = (size) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 ** 2) return `${(size / 1024).toFixed(0)} KB`;
  if (size < 1024 ** 3) return `${(size / 1024 ** 2).toFixed(1)} MB`;
  return `${(size / 1024 ** 3).toFixed(1)} GB`;
};

function iconFor(file) {
  if (file.type.startsWith('image/')) return FileImage;
  if (file.type.startsWith('video/')) return FileVideo;
  if (file.type.startsWith('audio/')) return FileAudio;
  if (file.type.includes('zip') || file.type.includes('archive')) return FileArchive;
  if (file.type.includes('pdf') || file.type.includes('text') || file.type.includes('word')) return FileText;
  return FileIcon;
}

export default function CreateDrop() {
  const [files, setFiles] = useState([]);
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [expiry, setExpiry] = useState('24h');
  const [downloadLimit, setDownloadLimit] = useState('');
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const abortRef = useRef(false);
  const controllerRef = useRef(null);
  const navigate = useNavigate();

  function addFiles(incoming) {
    const newFiles = Array.from(incoming || []);
    const combined = [...files, ...newFiles];
    setError(combined.length > 20 ? 'A Drop can contain up to 20 files.' : '');
    setFiles(combined.slice(0, 20));
  }

  function removeFile(index) {
    setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
  }

  async function uploadFile(drop, file, upload, bytesBefore, totalBytes) {
    const completedParts = [];
    const partCount = Math.ceil(file.size / chunkSize);
    let completedBytes = 0;
    for (let partNumber = 1; partNumber <= partCount; partNumber += 1) {
      if (abortRef.current) throw new Error('Upload canceled.');
      const start = (partNumber - 1) * chunkSize;
      const blob = file.slice(start, Math.min(start + chunkSize, file.size));
      const { data } = await api.post(`/drops/${drop.id}/files/${upload.id}/part-url`, { partNumber }, {
        headers: { 'X-Management-Secret': drop.managementSecret },
        signal: controllerRef.current.signal
      });
      const response = await api.put(data.url, blob, {
        headers: { 'Content-Type': 'application/octet-stream' },
        timeout: 120000,
        signal: controllerRef.current.signal,
        onUploadProgress: (event) => {
          setProgress(Math.round(((bytesBefore + completedBytes + (event.loaded || 0)) / totalBytes) * 100));
        }
      });
      const etag = response.headers.etag || response.headers.ETag;
      if (!etag) throw new Error('Storage did not return an upload checksum. Check the bucket CORS configuration.');
      completedParts.push({ PartNumber: partNumber, ETag: etag });
      completedBytes += blob.size;
    }
    await api.post(`/drops/${drop.id}/files/${upload.id}/complete`, { parts: completedParts }, {
      headers: { 'X-Management-Secret': drop.managementSecret },
      signal: controllerRef.current.signal
    });
  }

  async function createDrop(event) {
    event.preventDefault();
    setError('');
    if (!text.trim() && !files.length) {
      setError('Add a file or a little text to get your Drop started.');
      return;
    }
    if (files.some((file) => file.size === 0)) {
      setError('Empty files can’t be uploaded. Remove them or choose another file.');
      return;
    }
    abortRef.current = false;
    controllerRef.current = new AbortController();
    setBusy(true);
    setProgress(0);
    let createdDrop;
    let socket;
    try {
      const { data } = await api.post('/drops', {
        title,
        text,
        expiry,
        downloadLimit: downloadLimit ? Number(downloadLimit) : null,
        files: files.map((file) => ({ name: file.name, size: file.size, type: file.type || 'application/octet-stream' }))
      }, { signal: controllerRef.current.signal });
      createdDrop = data;
      if (files.length) {
        const apiUrl = new URL(import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1');
        socket = io(apiUrl.origin, { transports: ['websocket'] });
        socket.on('connect', () => {
          socket.emit('drop:subscribe', { dropId: data.id, managementSecret: data.managementSecret });
        });
        socket.on('drop:progress', ({ completed, total }) => {
          if (total) setProgress((current) => Math.max(current, Math.round((completed / total) * 100)));
        });
      }
      const totalBytes = files.reduce((total, file) => total + file.size, 0) || 1;
      let bytesBefore = 0;
      for (let index = 0; index < files.length; index += 1) {
        const upload = data.uploads[index];
        await uploadFile(data, files[index], upload, bytesBefore, totalBytes);
        if (abortRef.current) throw new Error('Upload canceled.');
        bytesBefore += files[index].size;
      }
      if (abortRef.current) throw new Error('Upload canceled.');
      const result = {
        ...data,
        status: 'ready',
        files: data.uploads.map((upload, index) => ({
          id: upload.id, name: files[index].name, size: files[index].size, type: files[index].type || 'application/octet-stream'
        }))
      };
      setProgress(100);
      navigate('/created', { state: { drop: result } });
    } catch (requestError) {
      let cleanupFailure = '';
      if (createdDrop && files.length) {
        await api.post(`/drops/${createdDrop.id}/abort`, {}, {
          headers: { 'X-Management-Secret': createdDrop.managementSecret }
        }).catch((cleanupError) => { cleanupFailure = errorMessage(cleanupError); });
      }
      const message = abortRef.current ? 'Upload canceled. Any incomplete upload will be removed by the expiry cleanup.' : errorMessage(requestError);
      setError(cleanupFailure ? `${message} Cleanup could not be confirmed; the Drop will be removed at expiry. (${cleanupFailure})` : message);
      abortRef.current = false;
    } finally {
      socket?.disconnect();
      controllerRef.current = null;
      setBusy(false);
    }
  }

  function cancelUpload() {
    abortRef.current = true;
    controllerRef.current?.abort();
  }

  const totalSize = files.reduce((total, file) => total + file.size, 0);

  return (
    <form className="create-panel" onSubmit={createDrop}>
      <div className="panel-topline">
        <div>
          <span className="eyebrow"><span className="live-dot" /> PRIVATE BY DESIGN</span>
          <h2>Make a Drop</h2>
        </div>
        <span className="panel-step">01 <span>/</span> 02</span>
      </div>
      <div
        className={`drop-zone ${dragging ? 'is-dragging' : ''}`}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }}
        onClick={() => !busy && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click(); }}
        aria-label="Choose files or drag files here"
      >
        <input ref={inputRef} className="visually-hidden" type="file" multiple onClick={(event) => event.stopPropagation()} onChange={(event) => { addFiles(event.target.files); event.target.value = ''; }} />
        <div className="upload-symbol"><UploadCloud size={23} strokeWidth={1.7} /></div>
        <div className="drop-copy">
          <strong>Drop files here, or <span>browse</span></strong>
          <small>Up to 20 files · 100 MB each · 500 MB total</small>
        </div>
        <span className="file-format">ALL FILE TYPES</span>
      </div>

      <AnimatePresence initial={false}>
        {files.length > 0 && (
          <motion.div className="file-list" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            {files.map((file, index) => {
              const FileTypeIcon = iconFor(file);
              return (
                <motion.div className="file-row" key={`${file.name}-${file.lastModified}-${index}`} initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -12 }}>
                  <span className="file-type-icon"><FileTypeIcon size={18} /></span>
                  <span className="file-meta"><strong>{file.name}</strong><small>{formatBytes(file.size)}</small></span>
                  {busy ? <span className="file-pending">Queued</span> : <button type="button" className="remove-file" onClick={() => removeFile(index)} aria-label={`Remove ${file.name}`}><X size={16} /></button>}
                </motion.div>
              );
            })}
            <div className="file-total"><span>{files.length} {files.length === 1 ? 'file' : 'files'}</span><span>{formatBytes(totalSize)} total</span></div>
          </motion.div>
        )}
      </AnimatePresence>

      <label className="field-label" htmlFor="drop-text">Add a message <span>optional</span></label>
      <textarea id="drop-text" className="message-field" placeholder="A note for whoever opens this Drop…" maxLength={100000} rows={2} value={text} onChange={(event) => setText(event.target.value)} />

      <div className="form-grid">
        <label className="form-field">
          <span className="field-label">Drop name <span>optional</span></span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Friday's photos" maxLength={120} />
        </label>
        <label className="form-field">
          <span className="field-label">Expires in</span>
          <select value={expiry} onChange={(event) => setExpiry(event.target.value)}>
            <option value="10m">10 minutes</option><option value="1h">1 hour</option><option value="24h">24 hours</option><option value="7d">7 days</option>
          </select>
        </label>
      </div>
      <label className="field-label limit-label" htmlFor="download-limit">Download limit <span>optional · counts completed downloads</span></label>
      <input id="download-limit" className="limit-input" type="number" min="1" max="10000" value={downloadLimit} onChange={(event) => setDownloadLimit(event.target.value)} placeholder="Unlimited" />

      {error && <p className="form-error" role="alert">{error}</p>}
      {busy && (
        <div className="upload-progress" aria-live="polite">
          <div className="progress-label"><span><LoaderCircle size={15} className="spin" /> Uploading your Drop</span><strong>{progress}%</strong></div>
          <div className="progress-track"><motion.div className="progress-fill" animate={{ width: `${progress}%` }} /></div>
          <button type="button" className="cancel-upload" onClick={cancelUpload}><Trash2 size={13} /> Cancel upload</button>
        </div>
      )}
      <button className="button button-primary submit-button" type="submit" disabled={busy}>
        {busy ? <><LoaderCircle size={17} className="spin" /> Creating your Drop…</> : <><Plus size={17} /> Create a Drop <span className="button-arrow">↗</span></>}
      </button>
      <p className="privacy-note"><ShieldCheck size={14} /> No account needed. Your Drop disappears when it expires.</p>
    </form>
  );
}
