export interface Habit { id: string; name: string; color: string; archived?: boolean; updatedAt: number }
export interface Outcome { id: string; name: string; higherIsBetter: boolean; archived?: boolean; updatedAt: number }
export interface JournalEntry {
  date: string; // YYYY-MM-DD
  habits: Record<string, boolean>;
  outcomes: Record<string, number | null>;
  note: string;
  updatedAt: number;
}
export interface AppData {
  version: 2;
  habits: Habit[];
  outcomes: Outcome[];
  entries: Record<string, JournalEntry>; // keyed by date
  /** Tombstones: id (habit/outcome id or entry date) → deletion time. Lets deletions sync. */
  deleted: Record<string, number>;
}
