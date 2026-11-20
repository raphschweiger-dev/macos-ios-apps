import { useRef, useState } from 'react';
import type { AppData } from '../types';
import { download, eraseAll, exportCSV, exportJSON } from '../store';
import { migrate } from '../sync/merge';
import type { SyncApi } from '../sync/useSync';
import { SyncError } from '../sync/github';
import { today } from '../dates';

interface Props {
  data: AppData;
  setData: (d: AppData) => void;
  onLoadDemo: () => void;
  toast: (m: string) => void;
  sync: SyncApi;
}

export function timeAgo(t?: number) {
  if (!t) return 'never';
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  return new Date(t).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

export default function DataPanel({ data, setData, onLoadDemo, toast, sync }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const n = Object.keys(data.entries).length;

  const importFile = async (f: File) => {
    try {
      const parsed = migrate(JSON.parse(await f.text()));
      if (!parsed) throw new Error('bad format');
      if (n && !confirm(`Replace your ${n} logged days with the imported file?`)) return;
      // Stamp as fresh edits so the import wins over older synced copies.
      const now = Date.now();
      setData({
        ...parsed,
        habits: parsed.habits.map((h) => ({ ...h, updatedAt: now })),
        outcomes: parsed.outcomes.map((o) => ({ ...o, updatedAt: now })),
        entries: Object.fromEntries(Object.entries(parsed.entries).map(([k, e]) => [k, { ...e, updatedAt: now }])),
      });
      toast(`Imported ${Object.keys(parsed.entries).length} days`);
    } catch {
      toast('That file is not a Habit Journal backup');
    }
  };

  return (
    <div className="setup fade-in">
      <SyncCard sync={sync} toast={toast} />

      <section className="card">
        <div className="card-head"><h2>Backup &amp; export</h2></div>
        <p className="muted">{n} days logged. Your data is stored on this device{sync.cfg ? ' and in your GitHub data repo' : ''}.</p>
        <div className="btn-row">
          <button className="primary-btn" onClick={() => download(`habit-journal-${today()}.json`, exportJSON(data), 'application/json')}>Export backup (JSON)</button>
          <button className="secondary-btn" onClick={() => download(`habit-journal-${today()}.csv`, exportCSV(data), 'text/csv')}>Export CSV (for pandas / Excel)</button>
          <button className="secondary-btn" onClick={() => fileRef.current?.click()}>Import backup…</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = ''; }} />
        </div>
      </section>

      <section className="card">
        <div className="card-head"><h2>Demo</h2></div>
        <p className="muted">Load 90 days of synthetic data with two real effects built in: moisturizer lowers redness the next day, and sleep raises energy the same day. Coffee and cleanser are pure noise. The Insights page should find the first two and ignore the noise.</p>
        {sync.cfg && <p className="muted small">Disconnect sync first, so demo data doesn't end up on your other devices.</p>}
        <div className="btn-row">
          <button className="secondary-btn" disabled={!!sync.cfg} onClick={onLoadDemo}>Load demo data</button>
        </div>
      </section>

      <section className="card danger-zone">
        <div className="card-head"><h2>Reset</h2></div>
        {sync.cfg && <p className="muted small">Sync is on, so this also erases the journal on your other devices.</p>}
        <div className="btn-row">
          <button className="danger-btn" onClick={() => { if (confirm('Erase all habits, outcomes and entries?')) { setData(eraseAll(data)); toast('Journal erased'); } }}>Erase everything</button>
        </div>
      </section>
    </div>
  );
}

function SyncCard({ sync, toast }: { sync: SyncApi; toast: (m: string) => void }) {
  const [owner, setOwner] = useState(sync.cfg?.owner ?? '');
  const [repo, setRepo] = useState(sync.cfg?.repo ?? 'habit-journal-data');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const s = sync.status;

  if (sync.cfg) {
    return (
      <section className="card">
        <div className="card-head">
          <h2>Sync with GitHub</h2>
          <span className={`sync-pill ${s.kind}`}><span className="sync-dot" />{s.kind === 'syncing' ? 'Syncing…' : s.kind === 'error' ? 'Error' : 'On'}</span>
        </div>
        <p className="muted">
          Synced with <b>{sync.cfg.owner}/{sync.cfg.repo}</b> · <code>{sync.cfg.path}</code><br />
          Last synced: {timeAgo('lastSyncedAt' in s ? s.lastSyncedAt : undefined)}
        </p>
        {s.kind === 'error' && <p className="error-text">{s.message}</p>}
        <p className="muted small">Syncs automatically when you open the app, a few seconds after each change, and when you come back to it.</p>
        <div className="btn-row">
          <button className="primary-btn" disabled={s.kind === 'syncing'} onClick={() => sync.syncNow()}>Sync now</button>
          <button className="secondary-btn" onClick={() => { if (confirm('Stop syncing on this device? Your data stays here and on GitHub.')) { sync.disconnect(); toast('Sync turned off on this device'); } }}>Disconnect</button>
        </div>
      </section>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await sync.connect({ owner: owner.trim(), repo: repo.trim(), token: token.trim(), path: 'journal.json' });
      toast('Connected to GitHub, syncing…');
      setToken('');
    } catch (ex) {
      setErr(ex instanceof SyncError ? ex.message : String(ex));
    } finally { setBusy(false); }
  };

  return (
    <section className="card">
      <div className="card-head">
        <h2>Sync with GitHub</h2>
        <span className="sync-pill off"><span className="sync-dot" />Off</span>
      </div>
      <p className="muted">Keep your Mac and iPhone in sync. Your journal is saved as <code>journal.json</code> in a <b>private</b> GitHub repo that only you can see.</p>
      <ol className="steps">
        <li>Create a <b>private</b> repo named <code>habit-journal-data</code> at <a href="https://github.com/new" target="_blank" rel="noreferrer">github.com/new</a>.</li>
        <li>
          Create a token at <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">Settings → Fine-grained tokens</a>.
          Under <i>Repository access</i>, choose <i>Only select repositories → habit-journal-data</i>. Under <i>Permissions</i>, set <i>Contents → Read and write</i>.
        </li>
        <li>Paste it below. Do this once on your Mac and once on your iPhone.</li>
      </ol>
      <form className="sync-form" onSubmit={submit}>
        <label><span>GitHub username</span><input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="your-username" autoCapitalize="off" autoCorrect="off" spellCheck={false} required /></label>
        <label><span>Data repo</span><input value={repo} onChange={(e) => setRepo(e.target.value)} autoCapitalize="off" autoCorrect="off" spellCheck={false} required /></label>
        <label><span>Token</span><input value={token} onChange={(e) => setToken(e.target.value)} type="password" placeholder="github_pat_…" autoComplete="off" required /></label>
        {err && <p className="error-text">{err}</p>}
        <div className="btn-row">
          <button className="primary-btn" type="submit" disabled={busy || !owner || !repo || !token}>{busy ? 'Connecting…' : 'Connect & sync'}</button>
        </div>
      </form>
      <p className="muted small">The token stays on this device and is only ever sent to api.github.com. It can only access the one repo you picked.</p>
    </section>
  );
}
