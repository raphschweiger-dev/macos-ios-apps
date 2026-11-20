import { describe, it, expect } from 'vitest';
import { canonical, merge, migrate } from '../../sync/merge';
import { fromBase64Utf8, toBase64Utf8 } from '../../sync/github';
import type { AppData } from '../../types';

const base = (): AppData => ({
  version: 2,
  habits: [{ id: 'h1', name: 'Cleanser', color: '#000', updatedAt: 10 }],
  outcomes: [{ id: 'o1', name: 'Redness', higherIsBetter: false, updatedAt: 10 }],
  entries: { '2026-01-01': { date: '2026-01-01', habits: { h1: true }, outcomes: { o1: 5 }, note: 'a', updatedAt: 10 } },
  deleted: {},
});

describe('merge', () => {
  it('newer edit wins, from either side', () => {
    const a = base(), b = base();
    a.entries['2026-01-01'] = { ...a.entries['2026-01-01'], outcomes: { o1: 3 }, updatedAt: 20 };
    b.habits[0] = { ...b.habits[0], name: 'Gentle cleanser', updatedAt: 30 };
    for (const m of [merge(a, b), merge(b, a)]) {
      expect(m.entries['2026-01-01'].outcomes.o1).toBe(3);
      expect(m.habits[0].name).toBe('Gentle cleanser');
    }
  });

  it('unions entries from both devices', () => {
    const a = base(), b = base();
    a.entries['2026-01-02'] = { date: '2026-01-02', habits: {}, outcomes: { o1: 1 }, note: '', updatedAt: 11 };
    b.entries['2026-01-03'] = { date: '2026-01-03', habits: {}, outcomes: { o1: 2 }, note: '', updatedAt: 12 };
    expect(Object.keys(merge(a, b).entries).sort()).toEqual(['2026-01-01', '2026-01-02', '2026-01-03']);
  });

  it('a deletion beats an older edit; an edit after the deletion revives', () => {
    const a = base(), b = base();
    a.habits = []; a.deleted = { h1: 50 };
    expect(merge(a, b).habits).toEqual([]);
    expect(merge(b, a).habits).toEqual([]);
    b.habits[0] = { ...b.habits[0], updatedAt: 60 };
    expect(merge(a, b).habits.map((h) => h.id)).toEqual(['h1']);
  });

  it('entry tombstones (erase all) propagate', () => {
    const a = base(), b = base();
    a.entries = {}; a.deleted = { 'entry:2026-01-01': 99 };
    expect(merge(b, a).entries).toEqual({});
  });

  it('is idempotent and commutative', () => {
    const a = base(), b = base();
    a.entries['2026-01-01'] = { ...a.entries['2026-01-01'], note: 'x', updatedAt: 20 };
    b.habits.push({ id: 'h2', name: 'Moisturizer', color: '#0f0', updatedAt: 5 });
    b.deleted = { o9: 3 };
    const ab = merge(a, b);
    expect(canonical(merge(ab, b))).toBe(canonical(ab));
    expect(canonical(merge(ab, ab))).toBe(canonical(ab));
    expect(canonical(merge(b, a))).toBe(canonical(ab));
  });

  it('identical timestamps resolve the same on both devices', () => {
    const a = base(), b = base();
    a.entries['2026-01-01'] = { ...a.entries['2026-01-01'], note: 'from mac', updatedAt: 20 };
    b.entries['2026-01-01'] = { ...b.entries['2026-01-01'], note: 'from iphone', updatedAt: 20 };
    expect(merge(a, b).entries['2026-01-01'].note).toBe(merge(b, a).entries['2026-01-01'].note);
  });
});

describe('migrate', () => {
  it('upgrades v1 data', () => {
    const v1 = { version: 1, habits: [{ id: 'h', name: 'H', color: '#000' }], outcomes: [], entries: { d: { date: 'd', habits: {}, outcomes: {}, note: '' } } };
    const m = migrate(v1)!;
    expect(m.version).toBe(2);
    expect(m.habits[0].updatedAt).toBe(0);
    expect(m.entries.d.updatedAt).toBe(0);
    expect(m.deleted).toEqual({});
  });
  it('rejects junk', () => {
    expect(migrate({ foo: 1 })).toBeNull();
    expect(migrate(null)).toBeNull();
  });
});

describe('base64 utf-8', () => {
  it('round-trips umlauts and emoji', () => {
    const s = 'Rötung schlimmer 😬 nach Käse';
    expect(fromBase64Utf8(toBase64Utf8(s))).toBe(s);
  });
});
