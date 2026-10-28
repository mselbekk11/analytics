const formatters = new Map<string, Intl.DateTimeFormat>();

/** The calendar date ("2026-10-13") of `ts` in timezone `tz`. Day buckets and date ranges both use this. */
export function localDate(ts: number, tz: string): string {
  let f = formatters.get(tz);
  if (f === undefined) {
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    formatters.set(tz, f);
  }
  return f.format(ts);
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const HOUR_MS = 60 * 60 * 1000;
const partFormatters = new Map<string, Intl.DateTimeFormat>();

/** The local date and hour (0-23) of `ts` in timezone `tz`. */
export function localHour(ts: number, tz: string): { date: string; hour: number } {
  let f = partFormatters.get(tz);
  if (f === undefined) {
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    });
    partFormatters.set(tz, f);
  }
  const p = Object.fromEntries(f.formatToParts(ts).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}

const offsetFormatters = new Map<string, Intl.DateTimeFormat>();

/** Local minus UTC, in ms, at `ts` (offsets are whole minutes). */
function offsetMs(ts: number, tz: string): number {
  let f = offsetFormatters.get(tz);
  if (f === undefined) {
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    offsetFormatters.set(tz, f);
  }
  const p = Object.fromEntries(f.formatToParts(ts).map((x) => [x.type, x.value]));
  const wall = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
  return wall - (ts - (ts % 60_000));
}

/** The UTC timestamp of `hour`:00 on local `date` in `tz` (the next valid time across a DST gap). */
export function zonedTime(date: string, hour: number, tz: string): number {
  const wall = Date.parse(`${date}T00:00:00Z`) + hour * HOUR_MS;
  const first = wall - offsetMs(wall, tz);
  return wall - offsetMs(first, tz);
}

export type HourPeriod = "today" | "yesterday" | "24h";

/**
 * The hourly window [start, end) of a preset at `now`, in the site's timezone. Today and
 * 24h end at the end of the current local hour; Yesterday is the whole local day.
 */
export function hourWindow(period: HourPeriod, now: number, tz: string): { start: number; end: number } {
  const { date, hour } = localHour(now, tz);
  const hourEnd = zonedTime(date, hour, tz) + HOUR_MS;
  switch (period) {
    case "today":
      return { start: zonedTime(date, 0, tz), end: hourEnd };
    case "yesterday": {
      const day = new Date(Date.parse(`${date}T00:00:00Z`) - 24 * HOUR_MS).toISOString().slice(0, 10);
      return { start: zonedTime(day, 0, tz), end: zonedTime(date, 0, tz) };
    }
    case "24h":
      return { start: hourEnd - 24 * HOUR_MS, end: hourEnd };
  }
}
