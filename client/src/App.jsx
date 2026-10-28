import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Check, Clock3, Copy, Download, FileText, Link2, LockKeyhole, Plus, Share2, ShieldCheck, Sparkles, X, Zap } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { io } from 'socket.io-client';
import { Link, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import CreateDrop from './components/CreateDrop.jsx';
import Header from './components/Header.jsx';
import api, { errorMessage } from './services/api.js';

function formatBytes(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 ** 2) return `${(size / 1024).toFixed(0)} KB`;
  if (size < 1024 ** 3) return `${(size / 1024 ** 2).toFixed(1)} MB`;
  return `${(size / 1024 ** 3).toFixed(1)} GB`;
}

function Home() {
  return (
    <>
      <main className="home-main">
        <section className="hero">
          <div className="hero-copy">
            <motion.div className="eyebrow hero-eyebrow" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
              <span className="eyebrow-line" /> A LITTLE LESS FRICTION
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.55 }}>
              Sharing should<br />be this <span className="headline-accent">simple.</span>
            </motion.h1>
            <motion.p className="hero-description" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.17, duration: 0.5 }}>
              Your files. One code. Zero hassle.<br />Send anything to anyone, no account required.
            </motion.p>
            <motion.div className="hero-links" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.27 }}>
              <a href="#create" className="button button-dark">Create a Drop <ArrowUpRight size={16} /></a>
              <Link to="/enter" className="text-link">Have a code? <ArrowRight size={15} /></Link>
            </motion.div>
            <motion.div className="trust-line" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
              <span className="trust-avatars" aria-hidden="true"><i>J</i><i>M</i><i>A</i></span>
              <span>Made for sharing, not sign-ups</span>
            </motion.div>
          </div>
          <motion.div className="hero-art" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1, duration: 0.7 }}>
            <div className="art-glow" />
            <div className="orbit orbit-one" /><div className="orbit orbit-two" />
            <div className="art-file art-file-back"><span className="art-file-fold" /><div className="art-file-line wide" /><div className="art-file-line" /><div className="art-file-line short" /><div className="art-file-tag">PDF</div></div>
            <div className="art-file art-file-front"><div className="art-image"><span /><span /><span /></div><div className="art-file-line wide" /><div className="art-file-line short" /><div className="art-file-tag blue-tag">IMG</div></div>
            <div className="art-transfer"><span className="transfer-icon"><ArrowDown size={16} /></span><span>Ready to share</span><i /></div>
            <div className="art-sparkle sparkle-a">✦</div><div className="art-sparkle sparkle-b">✳</div>
            <div className="art-caption"><span>01 — YOUR DROP</span><span>FILES, IN GOOD COMPANY</span></div>
          </motion.div>
        </section>

        <section className="create-section" id="create">
          <div className="section-heading">
            <div><span className="eyebrow"><span className="eyebrow-line" /> START SHARING</span><h2>Make something<br className="mobile-only" /> worth passing on.</h2></div>
            <p>A few files, a whole folder, a quick note.<br />It all starts with a Drop.</p>
          </div>
          <CreateDrop />
        </section>

        <section className="how-section" id="how-it-works">
          <div className="how-heading"><span className="eyebrow"><span className="eyebrow-line" /> NO INSTRUCTIONS NEEDED</span><h2>Three steps.<br />Then it’s gone.</h2></div>
          <div className="steps">
            <div className="step"><span className="step-number">01</span><span className="step-icon"><Plus size={19} /></span><h3>Add your stuff</h3><p>Drop in files, write a note, or do both. No sign-up standing between you and send.</p></div>
            <div className="step"><span className="step-number">02</span><span className="step-icon"><Share2 size={19} /></span><h3>Pass it along</h3><p>Get a private access code and a link. Share however works for you.</p></div>
            <div className="step"><span className="step-number">03</span><span className="step-icon"><Clock3 size={19} /></span><h3>Let it disappear</h3><p>Your Drop expires on your schedule. No loose ends, no files left behind.</p></div>
          </div>
        </section>

        <section className="feature-strip">
          <div className="feature-intro"><span className="eyebrow"><span className="eyebrow-line" /> SMALL DETAILS, BIG RELIEF</span><h2>Built to get out<br />of your way.</h2></div>
          <div className="feature-item"><ShieldCheck size={19} /><strong>Private by default</strong><span>Only people with your code can get in.</span></div>
          <div className="feature-item"><Zap size={19} /><strong>Quick by nature</strong><span>No account, no setup, no waiting around.</span></div>
          <div className="feature-item"><Clock3 size={19} /><strong>Gone on schedule</strong><span>Set an expiry or a download limit.</span></div>
        </section>
      </main>
    </>
  );
}

