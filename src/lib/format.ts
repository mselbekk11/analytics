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

/** A change as a signed percentage with one decimal: 0.504 -> "+50.4%", -0.031 -> "-3.1%", 0 -> "0%". */
export function formatChange(change: number): string {
  const pct = Math.round(change * 1000) / 10;
  if (pct === 0) return "0%";
  return `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

/** A rate from 0 to 1 for the stat tiles: two decimals below 1% ("0.80%"), one above ("41.6%"). */
export function formatRate(rate: number): string {
  const pct = rate * 100;
  return `${pct.toFixed(pct < 1 ? 2 : 1)}%`;
}

/**
 * A goal name as a tile label: words split on "_", "-", ":" and spaces, title-cased,
 * the last one pluralised unless it already ends in "s" or "ed":
 * "signup" -> "Signups", "checkout_started" -> "Checkout Started".
 */
export function goalLabel(name: string): string {
  const words = name.split(/[\s_:-]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1));
  if (words.length === 0) return name;
  const last = words[words.length - 1];
  words[words.length - 1] = plural(last);
  return words.join(" ");
}

function plural(word: string): string {
  const lower = word.toLowerCase();
  if (/(ed|s)$/.test(lower)) return word;
  if (/(x|z|ch|sh)$/.test(lower)) return `${word}es`;
  if (/[^aeiou]y$/.test(lower)) return `${word.slice(0, -1)}ies`;
  return `${word}s`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-13" -> "Oct 13", with the year when asked for. Reads the string, not a Date, so no timezone shifts. */
export function formatDate(date: string, withYear = false): string {
  const [y, m, d] = date.split("-");
  const label = `${MONTHS[Number(m) - 1]} ${Number(d)}`;
  return withYear ? `${label}, ${y}` : label;
}

/**
 * A chart point: a day ("2026-10-13" -> "Oct 13") or an hour ("2026-10-13T14:00" ->
 * "14:00", or "Oct 13, 14:00" with `full`, as the tooltip shows it).
 */
export function formatPoint(point: string, full = false): string {
  const [date, hour] = point.split("T");
  if (hour === undefined) return formatDate(date, full);
  return full ? `${formatDate(date)}, ${hour}` : hour;
}

/**
 * A custom range in words, day first: "1 Oct – 14 Oct 2026", "28 Dec 2025 – 3 Jan 2026",
 * or "14 Oct 2026" for one day. The year shows once unless the range crosses one.
 */
export function formatRangeLabel({ from, to }: { from: string; to: string }): string {
  const day = (date: string, withYear: boolean) => {
    const [y, m, d] = date.split("-");
    return `${Number(d)} ${MONTHS[Number(m) - 1]}${withYear ? ` ${y}` : ""}`;
  };
  if (from === to) return day(to, true);
  return `${day(from, from.slice(0, 4) !== to.slice(0, 4))} – ${day(to, true)}`;
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

const dateTimeFormats = new Map<string, Intl.DateTimeFormat>();

function dateTimeFormat(timeZone: string, withDate: boolean): Intl.DateTimeFormat {
  const key = `${timeZone}${withDate ? ":date" : ""}`;
  let f = dateTimeFormats.get(key);
  if (f === undefined) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      ...(withDate ? { month: "short", day: "numeric", year: "numeric" } : {}),
      hour: "numeric",
      minute: "2-digit",
    });
    dateTimeFormats.set(key, f);
  }
  return f;
}

/** A timestamp in the site's timezone: "Oct 27, 2026, 10:04 AM". */
export function formatDateTime(ts: number, timeZone: string): string {
  return dateTimeFormat(timeZone, true).format(ts);
}

/** A timestamp's time of day in the site's timezone: "10:04 AM". */
export function formatTime(ts: number, timeZone: string): string {
  return dateTimeFormat(timeZone, false).format(ts);
}

/** A longer span, two units at most: "<1m", "12m", "2h 5m", "3d 4h". */
export function formatElapsed(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / 60_000);
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return minutes % 60 ? `${hours}h ${minutes % 60}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return hours % 24 ? `${days}d ${hours % 24}h` : `${days}d`;
}
