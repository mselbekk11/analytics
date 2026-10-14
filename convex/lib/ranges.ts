// Date-range maths on "YYYY-MM-DD" strings. Shared by the stats queries and the
// dashboard's range picker, so keep it dependency-free. Dates are calendar days in
// the site's timezone (see localDate), so the arithmetic here is plain UTC day maths.

export const PRESETS = ["7d", "30d", "90d"] as const;
export type Preset = (typeof PRESETS)[number];
export const DEFAULT_PRESET: Preset = "30d";
export const MAX_RANGE_DAYS = 365;

export type DateRange = { from: string; to: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export function isDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  return new Date(d.getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

/** Number of days from `from` to `to`, both included. */
export function rangeDays({ from, to }: DateRange): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(ms / DAY_MS) + 1;
}

/** Every date in the range, in order. */
export function eachDate(range: DateRange): string[] {
  const n = rangeDays(range);
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(addDays(range.from, i));
  return out;
}

/** The range of equal length that ends the day before `range` starts. */
export function previousRange(range: DateRange): DateRange {
  const n = rangeDays(range);
  return { from: addDays(range.from, -n), to: addDays(range.from, -1) };
}

/** The range of equal length that starts the day after `range` ends. */
export function nextRange(range: DateRange): DateRange {
  const n = rangeDays(range);
  return { from: addDays(range.to, 1), to: addDays(range.to, n) };
}

export function isValidRange(range: DateRange): boolean {
  if (!isDate(range.from) || !isDate(range.to) || range.from > range.to) return false;
  return rangeDays(range) <= MAX_RANGE_DAYS;
}

/** "30d" ending today (today included) -> { from: today - 29, to: today }. */
export function presetRange(preset: Preset, today: string): DateRange {
  const n = Number.parseInt(preset, 10);
  return { from: addDays(today, -(n - 1)), to: today };
}

/**
 * Parses the `?range=` URL value: a preset ("30d") or a custom span
 * ("2026-09-01_2026-09-30"). Anything else, including a span longer than
 * MAX_RANGE_DAYS, falls back to the default preset.
 */
export function parseRangeParam(
  param: string | null,
  today: string,
): { range: DateRange; preset: Preset | null } {
  if (param !== null && (PRESETS as readonly string[]).includes(param)) {
    const preset = param as Preset;
    return { range: presetRange(preset, today), preset };
  }
  if (param !== null) {
    const [from, to] = param.split("_");
    if (from !== undefined && to !== undefined && isValidRange({ from, to })) {
      return { range: { from, to }, preset: null };
    }
  }
  return { range: presetRange(DEFAULT_PRESET, today), preset: DEFAULT_PRESET };
}

export function formatRangeParam({ from, to }: DateRange): string {
  return `${from}_${to}`;
}

/**
 * Change from `previous` to `current` as a fraction (0.25 = +25%).
 * Null when there is nothing to compare against.
 */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return (current - previous) / previous;
}
