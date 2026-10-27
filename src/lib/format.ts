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

// Vercel gives regions as ISO 3166-2 codes; US states get their names, other codes show as is
const US_STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado",
  CT: "Connecticut", DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas",
  KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts",
  MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico",
  NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma",
  OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota",
  TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", PR: "Puerto Rico",
};

/** "US/CA" -> "California"; "DE/BE" -> "BE, Germany". Anything else comes back as given. */
export function regionLabel(key: string): string {
  const [country, region] = key.split("/");
  if (!region) return key;
  if (country === "US" && US_STATES[region]) return US_STATES[region];
  return `${region}, ${countryName(country)}`;
}

/** "US/CA/San Francisco" -> "San Francisco, CA"; "SG//Singapore" -> "Singapore". */
export function cityLabel(key: string): string {
  const [, region, ...rest] = key.split("/");
  if (rest.length === 0) return key;
  const city = rest.join("/");
  return region ? `${city}, ${region}` : city;
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

/**
 * Shortens a long domain in the middle, keeping its end (and so the TLD) readable,
 * as SA's site cards do: "advancedortholabsf.com" -> "advancedo…absf.com".
 */
/** An outbound link without its scheme or a bare trailing slash: "https://github.com/" -> "github.com". */
export function outboundLabel(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/^([^/]+)\/$/, "$1");
}

export function truncateMiddle(s: string, max: number): string {
  if (s.length <= max) return s;
  const keep = max - 1;
  const tail = Math.floor(keep / 2);
  return `${s.slice(0, keep - tail)}…${s.slice(s.length - tail)}`;
}

const moneyFormats = new Map<string, Intl.NumberFormat>();

function moneyFormat(currency: string, whole: boolean): Intl.NumberFormat {
  const key = `${currency}${whole ? ":whole" : ""}`;
  let f = moneyFormats.get(key);
  if (f === undefined) {
    f = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      ...(whole ? { maximumFractionDigits: 0, minimumFractionDigits: 0 } : {}),
    });
    moneyFormats.set(key, f);
  }
  return f;
}

/** Digits after the decimal point in a currency's smallest unit: 2 for USD, 0 for JPY. */
export function currencyDigits(currency: string): number {
  return moneyFormat(currency, false).resolvedOptions().maximumFractionDigits ?? 2;
}

/**
 * An amount in the smallest unit (cents, as Stripe sends it) as money:
 * (123456, "USD") -> "$1,234.56". `whole` rounds to whole units for lists ("$1,235").
 */
export function formatMoney(minor: number, currency: string, whole = false): string {
  return moneyFormat(currency, whole).format(minor / 10 ** currencyDigits(currency));
}
