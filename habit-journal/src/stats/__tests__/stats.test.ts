import { describe, it, expect } from 'vitest';
import { pearson, correlationPValue, fisherCI, cohensD } from '../correlation';
import { studentTCdf, incompleteBeta } from '../distributions';
import { benjaminiHochberg } from '../fdr';
import { alignedSamples, analyze } from '../analyze';
import { makeDemoData } from '../../demoData';
import type { AppData } from '../../types';

describe('distributions', () => {
  it('t CDF matches reference values', () => {
    expect(studentTCdf(0, 5)).toBeCloseTo(0.5, 10);
    expect(studentTCdf(2.228, 10)).toBeCloseTo(0.975, 3); // t_{0.975,10}
    expect(studentTCdf(-1.96, 1e6)).toBeCloseTo(0.025, 3);
  });
  it('incomplete beta symmetric case', () => {
    expect(incompleteBeta(0.5, 2, 2)).toBeCloseTo(0.5, 10);
  });
});

describe('correlation', () => {
  it('pearson known value', () => {
    expect(pearson([1, 2, 3, 4, 5], [2, 4, 5, 4, 5])).toBeCloseTo(0.7745967, 6);
    expect(pearson([1, 2, 3], [3, 2, 1])).toBeCloseTo(-1, 10);
  });
  it('p-value for r=0.5, n=20', () => {
    expect(correlationPValue(0.5, 20)).toBeCloseTo(0.0248, 3);
  });
  it('Fisher CI contains r and is ordered', () => {
    const [lo, hi] = fisherCI(0.5, 20);
    expect(lo).toBeCloseTo(0.0738, 3);
    expect(hi).toBeCloseTo(0.7719, 3);
  });
  it('cohens d', () => {
    expect(cohensD([2, 4, 6], [1, 3, 5])).toBeCloseTo(0.5, 10);
  });
});

describe('Benjamini-Hochberg', () => {
  it('matches hand-computed q-values', () => {
    // p sorted: .01 .02 .03 .04 .05 → p*m/k = .05 .05 .05 .05 .05
    const q = benjaminiHochberg([0.05, 0.01, 0.03, 0.02, 0.04]);
    q.forEach((v) => expect(v).toBeCloseTo(0.05, 10));
    const q2 = benjaminiHochberg([0.001, 0.5, NaN, 0.04]);
    expect(q2[0]).toBeCloseTo(0.003, 10);
    expect(q2[3]).toBeCloseTo(0.06, 10);
    expect(q2[1]).toBeCloseTo(0.5, 10);
    expect(q2[2]).toBeNaN();
  });
});

describe('lag alignment', () => {
  it('pairs habit on day t with outcome on day t+k', () => {
    const data: AppData = {
      version: 2,
      deleted: {},
      habits: [{ id: 'h', name: 'H', color: '#000', updatedAt: 0 }],
      outcomes: [{ id: 'o', name: 'O', higherIsBetter: true, updatedAt: 0 }],
      entries: {
        '2026-01-01': { date: '2026-01-01', habits: { h: true }, outcomes: { o: 1 }, note: '', updatedAt: 0 },
        '2026-01-02': { date: '2026-01-02', habits: { h: false }, outcomes: { o: 7 }, note: '', updatedAt: 0 },
        '2026-01-03': { date: '2026-01-03', habits: { h: true }, outcomes: { o: 3 }, note: '', updatedAt: 0 },
      },
    };
    const a = alignedSamples(data, 'h', 'o', 1);
    expect(a.dates).toEqual(['2026-01-01', '2026-01-02']);
    expect(a.x).toEqual([1, 0]);
    expect(a.y).toEqual([7, 3]);
  });
});

describe('demo data recovery', () => {
  const data = makeDemoData(90, 42, '2026-06-30');
  const res = analyze(data);
  const find = (h: string, o: string, lag: number) => res.find((r) => r.habitId === h && r.outcomeId === o && r.lag === lag)!;

  it('detects moisturizer → next-day redness as significant and negative', () => {
    const m = find('h-moist', 'o-redness', 1);
    expect(m.r).toBeLessThan(-0.3);
    expect(m.q).toBeLessThan(0.05);
    expect(m.diff).toBeLessThan(-1);
  });
  it('detects sleep → same-day energy', () => {
    expect(find('h-sleep', 'o-energy', 0).q).toBeLessThan(0.05);
  });
  it('planted effects are the top two findings', () => {
    const top = [...res].filter((r) => isFinite(r.q)).sort((a, b) => a.q - b.q).slice(0, 2);
    const keys = top.map((r) => `${r.habitId}|${r.outcomeId}|${r.lag}`).sort();
    expect(keys).toEqual(['h-moist|o-redness|1', 'h-sleep|o-energy|0']);
  });
  it('control habits are not significant', () => {
    for (const r of res.filter((r) => r.habitId === 'h-coffee' || r.habitId === 'h-cleanser')) {
      expect(r.q).toBeGreaterThan(0.1);
    }
  });
});

describe('habit overlap', () => {
  it('flags habits always done together, not independent ones', async () => {
    const { habitOverlap } = await import('../analyze');
    const data = makeDemoData(90, 42, '2026-06-30');
    expect(habitOverlap(data, 0.4)).toEqual([]);
    for (const e of Object.values(data.entries)) e.habits['h-cleanser'] = e.habits['h-moist'];
    const o = habitOverlap(data, 0.4);
    expect(o.length).toBe(1);
    expect(o[0].r).toBeCloseTo(1, 10);
  });
});
