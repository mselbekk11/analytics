import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { Dim } from "./dims";
import { bumpSessionDim } from "./rollups";
import { classify, type Channel } from "./sources";

const HOUR_MS = 60 * 60 * 1000;

/** Campaign tags from the landing page's URL (utm_* and ?ref= or ?via=), each at most 100 characters. */
export const campaignValidator = v.object({
  utmSource: v.optional(v.string()),
  utmMedium: v.optional(v.string()),
  utmCampaign: v.optional(v.string()),
  utmTerm: v.optional(v.string()),
  utmContent: v.optional(v.string()),
  refTag: v.optional(v.string()),
});

export type Campaign = Infer<typeof campaignValidator>;

type Attributed = Campaign & { source: string; channel: string };

const TAG_DIMS: [keyof Campaign, Dim][] = [
  ["utmSource", "utm_source"],
  ["utmMedium", "utm_medium"],
  ["utmCampaign", "utm_campaign"],
  ["utmTerm", "utm_term"],
  ["utmContent", "utm_content"],
  ["refTag", "ref"],
];

/** The source, channel and tag dims a visit counts under, as [dim, key] pairs. */
export function sourceDims(a: Attributed): [Dim, string][] {
  const dims: [Dim, string][] = [
    ["source", a.source],
    ["channel", a.channel],
  ];
  for (const [field, dim] of TAG_DIMS) {
    const value = a[field];
    if (value) dims.push([dim, value]);
  }
  return dims;
}

/** A session's source and channel; sessions from before 5b are classified from their referrer. */
export function sessionSource(s: Doc<"sessions">): { source: string; channel: string } {
  if (s.source !== undefined && s.channel !== undefined) {
    return { source: s.source, channel: s.channel };
  }
  return classify(s);
}

export function attribute(
  referrer: string,
  campaign: Campaign | undefined,
): Campaign & { source: string; channel: Channel } {
  return { ...campaign, ...classify({ referrer, ...campaign }) };
}

/**
 * Counts a session on its source dims, entry page and exit page, on the day it
 * started. A visitor counts once per key and day, so a second session from the same
 * source that day adds a session but no visitor.
 */
export async function countSession(ctx: MutationCtx, session: Doc<"sessions">): Promise<void> {
  const earlier = (
    await ctx.db
      .query("sessions")
      .withIndex("by_site_visitor_started", (q) =>
        q
          .eq("siteId", session.siteId)
          .eq("visitorId", session.visitorId)
          .gte("startedAt", session.startedAt - 48 * HOUR_MS)
          .lt("startedAt", session.startedAt),
      )
      .take(100)
  ).filter((e) => e.date === session.date);
  const seen = new Set(
    earlier.flatMap((e) => sourceDims({ ...e, ...sessionSource(e) }).map(([d, k]) => `${d}\u0000${k}`)),
  );

  for (const [dim, key] of sourceDims({ ...session, ...sessionSource(session) })) {
    const visitors = seen.has(`${dim}\u0000${key}`) ? 0 : 1;
    await bumpSessionDim(ctx, session.siteId, session.date, dim, key, { sessions: 1, visitors });
  }
  await bumpSessionDim(ctx, session.siteId, session.date, "entry", session.entryPath, { sessions: 1 });
  await bumpSessionDim(ctx, session.siteId, session.date, "exit", session.exitPath, { sessions: 1 });
}

/** A unique visit without ids (cookieless or an old script): one visitor on its source dims. */
export async function countCookielessVisit(
  ctx: MutationCtx,
  siteId: Id<"sites">,
  date: string,
  a: Attributed,
): Promise<void> {
  for (const [dim, key] of sourceDims(a)) {
    await bumpSessionDim(ctx, siteId, date, dim, key, { visitors: 1 });
  }
}
