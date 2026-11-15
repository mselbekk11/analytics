import { v, type Infer } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query, type QueryCtx } from "./_generated/server";
import { accessState, ownerAccount } from "./lib/access";
import { requireOwnerId } from "./lib/auth";
import { rankEntries } from "./lib/dims";
import { CADENCE_FIELD, cadenceValidator, insightPeriod, wantsCadence, type Cadence } from "./lib/insights";
import { previousRange, type DateRange } from "./lib/ranges";
import { siteCurrency } from "./lib/revenue";
import { siteSummary, sumDim } from "./stats";

// Insight emails (launch v1 Phase 15): the Settings switches, the cron fan-out, the
// numbers for each site and the unsubscribe. Rendering and sending is insightsSend.ts
// (a Node action, for React Email).

// Accounts read per run of startCadence; it schedules itself for the next page
const ACCOUNTS_PER_PAGE = 100;
// Sites per account (the plan allows 20); one query per site keeps each read small
const MAX_SITES = 100;
const TOP_ROWS = 3;

const prefsValidator = v.object({ daily: v.boolean(), weekly: v.boolean(), monthly: v.boolean() });

function prefsOf(account: Doc<"accounts">) {
  return {
    daily: wantsCadence(account, "daily"),
    weekly: wantsCadence(account, "weekly"),
    monthly: wantsCadence(account, "monthly"),
  };
}

/** The signed-in user's switches, or null before accounts.ensure has made the account. */
export const prefs = query({
  args: {},
  returns: v.union(v.null(), prefsValidator),
  handler: async (ctx) => {
    const account = await ownerAccount(ctx, await requireOwnerId(ctx));
    return account === null ? null : prefsOf(account);
  },
});

/** Turns one cadence on or off for the signed-in user. Works while locked too. */
export const setPref = mutation({
  args: { cadence: cadenceValidator, on: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const account = await ownerAccount(ctx, await requireOwnerId(ctx));
    if (account === null) throw new Error("No account yet");
    await ctx.db.patch("accounts", account._id, { [CADENCE_FIELD[args.cadence]]: args.on });
    return null;
  },
});

/** Who a cadence goes to: opted in, and not locked (comped, trialing, active and past_due are). */
export function isRecipient(account: Doc<"accounts">, cadence: Cadence): boolean {
  return wantsCadence(account, cadence) && accessState(account) !== "locked";
}

/**
 * Run by the crons: schedules one send per account that gets this cadence, a page of
 * accounts at a time. Every send of one run shares `now`, so they cover the same days.
 */
export const startCadence = internalMutation({
  args: { cadence: cadenceValidator, now: v.optional(v.number()), cursor: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const page = await ctx.db
      .query("accounts")
      .paginate({ numItems: ACCOUNTS_PER_PAGE, cursor: args.cursor ?? null });
    for (const account of page.page) {
      if (!isRecipient(account, args.cadence)) continue;
      await ctx.scheduler.runAfter(0, internal.insightsSend.sendAccount, {
        accountId: account._id,
        cadence: args.cadence,
        now,
      });
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.insights.startCadence, {
        cadence: args.cadence,
        now,
        cursor: page.continueCursor,
      });
    }
    return null;
  },
});

/**
 * The account a send is for, checked again when it runs (the switch or the lock may have
 * changed since the cron), and the ids of its sites.
 */
export const accountForSend = internalQuery({
  args: { accountId: v.string(), cadence: cadenceValidator },
  returns: v.union(
    v.object({ skip: v.union(v.literal("no_account"), v.literal("opted_out"), v.literal("locked")) }),
    v.object({ skip: v.null(), ownerId: v.string(), siteIds: v.array(v.id("sites")) }),
  ),
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("accounts", args.accountId);
    const account = id === null ? null : await ctx.db.get("accounts", id);
    if (account === null) return { skip: "no_account" as const };
    if (!wantsCadence(account, args.cadence)) return { skip: "opted_out" as const };
    if (accessState(account) === "locked") return { skip: "locked" as const };
    const sites = await ctx.db
      .query("sites")
      .withIndex("by_owner", (q) => q.eq("ownerId", account.ownerId))
      .take(MAX_SITES);
    return { skip: null, ownerId: account.ownerId, siteIds: sites.map((s) => s._id) };
  },
});

