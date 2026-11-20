import { useMemo } from 'react';
import type { AppData, JournalEntry } from '../types';
import { addDays, fromISO, today } from '../dates';
import { blankEntry } from '../store';
import { IconChevronLeft, IconChevronRight, IconCheck } from './Icons';

interface Props {
  data: AppData;
  update: (fn: (d: AppData) => AppData) => void;
  date: string;
  setDate: (d: string) => void;
}

/** Ensure entry exists and every active habit has an explicit yes/no once the day is touched. */
export function touchEntry(d: AppData, date: string, fn: (e: JournalEntry) => JournalEntry): AppData {
  const existing = d.entries[date] ?? blankEntry(date);
  const habits = { ...existing.habits };
  for (const h of d.habits) if (!h.archived && !(h.id in habits)) habits[h.id] = false;
  const next = fn({ ...existing, habits, outcomes: { ...existing.outcomes } });
  return { ...d, entries: { ...d.entries, [date]: next } };
}

export function toggleHabit(d: AppData, date: string, habitId: string): AppData {
  return touchEntry(d, date, (e) => ({ ...e, habits: { ...e.habits, [habitId]: !e.habits[habitId] } }));
}

function ratingColor(v: number, higherIsBetter: boolean) {
  const good = higherIsBetter ? v / 10 : 1 - v / 10;
  // red (0) → amber → green (1)
  const hue = Math.round(good * 130);
  return `hsl(${hue} 70% 52%)`;
}

export default function Journal({ data, update, date, setDate }: Props) {
  const entry = data.entries[date];
  const habits = data.habits.filter((h) => !h.archived);
  const outcomes = data.outcomes.filter((o) => !o.archived);
  const isToday = date === today();
  const d = fromISO(date);

  const strip = useMemo(() => {
    const days: string[] = [];
    for (let i = -10; i <= 3; i++) days.push(addDays(date, i));
    return days;
  }, [date]);

  const completeness = (dt: string) => {
    const e = data.entries[dt];
    if (!e) return 0;
    const total = habits.length + outcomes.length;
    if (!total) return 1;
    const done = habits.filter((h) => e.habits[h.id]).length + outcomes.filter((o) => e.outcomes[o.id] != null).length;
    return Math.max(0.15, done / total);
  };

  return (
    <div className="journal fade-in" key={date}>
      <div className="day-header">
        <div>
          <div className="eyebrow">{isToday ? 'Today' : d.toLocaleDateString(undefined, { weekday: 'long' })}</div>
          <h1 className="large-title">{d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</h1>
        </div>
        <div className="day-nav">
          <button className="icon-btn" onClick={() => setDate(addDays(date, -1))} title="Previous day (←)"><IconChevronLeft /></button>
          <button className="pill-btn" disabled={isToday} onClick={() => setDate(today())} title="Today (T)">Today</button>
          <button className="icon-btn" onClick={() => setDate(addDays(date, 1))} title="Next day (→)"><IconChevronRight /></button>
        </div>
      </div>

      <div className="week-strip">
        {strip.map((dt) => {
          const c = completeness(dt);
          const dd = fromISO(dt);
          const future = dt > today();
          return (
            <button key={dt} className={`strip-day ${dt === date ? 'active' : ''} ${future ? 'future' : ''}`} onClick={() => setDate(dt)}>
              <span className="strip-wd">{dd.toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
              <svg viewBox="0 0 36 36" className="ring">
                <circle cx="18" cy="18" r="15" className="ring-bg" />
                {c > 0 && <circle cx="18" cy="18" r="15" className="ring-fg" strokeDasharray={`${c * 94.2} 94.2`} />}
                <text x="18" y="22.5" textAnchor="middle">{dd.getDate()}</text>
              </svg>
            </button>
          );
        })}
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Habits</h2>
          <span className="hint">Press 1–9 to toggle</span>
        </div>
        {habits.length === 0 ? (
          <p className="muted">No habits yet. Add some in Habits &amp; Outcomes.</p>
        ) : (
          <div className="chips">
            {habits.map((h, i) => {
              const on = !!entry?.habits[h.id];
              return (
                <button
                  key={h.id}
                  className={`chip ${on ? 'on' : ''}`}
                  style={{ ['--c' as string]: h.color }}
                  onClick={() => update((dd) => toggleHabit(dd, date, h.id))}
                  aria-pressed={on}
                >
                  <span className="chip-check">{on ? <IconCheck width={14} height={14} strokeWidth={2.4} /> : null}</span>
                  <span className="chip-label">{h.name}</span>
                  {i < 9 && <kbd>{i + 1}</kbd>}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Outcomes</h2>
          <span className="hint">0 = none · 10 = extreme</span>
        </div>
        {outcomes.length === 0 && <p className="muted">No outcomes yet. Add something to track, like redness, energy or mood.</p>}
        {outcomes.map((o) => {
          const v = entry?.outcomes[o.id] ?? null;
          return (
            <div className="rating-row" key={o.id}>
              <div className="rating-label">
                <span>{o.name}</span>
                <span className="direction">{o.higherIsBetter ? 'higher is better' : 'lower is better'}</span>
              </div>
              <div className="rating" role="radiogroup" aria-label={o.name}>
                {Array.from({ length: 11 }, (_, n) => (
                  <button
                    key={n}
                    role="radio"
                    aria-checked={v === n}
                    className={`rating-dot ${v === n ? 'sel' : ''} ${v != null && n <= v ? 'filled' : ''}`}
                    style={{ ['--rc' as string]: ratingColor(n, o.higherIsBetter) }}
                    onClick={() => update((dd) => touchEntry(dd, date, (e) => ({ ...e, outcomes: { ...e.outcomes, [o.id]: v === n ? null : n } })))}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      <section className="card">
        <div className="card-head"><h2>Notes</h2></div>
        <textarea
          className="note"
          placeholder="How did today go? New product, stress, diet, weather…"
          value={entry?.note ?? ''}
          onChange={(ev) => {
            const note = ev.target.value;
            update((dd) => touchEntry(dd, date, (e) => ({ ...e, note })));
          }}
        />
      </section>
    </div>
  );
}
