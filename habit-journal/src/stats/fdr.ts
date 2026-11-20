/** Benjamini–Hochberg adjusted p-values (q-values). NaN entries are passed through. */
export function benjaminiHochberg(pvals: number[]): number[] {
  const idx = pvals.map((p, i) => [p, i] as const).filter(([p]) => isFinite(p));
  const m = idx.length;
  const q = pvals.map(() => NaN);
  idx.sort((a, b) => a[0] - b[0]);
  let running = 1;
  for (let k = m - 1; k >= 0; k--) {
    const [p, i] = idx[k];
    running = Math.min(running, (p * m) / (k + 1));
    q[i] = running;
  }
  return q;
}