function Footer() {
  return <footer className="site-footer"><span>© {new Date().getFullYear()} Droply</span><span className="footer-tagline">Drop it. Share it. Done.</span><nav><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/help">Help</Link><Link to="/report">Report</Link></nav></footer>;
}

function CopyButton({ value, label = 'Copy', className = '' }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
      else {
        const element = document.createElement('textarea');
        element.value = value;
        element.style.position = 'fixed';
        element.style.opacity = '0';
        document.body.appendChild(element);
        element.select();
        const copiedSuccessfully = document.execCommand('copy');
        element.remove();
        if (!copiedSuccessfully) throw new Error('Clipboard access is unavailable.');
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }
  return <button className={`button ${className}`} onClick={copy} type="button" aria-live="polite">{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? 'Copied' : label}</button>;
}

function Created() {
  const { state } = useLocation();
  const drop = state?.drop;
  const [sharing, setSharing] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  if (!drop?.code) return <main className="standalone-page"><div className="small-panel"><Sparkles size={24} /><h1>Your Drop is ready.</h1><p>For security, the access code only appears right after you create it.</p><Link className="button button-primary" to="/">Create another Drop</Link></div></main>;
  const shareUrl = `${window.location.origin}/enter?code=${encodeURIComponent(drop.code)}`;
  const expiryLabel = new Date(drop.expiresAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

  async function share() {
    setSharing(true);
    try {
      if (navigator.share) await navigator.share({ title: drop.title || 'A Drop for you', text: `Open my Drop with code ${drop.code}`, url: shareUrl });
      else if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(shareUrl);
    } finally { setSharing(false); }
  }

  async function deleteDrop() {
    if (!window.confirm('Delete this Drop now? Recipients will no longer be able to open it.')) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete(`/drops/${drop.id}`, { headers: { 'X-Management-Secret': drop.managementSecret } });
      navigate('/');
    } catch (requestError) {
      setDeleteError(errorMessage(requestError));
      setDeleting(false);
    }
  }

  return (
    <main className="standalone-page">
      <motion.section className="success-card" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
        <div className="success-top"><span className="success-icon"><Check size={21} /></span><span className="eyebrow">YOUR DROP IS READY</span></div>
        <h1>Out in the world.<br /><span>Right on your terms.</span></h1>
        <p className="success-description">Pass along the code or link. Anyone with access can open your Drop until it expires.</p>
        <div className="access-code-label">YOUR ACCESS CODE <span>KEEP IT BETWEEN YOU</span></div>
        <div className="code-display" aria-label={`Access code ${drop.code}`}>{drop.code.match(/.{1,4}/g).join(' ')}</div>
        <div className="success-actions">
          <CopyButton value={drop.code} label="Copy code" className="button-primary" />
          <CopyButton value={shareUrl} label="Copy link" className="button-light" />
          <button type="button" className="button button-light share-button" onClick={share}><Share2 size={16} />{sharing ? 'Opening…' : 'Share'}</button>
        </div>
        <div className="success-details">
          <div><Clock3 size={16} /><span><small>EXPIRES</small><strong>{expiryLabel}</strong></span></div>
          <div><FileText size={16} /><span><small>CONTENTS</small><strong>{drop.files.length} {drop.files.length === 1 ? 'file' : 'files'}{drop.text ? ' + note' : ''}</strong></span></div>
        </div>
        <div className="qr-and-files">
          <div className="qr-box"><QRCodeSVG value={shareUrl} size={112} level="M" includeMargin /><span>SCAN TO OPEN</span></div>
          <div className="success-file-list"><span className="eyebrow">IN THIS DROP</span>
            {drop.files.length ? drop.files.map((file) => <div className="success-file" key={file.id}><FileText size={15} /><strong>{file.name}</strong></div>) : <div className="success-file"><FileText size={15} /><strong>Text-only Drop</strong></div>}
            {drop.text && <div className="success-file"><FileText size={15} /><strong>Message included</strong></div>}
          </div>
        </div>
        <div className="secret-warning"><LockKeyhole size={15} /><span>Your creator controls stay in this browser session. Keep this page open if you may want to delete the Drop early.</span></div>
        {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
        <button className="delete-drop-button" type="button" onClick={deleteDrop} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete this Drop early'}</button>
        <Link className="new-drop-link" to="/"><Plus size={16} /> Make another Drop</Link>
      </motion.section>
    </main>
  );
}

function EnterCode() {
  const [code, setCode] = useState(new URLSearchParams(useLocation().search).get('code') || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function resolve(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post('/drops/resolve', { code });
      navigate(`/drop/${data.id}`, { state: { drop: data, code: code.replace(/[\s-]/g, '').toUpperCase() } });
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('code') && code.length >= 8) void resolve({ preventDefault() {} });
  }, []);

  return (
    <main className="standalone-page">
      <motion.section className="code-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
        <span className="small-icon"><Link2 size={20} /></span><span className="eyebrow">A LITTLE SOMETHING FOR YOU</span>
        <h1>Have a code?</h1><p>Enter the access code you were sent to open the Drop.</p>
        <form onSubmit={resolve}>
          <label htmlFor="access-code">ACCESS CODE</label>
          <input id="access-code" autoFocus autoComplete="one-time-code" inputMode="text" maxLength={24} value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="e.g. 8Q3F 2K7D" />
          {(error || unavailable) && <p className="form-error" role="alert">{error || 'This Drop is no longer available.'}</p>}
          <button className="button button-primary full-button" type="submit" disabled={busy || code.trim().length < 8}>{busy ? 'Checking code…' : <>Open this Drop <ArrowRight size={16} /></>}</button>
        </form>
        <span className="code-card-foot"><ShieldCheck size={14} /> Your code is the key. We never ask for your details.</span>
        <Link to="/" className="back-link"><ArrowLeft size={14} /> Back home</Link>
      </motion.section>
    </main>
  );
}

