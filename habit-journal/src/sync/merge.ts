import type { AppData, Habit, JournalEntry, Outcome } from '../types';

/** Older-format data (v1) → v2: add timestamps and tombstones. */
export function migrate(raw: unknown): AppData | null {
  const d = raw as Omit<Partial<AppData>, 'version'> & { version?: number };
  if (!d || typeof d !== 'object' || !Array.isArray(d.habits) || !Array.isArray(d.outcomes) || typeof d.entries !== 'object') return null;
  if (d.version !== 1 && d.version !== 2) return null;
  const t = (x: { updatedAt?: number }) => (typeof x.updatedAt === 'number' ? x.updatedAt : 0);
  return {
    version: 2,
    habits: d.habits.map((h) => ({ ...h, updatedAt: t(h) })),
    outcomes: d.outcomes.map((o) => ({ ...o, updatedAt: t(o) })),
    entries: Object.fromEntries(Object.entries(d.entries!).map(([k, e]) => [k, { ...e, note: e.note ?? '', updatedAt: t(e) }])),
    deleted: { ...(d.deleted ?? {}) },
  };
}

/** Newer updatedAt wins; ties broken deterministically by JSON so merge is commutative. */
function pick<T extends { updatedAt: number }>(a: T | undefined, b: T | undefined): T | undefined {
  if (!a) return b;
  if (!b) return a;
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? a : b;
  return JSON.stringify(a) >= JSON.stringify(b) ? a : b;
}

function mergeList<T extends { id: string; updatedAt: number }>(a: T[], b: T[], deleted: Record<string, number>): T[] {
  const order: string[] = [];
  const map = new Map<string, T>();
  for (const x of [...a, ...b]) {
    if (!map.has(x.id)) order.push(x.id);
    map.set(x.id, pick(map.get(x.id), x)!);
  }
  return order
    .map((id) => map.get(id)!)
    .filter((x) => !(deleted[x.id] != null && deleted[x.id] >= x.updatedAt));
}

/**
 * Merge two replicas. Per item: last-writer-wins on updatedAt.
 * A tombstone removes an item unless the item was edited after the deletion.
 * Commutative (up to list order), associative and idempotent.
 */
export function merge(local: AppData, remote: AppData): AppData {
  const deleted: Record<string, number> = { ...local.deleted };
  for (const [id, t] of Object.entries(remote.deleted)) deleted[id] = Math.max(deleted[id] ?? 0, t);

  const habits = mergeList<Habit>(local.habits, remote.habits, deleted);
  const outcomes = mergeList<Outcome>(local.outcomes, remote.outcomes, deleted);

  const entries: Record<string, JournalEntry> = {};
  for (const date of new Set([...Object.keys(local.entries), ...Object.keys(remote.entries)])) {
    const e = pick(local.entries[date], remote.entries[date])!;
    if (deleted[`entry:${date}`] != null && deleted[`entry:${date}`] >= e.updatedAt) continue;
    entries[date] = e;
  }
  return { version: 2, habits, outcomes, entries, deleted };
}

/** Canonical JSON (sorted keys) for change detection, independent of insertion order. */
export function canonical(d: AppData): string {
  const sortObj = (o: unknown): unknown => {
    if (Array.isArray(o)) return o.map(sortObj);
    if (o && typeof o === 'object') return Object.fromEntries(Object.keys(o as object).sort().map((k) => [k, sortObj((o as Record<string, unknown>)[k])]));
    return o;
  };
  const norm = { ...d, habits: [...d.habits].sort((a, b) => a.id.localeCompare(b.id)), outcomes: [...d.outcomes].sort((a, b) => a.id.localeCompare(b.id)) };
  return JSON.stringify(sortObj(norm));
}
