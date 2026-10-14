import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export type Dim = "page" | "referrer" | "device" | "browser" | "country";

type StatsDelta = {
  pageviews?: number;
  visitors?: number;
  durationSumMs?: number;
  durationCount?: number;
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
    });
    return;
  }
  await ctx.db.patch("dailyStats", row._id, {
    pageviews: row.pageviews + (delta.pageviews ?? 0),
    visitors: row.visitors + (delta.visitors ?? 0),
    durationSumMs: row.durationSumMs + (delta.durationSumMs ?? 0),
    durationCount: row.durationCount + (delta.durationCount ?? 0),
  });
}

export async function bumpDailyDim(
  ctx: MutationCtx,
  siteId: Id<"sites">,
  date: string,
  dim: Dim,
  key: string,
  unique: boolean,
): Promise<void> {
  const row = await ctx.db
    .query("dailyDims")
    .withIndex("by_site_date_dim_key", (q) =>
      q.eq("siteId", siteId).eq("date", date).eq("dim", dim).eq("key", key),
    )
    .unique();
  const visitors = unique ? 1 : 0;
  if (row === null) {
    await ctx.db.insert("dailyDims", { siteId, date, dim, key, pageviews: 1, visitors });
    return;
  }
  await ctx.db.patch("dailyDims", row._id, {
    pageviews: row.pageviews + 1,
    visitors: row.visitors + visitors,
  });
}
