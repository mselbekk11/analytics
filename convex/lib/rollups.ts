import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { Dim } from "./dims";

type StatsDelta = {
  pageviews?: number;
  visitors?: number;
  durationSumMs?: number;
  durationCount?: number;
  sessions?: number;
  bounces?: number;
  sessionEngagedMs?: number;
};

export async function bumpDailyStats(
  ctx: MutationCtx,
  siteId: Id<"sites">,
  date: string,
  delta: StatsDelta,
): Promise<void> {
  const row = await ctx.db
    .query("dailyStats")
    .withIndex("by_site_date", (q) => q.eq("siteId", siteId).eq("date", date))
    .unique();
  if (row === null) {
    await ctx.db.insert("dailyStats", {
      siteId,
      date,
      pageviews: delta.pageviews ?? 0,
      visitors: delta.visitors ?? 0,
      durationSumMs: delta.durationSumMs ?? 0,
      durationCount: delta.durationCount ?? 0,
      sessions: delta.sessions ?? 0,
      bounces: delta.bounces ?? 0,
      sessionEngagedMs: delta.sessionEngagedMs ?? 0,
    });
    return;
  }
  await ctx.db.patch("dailyStats", row._id, {
    pageviews: row.pageviews + (delta.pageviews ?? 0),
    visitors: row.visitors + (delta.visitors ?? 0),
    durationSumMs: row.durationSumMs + (delta.durationSumMs ?? 0),
    durationCount: row.durationCount + (delta.durationCount ?? 0),
    sessions: (row.sessions ?? 0) + (delta.sessions ?? 0),
    bounces: (row.bounces ?? 0) + (delta.bounces ?? 0),
    sessionEngagedMs: (row.sessionEngagedMs ?? 0) + (delta.sessionEngagedMs ?? 0),
  });
}

export async function bumpDailyDim(
  ctx: MutationCtx,
  siteId: Id<"sites">,
  date: string,
  dim: Dim,
  key: string,
  countsVisitor: boolean, // first hit of the visitor that day (an SA unique visit without cookies)
): Promise<void> {
  const row = await ctx.db
    .query("dailyDims")
    .withIndex("by_site_date_dim_key", (q) =>
      q.eq("siteId", siteId).eq("date", date).eq("dim", dim).eq("key", key),
    )
    .unique();
  const visitors = countsVisitor ? 1 : 0;
  if (row === null) {
    await ctx.db.insert("dailyDims", { siteId, date, dim, key, pageviews: 1, visitors });
    return;
  }
  await ctx.db.patch("dailyDims", row._id, {
    pageviews: row.pageviews + 1,
    visitors: row.visitors + visitors,
  });
}

/**
 * Adds to a session dim (source, channel, UTM, ref, entry, exit). These count
 * sessions and visitors only; their `pageviews` stays 0.
 */
export async function bumpSessionDim(
  ctx: MutationCtx,
  siteId: Id<"sites">,
  date: string,
  dim: Dim,
  key: string,
  delta: { sessions?: number; visitors?: number },
): Promise<void> {
  const row = await ctx.db
    .query("dailyDims")
    .withIndex("by_site_date_dim_key", (q) =>
      q.eq("siteId", siteId).eq("date", date).eq("dim", dim).eq("key", key),
    )
    .unique();
  if (row === null) {
    await ctx.db.insert("dailyDims", {
      siteId,
      date,
      dim,
      key,
      pageviews: 0,
      visitors: delta.visitors ?? 0,
      sessions: delta.sessions ?? 0,
    });
    return;
  }
  await ctx.db.patch("dailyDims", row._id, {
    visitors: row.visitors + (delta.visitors ?? 0),
    sessions: (row.sessions ?? 0) + (delta.sessions ?? 0),
  });
}

/**
 * Adds to an event dim (goal, outbound): `events` counts completions or clicks,
 * `visitors` each visitor once per key and day.
 */
export async function bumpEventDim(
  ctx: MutationCtx,
  siteId: Id<"sites">,
  date: string,
  dim: Dim,
  key: string,
  countsVisitor: boolean,
): Promise<void> {
  const row = await ctx.db
    .query("dailyDims")
    .withIndex("by_site_date_dim_key", (q) =>
      q.eq("siteId", siteId).eq("date", date).eq("dim", dim).eq("key", key),
    )
    .unique();
  const visitors = countsVisitor ? 1 : 0;
  if (row === null) {
    await ctx.db.insert("dailyDims", { siteId, date, dim, key, pageviews: 0, visitors, events: 1 });
    return;
  }
  await ctx.db.patch("dailyDims", row._id, {
    visitors: row.visitors + visitors,
    events: (row.events ?? 0) + 1,
  });
}
