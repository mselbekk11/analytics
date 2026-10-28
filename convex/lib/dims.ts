import { v, type Infer } from "convex/values";

// Every dimension a dailyDims row can hold. Pageview dims (page, referrer, device,
// browser, country, and from 5c os, region and city) count each pageview and its visitor. Session dims (5b on) count
// sessions, and visitors once per visitor, key and day; their `pageviews` stays 0. Event dims (goal and
// outbound, 5d on) count `events` (completions or clicks) and visitors once per visitor, key and day.
export const dimValidator = v.union(
  v.literal("page"),
  v.literal("referrer"),
  v.literal("device"),
  v.literal("browser"),
  v.literal("country"),
  v.literal("source"),
  v.literal("channel"),
  v.literal("utm_source"),
  v.literal("utm_medium"),
  v.literal("utm_campaign"),
  v.literal("utm_term"),
  v.literal("utm_content"),
  v.literal("ref"),
  v.literal("entry"),
  v.literal("exit"),
  v.literal("os"),
  v.literal("region"),
  v.literal("city"),
  v.literal("goal"),
  v.literal("outbound"),
);

export type Dim = Infer<typeof dimValidator>;

// A source list can be limited to one channel whose sources all have names in the
// classifier (sources.KNOWN_SOURCES), so the rollups can tell them apart by key. Only AI
// for now: Referral and the rest also take unknown hostnames and tags.
export const listChannelValidator = v.literal("AI");

export type ListChannel = Infer<typeof listChannelValidator>;

/** The key of a list in the filtered view's `breakdowns`: the dim, or "source:AI". */
export function breakdownKey(dim: Dim, channel?: ListChannel): string {
  return channel === undefined ? dim : `${dim}:${channel}`;
}

/**
 * Which count a list ranks and shows: pageviews for pages, sessions for entry and exit
 * pages, events for goals and outbound links, visitors otherwise.
 */
export function dimMetric(dim: Dim): "pageviews" | "sessions" | "visitors" | "events" {
  if (dim === "page") return "pageviews";
  if (dim === "entry" || dim === "exit") return "sessions";
  if (dim === "goal" || dim === "outbound") return "events";
  return "visitors";
}

/** One key's counts in a list, summed over the range. */
export type DimEntry = {
  key: string;
  pageviews: number;
  visitors: number;
  sessions: number;
  events: number;
  revenueMinor: number;
};

export const DIM_COUNTS = ["pageviews", "visitors", "sessions", "events", "revenueMinor"] as const;

/**
 * A list's rows, largest first by the dim's metric and then the other counts. Keys with
 * none of that metric are left out, unless they have revenue ("Unattributed" has no visitors).
 */
export function rankEntries(dim: Dim, entries: DimEntry[]): DimEntry[] {
  const metric = dimMetric(dim);
  const order = [metric, ...DIM_COUNTS.filter((m) => m !== metric)];
  return entries
    .filter((e) => e[metric] > 0 || e.revenueMinor !== 0)
    .sort((a, b) => {
      for (const m of order) if (a[m] !== b[m]) return b[m] - a[m];
      return a.key.localeCompare(b.key);
    });
}