function Viewer() {
  const { id } = useParams();
  const { state } = useLocation();
  const drop = state?.drop;
  const code = state?.code;
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    if (!drop || !code) return undefined;
    const apiUrl = new URL(import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1');
    const socket = io(apiUrl.origin, { transports: ['websocket'] });
    socket.on('connect', () => socket.emit('drop:subscribe', { dropId: id, code }));
    socket.on('drop:unavailable', () => setUnavailable(true));
    return () => socket.disconnect();
  }, [id, code, drop]);
  if (!drop || !code) return <main className="standalone-page"><div className="small-panel"><h1>Open with your code.</h1><p>Enter the code that came with this Drop to see its contents.</p><Link to="/enter" className="button button-primary">Enter a code</Link></div></main>;

  async function download(file) {
    setError('');
    try {
      const response = await api.post(`/drops/${id}/files/${file.id}/download`, {}, {
        headers: { 'X-Drop-Code': code },
        responseType: 'blob',
        timeout: 0
      });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = file.name;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (requestError) { setError(errorMessage(requestError)); }
  }

  async function openPreview(file) {
    try {
      const response = await api.post(`/drops/${id}/files/${file.id}/preview`, {}, {
        headers: { 'X-Drop-Code': code }, responseType: 'blob'
      });
      setPreview({ url: URL.createObjectURL(response.data), type: file.type, name: file.name });
    } catch (requestError) { setError(errorMessage(requestError)); }
  }

  return (
    <main className="standalone-page viewer-page">
      <section className="viewer-card">
        <Link className="back-link" to="/enter"><ArrowLeft size={14} /> Back</Link>
        <div className="viewer-heading"><span className="success-icon"><Check size={18} /></span><span className="eyebrow">A DROP FOR YOU</span></div>
        <h1>{drop.title || 'A little something'}</h1>
        <p className="viewer-expiry"><Clock3 size={14} /> Expires {new Date(drop.expiresAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
        {drop.text && <div className="shared-note"><div className="note-heading"><span>NOTE</span><CopyButton value={drop.text} label="Copy" className="tiny-copy" /></div><p>{drop.text}</p></div>}
        <div className="viewer-files"><div className="viewer-files-heading"><strong>Files</strong><span>{drop.files.length} item{drop.files.length === 1 ? '' : 's'}</span></div>
          {drop.files.map((file) => <div className="viewer-file" key={file.id}>
            <span className="file-type-icon"><FileText size={18} /></span><span className="file-meta"><strong>{file.name}</strong><small>{file.type} · {formatBytes(file.size)}</small></span>
            {file.previewable && <button className="tiny-copy" onClick={() => openPreview(file)} type="button">Preview</button>}
            <button className="download-button" onClick={() => download(file)} type="button" aria-label={`Download ${file.name}`} disabled={unavailable}><Download size={17} /></button>
          </div>)}
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <p className="privacy-note"><ShieldCheck size={14} /> This Drop is private to people with its access code.</p>
      </section>
      <AnimatePresence>{preview && <motion.div className="preview-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { URL.revokeObjectURL(preview.url); setPreview(null); }}>
        <button className="preview-close" aria-label="Close preview"><X size={20} /></button>
        {preview.type.startsWith('image/') ? <img src={preview.url} alt={preview.name} onClick={(event) => event.stopPropagation()} /> :
          preview.type.startsWith('audio/') ? <audio controls src={preview.url} onClick={(event) => event.stopPropagation()} /> :
            preview.type.startsWith('video/') ? <video controls src={preview.url} onClick={(event) => event.stopPropagation()} /> :
              <iframe title={`Preview of ${preview.name}`} src={preview.url} sandbox="" onClick={(event) => event.stopPropagation()} />}
      </motion.div>}</AnimatePresence>
    </main>
  );
}

function StaticPage({ title, children }) {
  return <main className="standalone-page"><section className="text-page"><Link to="/" className="back-link"><ArrowLeft size={14} /> Home</Link><span className="eyebrow">DROPLY · GOOD TO KNOW</span><h1>{title}</h1>{children}</section></main>;
}

function Report() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api.post('/reports', Object.fromEntries(form.entries()));
      setSent(true);
    } catch (requestError) { setError(errorMessage(requestError)); }
  }
  return <StaticPage title="Report a Drop">{sent ? <p>Thank you. Your report has been received for review.</p> : <form className="report-form" onSubmit={submit}><label>Access code, if available<input name="code" maxLength={24} /></label><label>What’s the issue?<select name="category"><option value="abuse">Abusive or harmful content</option><option value="copyright">Copyright concern</option><option value="malware">Potential malware</option><option value="other">Something else</option></select></label><label>Tell us more<textarea name="description" minLength={10} maxLength={4000} required rows={5} /></label><label>Email for follow-up (optional)<input name="email" type="email" maxLength={254} /></label>{error && <p className="form-error">{error}</p>}<button className="button button-primary">Send report</button></form>}</StaticPage>;
}

