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
