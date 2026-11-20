import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppData } from '../types';
import { canonical, merge } from './merge';
import { pull, sync, SyncError, type SyncConfig } from './github';

const KEY = 'habit-journal.sync';

export type SyncStatus =
  | { kind: 'off' }
  | { kind: 'syncing'; lastSyncedAt?: number }
  | { kind: 'ok'; lastSyncedAt: number }
  | { kind: 'error'; message: string; lastSyncedAt?: number };

function loadCfg(): SyncConfig | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    return c && c.token && c.owner && c.repo ? { path: 'journal.json', ...c } : null;
  } catch { return null; }
}
function saveCfg(c: SyncConfig | null) {
  try { if (c) localStorage.setItem(KEY, JSON.stringify(c)); else localStorage.removeItem(KEY); } catch { /* ignore */ }
}

export function useSync(data: AppData, setData: (d: AppData) => void) {
  const [cfg, setCfg] = useState<SyncConfig | null>(loadCfg);
  const [status, setStatus] = useState<SyncStatus>(() => (loadCfg() ? { kind: 'syncing' } : { kind: 'off' }));
  const dataRef = useRef(data);
  dataRef.current = data;
  const running = useRef(false);
  const again = useRef(false);
  const lastSynced = useRef<string | null>(null);
  const lastAt = useRef<number | undefined>(undefined);

  const run = useCallback(async (c: SyncConfig | null = cfg) => {
    if (!c) return;
    if (running.current) { again.current = true; return; }
    running.current = true;
    setStatus({ kind: 'syncing', lastSyncedAt: lastAt.current });
    try {
      const snapshot = dataRef.current;
      const merged = await sync(c, snapshot);
      lastSynced.current = canonical(merged);
      const latest = dataRef.current;
      const next = latest === snapshot ? merged : merge(latest, merged);
      if (latest !== snapshot) again.current = true; // edits happened mid-flight: push them next
      if (canonical(next) !== canonical(latest)) setData(next);
      lastAt.current = Date.now();
      setStatus({ kind: 'ok', lastSyncedAt: lastAt.current });
    } catch (e) {
      const message = e instanceof SyncError ? e.message : String(e);
      setStatus({ kind: 'error', message, lastSyncedAt: lastAt.current });
    } finally {
      running.current = false;
      if (again.current) { again.current = false; setTimeout(() => run(c), 300); }
    }
  }, [cfg, setData]);

  // On open, when the app comes back to the foreground, and when the network returns.
  useEffect(() => {
    if (!cfg) return;
    run(cfg);
    const onVis = () => document.visibilityState === 'visible' && run(cfg);
    const onOnline = () => run(cfg);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('online', onOnline);
    window.addEventListener('focus', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('focus', onVis);
    };
  }, [cfg, run]);

  // Debounced push after local edits.
  useEffect(() => {
    if (!cfg || lastSynced.current === null) return;
    if (canonical(data) === lastSynced.current) return;
    const t = setTimeout(() => run(cfg), 2500);
    return () => clearTimeout(t);
  }, [data, cfg, run]);

  /** Validate credentials, then save and run a first sync. */
  const connect = useCallback(async (c: SyncConfig) => {
    await pull(c); // throws a readable SyncError if repo/token is wrong
    saveCfg(c);
    lastSynced.current = null;
    setCfg(c);
  }, []);

  const disconnect = useCallback(() => {
    saveCfg(null);
    setCfg(null);
    lastSynced.current = null;
    setStatus({ kind: 'off' });
  }, []);

  return { cfg, status, connect, disconnect, syncNow: () => run(cfg) };
}

export type SyncApi = ReturnType<typeof useSync>;
