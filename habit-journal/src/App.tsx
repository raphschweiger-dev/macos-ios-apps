import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppData } from './store';
import { addDays, today } from './dates';
import { makeDemoData } from './demoData';
import Journal, { toggleHabit } from './components/Journal';
import Insights from './components/Insights';
import Setup from './components/Setup';
import DataPanel, { timeAgo } from './components/DataPanel';
import { useSync, type SyncApi } from './sync/useSync';
import { IconAuto, IconDatabase, IconFlame, IconInsights, IconJournal, IconMoon, IconSliders, IconSun } from './components/Icons';

type View = 'journal' | 'insights' | 'setup' | 'data';
type Theme = 'auto' | 'light' | 'dark';

const NAV: { id: View; label: string; icon: typeof IconJournal }[] = [
  { id: 'journal', label: 'Journal', icon: IconJournal },
  { id: 'insights', label: 'Insights', icon: IconInsights },
  { id: 'setup', label: 'Habits & Outcomes', icon: IconSliders },
  { id: 'data', label: 'Data', icon: IconDatabase },
];
const TITLES: Record<View, string> = { journal: 'Journal', insights: 'Insights', setup: 'Habits & Outcomes', data: 'Data' };

function readTheme(): Theme {
  try { return (localStorage.getItem('habit-journal.theme') as Theme) || 'auto'; } catch { return 'auto'; }
}

export default function App() {
  const [data, update, setData] = useAppData();
  const sync = useSync(data, setData);
  const [view, setView] = useState<View>('journal');
  const [date, setDate] = useState(today());
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<number>();

  const toast = useCallback((m: string) => {
    setToastMsg(m);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 2200);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', theme);
    try { localStorage.setItem('habit-journal.theme', theme); } catch { /* ignore */ }
  }, [theme]);

  const loadDemo = useCallback(() => {
    if (sync.cfg) { toast('Turn off sync before loading demo data'); return; }
    if (Object.keys(data.entries).length && !confirm('Replace your journal with 90 days of demo data? (Export a backup first if you want to keep it.)')) return;
    setData(makeDemoData());
    setView('insights');
    toast('Loaded 90 days of demo data');
  }, [data.entries, setData, toast, sync.cfg]);

  const streak = useMemo(() => {
    let d = data.entries[today()] ? today() : addDays(today(), -1);
    let n = 0;
    while (data.entries[d]) { n++; d = addDays(d, -1); }
    return n;
  }, [data.entries]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && /^[1-4]$/.test(e.key)) {
        e.preventDefault();
        setView(NAV[Number(e.key) - 1].id);
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey || view !== 'journal') return;
      if (e.key === 'ArrowLeft') setDate((d) => addDays(d, -1));
      else if (e.key === 'ArrowRight') setDate((d) => addDays(d, 1));
      else if (e.key.toLowerCase() === 't') setDate(today());
      else if (/^[1-9]$/.test(e.key)) {
        const h = data.habits.filter((x) => !x.archived)[Number(e.key) - 1];
        if (h) {
          update((d) => toggleHabit(d, date, h.id));
          const on = !data.entries[date]?.habits[h.id];
          toast(`${h.name} ${on ? '✓' : '✗'}`);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, date, data, update, toast]);

  const nextTheme: Record<Theme, Theme> = { auto: 'light', light: 'dark', dark: 'auto' };
  const ThemeIcon = theme === 'auto' ? IconAuto : theme === 'light' ? IconSun : IconMoon;

  return (
    <div className="desktop">
      <div className="window">
        <aside className="sidebar">
          <div className="traffic" aria-hidden>
            <span className="tl red" /><span className="tl yellow" /><span className="tl green" />
          </div>
          <div className="app-name">Habit Journal</div>
          <nav>
            <div className="nav-section">Library</div>
            {NAV.map((n, i) => (
              <button key={n.id} className={`nav-item ${view === n.id ? 'active' : ''}`} onClick={() => setView(n.id)}>
                <n.icon width={17} height={17} />
                <span>{n.label}</span>
                <kbd className="nav-kbd">⌘{i + 1}</kbd>
              </button>
            ))}
          </nav>
          <div className="sidebar-foot">
            <div className="streak" title="Consecutive days logged">
              <IconFlame width={16} height={16} /> <b>{streak}</b> day streak
            </div>
            <div className="foot-right">
              <SyncIndicator sync={sync} onClick={() => setView('data')} />
              <button className="icon-btn sm" onClick={() => setTheme(nextTheme[theme])} title={`Appearance: ${theme}`}>
                <ThemeIcon width={16} height={16} />
              </button>
            </div>
          </div>
        </aside>

        <main className="content">
          <header className="toolbar">
            <h1 className="toolbar-title">{TITLES[view]}</h1>
            <div className="toolbar-actions">
              {view === 'journal' && date !== today() && <button className="pill-btn" onClick={() => setDate(today())}>Jump to today</button>}
              <span className="only-mobile"><SyncIndicator sync={sync} onClick={() => setView('data')} compact /></span>
              <button className="icon-btn sm only-mobile" onClick={() => setTheme(nextTheme[theme])} title={`Appearance: ${theme}`}><ThemeIcon width={16} height={16} /></button>
            </div>
          </header>
          <div className="scroll">
            <div className="page">
              {view === 'journal' && <Journal data={data} update={update} date={date} setDate={setDate} />}
              {view === 'insights' && <Insights data={data} onLoadDemo={loadDemo} onGoJournal={() => setView('journal')} />}
              {view === 'setup' && <Setup data={data} update={update} toast={toast} />}
              {view === 'data' && <DataPanel data={data} setData={setData} onLoadDemo={loadDemo} toast={toast} sync={sync} />}
            </div>
          </div>
        </main>
      </div>

      <nav className="tabbar">
        {NAV.map((n) => (
          <button key={n.id} className={view === n.id ? 'active' : ''} onClick={() => setView(n.id)}>
            <n.icon width={22} height={22} />
            <span>{n.id === 'setup' ? 'Setup' : n.label}</span>
          </button>
        ))}
      </nav>

      <div className={`toast ${toastMsg ? 'show' : ''}`} role="status">{toastMsg}</div>
    </div>
  );
}

function SyncIndicator({ sync, onClick, compact }: { sync: SyncApi; onClick: () => void; compact?: boolean }) {
  const s = sync.status;
  if (s.kind === 'off') return null;
  const label = s.kind === 'syncing' ? 'Syncing…' : s.kind === 'error' ? 'Sync error' : `Synced ${timeAgo(s.lastSyncedAt)}`;
  return (
    <button className={`sync-ind ${s.kind}`} onClick={onClick} title={s.kind === 'error' ? s.message : label}>
      <span className="sync-dot" />{!compact && <span>{s.kind === 'ok' ? 'Synced' : label}</span>}
    </button>
  );
}
