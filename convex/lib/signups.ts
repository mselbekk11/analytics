import { v, type Infer } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { displayName, persona } from "./names";
import { countryLabel } from "./payments";
import { percentChange } from "./ranges";

// Signups (launch v1 Phase 14). A signup is the first time identify() gives a visitor an
// email or a user id; it is stored on the visitor as `identifiedAt` (with the signup page
// and the first session's landing page) and never moves after that, so identifying the
// same visitor again doesn't count twice. Paying means the visitor has a linked payment
// (`firstPaidAt`), whenever it came; free means not (yet).

export const SIGNUP_ROWS = 50;

/** The earliest identify() call on record for a visitor, with the page it was on. */
export async function firstIdentify(
  ctx: QueryCtx | MutationCtx,
  visitor: Pick<Doc<"visitors">, "siteId" | "visitorId">,
): Promise<{ ts: number; path: string } | null> {
  const event = await ctx.db
    .query("events")
    .withIndex("by_site_visitor_ts", (q) => q.eq("siteId", visitor.siteId).eq("visitorId", visitor.visitorId))
    .filter((q) => q.eq(q.field("type"), "identify"))
    .first();
  return event === null ? null : { ts: event.ts, path: event.path };
}

/** The entry page of the visitor's first session, or null without sessions. */
export async function landingPath(
  ctx: QueryCtx | MutationCtx,
  visitor: Pick<Doc<"visitors">, "siteId" | "visitorId">,
): Promise<string | null> {
  const first = await ctx.db
    .query("sessions")
    .withIndex("by_site_visitor_started", (q) => q.eq("siteId", visitor.siteId).eq("visitorId", visitor.visitorId))
    .first();
  return first?.entryPath ?? null;
}

/**
 * The signup fields to write when identify() at `ts` on `path` gives the visitor an email
 * or user id, or null when it already has `identifiedAt`. A visitor that already had an
 * email or user id (identified before signups were recorded, or an email from a payment)
 * takes its earliest identify() call on record if that came first, so the time is never
 * later than its first identify.
 */
export async function signupAt(
  ctx: MutationCtx,
  visitor: Doc<"visitors">,
  ts: number,
  path: string,
): Promise<{ identifiedAt: number; signupPath: string; landingPath?: string } | null> {
  if (visitor.identifiedAt !== undefined) return null;
  let at = { ts, path };
  if (visitor.userId !== undefined || visitor.email !== undefined) {
    const earlier = await firstIdentify(ctx, visitor);
    if (earlier !== null && earlier.ts < ts) at = earlier;
  }
  const landing = await landingPath(ctx, visitor);
  return { identifiedAt: at.ts, signupPath: at.path, ...(landing !== null ? { landingPath: landing } : {}) };
}

/** How long from the visitor's first visit to the signup, never negative. */
export function timeToSignup(v: Pick<Doc<"visitors">, "firstSeen" | "identifiedAt">): number | null {
  return v.identifiedAt === undefined ? null : Math.max(0, v.identifiedAt - v.firstSeen);
}

export function isPaying(v: Pick<Doc<"visitors">, "firstPaidAt">): boolean {
  return v.firstPaidAt !== undefined;
}

export const signupTotals = v.object({
  signups: v.number(),
  paying: v.number(),
  tookSumMs: v.number(),
  previousSignups: v.number(),
  previousPaying: v.number(),
  previousTookSumMs: v.number(),
});
export type SignupTotals = Infer<typeof signupTotals>;

/** Adds up a period's signups: how many, how many pay, and the summed time to sign up. */
export function countSignups(visitors: Pick<Doc<"visitors">, "firstSeen" | "identifiedAt" | "firstPaidAt">[]) {
  let paying = 0;
  let tookSumMs = 0;
  for (const v of visitors) {
    if (isPaying(v)) paying++;
    tookSumMs += timeToSignup(v) ?? 0;
  }
  return { signups: visitors.length, paying, tookSumMs };
}

/**
 * The tiles: Signups, Free, Paying, Free → paid (the share of signups that pay) and Avg.
 * time to sign up, each with its change against the period before. The rate and the
 * average are null without signups.
 */
