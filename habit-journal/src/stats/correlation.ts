import { twoSidedP } from './distributions';

export const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function variance(xs: number[]): number {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  return xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1);
}

export function pearson(x: number[], y: number[]): number {
  const n = x.length;
  if (n !== y.length || n < 2) return NaN;
  const mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx, dy = y[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return NaN;
  return sxy / Math.sqrt(sxx * syy);
}

/** Two-sided p-value for H0: rho = 0. */
export function correlationPValue(r: number, n: number): number {
  if (!isFinite(r) || n < 3) return NaN;
  if (Math.abs(r) >= 1) return 0;
  const df = n - 2;
  const t = r * Math.sqrt(df / (1 - r * r));
  return twoSidedP(t, df);
}

/** 95% confidence interval for r via Fisher z-transform. */
export function fisherCI(r: number, n: number, z = 1.959963984540054): [number, number] {
  if (!isFinite(r) || n < 4) return [NaN, NaN];
  const rc = Math.max(-0.999999, Math.min(0.999999, r));
  const zr = Math.atanh(rc);
  const se = 1 / Math.sqrt(n - 3);
  return [Math.tanh(zr - z * se), Math.tanh(zr + z * se)];
}

/** Cohen's d with pooled SD (group1 - group0). */
export function cohensD(g1: number[], g0: number[]): number {
  const n1 = g1.length, n0 = g0.length;
  if (n1 < 2 || n0 < 2) return NaN;
  const sp = Math.sqrt(((n1 - 1) * variance(g1) + (n0 - 1) * variance(g0)) / (n1 + n0 - 2));
  if (sp === 0) return NaN;
  return (mean(g1) - mean(g0)) / sp;
}

export function rollingMean(xs: (number | null)[], window: number): (number | null)[] {
  return xs.map((_, i) => {
    const slice = xs.slice(Math.max(0, i - window + 1), i + 1).filter((v): v is number => v != null);
    return slice.length ? mean(slice) : null;
  });
}
