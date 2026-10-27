// Pure helpers for /api/collect. Kept free of Next.js and Convex so Vitest can cover them.

export type Device = "mobile" | "tablet" | "desktop";

export type PageviewPayload = {
  t: "pv";
  site: string;
  host: string;
  path: string;
  ref: string;
  unique: boolean;
  pvId: string;
  sw?: number;
  /** _va_vid and _va_sid; both or neither */
  vid?: string;
  sid?: string;
  /** Sent by the snippet's data-cookieless mode (or when cookies are blocked) */
  nc: boolean;
  /** Campaign tags from the landing page's URL, first pageview of a page load only */
  campaign?: Campaign;
};

export type Campaign = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  refTag?: string;
};

export type PingPayload = {
  t: "ping";
  site: string;
  pvId: string;
  ms: number;
};

/** One beacon per pageview from scripts cached before Phase 5a; pings replaced it. */
export type DurationPayload = {
  t: "dur";
  site: string;
  pvId: string;
  ms: number;
};

export type Payload = PageviewPayload | PingPayload | DurationPayload;

// Room for six 100-character campaign tags, even in non-Latin scripts
export const MAX_BODY_BYTES = 4096;
export const MAX_TAG_LENGTH = 100;
export const MAX_DURATION_MS = 30 * 60 * 1000;
export const MAX_PING_MS = 70 * 1000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function str(value: unknown, max: number, min = 0): value is string {
  return typeof value === "string" && value.length >= min && value.length <= max;
}

/** Validates the beacon body. Returns null for anything malformed. */
export function parsePayload(body: string): Payload | null {
  if (body.length === 0 || new TextEncoder().encode(body).length > MAX_BODY_BYTES) {
    return null;
  }
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;
  if (!str(d.site, 253, 1) || !str(d.pvId, 64, 1)) return null;

  if (d.t === "pv") {
    if (!str(d.host, 253) || !str(d.path, 500, 1) || !str(d.ref, 1000)) return null;
    if (typeof d.unique !== "boolean") return null;
    const sw = typeof d.sw === "number" && Number.isFinite(d.sw) ? d.sw : undefined;
    const ids = d.vid !== undefined || d.sid !== undefined;
    if (ids && !(isUuid(d.vid) && isUuid(d.sid))) return null;
    const campaign = d.c === undefined ? undefined : parseCampaign(d.c);
    if (campaign === null) return null;
    return {
      t: "pv",
      site: d.site,
      host: d.host,
      path: d.path,
      ref: d.ref,
      unique: d.unique,
      pvId: d.pvId,
      sw,
      ...(ids ? { vid: d.vid as string, sid: d.sid as string } : {}),
      nc: d.nc === 1 || d.nc === true,
      ...(campaign ? { campaign } : {}),
    };
  }

  if (d.t === "ping") {
    const ms = d.ms;
    if (typeof ms !== "number" || !Number.isInteger(ms) || ms < 0 || ms > MAX_PING_MS) {
      return null;
    }
    return { t: "ping", site: d.site, pvId: d.pvId, ms };
  }

  if (d.t === "dur") {
    const ms = d.ms;
    if (typeof ms !== "number" || !Number.isInteger(ms) || ms < 0 || ms > MAX_DURATION_MS) {
      return null;
    }
    return { t: "dur", site: d.site, pvId: d.pvId, ms };
  }

  return null;
}

// The script sends URL parameter names; `via` is another spelling of `ref`
const TAG_FIELDS: [string, keyof Campaign][] = [
  ["utm_source", "utmSource"],
  ["utm_medium", "utmMedium"],
  ["utm_campaign", "utmCampaign"],
  ["utm_term", "utmTerm"],
  ["utm_content", "utmContent"],
  ["ref", "refTag"],
  ["via", "refTag"],
];

/**
 * The `c` object: known parameter names only, each a string of at most 100
 * characters. Empty values are dropped; undefined if nothing is left, null if malformed.
 */
