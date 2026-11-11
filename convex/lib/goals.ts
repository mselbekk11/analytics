import { ConvexError, v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { DimEntry } from "./dims";

// The Goals tab (launch v1 Phase 8). A goal is a custom event by name or a pageview of
// one exact path, from the site's `goals` rows. Conversions are the event's completions
// or the path's pageviews. The rate is a goal's visitors (see goalVisitors) over the
// site's visitors, summed per day on day ranges and distinct on filtered and hour
// ranges, as stats.goals and the filtered view count them for the Events card.

export const MAX_GOALS = 50;
export const MAX_GOAL_KEY = 100; // the longest event name ingest keeps
export const MAX_GOAL_NAME = 60;
// "Other events" lists at most this many names
export const MAX_OTHER_EVENTS = 100;

export const goalKindValidator = v.union(v.literal("event"), v.literal("page"));
export type GoalKind = Infer<typeof goalKindValidator>;

export const goalRow = v.object({
  id: v.id("goals"),
  kind: goalKindValidator,
  key: v.string(),
  name: v.string(),
  conversions: v.number(),
  visitors: v.number(),
  // The source of the sessions with the most conversions; null when none had a session
  // (cookieless) or there were too many rows to read
  topSource: v.union(v.null(), v.string()),
});
export type GoalRow = Infer<typeof goalRow>;

export const otherEvent = v.object({ name: v.string(), events: v.number(), visitors: v.number() });
export type OtherEvent = Infer<typeof otherEvent>;

/** A path as ingest stores it: no query or hash, a leading slash, no trailing slash. */
export function normalizeGoalPath(path: string): string {
  let p = path.trim().split(/[?#]/)[0] || "/";
  if (!p.startsWith("/")) p = "/" + p;
  if (p.length > 1) p = p.replace(/\/+$/, "") || "/";
  return p;
}

/** A new goal's key and name, cleaned up, or a ConvexError saying what is wrong. */
export function parseGoal(kind: GoalKind, key: string, name: string | undefined): { key: string; name: string } {
  const cleanKey = kind === "page" ? normalizeGoalPath(key) : key.trim();
  if (cleanKey === "") throw new ConvexError("Enter an event name");
  if (cleanKey.length > MAX_GOAL_KEY) {
    throw new ConvexError(`${kind === "page" ? "Paths" : "Event names"} are at most ${MAX_GOAL_KEY} characters`);
  }
  if (kind === "page" && /\*/.test(cleanKey)) throw new ConvexError("Use one exact path, without *");
  const cleanName = (name ?? "").trim() || cleanKey;
  if (cleanName.length > MAX_GOAL_NAME) throw new ConvexError(`Names are at most ${MAX_GOAL_NAME} characters`);
  return { key: cleanKey, name: cleanName };
}

/** Defined goals, oldest first. */
export function sortGoals(goals: Doc<"goals">[]): Doc<"goals">[] {
  return [...goals].sort((a, b) => a.createdAt - b.createdAt);
}

/** source → conversions for each goal, while reading rows. */
export class SourceTally {
  private counts = new Map<Id<"goals">, Map<string, number>>();
  add(goal: Id<"goals">, source: string) {
    const bySource = this.counts.get(goal) ?? new Map<string, number>();
    this.counts.set(goal, bySource);
    bySource.set(source, (bySource.get(source) ?? 0) + 1);
  }
  /** The source with the most conversions, ties A to Z; null without any. */
  top(goal: Id<"goals">): string | null {
    let best: string | null = null;
    let most = 0;
    for (const [source, n] of this.counts.get(goal) ?? []) {
      if (n > most || (n === most && best !== null && source.localeCompare(best) < 0)) {
        best = source;
        most = n;
      }
    }
    return best;
  }
}

/**
 * The table's rows (most conversions first) and the recorded events that aren't goals
 * (most completions first), from the goal and page entries of the range.
 */
export function goalRows(
  goals: Doc<"goals">[],
  eventEntries: DimEntry[],
  pageEntries: DimEntry[],
  topSource: (goal: Id<"goals">) => string | null,
): { rows: GoalRow[]; others: OtherEvent[] } {
  const events = new Map(eventEntries.map((e) => [e.key, e]));
  const pages = new Map(pageEntries.map((e) => [e.key, e]));
  const rows = sortGoals(goals).map((g) => {
    const entry = (g.kind === "event" ? events : pages).get(g.key);
    return {
      id: g._id,
      kind: g.kind,
      key: g.key,
      name: g.name,
      conversions: entry === undefined ? 0 : g.kind === "event" ? entry.events : entry.pageviews,
      visitors: entry === undefined ? 0 : goalVisitors(g.kind, entry),
      topSource: topSource(g._id),
    };
  });
  rows.sort((a, b) => b.conversions - a.conversions || a.name.localeCompare(b.name));
  const defined = new Set(goals.filter((g) => g.kind === "event").map((g) => g.key));
  const others = eventEntries
    .filter((e) => e.events > 0 && !defined.has(e.key))
    .map((e) => ({ name: e.key, events: e.events, visitors: e.visitors }))
    .sort((a, b) => b.events - a.events || a.name.localeCompare(b.name))
    .slice(0, MAX_OTHER_EVENTS);
  return { rows, others };
}

/**
 * Who converted. Events count each visitor once per goal (and day, on the rollups). A
 * page row's `visitors` only counts visitors whose first pageview of the day was that
 * page, so page goals count the sessions that viewed it instead (per day on the rollups;
 * the filtered view has no sessions there and counts distinct visitors). Cookieless
 * pages have no sessions and keep the unique visits.
 */
function goalVisitors(kind: GoalKind, entry: DimEntry): number {
  if (kind === "event") return entry.visitors;
  return entry.sessions > 0 ? entry.sessions : entry.visitors;
}

/** A goal's conversion rate: its visitors over the site's, at most 100%; null without visitors. */
export function goalRate(goalVisitors: number, siteVisitors: number): number | null {
  return siteVisitors > 0 ? Math.min(1, goalVisitors / siteVisitors) : null;
}

/**
 * The three tiles: goals tracked (and how many are events and pageviews), total
 * conversions, and the average of the goals' conversion rates (null with no goals or
 * no visitors).
 */
export function goalTiles(rows: Pick<GoalRow, "kind" | "conversions" | "visitors">[], siteVisitors: number) {
  const rates = rows.map((r) => goalRate(r.visitors, siteVisitors)).filter((r) => r !== null);
  return {
    tracked: rows.length,
    events: rows.filter((r) => r.kind === "event").length,
    pageviews: rows.filter((r) => r.kind === "page").length,
    conversions: rows.reduce((n, r) => n + r.conversions, 0),
    avgRate: rates.length === 0 ? null : rates.reduce((n, r) => n + r, 0) / rates.length,
  };
}
