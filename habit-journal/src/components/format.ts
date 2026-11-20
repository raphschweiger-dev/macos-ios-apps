import type { PairResult } from '../stats/analyze';

export const fmt = (x: number, d = 2) => (isFinite(x) ? x.toFixed(d) : '—');
export const fmtP = (p: number) => (!isFinite(p) ? '—' : p < 0.001 ? '<0.001' : p.toFixed(3));
export const lagPhrase = (lag: number) =>
  lag === 0 ? 'the same day' : lag === 1 ? 'the next day' : `${lag} days later`;
export const lagShort = (lag: number) => (lag === 0 ? 'same day' : `+${lag}d`);

export type Evidence = 'strong' | 'likely' | 'trend' | 'none' | 'na';
export function evidence(r: PairResult): Evidence {
  if (r.status !== 'ok' || !isFinite(r.p)) return 'na';
  if (r.q < 0.05) return 'strong';
  if (r.q < 0.1) return 'likely';
  if (r.p < 0.05) return 'trend';
  return 'none';
}
export const evidenceLabel: Record<Evidence, string> = {
  strong: 'Strong evidence',
  likely: 'Likely',
  trend: 'Weak, may be chance',
  none: 'No clear link',
  na: 'Not enough data',
};