/** The account id of an owner, for insightsSend.sendNow. */
export const accountIdOf = internalQuery({
  args: { ownerId: v.string() },
  returns: v.union(v.null(), v.id("accounts")),
  handler: async (ctx, args) => (await ownerAccount(ctx, args.ownerId))?._id ?? null,
});

const changeValidator =v.object({ current: v.number(), previous: v.union(v.null(), v.number()) });

export const siteInsightValidator = v.object({
  domain: v.string(),
  from: v.string(),
  to: v.string(),
  visitors: changeValidator,
  pageviews: changeValidator,
  // Only on sites with a payments provider; minor units of `currency`
  revenue: v.union(v.null(), v.object({ current: v.number(), previous: v.number(), currency: v.string() })),
  keyGoal: v.union(v.null(), v.object({ name: v.string(), current: v.number(), previous: v.number() })),
  sources: v.array(v.object({ name: v.string(), visitors: v.number() })),
  pages: v.array(v.object({ path: v.string(), pageviews: v.number() })),
});
export type SiteInsight = Infer<typeof siteInsightValidator>;

/**
 * The key goal over a range: the site's own Key goal (Settings) when it has one,
 * otherwise the goal with the most completions in the range (ties by visitors, then
 * name). Null when there's neither. Completions are its events from the goal rollups,
 * as on the Goals tab.
 */
async function keyGoalInsight(ctx: QueryCtx, site: Doc<"sites">, range: DateRange) {
  const current = await sumDim(ctx, site._id, "goal", range);
  let name = site.keyGoal ?? null;
  if (name === null) {
    const top = current.entries
      .filter((e) => e.events > 0)
      .sort((a, b) => b.events - a.events || b.visitors - a.visitors || a.key.localeCompare(b.key))[0];
    if (top === undefined) return null;
    name = top.key;
  }
  const before = await sumDim(ctx, site._id, "goal", previousRange(range));
  return {
    name,
    current: current.entries.find((e) => e.key === name)?.events ?? 0,
    previous: before.entries.find((e) => e.key === name)?.events ?? 0,
  };
}

/**
 * One site's numbers for an email at `now`, or null when it had no visitors in its
 * period (or is gone). The same reads as the dashboard for that custom range: the
 * summary tiles (rollups, plus the session rows the Visitors tile counts distinct ids
 * from), the Sources and Pages cards' rollups, and the goal rollups. The change is
 * against the equal-length range before, as the dashboard shows it.
 */
export const siteInsight = internalQuery({
  args: { siteId: v.id("sites"), cadence: cadenceValidator, now: v.number() },
  returns: v.union(v.null(), siteInsightValidator),
  handler: async (ctx, args) => {
    const site = await ctx.db.get("sites", args.siteId);
    if (site === null) return null;
    const range = insightPeriod(args.cadence, args.now, site.timezone);
    const summary = await siteSummary(ctx, site, range);
    if (summary.current.visitors <= 0) return null;

    const sources = rankEntries("source", (await sumDim(ctx, site._id, "source", range)).entries);
    const pages = rankEntries("page", (await sumDim(ctx, site._id, "page", range)).entries);
    const hasRevenue = (site.revenueSource ?? "none") !== "none";
    return {
      domain: site.domain,
      from: range.from,
      to: range.to,
      visitors: {
        current: summary.current.visitors,
        // The dashboard shows no change when the earlier range is before visitor tracking began
        previous: summary.comparable ? summary.previous.visitors : null,
      },
      pageviews: { current: summary.current.pageviews, previous: summary.previous.pageviews },
      revenue: hasRevenue
        ? {
            current: summary.current.revenueMinor,
            previous: summary.previous.revenueMinor,
            currency: siteCurrency(site),
          }
        : null,
      keyGoal: await keyGoalInsight(ctx, site, range),
      sources: sources.slice(0, TOP_ROWS).map((e) => ({ name: e.key, visitors: e.visitors })),
      pages: pages.slice(0, TOP_ROWS).map((e) => ({ path: e.key, pageviews: e.pageviews })),
    };
  },
});

/**
 * Turns off one cadence for the account a verified unsubscribe token names. False when
 * the account doesn't exist. The token is checked by the HTTP route (http.ts) first.
 */
export const unsubscribe = internalMutation({
  args: { accountId: v.string(), cadence: cadenceValidator },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("accounts", args.accountId);
    const account = id === null ? null : await ctx.db.get("accounts", id);
    if (account === null) return false;
    await ctx.db.patch("accounts", account._id, { [CADENCE_FIELD[args.cadence]]: false });
    return true;
  },
});
