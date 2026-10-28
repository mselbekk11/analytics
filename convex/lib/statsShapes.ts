import { v, type Infer } from "convex/values";

// What the dashboard's stats queries return. stats.filtered returns the same shapes,
// so the dashboard components read a filtered view exactly like the rollup view.

export const totals = v.object({
  visitors: v.number(),
  pageviews: v.number(),
  timeOnPageMs: v.union(v.null(), v.number()),
  sessions: v.number(),
  bounceRate: v.union(v.null(), v.number()), // fraction of sessions
  sessionTimeMs: v.union(v.null(), v.number()),
  revenueMinor: v.number(), // net of refunds, in the site's currency
  payments: v.number(),
  refundsMinor: v.number(),
});

export const summaryResult = v.object({
  current: totals,
  previous: totals,
  comparable: v.boolean(),
  visitorsApprox: v.boolean(),
});

export const seriesResult = v.array(
  v.object({
    date: v.string(),
    pageviews: v.number(),
    visitors: v.number(),
    revenueMinor: v.number(),
  }),
);

export const breakdownResult = v.object({
  rows: v.array(
    v.object({
      key: v.string(),
      pageviews: v.number(),
      visitors: v.number(),
      sessions: v.number(),
      events: v.number(),
      revenueMinor: v.number(),
    }),
  ),
  totalPageviews: v.number(),
  totalVisitors: v.number(),
  totalSessions: v.number(),
  totalEvents: v.number(),
  totalRevenueMinor: v.number(),
});

export const goalsResult = v.object({
  rows: v.array(v.object({ name: v.string(), completions: v.number(), visitors: v.number() })),
  visitors: v.number(),
  keyGoal: v.union(v.null(), v.string()),
});

export const conversionsResult = v.object({
  kind: v.union(v.null(), v.literal("revenue"), v.literal("goal")),
  current: v.union(v.null(), v.number()),
  previous: v.union(v.null(), v.number()),
  otherCurrencyPayments: v.number(),
});

export type Totals = Infer<typeof totals>;
export type Summary = Infer<typeof summaryResult>;
export type Series = Infer<typeof seriesResult>;
export type BreakdownResult = Infer<typeof breakdownResult>;
export type GoalsResult = Infer<typeof goalsResult>;
export type ConversionsResult = Infer<typeof conversionsResult>;
