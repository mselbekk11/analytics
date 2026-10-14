// Display formatting for the dashboard. Pure functions, unit-tested in format.test.ts.

const numberFormat = new Intl.NumberFormat("en-US");

export function formatNumber(n: number): string {
  return numberFormat.format(n);
}

/** 0 -> "0s", 42_000 -> "42s", 95_000 -> "1m 35s", 3_700_000 -> "1h 1m". */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 60) return `${minutes}m ${totalSeconds % 60}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/** A share from 0 to 1 as a percentage, with one decimal below 1% as SA shows it ("0.6%"). */
export function formatShare(share: number): string {
  const pct = share * 100;
  if (pct > 0 && pct < 0.05) return "<0.1%";
  if (pct < 0.95) return `${Math.round(pct * 10) / 10}%`;
  return `${Math.round(pct)}%`;
}

/** A change as a signed percentage: 0.25 -> "+25%", -0.031 -> "-3%". */
export function formatChange(change: number): string {
  const pct = Math.round(change * 100);
  return `${pct > 0 ? "+" : ""}${pct}%`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-13" -> "Oct 13", with the year when asked for. Reads the string, not a Date, so no timezone shifts. */
export function formatDate(date: string, withYear = false): string {
  const [y, m, d] = date.split("-");
  const label = `${MONTHS[Number(m) - 1]} ${Number(d)}`;
  return withYear ? `${label}, ${y}` : label;
}

let regionNames: Intl.DisplayNames | null = null;

/** "US" -> "United States". Unknown or missing codes come back as given. */
export function countryName(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return code;
  regionNames ??= new Intl.DisplayNames(["en"], { type: "region" });
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

/** "US" -> "🇺🇸", built from regional indicator symbols. Empty for anything that is not a 2-letter code. */
export function countryFlag(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return "";
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** Referrer keys are hostnames or "(direct)", which SA shows as is. */
export function referrerLabel(key: string): string {
  return key;
}

const DEVICE_LABELS: Record<string, string> = {
  mobile: "Mobile",
  tablet: "Tablet",
  desktop: "Desktop",
};

export function deviceLabel(key: string): string {
  return DEVICE_LABELS[key] ?? key;
}
