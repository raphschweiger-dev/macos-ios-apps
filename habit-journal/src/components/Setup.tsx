import { useState } from 'react';
import type { AppData } from '../types';
import { uid } from '../store';
import { IconArchive, IconPlus, IconTrash } from './Icons';

export const PALETTE = ['#007AFF', '#34C759', '#FF9500', '#AF52DE', '#FF2D55', '#5AC8FA', '#FFCC00', '#FF3B30', '#30B0C7', '#A2845E'];

interface Props { data: AppData; update: (fn: (d: AppData) => AppData) => void; toast: (m: string) => void }

export default function Setup({ data, update, toast }: Props) {
  const [newHabit, setNewHabit] = useState('');
  const [newOutcome, setNewOutcome] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const addHabit = () => {
    const name = newHabit.trim();
    if (!name) return;
    update((d) => ({ ...d, habits: [...d.habits, { id: uid('h'), name, color: PALETTE[d.habits.length % PALETTE.length] }] }));
    setNewHabit('');
    toast(`Added habit "${name}"`);
  };
  const addOutcome = () => {
    const name = newOutcome.trim();
    if (!name) return;
    update((d) => ({ ...d, outcomes: [...d.outcomes, { id: uid('o'), name, higherIsBetter: false }] }));
    setNewOutcome('');
    toast(`Added outcome "${name}"`);
  };

  const setHabit = (id: string, patch: Partial<AppData['habits'][number]>) =>
    update((d) => ({ ...d, habits: d.habits.map((h) => (h.id === id ? { ...h, ...patch } : h)) }));
  const setOutcome = (id: string, patch: Partial<AppData['outcomes'][number]>) =>
    update((d) => ({ ...d, outcomes: d.outcomes.map((o) => (o.id === id ? { ...o, ...patch } : o)) }));

  const del = (kind: 'habits' | 'outcomes', id: string, name: string) => {
    if (!confirm(`Delete "${name}" and all its logged values? Archive keeps the history instead.`)) return;
    update((d) => {
      const entries = Object.fromEntries(Object.entries(d.entries).map(([k, e]) => {
        const habits = { ...e.habits }, outcomes = { ...e.outcomes };
        delete habits[id]; delete outcomes[id];
        return [k, { ...e, habits, outcomes }];
      }));
      return { ...d, [kind]: (d[kind] as { id: string }[]).filter((x) => x.id !== id), entries } as AppData;
    });
  };

  const habits = data.habits.filter((h) => showArchived || !h.archived);
  const outcomes = data.outcomes.filter((o) => showArchived || !o.archived);
  const anyArchived = data.habits.some((h) => h.archived) || data.outcomes.some((o) => o.archived);

  return (
    <div className="setup fade-in">
      <section className="card">
        <div className="card-head">
          <h2>Habits</h2>
          <span className="hint">Things you do (yes / no each day)</span>
        </div>
        <ul className="list">
          {habits.map((h) => (
            <li key={h.id} className={`list-row ${h.archived ? 'archived' : ''}`}>
              <button
                className="swatch"
                style={{ background: h.color }}
                title="Change color"
                onClick={() => setHabit(h.id, { color: PALETTE[(PALETTE.indexOf(h.color) + 1) % PALETTE.length] })}
              />
              <input className="inline-input" value={h.name} onChange={(e) => setHabit(h.id, { name: e.target.value })} />
              <button className="icon-btn sm" title={h.archived ? 'Unarchive' : 'Archive (hide but keep history)'} onClick={() => setHabit(h.id, { archived: !h.archived })}><IconArchive width={16} height={16} /></button>
              <button className="icon-btn sm danger" title="Delete" onClick={() => del('habits', h.id, h.name)}><IconTrash width={16} height={16} /></button>
            </li>
          ))}
        </ul>
        <form className="add-row" onSubmit={(e) => { e.preventDefault(); addHabit(); }}>
          <input placeholder="New habit, e.g. Sunscreen, Retinol, 2L water" value={newHabit} onChange={(e) => setNewHabit(e.target.value)} />
          <button className="primary-btn" type="submit" disabled={!newHabit.trim()}><IconPlus width={16} height={16} /> Add</button>
        </form>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Outcomes</h2>
          <span className="hint">Things you rate 0–10 each day</span>
        </div>
        <ul className="list">
          {outcomes.map((o) => (
            <li key={o.id} className={`list-row ${o.archived ? 'archived' : ''}`}>
              <input className="inline-input" value={o.name} onChange={(e) => setOutcome(o.id, { name: e.target.value })} />
              <div className="segmented sm">
                <button className={!o.higherIsBetter ? 'on' : ''} onClick={() => setOutcome(o.id, { higherIsBetter: false })}>Lower is better</button>
                <button className={o.higherIsBetter ? 'on' : ''} onClick={() => setOutcome(o.id, { higherIsBetter: true })}>Higher is better</button>
              </div>
              <button className="icon-btn sm" title={o.archived ? 'Unarchive' : 'Archive'} onClick={() => setOutcome(o.id, { archived: !o.archived })}><IconArchive width={16} height={16} /></button>
              <button className="icon-btn sm danger" title="Delete" onClick={() => del('outcomes', o.id, o.name)}><IconTrash width={16} height={16} /></button>
            </li>
          ))}
        </ul>
        <form className="add-row" onSubmit={(e) => { e.preventDefault(); addOutcome(); }}>
          <input placeholder="New outcome, e.g. Breakouts, Dryness, Mood" value={newOutcome} onChange={(e) => setNewOutcome(e.target.value)} />
          <button className="primary-btn" type="submit" disabled={!newOutcome.trim()}><IconPlus width={16} height={16} /> Add</button>
        </form>
      </section>

      {anyArchived && (
        <label className="toggle-line">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show archived
        </label>
      )}
    </div>
  );
}
