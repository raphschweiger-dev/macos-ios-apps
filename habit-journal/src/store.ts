import { useCallback, useEffect, useState } from 'react';
import type { AppData, JournalEntry } from './types';

const KEY = 'habit-journal.v1';

export const emptyData = (): AppData => ({
  version: 1,
  habits: [
    { id: 'h-cleanser', name: 'Cleanser', color: '#5AC8FA' },
    { id: 'h-moist', name: 'Moisturizer', color: '#34C759' },
  ],
  outcomes: [{ id: 'o-redness', name: 'Redness', higherIsBetter: false }],
  entries: {},
});

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (isAppData(parsed)) return parsed;
    }
  } catch { /* ignore */ }
  return emptyData();
}

function saveData(d: AppData) {
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* ignore */ }
}

export function isAppData(x: unknown): x is AppData {
  const d = x as AppData;
  return !!d && d.version === 1 && Array.isArray(d.habits) && Array.isArray(d.outcomes) && typeof d.entries === 'object';
}

export function useAppData() {
  const [data, setData] = useState<AppData>(loadData);
  useEffect(() => saveData(data), [data]);
  const update = useCallback((fn: (d: AppData) => AppData) => setData((d) => fn(d)), []);
  return [data, update, setData] as const;
}

export function blankEntry(date: string): JournalEntry {
  return { date, habits: {}, outcomes: {}, note: '' };
}

export const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

export function exportJSON(d: AppData): string {
  return JSON.stringify(d, null, 2);
}

export function exportCSV(d: AppData): string {
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const header = ['date', ...d.habits.map((h) => esc(h.name)), ...d.outcomes.map((o) => esc(o.name)), 'note'];
  const rows = Object.keys(d.entries).sort().map((date) => {
    const e = d.entries[date];
    return [
      date,
      ...d.habits.map((h) => (h.id in e.habits ? (e.habits[h.id] ? '1' : '0') : '')),
      ...d.outcomes.map((o) => (e.outcomes[o.id] ?? '').toString()),
      esc(e.note ?? ''),
    ].join(',');
  });
  return [header.join(','), ...rows].join('\n');
}

export function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
