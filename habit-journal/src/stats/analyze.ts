import type { AppData } from '../types';
import { addDays } from '../dates';
import { pearson, correlationPValue, fisherCI, cohensD, mean } from './correlation';
import { benjaminiHochberg } from './fdr';

export const LAGS = [0, 1, 2, 3] as const;
export const MIN_N = 14;
export const MIN_GROUP = 3;

export type PairStatus = 'ok' | 'insufficient' | 'no-variation';

export interface PairResult {
  habitId: string;
  outcomeId: string;
  lag: number;
  n: number;
  nWith: number;
  nWithout: number;
  r: number;
  ci: [number, number];
  p: number;
  q: number;
  meanWith: number;
  meanWithout: number;
  diff: number; // meanWith - meanWithout
  d: number; // Cohen's d
  status: PairStatus;
}

/** Aligned samples: habit on day t, outcome on day t+lag. Only days where both were logged. */
export function alignedSamples(data: AppData, habitId: string, outcomeId: string, lag: number) {
  const x: number[] = [], y: number[] = [], dates: string[] = [];
  for (const date of Object.keys(data.entries).sort()) {
    const e = data.entries[date];
    if (!(habitId in e.habits)) continue;
    const later = data.entries[addDays(date, lag)];
    const v = later?.outcomes[outcomeId];
    if (v == null) continue;
    x.push(e.habits[habitId] ? 1 : 0);
    y.push(v);
    dates.push(date);
  }
  return { x, y, dates };
}

export function analyzePair(data: AppData, habitId: string, outcomeId: string, lag: number): PairResult {
  const { x, y } = alignedSamples(data, habitId, outcomeId, lag);
  const withH = y.filter((_, i) => x[i] === 1);
  const without = y.filter((_, i) => x[i] === 0);
  const n = x.length;
  let status: PairStatus = 'ok';
  if (n < MIN_N) status = 'insufficient';
  else if (withH.length < MIN_GROUP || without.length < MIN_GROUP) status = 'no-variation';
  const r = pearson(x, y);
  const usable = status === 'ok' && isFinite(r);
  return {
    habitId, outcomeId, lag, n,
    nWith: withH.length, nWithout: without.length,
    r: usable ? r : NaN,
    ci: usable ? fisherCI(r, n) : [NaN, NaN],
    p: usable ? correlationPValue(r, n) : NaN,
    q: NaN,
    meanWith: withH.length ? mean(withH) : NaN,
    meanWithout: without.length ? mean(without) : NaN,
    diff: withH.length && without.length ? mean(withH) - mean(without) : NaN,
    d: cohensD(withH, without),
    status,
  };
}

/** Full analysis across all active habits × outcomes × lags, with BH correction over every test performed. */
export function analyze(data: AppData, lags: readonly number[] = LAGS): PairResult[] {
  const habits = data.habits.filter((h) => !h.archived);
  const outcomes = data.outcomes.filter((o) => !o.archived);
  const results: PairResult[] = [];
  for (const h of habits) for (const o of outcomes) for (const lag of lags) results.push(analyzePair(data, h.id, o.id, lag));
  const q = benjaminiHochberg(results.map((r) => r.p));
  results.forEach((r, i) => (r.q = q[i]));
  return results;
}

/** "Good" direction score: positive = habit associated with a better outcome. */
export function benefit(r: PairResult, higherIsBetter: boolean): number {
  return higherIsBetter ? r.r : -r.r;
}

/** Phi coefficient between pairs of habits (same day); returns pairs with |phi| >= threshold. Flags confounding. */
export function habitOverlap(data: AppData, threshold = 0.4) {
  const habits = data.habits.filter((h) => !h.archived);
  const out: { a: string; b: string; r: number; n: number }[] = [];
  for (let i = 0; i < habits.length; i++) {
    for (let j = i + 1; j < habits.length; j++) {
      const a = habits[i].id, b = habits[j].id;
      const xa: number[] = [], xb: number[] = [];
      for (const e of Object.values(data.entries)) {
        if (a in e.habits && b in e.habits) { xa.push(e.habits[a] ? 1 : 0); xb.push(e.habits[b] ? 1 : 0); }
      }
      if (xa.length < MIN_N) continue;
      const r = pearson(xa, xb);
      if (isFinite(r) && Math.abs(r) >= threshold) out.push({ a, b, r, n: xa.length });
    }
  }
  return out.sort((x, y) => Math.abs(y.r) - Math.abs(x.r));
}
