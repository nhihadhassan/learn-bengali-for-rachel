/**
 * Calendar-day keys for streaks.
 *
 * Streaks must follow the *learner's* day, not UTC. The previous implementation
 * used `toISOString().slice(0, 10)`, which rolls over at UTC midnight — for a
 * learner in, say, UTC-5 that means the "learning day" flips at 7pm local, and
 * an evening session gets filed under tomorrow. These helpers use the local
 * calendar instead.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** `YYYY-MM-DD` for a date, in the learner's local timezone. */
export function localDayKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The local day key `offset` days away from `date` (negative = earlier). */
export function shiftedDayKey(offset: number, date: Date = new Date()): string {
  const shifted = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  shifted.setDate(shifted.getDate() + offset);
  return localDayKey(shifted);
}

/** Yesterday's local day key. */
export function previousDayKey(date: Date = new Date()): string {
  return shiftedDayKey(-1, date);
}

/**
 * How a stored `lastPracticeDate` relates to today.
 *
 * `"future"` exists because of the UTC→local migration: a learner who
 * practiced in the evening in a negative-offset timezone may have a stored key
 * one day *ahead* of their local today. Treating that as "already practiced
 * today" keeps their streak intact instead of resetting it to 1.
 */
export type DayRelation = "none" | "today" | "yesterday" | "future" | "older";

export function relateDayKey(
  storedKey: string | null | undefined,
  today = localDayKey(),
): DayRelation {
  if (!storedKey) {
    return "none";
  }

  if (storedKey === today) {
    return "today";
  }

  if (storedKey > today) {
    return "future";
  }

  const yesterday = shiftedDayKey(-1, parseDayKey(today));
  return storedKey === yesterday ? "yesterday" : "older";
}

/** Parse a `YYYY-MM-DD` key back into a local Date at midnight. */
export function parseDayKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

/**
 * Whole local days between two day keys (`later - earlier`). Used for activity
 * charts, where DST-safe day arithmetic matters more than exact hours.
 */
export function daysBetweenKeys(earlier: string, later: string): number {
  const from = parseDayKey(earlier).getTime();
  const to = parseDayKey(later).getTime();
  return Math.round((to - from) / DAY_MS);
}