function ContentPage({ kind }) {
  const pages = {
    privacy: ['Privacy, in plain language', <><p>Droply is built for sharing without accounts. We do not ask for your name, phone number, or email to create or open a Drop.</p><h2>What we store</h2><p>We store Drop metadata, the access-code hash, optional text, and file objects until the Drop expires or is deleted. We do not store the original access code in a retrievable form. Basic request information may be processed to protect the service from abuse.</p><h2>Expiry and deletion</h2><p>Choose an expiry of 10 minutes, 1 hour, 24 hours, or 7 days. A Drop becomes inaccessible at its expiry time; background cleanup removes its stored files afterward. Early deletion is supported through the creator’s management capability.</p><h2>Important</h2><p>Droply does not currently provide end-to-end encryption or guarantee that uploaded files are malware-free. Do not share sensitive information that requires those protections.</p></>],
    terms: ['Terms of use', <><p>Use Droply only to share content you have the right to share. Do not use it to distribute unlawful, harmful, infringing, or malicious content.</p><p>Drops are temporary and may become unavailable at expiry, when a download limit is reached, or when removed in response to a valid abuse report. Keep your own copy of anything important.</p><p>The service is provided as available. Do not use Droply for emergency, regulated, or high-sensitivity data workflows.</p></>],
    help: ['A few quick answers', <><h2>How do I open a Drop?</h2><p>Use the link you received or enter its access code on the home page. No account is needed.</p><h2>How long will it be available?</h2><p>The person who created it selected an expiry. A download limit may also be set.</p><h2>Can I trust every file?</h2><p>Only open files you expect and trust. Droply does not claim that every upload has been malware-scanned.</p><h2>Need to report something?</h2><p><Link to="/report">Send an abuse report</Link> with the access code if you have it.</p></>]
  };
  const [title, body] = pages[kind] || pages.help;
  return <StaticPage title={title}>{body}</StaticPage>;
}

function App() {
  const [dark, setDark] = useState(() => localStorage.getItem('droply-theme') === 'dark');
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    localStorage.setItem('droply-theme', dark ? 'dark' : 'light');
  }, [dark]);
  const location = useLocation();
  return <div className="app-shell"><Header dark={dark} onThemeToggle={() => setDark((value) => !value)} />
    <AnimatePresence mode="wait"><motion.div key={location.pathname} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
      <Routes location={location}>
        <Route path="/" element={<Home />} /><Route path="/create" element={<main className="standalone-page"><div className="create-page-wrap"><Link to="/" className="back-link"><ArrowLeft size={14} /> Home</Link><CreateDrop /></div></main>} />
        <Route path="/created" element={<Created />} /><Route path="/enter" element={<EnterCode />} /><Route path="/drop/:id" element={<Viewer />} />
        <Route path="/privacy" element={<ContentPage kind="privacy" />} /><Route path="/terms" element={<ContentPage kind="terms" />} /><Route path="/help" element={<ContentPage kind="help" />} /><Route path="/report" element={<Report />} />
        <Route path="*" element={<StaticPage title="That page wandered off"><p>We couldn’t find what you were looking for.</p><Link to="/">Head back home</Link></StaticPage>} />
      </Routes>
    </motion.div></AnimatePresence><Footer />
  </div>;
}

export default App;
