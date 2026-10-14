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
};

export type DurationPayload = {
  t: "dur";
  site: string;
  pvId: string;
  ms: number;
};

export type Payload = PageviewPayload | DurationPayload;

export const MAX_BODY_BYTES = 2048;
export const MAX_DURATION_MS = 30 * 60 * 1000;

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
    return {
      t: "pv",
      site: d.site,
      host: d.host,
      path: d.path,
      ref: d.ref,
      unique: d.unique,
      pvId: d.pvId,
      sw,
    };
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
