// Date-range maths on "YYYY-MM-DD" strings. Shared by the stats queries and the
// dashboard's range picker, so keep it dependency-free. Dates are calendar days in
// the site's timezone (see localDate), so the arithmetic here is plain UTC day maths.

export const PRESETS = ["today", "yesterday", "24h", "7d", "30d", "90d", "6m", "12m"] as const;
export type Preset = (typeof PRESETS)[number];
export const DEFAULT_PRESET: Preset = "7d";
export const MAX_RANGE_DAYS = 365;

export type DateRange = { from: string; to: string };

/** Hour ranges chart one point per hour; everything else one point per day. */
export type Granularity = "hour" | "day";

/** Presets that end today, by length in days. 6m and 12m are fixed lengths, not calendar months. */
const PRESET_DAYS: Record<Exclude<Preset, "today" | "yesterday" | "24h">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "6m": 183,
  "12m": 365,
};

/** Custom ranges are day ranges; only today, yesterday and 24h are hourly. */
export function presetGranularity(preset: Preset | null): Granularity {
  return preset === "today" || preset === "yesterday" || preset === "24h" ? "hour" : "day";
}

/** "Last 7 days" and so on, as the dashboard names them. */
export const PRESET_LABELS: Record<Preset, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "6m": "Last 6 months",
  "12m": "Last 12 months",
};

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

/**
 * The calendar days a preset covers: "30d" ending today (today included) is
 * { from: today - 29, to: today }. Today and yesterday are one day each, and the
 * rolling 24h covers yesterday and today (its exact hours come from the client's clock).
 */
export function presetRange(preset: Preset, today: string): DateRange {
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "yesterday": {
      const yesterday = addDays(today, -1);
      return { from: yesterday, to: yesterday };
    }
    case "24h":
      return { from: addDays(today, -1), to: today };
    default:
      return { from: addDays(today, -(PRESET_DAYS[preset] - 1)), to: today };
  }
}

/**
 * Parses the `?range=` URL value: a preset ("7d", "today", "6m") or a custom span
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