export function signupTiles(t: SignupTotals) {
  const rate = (paying: number, n: number) => (n === 0 ? null : paying / n);
  const avg = (sum: number, n: number) => (n === 0 ? null : sum / n);
  const change = (a: number | null, b: number | null) => (a === null || b === null ? null : percentChange(a, b));
  const paidRate = rate(t.paying, t.signups);
  const took = avg(t.tookSumMs, t.signups);
  return {
    signups: { value: t.signups, change: percentChange(t.signups, t.previousSignups) },
    free: { value: t.signups - t.paying, change: percentChange(t.signups - t.paying, t.previousSignups - t.previousPaying) },
    paying: { value: t.paying, change: percentChange(t.paying, t.previousPaying) },
    paidRate: { value: paidRate, change: change(paidRate, rate(t.previousPaying, t.previousSignups)) },
    took: { value: took, change: change(took, avg(t.previousTookSumMs, t.previousSignups)) },
  };
}

export const signupRow = v.object({
  visitorId: v.string(),
  person: v.string(), // the Users table's name: identify() name, email, else the animal
  email: v.union(v.string(), v.null()),
  userId: v.union(v.string(), v.null()),
  paying: v.boolean(),
  revenueMinor: v.number(),
  country: v.union(v.string(), v.null()),
  source: v.union(v.string(), v.null()),
  channel: v.union(v.string(), v.null()),
  landingPath: v.union(v.string(), v.null()),
  signupPath: v.union(v.string(), v.null()),
  tookMs: v.number(),
  /** Sessions started up to the signup, at most JOURNEY_CAP + 1; filled for the rows shown */
  journey: v.number(),
  identifiedAt: v.number(),
});
export type SignupRow = Infer<typeof signupRow>;

/** A signed-up visitor as the table lists it, before its journey is counted. */
export function toSignupRow(visitor: Doc<"visitors">): SignupRow {
  return {
    visitorId: visitor.visitorId,
    person: displayName(visitor.visitorId, visitor.name, visitor.email),
    email: visitor.email ?? null,
    userId: visitor.userId ?? null,
    paying: isPaying(visitor),
    revenueMinor: visitor.revenueMinor,
    country: visitor.country ?? null,
    source: visitor.firstSource ?? null,
    channel: visitor.firstChannel ?? null,
    landingPath: visitor.landingPath ?? null,
    signupPath: visitor.signupPath ?? null,
    tookMs: timeToSignup(visitor) ?? 0,
    journey: 0,
    identifiedAt: visitor.identifiedAt ?? 0,
  };
}

/**
 * Whether a signup matches the search: part of its name, email, user id or animal name,
 * its source or channel, its country's English name, its landing or signup page, or
 * "free" / "paying"; or its country's code exactly ("de").
 */
export function signupMatches(row: SignupRow, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (needle === "") return true;
  if (row.country !== null && row.country.toLowerCase() === needle) return true;
  const fields = [
    row.person,
    row.email,
    row.userId,
    persona(row.visitorId).name,
    row.source,
    row.channel,
    row.country === null ? null : countryLabel(row.country),
    row.landingPath,
    row.signupPath,
    row.paying ? "paying" : "free",
  ];
  return fields.some((f) => f !== null && f.toLowerCase().includes(needle));
}

/**
 * The signups the search keeps, newest first, and the `limit` rows from `offset`, moved
 * back to the last page if it is past the end. `matched` counts what the search kept.
 */
export function signupTable(
  rows: SignupRow[],
  opts: { search: string; offset: number; limit?: number },
): { rows: SignupRow[]; offset: number; matched: number } {
  const kept = rows
    .filter((r) => signupMatches(r, opts.search))
    .sort((a, b) => b.identifiedAt - a.identifiedAt || a.visitorId.localeCompare(b.visitorId));
  const limit = opts.limit ?? SIGNUP_ROWS;
  const last = Math.max(0, Math.ceil(kept.length / limit) - 1) * limit;
  const offset = Math.min(Math.max(0, Math.floor(opts.offset / limit) * limit), last);
  return { rows: kept.slice(offset, offset + limit), offset, matched: kept.length };
}

export const signupList = v.array(v.object({ key: v.string(), signups: v.number(), paying: v.number() }));

/** Signups (and how many pay) per key, most first, then by key; at most `limit` keys. */
export function rankSignups(
  rows: SignupRow[],
  key: (r: SignupRow) => string,
  limit = 100,
): { key: string; signups: number; paying: number }[] {
  const counts = new Map<string, { signups: number; paying: number }>();
  for (const r of rows) {
    const k = key(r);
    const c = counts.get(k) ?? { signups: 0, paying: 0 };
    c.signups++;
    if (r.paying) c.paying++;
    counts.set(k, c);
  }
  return [...counts.entries()]
    .map(([k, c]) => ({ key: k, ...c }))
    .sort((a, b) => b.signups - a.signups || a.key.localeCompare(b.key))
    .slice(0, limit);
}
