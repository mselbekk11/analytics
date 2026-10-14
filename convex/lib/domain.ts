// Shared by Convex functions and the /api/collect route, so keep it dependency-free.

const DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9-]{2,}$/;

/**
 * Lower-cases a user-entered domain and strips protocol, "www.", port, path and
 * trailing slash. Returns null if what is left is not a hostname.
 * "localhost" is allowed so a dev deployment can track the local test page.
 */
export function normalizeDomain(input: string): string | null {
  let d = input.trim().toLowerCase();
  d = d.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  d = d.split(/[/?#]/)[0];
  d = d.replace(/:\d+$/, "");
  d = d.replace(/\.$/, "");
  d = d.replace(/^www\./, "");
  if (d === "localhost") return d;
  if (d.length > 253 || !DOMAIN_RE.test(d)) return null;
  return d;
}

/** True when `host` is the site's domain or a subdomain of it ("www.picai.so" for "picai.so"). */
export function hostMatchesDomain(host: string, domain: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, "");
  return h === domain || h.endsWith("." + domain);
}
