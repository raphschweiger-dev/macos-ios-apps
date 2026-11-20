import { useRef } from 'react';
import type { AppData } from '../types';
import { download, emptyData, exportCSV, exportJSON, isAppData } from '../store';
import { today } from '../dates';

interface Props { data: AppData; setData: (d: AppData) => void; onLoadDemo: () => void; toast: (m: string) => void }

export default function DataPanel({ data, setData, onLoadDemo, toast }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const n = Object.keys(data.entries).length;

  const importFile = async (f: File) => {
    try {
      const parsed = JSON.parse(await f.text());
      if (!isAppData(parsed)) throw new Error('bad format');
      if (n && !confirm(`Replace your ${n} logged days with the imported file?`)) return;
      setData(parsed);
      toast(`Imported ${Object.keys(parsed.entries).length} days`);
    } catch {
      toast('That file is not a Habit Journal backup');
    }
  };

  return (
    <div className="setup fade-in">
      <section className="card">
        <div className="card-head"><h2>Backup &amp; export</h2></div>
        <p className="muted">Everything is stored privately in this browser ({n} days). Export a backup now and then, or move data between your Mac and iPhone.</p>
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
        <div className="btn-row">
          <button className="secondary-btn" onClick={onLoadDemo}>Load demo data</button>
        </div>
      </section>

      <section className="card danger-zone">
        <div className="card-head"><h2>Reset</h2></div>
        <div className="btn-row">
          <button className="danger-btn" onClick={() => { if (confirm('Erase all habits, outcomes and entries?')) { setData(emptyData()); toast('Journal reset'); } }}>Erase everything</button>
        </div>
      </section>
    </div>
  );
}
