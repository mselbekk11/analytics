import { v, type Infer } from "convex/values";
import { dimValidator, type Dim } from "./dims";

// Click-to-filter (5g). Shared by stats.filtered and the dashboard, which keeps the
// filters in the URL as `?f=channel:AI,country:US`.

export const MAX_FILTERS = 3;
// Filtered views read raw rows, so their range is shorter than the rollups' 365 days
export const MAX_FILTER_DAYS = 90;
const MAX_VALUE_LENGTH = 1000;

export const filterValidator = v.object({ dim: dimValidator, value: v.string() });
export type Filter = Infer<typeof filterValidator>;

const DIMS = new Set<string>(dimValidator.members.map((m) => m.value));

// A comma separates filters, so a comma inside a value (and the escape itself) is
// written as %2C (and %25) before the whole parameter is URL-encoded
const escapeValue = (s: string) => s.replace(/%/g, "%25").replace(/,/g, "%2C");
const unescapeValue = (s: string) => s.replace(/%2C/gi, ",").replace(/%25/g, "%");

/** Reads `?f=`: unknown dims, empty values and a repeated dim are dropped, at most MAX_FILTERS kept. */
export function parseFiltersParam(param: string | null): Filter[] {
  if (!param) return [];
  const out: Filter[] = [];
  for (const part of param.split(",")) {
    const i = part.indexOf(":");
    if (i < 1) continue;
    const dim = part.slice(0, i);
    const value = unescapeValue(part.slice(i + 1));
    if (!DIMS.has(dim) || value === "" || value.length > MAX_VALUE_LENGTH) continue;
    if (out.some((f) => f.dim === dim)) continue;
    out.push({ dim: dim as Dim, value });
    if (out.length === MAX_FILTERS) break;
  }
  return out;
}

/**
 * The `f` query parameter, URL-encoded but keeping `:`, `,` and `/` readable
 * ("channel:AI,page:/pricing"). Empty when there are no filters.
 */
export function formatFiltersParam(filters: Filter[]): string {
  const raw = filters.map((f) => `${f.dim}:${escapeValue(f.value)}`).join(",");
  return encodeURIComponent(raw).replace(/%3A/g, ":").replace(/%2C/g, ",").replace(/%2F/g, "/");
}

/**
 * Clicking a row: the same value again removes its filter, another value of a
 * filtered dim replaces it, and a new dim is added while there is room.
 */
export function toggleFilter(filters: Filter[], dim: Dim, value: string): Filter[] {
  const existing = filters.find((f) => f.dim === dim);
  if (existing?.value === value) return filters.filter((f) => f.dim !== dim);
  if (existing) return filters.map((f) => (f.dim === dim ? { dim, value } : f));
  if (filters.length >= MAX_FILTERS) return filters;
  return [...filters, { dim, value }];
}

/** Whether a row of `dim` can be clicked to filter: its dim is filtered already, or there is room. */
export function canFilter(filters: Filter[], dim: Dim): boolean {
  return filters.length < MAX_FILTERS || filters.some((f) => f.dim === dim);
}
