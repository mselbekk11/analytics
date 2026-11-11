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

export type DimCount = (typeof DIM_COUNTS)[number];

/** What the dashboard's cards rank and show (`?metric=`), shared by every card. */
export const CARD_METRICS = ["visitors", "pageviews", "revenue"] as const;

export type CardMetric = (typeof CARD_METRICS)[number];

// Lists the rollups count pageviews on (session and event lists keep `pageviews` at 0)
const PAGEVIEW_DIMS = new Set<Dim>(["page", "referrer", "device", "browser", "country", "os", "region", "city"]);
// Lists payments are credited to (revenue.creditDims)
const REVENUE_DIMS = new Set<Dim>([
  "source", "channel", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "ref",
  "referrer", "country", "region", "city",
]);

/**
 * The count a list ranks and shows for a card metric. A list without that count shows
 * its own (dimMetric): Pageviews on sources gives visitors, on entry and exit pages
 * sessions (one entry pageview each), on outbound links clicks; Revenue on pages,
 * devices and the like gives their pageviews or visitors. No metric: the list's own.
 */
export function listCount(dim: Dim, metric?: CardMetric): DimCount {
  if (metric === "visitors") return "visitors";
  if (metric === "pageviews" && PAGEVIEW_DIMS.has(dim)) return "pageviews";
  if (metric === "revenue" && REVENUE_DIMS.has(dim)) return "revenueMinor";
  return dimMetric(dim);
}

/**
 * The counts a list keeps: visitors, then pageviews on pageview lists, events on goals
 * and outbound links, sessions on the session lists, and revenue on the lists payments
 * are credited to (when the site has revenue). The rollups leave the others at 0, which
 * would read as "none", so the MCP server leaves them out.
 */
export function listCounts(dim: Dim, revenue: boolean): DimCount[] {
  const own: DimCount = PAGEVIEW_DIMS.has(dim) ? "pageviews" : dimMetric(dim) === "events" ? "events" : "sessions";
  const kept = new Set<DimCount>(["visitors", own]);
  if (revenue && REVENUE_DIMS.has(dim)) kept.add("revenueMinor");
  return DIM_COUNTS.filter((c) => kept.has(c));
}

function rankBy(entries: DimEntry[], count: DimCount): DimEntry[] {
  const order = [count, ...DIM_COUNTS.filter((m) => m !== count)];
  return [...entries].sort((a, b) => {
    for (const m of order) if (a[m] !== b[m]) return b[m] - a[m];
    return a.key.localeCompare(b.key);
  });
}

/**
 * A list's rows, largest first by its count for the card metric (see listCount) and then
 * the other counts. With a metric, keys with none of that count are left out. Without
 * one, keys with none of the list's own count are left out unless they have revenue
 * ("Unattributed" has no visitors).
 */
export function rankEntries(dim: Dim, entries: DimEntry[], metric?: CardMetric): DimEntry[] {
  const count = listCount(dim, metric);
  return rankBy(
    entries.filter((e) => (metric === undefined ? e[count] > 0 || e.revenueMinor !== 0 : e[count] !== 0)),
    count,
  );
}

/**
 * The rows a breakdown returns: every key in the top `limit` by any count a card can
 * rank this list by, ranked as rankEntries does without a metric. The page re-ranks
 * them with rankEntries(dim, rows, metric), so switching the metric needs no new query
 * and still sees the same top rows the whole list has.
 */
export function topEntries(dim: Dim, entries: DimEntry[], limit: number): DimEntry[] {
  const keys = new Set<string>();
  for (const metric of [undefined, ...CARD_METRICS]) {
    for (const e of rankEntries(dim, entries, metric).slice(0, limit)) keys.add(e.key);
  }
  return rankBy(
    entries.filter((e) => keys.has(e.key)),
    dimMetric(dim),
  );
}
