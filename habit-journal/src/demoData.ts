import type { AppData, JournalEntry } from './types';
import { addDays, today } from './dates';

// Seeded PRNG (mulberry32) so demo data is reproducible
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(r: () => number) {
  return Math.sqrt(-2 * Math.log(r() || 1e-12)) * Math.cos(2 * Math.PI * r());
}
const clamp = (v: number) => Math.max(0, Math.min(10, Math.round(v)));

/**
 * 90 days of synthetic data with planted effects:
 *  - Moisturizer lowers NEXT-day redness by ~2 points
 *  - Sleep 8h+ raises same-day energy by ~2 points
 *  - Cleanser and Coffee are pure noise (controls)
 */
export function makeDemoData(days = 90, seed = 42, end = today()): AppData {
  const r = rng(seed);
  const habits = [
    { id: 'h-cleanser', name: 'Cleanser', color: '#5AC8FA' },
    { id: 'h-moist', name: 'Moisturizer', color: '#34C759' },
    { id: 'h-sleep', name: 'Slept 8h+', color: '#AF52DE' },
    { id: 'h-coffee', name: 'Coffee', color: '#FF9500' },
  ];
  const outcomes = [
    { id: 'o-redness', name: 'Redness', higherIsBetter: false },
    { id: 'o-energy', name: 'Energy', higherIsBetter: true },
  ];
  const start = addDays(end, -(days - 1));
  const entries: Record<string, JournalEntry> = {};
  let prevMoist = false;
  for (let i = 0; i < days; i++) {
    const date = addDays(start, i);
    const h = {
      'h-cleanser': r() < 0.6,
      'h-moist': r() < 0.5,
      'h-sleep': r() < 0.45,
      'h-coffee': r() < 0.55,
    };
    const redness = clamp(5 - (prevMoist ? 2 : 0) + gauss(r) * 1.4);
    const energy = clamp(5 + (h['h-sleep'] ? 2 : 0) + gauss(r) * 1.5);
    entries[date] = { date, habits: h, outcomes: { 'o-redness': redness, 'o-energy': energy }, note: '' };
    prevMoist = h['h-moist'];
  }
  return { version: 1, habits, outcomes, entries };
}
