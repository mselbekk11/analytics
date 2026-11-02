// Excluded-path globs (design v4 Phase 13). Pure, so ingest, the sites mutations and the
// Settings form share one definition of a valid pattern and of a match.

export const MAX_EXCLUDED_PATHS = 50;
export const MAX_PATTERN_LENGTH = 200;

/**
 * A pattern as stored: starts with "/", no trailing slash (except "/" itself), runs of
 * "*" collapsed to one. Returns the error to show instead when the pattern is invalid.
 */
export function parseExcludedPath(raw: string): { pattern: string } | { error: string } {
  let p = raw.trim();
  if (!p) return { error: "Enter a path like /admin/*" };
  if (!p.startsWith("/")) return { error: "Patterns start with /, like /admin/*" };
  if (/\s/.test(p)) return { error: "Patterns can't contain spaces" };
  if (/[?#]/.test(p)) return { error: "Patterns match the path only, without ? or #" };
  if (p.length > MAX_PATTERN_LENGTH) return { error: `Patterns are at most ${MAX_PATTERN_LENGTH} characters` };
  p = p.replace(/\*+/g, "*").replace(/\/{2,}/g, "/");
  if (p.length > 1) p = p.replace(/\/+$/, "") || "/";
  return { pattern: p };
}

/**
 * Whether a path (as /api/collect stores it: no query, no trailing slash) matches one
 * pattern. "*" matches any characters, slashes included, so `/admin/*` covers every page
 * under /admin, and a trailing "/*" also matches the bare prefix (`/admin` itself). A
 * pattern without "*" matches that path exactly. Matching is case-sensitive, as paths are.
 */
export function matchesPattern(path: string, pattern: string): boolean {
  const p = path.length > 1 ? path.replace(/\/+$/, "") || "/" : path;
  if (!pattern.includes("*")) return p === pattern;
  const tail = pattern.endsWith("/*");
  const body = tail ? pattern.slice(0, -2) : pattern;
  const source = body
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${source}${tail ? "(?:/.*)?" : ""}$`).test(p);
}

/** Whether a path matches any of a site's excluded patterns. */
export function isExcludedPath(path: string, patterns: readonly string[] | undefined): boolean {
  return patterns !== undefined && patterns.some((pattern) => matchesPattern(path, pattern));
}

// Path grouping (design v4 Phase 14). Ingest rewrites each pageview's path with the
// site's settings before storing it, and the Settings preview runs the same function.

export const DEFAULT_PLACEHOLDER = ":id";
export const MAX_NAMED_PATTERNS = 50;
const MAX_PLACEHOLDER_LENGTH = 40;
const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

export type PathGrouping = { enabled: boolean; placeholder: string; patterns: string[] };

/** A placeholder as stored: ":" and a name. A missing ":" is added; empty means `:id`. */
export function parsePlaceholder(raw: string): { placeholder: string } | { error: string } {
  const p = raw.trim();
  if (!p) return { placeholder: DEFAULT_PLACEHOLDER };
  const name = p.startsWith(":") ? p.slice(1) : p;
  if (!NAME.test(name)) {
    return { error: "Placeholders are a name of letters, digits and _, like :id" };
  }
  if (name.length > MAX_PLACEHOLDER_LENGTH) {
    return { error: `Placeholders are at most ${MAX_PLACEHOLDER_LENGTH} characters` };
  }
  return { placeholder: `:${name}` };
}

/**
 * A named pattern as stored, like `/dashboard/:site_id/sites`: literal segments and at
 * least one `:name` segment, no trailing slash. Returns the error to show instead.
 */
export function parseNamedPattern(raw: string): { pattern: string } | { error: string } {
  let p = raw.trim();
  if (!p) return { error: "Enter a pattern like /dashboard/:site_id/sites" };
  if (!p.startsWith("/")) return { error: "Patterns start with /, like /orders/:order_id" };
  if (/\s/.test(p)) return { error: "Patterns can't contain spaces" };
  if (/[?#*]/.test(p)) return { error: "Patterns can't contain ?, # or *" };
  if (p.length > MAX_PATTERN_LENGTH) return { error: `Patterns are at most ${MAX_PATTERN_LENGTH} characters` };
  p = p.replace(/\/{2,}/g, "/");
  if (p.length > 1) p = p.replace(/\/+$/, "") || "/";
  const params = p.split("/").filter((s) => s.startsWith(":"));
  if (params.length === 0) return { error: "Use :name for the dynamic part, like /orders/:order_id" };
  if (params.some((s) => !NAME.test(s.slice(1)))) {
    return { error: "Names after : are letters, digits and _, like :site_id" };
  }
  return { pattern: p };
}

/**
 * Whether a path matches a named pattern: the same number of segments, literal ones
 * equal and each `:name` one any non-empty segment.
 */
export function matchesNamedPattern(path: string, pattern: string): boolean {
  const segs = path.split("/");
  const parts = pattern.split("/");
  return (
    segs.length === parts.length &&
    parts.every((part, i) => (part.startsWith(":") ? segs[i] !== "" : part === segs[i]))
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Whether a segment looks like a record id: a UUID, 6 or more digits, 16 or more hex
 * characters, or 16 or more letters and digits with at least one of each (base64-ish
 * ids). Segments with "-" or "_" other than UUIDs are slugs, so they are never grouped.
 */
export function isIdSegment(segment: string): boolean {
  if (UUID.test(segment)) return true;
  if (/^\d{6,}$/.test(segment)) return true;
  if (/^[0-9a-f]{16,}$/i.test(segment)) return true;
  return /^[A-Za-z0-9]{16,}$/.test(segment) && /\d/.test(segment) && /[A-Za-z]/.test(segment);
}

/**
 * The path ingest stores. With grouping on, the first named pattern that matches wins;
 * otherwise each id-like segment becomes the placeholder. Off (or missing), the path is
 * unchanged.
 */
export function groupPath(path: string, grouping: PathGrouping | undefined): string {
  if (!grouping?.enabled) return path;
  const named = grouping.patterns.find((pattern) => matchesNamedPattern(path, pattern));
  if (named !== undefined) return named;
  return path
    .split("/")
    .map((s) => (isIdSegment(s) ? grouping.placeholder : s))
    .join("/");
}