function parseCampaign(value: unknown): Campaign | undefined | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const c = value as Record<string, unknown>;
  const known = new Set(TAG_FIELDS.map(([param]) => param));
  if (Object.keys(c).some((k) => !known.has(k))) return null;
  const campaign: Campaign = {};
  for (const [param, field] of TAG_FIELDS) {
    const tag = c[param];
    if (tag === undefined) continue;
    if (!str(tag, MAX_TAG_LENGTH)) return null;
    const trimmed = tag.trim();
    if (trimmed && campaign[field] === undefined) campaign[field] = trimmed;
  }
  return Object.keys(campaign).length > 0 ? campaign : undefined;
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

function hostnameOf(value: string): string | null {
  try {
    return new URL(value.includes("://") ? value : `https://${value}`).hostname.toLowerCase();
  } catch {
    return null;
  }
}

const stripWww = (host: string) => host.replace(/^www\./, "");

/**
 * Reduces a referrer (full URL or bare hostname) to a hostname without "www.".
 * Empty, unparseable, or the site's own host (internal navigation) become "(direct)".
 */
export function normalizeReferrer(ref: string, siteHost: string): string {
  if (!ref) return "(direct)";
  const host = hostnameOf(ref);
  if (!host) return "(direct)";
  const clean = stripWww(host);
  if (siteHost && clean === stripWww(siteHost.toLowerCase())) return "(direct)";
  return clean;
}

/** Drops query string and hash, and a trailing slash except on "/". */
export function normalizePath(path: string): string {
  let p = path.split(/[?#]/)[0] || "/";
  if (!p.startsWith("/")) p = "/" + p;
  if (p.length > 1) p = p.replace(/\/+$/, "") || "/";
  return p;
}

/** Device type from ua-parser's `device.type`, falling back to screen width. */
export function detectDevice(uaDeviceType: string | undefined, screenWidth: number | undefined): Device {
  if (uaDeviceType === "mobile" || uaDeviceType === "wearable") return "mobile";
  if (uaDeviceType === "tablet") return "tablet";
  if (uaDeviceType) return "desktop"; // console, smarttv, embedded
  if (screenWidth === undefined) return "desktop";
  if (screenWidth < 768) return "mobile";
  if (screenWidth < 1024) return "tablet";
  return "desktop";
}

/** What Vercel's geolocation() gives the route (header values, all optional). */
export type GeoHeaders = {
  country?: string;
  countryRegion?: string;
  city?: string;
  latitude?: string;
  longitude?: string;
};

export type Geo = {
  country: string;
  region?: string;
  city?: string;
  lat?: number;
  lon?: number;
};

/**
 * Country, region (ISO 3166-2 code, "CA"), city and coordinates rounded to one
 * decimal place (about 10 km), so a precise location never leaves the route.
 */
export function parseGeo(geo: GeoHeaders): Geo {
  const region = geo.countryRegion?.trim().toUpperCase();
  const city = geo.city?.trim().slice(0, 100);
  const lat = coord(geo.latitude, 90);
  const lon = coord(geo.longitude, 180);
  return {
    country: geo.country || "Unknown",
    ...(region && /^[A-Z0-9]{1,3}$/.test(region) ? { region } : {}),
    ...(city ? { city } : {}),
    ...(lat !== undefined && lon !== undefined ? { lat, lon } : {}),
  };
}

function coord(value: string | undefined, max: number): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || Math.abs(n) > max) return undefined;
  return Math.round(n * 10) / 10 || 0; // no -0
}

/** The hostname the request came from: Origin, then Referer, then the payload's own host. */
export function requestHostname(
  origin: string | null,
  referer: string | null,
  payloadHost: string | undefined,
): string {
  for (const candidate of [origin, referer]) {
    if (candidate && candidate !== "null") {
      const host = hostnameOf(candidate);
      if (host) return host;
    }
  }
  return payloadHost?.toLowerCase() ?? "";
}
