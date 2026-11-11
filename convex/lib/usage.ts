import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

// The usage meter (launch v1 Phase 6): pageviews plus custom events (goals and outbound
// clicks; the script's track() sends goals) across all of an account's sites per UTC
// calendar month. Counted per site per UTC day on usageDays, so there is no hot
// per-account document, and nothing is ever enforced.

export type UsageDelta = { pageviews?: number; events?: number };
export type Usage = { pageviews: number; events: number; total: number };

// The same cap sites.list uses
const MAX_SITES = 500;

/** The UTC calendar date ("2026-11-01") of `ts`. */
export function utcDate(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

/** The UTC month ("2026-11") of `ts`. */
export function utcMonth(ts: number): string {
  return new Date(ts).toISOString().slice(0, 7);
}

/** The first moment of `month` ("2026-11") in UTC. */
export function monthStart(month: string): number {
  return Date.parse(`${month}-01T00:00:00Z`);
}

export function isMonth(month: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}

/** Adds to a site's usage row for a UTC day, creating it if missing. */
export async function addUsage(
  ctx: MutationCtx,
  siteId: Id<"sites">,
  date: string,
  delta: UsageDelta,
): Promise<void> {
  const row = await ctx.db
    .query("usageDays")
    .withIndex("by_site_date", (q) => q.eq("siteId", siteId).eq("date", date))
    .unique();
  if (row === null) {
    await ctx.db.insert("usageDays", {
      siteId,
      date,
      pageviews: delta.pageviews ?? 0,
      events: delta.events ?? 0,
    });
    return;
  }
  await ctx.db.patch("usageDays", row._id, {
    pageviews: row.pageviews + (delta.pageviews ?? 0),
    events: row.events + (delta.events ?? 0),
  });
}

/**
 * Counts a hit stored by ingest at `ts`. The site's first one marks `usageStartedAt`,
 * where the backfill stops, so a hit is never counted by both.
 */
export async function countUsage(
  ctx: MutationCtx,
  site: Doc<"sites">,
  ts: number,
  delta: UsageDelta,
): Promise<void> {
  if (site.usageStartedAt === undefined) {
    await ctx.db.patch("sites", site._id, { usageStartedAt: ts });
  }
  await addUsage(ctx, site._id, utcDate(ts), delta);
}

/** One site's usage in `month` ("2026-11"). */
export async function siteUsage(ctx: QueryCtx, siteId: Id<"sites">, month: string): Promise<Usage> {
  const days = await ctx.db
    .query("usageDays")
    .withIndex("by_site_date", (q) =>
      q.eq("siteId", siteId).gte("date", `${month}-01`).lte("date", `${month}-31`),
    )
    .take(31);
  let pageviews = 0;
  let events = 0;
  for (const day of days) {
    pageviews += day.pageviews;
    events += day.events;
  }
  return { pageviews, events, total: pageviews + events };
}

/** The usage of every site `ownerId` has, summed, in `month`. */
export async function ownerUsage(ctx: QueryCtx, ownerId: string, month: string): Promise<Usage> {
  const sites = await ctx.db
    .query("sites")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .take(MAX_SITES);
  const sum: Usage = { pageviews: 0, events: 0, total: 0 };
  for (const site of sites) {
    const u = await siteUsage(ctx, site._id, month);
    sum.pageviews += u.pageviews;
    sum.events += u.events;
    sum.total += u.total;
  }
  return sum;
}
