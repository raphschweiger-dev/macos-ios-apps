export interface Habit { id: string; name: string; color: string; archived?: boolean }
export interface Outcome { id: string; name: string; higherIsBetter: boolean; archived?: boolean }
export interface JournalEntry {
  date: string; // YYYY-MM-DD
  habits: Record<string, boolean>;
  outcomes: Record<string, number | null>;
  note: string;
}
export interface AppData {
  version: 1;
  habits: Habit[];
  outcomes: Outcome[];
  entries: Record<string, JournalEntry>; // keyed by date
}
