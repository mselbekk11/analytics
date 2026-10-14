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
