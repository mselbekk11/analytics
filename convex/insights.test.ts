/// <reference types="vite/client" />
import resendTest from "@convex-dev/resend/test";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, components, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { signUnsubscribe } from "./lib/insights";
import schema from "./schema";

// Insight emails (launch v1 Phase 15): who gets one, what each site shows, the send and
// the one-click unsubscribe.

const modules = import.meta.glob("./**/*.{ts,tsx}");
const SECRET = "test-secret";
const UNSUB_SECRET = "unsub-secret";
const OWNER = { subject: "user_1", tokenIdentifier: "clerk|user_1" };
const STRANGER = { subject: "user_2", tokenIdentifier: "clerk|user_2" };
const MONDAY = Date.parse("2026-11-16T09:00:00Z"); // the weekly cron, after the week Nov 9–15
const WEEK = { from: "2026-11-09", to: "2026-11-15" };

const newTest = () => convexTest(schema, modules);
type T = ReturnType<typeof newTest>;

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

/** A pageview at `iso`, from visitor `n` in their session `n`. */
async function hit(t: T, site: string, iso: string, n: number, o: { path?: string; referrer?: string } = {}) {
  vi.setSystemTime(new Date(iso));
  const pvId = `pv-${site}-${iso}-${n}-${o.path ?? "/"}`;
  await t.mutation(api.ingest.pageview, {
    secret: SECRET,
    site,
    hostname: site,
    path: o.path ?? "/",
    referrer: o.referrer ?? "(direct)",
    unique: true,
    device: "desktop",
    browser: "Chrome",
    country: "US",
    pvId,
    visitorId: uuid(n),
    sessionId: uuid(1000 + n),
  });
  return pvId;
}

async function goal(t: T, site: string, iso: string, n: number, name: string) {
  const pvId = await hit(t, site, iso, n, { path: "/goal" });
  await t.mutation(api.ingest.event, { secret: SECRET, site, hostname: site, pvId, event: { type: "goal", name } });
}

const siteId = (t: T, domain: string) =>
  t.run(async (ctx) => (await ctx.db.query("sites").withIndex("by_domain", (q) => q.eq("domain", domain)).unique())!._id);

const account = (t: T, ownerId: string) =>
  t.run(async (ctx) => (await ctx.db.query("accounts").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).unique())!);

const patchAccount = async (t: T, ownerId: string, fields: Partial<Doc<"accounts">>) => {
  const a = await account(t, ownerId);
  await t.run((ctx) => ctx.db.patch("accounts", a._id, fields));
};

/** Ids of the accounts startCadence scheduled a send for. */
async function scheduledSends(t: T): Promise<string[]> {
  const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  return jobs
    .filter((j) => j.name.includes("sendAccount"))
    .map((j) => (j.args[0] as { accountId: string }).accountId)
    .sort();
}

beforeEach(() => {
  vi.stubEnv("INGEST_SECRET", SECRET);
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T12:00:00Z"));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("who gets emailed (insights.startCadence)", () => {
  // One account per state; trialEndsAt is in the future unless the state ends the trial
  const STATES: Record<string, Partial<Doc<"accounts">>> = {
    trialing: {},
    optedOut: { emailWeekly: false },
    locked: { trialEnded: true },
    lapsed: { trialEnded: true, status: "canceled" },
    comped: { comped: true, trialEnded: true },
    active: { status: "active", trialEnded: true },
    pastDue: { status: "past_due", trialEnded: true },
    lockedOptedIn: { trialEnded: true, emailDaily: true },
    dailyOn: { emailDaily: true },
  };

  async function setup() {
    const t = newTest();
    const ids: Record<string, Id<"accounts">> = {};
    await t.run(async (ctx) => {
      for (const [name, fields] of Object.entries(STATES)) {
        ids[name] = await ctx.db.insert("accounts", { ownerId: `clerk|${name}`, trialEndsAt: Date.parse("2026-12-01"), ...fields });
      }
    });
    return { t, ids };
  }

  test("weekly: opted in (the default) and not locked, so comped, trialing, active and past_due", async () => {
    const { t, ids } = await setup();
    await t.mutation(internal.insights.startCadence, { cadence: "weekly", now: MONDAY });
    expect(await scheduledSends(t)).toEqual(
      [ids.trialing, ids.comped, ids.active, ids.pastDue, ids.dailyOn].sort(),
    );
  });

  test("daily is off by default, so only accounts that turned it on, and never locked ones", async () => {
    const { t, ids } = await setup();
    await t.mutation(internal.insights.startCadence, { cadence: "daily", now: MONDAY });
    expect(await scheduledSends(t)).toEqual([ids.dailyOn]);
  });

  test("pages through the accounts, scheduling itself for the rest", async () => {
    const t = newTest();
    await t.run(async (ctx) => {
      for (let i = 0; i < 250; i++) await ctx.db.insert("accounts", { ownerId: `clerk|u${i}`, trialEndsAt: Date.parse("2026-12-01") });
    });
    let args: { cadence: "monthly"; now: number; cursor?: string } | null = { cadence: "monthly", now: MONDAY };
    let runs = 0;
    while (args !== null) {
      await t.mutation(internal.insights.startCadence, args);
      runs++;
      const next = (await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect())).filter(
        (j) => j.name.includes("startCadence") && j.state.kind === "pending",
      );
      const pending = next.map((j) => j.args[0] as { cadence: "monthly"; now: number; cursor?: string });
      // Each continuation is scheduled once; cancel it so the next loop only sees the new one
      await t.run(async (ctx) => {
        for (const j of next) await ctx.scheduler.cancel(j._id);
      });
      args = pending[0] ?? null;
      if (args !== null) expect(args.now).toBe(MONDAY);
    }
    expect(runs).toBe(3);
    expect((await scheduledSends(t)).length).toBe(250);
  });
});

describe("the numbers per site (insights.siteInsight)", () => {
  async function setup() {
    const t = newTest();
    const owner = t.withIdentity(OWNER);
    await owner.mutation(api.sites.create, { domain: "a.dev", timezone: "UTC" });
    await owner.mutation(api.sites.create, { domain: "quiet.dev", timezone: "UTC" });
    // The week before (Nov 2–8): 2 visitors, 3 pageviews; tracking starts on its first day
    await hit(t, "a.dev", "2026-11-02T10:00:00Z", 1);
    await hit(t, "a.dev", "2026-11-03T10:00:00Z", 2);
    await hit(t, "a.dev", "2026-11-03T10:05:00Z", 2, { path: "/pricing" });
    await goal(t, "a.dev", "2026-11-04T10:00:00Z", 2, "signup");
    await hit(t, "quiet.dev", "2026-11-05T10:00:00Z", 9); // nothing the week after
    // The week (Nov 9–15): 4 visitors
    await hit(t, "a.dev", "2026-11-09T10:00:00Z", 3, { referrer: "www.google.com" });
    await hit(t, "a.dev", "2026-11-09T10:01:00Z", 3, { path: "/pricing" });
    await hit(t, "a.dev", "2026-11-10T10:00:00Z", 4, { referrer: "www.google.com" });
    await hit(t, "a.dev", "2026-11-10T10:01:00Z", 4, { path: "/pricing" });
    await hit(t, "a.dev", "2026-11-11T10:00:00Z", 5, { referrer: "news.ycombinator.com", path: "/blog" });
    await hit(t, "a.dev", "2026-11-15T23:30:00Z", 6, { referrer: "www.reddit.com", path: "/about" });
    await goal(t, "a.dev", "2026-11-12T10:00:00Z", 3, "signup");
    await goal(t, "a.dev", "2026-11-12T11:00:00Z", 4, "signup");
    await goal(t, "a.dev", "2026-11-13T10:00:00Z", 3, "newsletter");
    await goal(t, "a.dev", "2026-11-13T11:00:00Z", 4, "newsletter");
    await goal(t, "a.dev", "2026-11-13T12:00:00Z", 5, "newsletter");
    // After the week: not counted
    await hit(t, "a.dev", "2026-11-16T08:00:00Z", 7);
    vi.setSystemTime(new Date(MONDAY));
    return { t, owner };
  }

  const insight = async (t: T, domain: string, cadence: "daily" | "weekly" | "monthly" = "weekly", now = MONDAY) =>
    await t.query(internal.insights.siteInsight, { siteId: await siteId(t, domain), cadence, now });

  test("visitors and pageviews match the dashboard's summary for that range, with its change", async () => {
    const { t, owner } = await setup();
    const result = (await insight(t, "a.dev"))!;
    const dashboard = await owner.query(api.stats.summary, { domain: "a.dev", ...WEEK });
    expect(result).toMatchObject({ domain: "a.dev", ...WEEK });
    expect(result.visitors).toEqual({ current: dashboard.current.visitors, previous: dashboard.previous.visitors });
    expect(result.pageviews).toEqual({ current: dashboard.current.pageviews, previous: dashboard.previous.pageviews });
    expect(result.visitors).toEqual({ current: 4, previous: 2 });
    expect(result.pageviews).toEqual({ current: 6 + 5, previous: 3 + 1 }); // goal pageviews count too
  });

  test("top 3 sources by visitors and top 3 pages by pageviews, as the cards rank them", async () => {
    const { t } = await setup();
    const result = (await insight(t, "a.dev"))!;
    expect(result.sources).toEqual([
      { name: "Google", visitors: 2 },
      { name: "Hacker News", visitors: 1 },
      { name: "Reddit", visitors: 1 },
    ]);
    expect(result.pages).toEqual([
      { path: "/goal", pageviews: 5 },
      { path: "/", pageviews: 2 },
      { path: "/pricing", pageviews: 2 },
    ]);
  });

  test("key goal: the goal with the most completions, or the site's own key goal when set", async () => {
    const { t, owner } = await setup();
    expect((await insight(t, "a.dev"))!.keyGoal).toEqual({ name: "newsletter", current: 3, previous: 0 });
    await owner.mutation(api.sites.setKeyGoal, { domain: "a.dev", keyGoal: "signup" });
    expect((await insight(t, "a.dev"))!.keyGoal).toEqual({ name: "signup", current: 2, previous: 1 });
    // A key goal with no completions still shows, at zero
    await owner.mutation(api.sites.setKeyGoal, { domain: "a.dev", keyGoal: "purchase" });
    expect((await insight(t, "a.dev"))!.keyGoal).toEqual({ name: "purchase", current: 0, previous: 0 });
  });

  test("revenue only on sites with a payments provider", async () => {
    const { t } = await setup();
    expect((await insight(t, "a.dev"))!.revenue).toBeNull();
    const id = await siteId(t, "a.dev");
    await t.run(async (ctx) => {
      await ctx.db.patch("sites", id, { revenueSource: "api", currency: "EUR" });
      const day = (await ctx.db
        .query("dailyStats")
        .withIndex("by_site_date", (q) => q.eq("siteId", id).eq("date", "2026-11-10"))
        .unique())!;
      await ctx.db.patch("dailyStats", day._id, { revenueMinor: 4900 });
    });
    expect((await insight(t, "a.dev"))!.revenue).toEqual({ current: 4900, previous: 0, currency: "EUR" });
  });

  test("a site with no visitors in its period is left out", async () => {
    const { t } = await setup();
    expect(await insight(t, "quiet.dev")).toBeNull();
  });

  test("each site's period is its own local week", async () => {
    const t = newTest();
    const owner = t.withIdentity(OWNER);
    await owner.mutation(api.sites.create, { domain: "la.dev", timezone: "America/Los_Angeles" });
    await hit(t, "la.dev", "2026-11-02T18:00:00Z", 1); // Nov 2 there, the week before
    await hit(t, "la.dev", "2026-11-09T05:00:00Z", 2); // Sunday Nov 8, 21:00 there: still the week before
    await hit(t, "la.dev", "2026-11-12T18:00:00Z", 3);
    await hit(t, "la.dev", "2026-11-16T05:00:00Z", 4); // Sunday Nov 15, 21:00 there: in the week
    vi.setSystemTime(new Date(MONDAY));
    const result = (await insight(t, "la.dev"))!;
    expect(result).toMatchObject({ ...WEEK, visitors: { current: 2, previous: 2 } });
    const dashboard = await owner.query(api.stats.summary, { domain: "la.dev", ...WEEK });
    expect(result.visitors.current).toBe(dashboard.current.visitors);
  });

  test("no visitor change when the week before is before visitor tracking began", async () => {
    const t = newTest();
    await t.withIdentity(OWNER).mutation(api.sites.create, { domain: "new.dev", timezone: "UTC" });
    await hit(t, "new.dev", "2026-11-12T10:00:00Z", 1);
    vi.setSystemTime(new Date(MONDAY));
    const result = (await insight(t, "new.dev"))!;
    expect(result.visitors).toEqual({ current: 1, previous: null });
    expect(result.pageviews).toEqual({ current: 1, previous: 0 });
  });

  test("daily and monthly cover yesterday and last month, with the change against the range before", async () => {
    const { t } = await setup();
    const daily = (await insight(t, "a.dev", "daily", Date.parse("2026-11-11T07:00:00Z")))!;
    expect(daily).toMatchObject({ from: "2026-11-10", to: "2026-11-10", pageviews: { current: 2, previous: 2 } });
    const monthly = (await insight(t, "a.dev", "monthly", Date.parse("2026-12-01T09:00:00Z")))!;
    expect(monthly).toMatchObject({ from: "2026-11-01", to: "2026-11-30", visitors: { current: 7, previous: null } });
  });
});

describe("sending (insightsSend.sendNow)", () => {
  const EMAILS: Record<string, string> = { user_1: "owner@example.com", user_2: "stranger@example.com" };

  async function setup() {
    const t = newTest();
    resendTest.register(t);
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("CLERK_SECRET_KEY", "sk_test");
    vi.stubEnv("INSIGHT_UNSUBSCRIBE_SECRET", UNSUB_SECRET);
    vi.stubEnv("CONVEX_SITE_URL", "https://example.convex.site");
    vi.stubEnv("APP_URL", "https://app.example");
    const clerk = vi.fn(async (url: string | URL | Request) => {
      const id = String(url).split("/users/")[1];
      const email = EMAILS[id];
      if (email === undefined) return new Response("{}", { status: 404 });
      return Response.json({ primary_email_address_id: "e1", email_addresses: [{ id: "e1", email_address: email }] });
    });
    vi.stubGlobal("fetch", clerk);
    const owner = t.withIdentity(OWNER);
    await owner.mutation(api.sites.create, { domain: "a.dev", timezone: "UTC" });
    await owner.mutation(api.sites.create, { domain: "quiet.dev", timezone: "UTC" });
    await t.withIdentity(STRANGER).mutation(api.sites.create, { domain: "s.dev", timezone: "UTC" });
    await hit(t, "a.dev", "2026-11-12T10:00:00Z", 1, { referrer: "www.google.com" });
    await hit(t, "s.dev", "2026-11-02T10:00:00Z", 2); // the stranger: nothing last week
    vi.setSystemTime(new Date(MONDAY));
    return { t, owner, clerk };
  }

  const sendNow = (t: T, ownerId: string, cadence: "daily" | "weekly" | "monthly" = "weekly", force?: boolean) =>
    t.action(internal.insightsSend.sendNow, { ownerId, cadence, force });

  test("sends the owner's email with the active sites, the unsubscribe headers and dashboard links", async () => {
    const { t, clerk } = await setup();
    const result = await sendNow(t, OWNER.tokenIdentifier);
    expect(result).toMatchObject({ status: "sent", sites: 1 }); // quiet.dev is left out
    expect(clerk).toHaveBeenCalledWith("https://api.clerk.com/v1/users/user_1", expect.anything());

    const email = (await t.query(components.resend.lib.get, { emailId: result.emailId! }))!;
    expect(email.to).toEqual(["owner@example.com"]);
    expect(email.from).toBe("Simple Stats <insights@mail.simplestats.ai>");
    expect(email.subject).toBe("Your weekly insights: Nov 9 – 15, 2026");
    const accountId = (await account(t, OWNER.tokenIdentifier))._id;
    const unsubscribeUrl = `https://example.convex.site/email/unsubscribe?t=${encodeURIComponent(await signUnsubscribe(UNSUB_SECRET, accountId, "weekly"))}`;
    expect(email.headers).toEqual([
      { name: "List-Unsubscribe", value: `<${unsubscribeUrl}>` },
      { name: "List-Unsubscribe-Post", value: "List-Unsubscribe=One-Click" },
    ]);
    expect(email.html).toContain("a.dev");
    expect(email.html).not.toContain("quiet.dev");
    expect(email.html).toContain("https://app.example/sites/a.dev?range=2026-11-09_2026-11-15");
    expect(email.html).toContain(unsubscribeUrl.replace(/&/g, "&amp;"));
    expect(email.text).toContain("Google");
  });

  test("the same run is sent once; force sends again", async () => {
    const { t } = await setup();
    const first = await sendNow(t, OWNER.tokenIdentifier);
    expect((await sendNow(t, OWNER.tokenIdentifier)).emailId).toBe(first.emailId);
    expect((await sendNow(t, OWNER.tokenIdentifier, "weekly", true)).emailId).not.toBe(first.emailId);
  });

  test("an account with no activity gets nothing", async () => {
    const { t, clerk } = await setup();
    expect(await sendNow(t, STRANGER.tokenIdentifier)).toEqual({ status: "no_activity", sites: 0 });
    expect(clerk).not.toHaveBeenCalled();
  });

  test("a locked account gets nothing, a comped one does", async () => {
    const { t } = await setup();
    await patchAccount(t, OWNER.tokenIdentifier, { trialEnded: true });
    expect(await sendNow(t, OWNER.tokenIdentifier)).toEqual({ status: "locked", sites: 0 });
    await patchAccount(t, OWNER.tokenIdentifier, { comped: true });
    expect((await sendNow(t, OWNER.tokenIdentifier)).status).toBe("sent");
  });

  test("an opted-out account gets nothing, and daily is off by default", async () => {
    const { t, owner } = await setup();
    expect(await sendNow(t, OWNER.tokenIdentifier, "daily")).toEqual({ status: "opted_out", sites: 0 });
    await owner.mutation(api.insights.setPref, { cadence: "weekly", on: false });
    expect(await sendNow(t, OWNER.tokenIdentifier)).toEqual({ status: "opted_out", sites: 0 });
  });

  test("INSIGHT_EMAILS_ONLY_TO keeps everyone else from being emailed", async () => {
    const { t } = await setup();
    vi.stubEnv("INSIGHT_EMAILS_ONLY_TO", "someone@else.com");
    expect(await sendNow(t, OWNER.tokenIdentifier)).toEqual({ status: "not_allowed", sites: 1 });
    vi.stubEnv("INSIGHT_EMAILS_ONLY_TO", "Owner@Example.com");
    expect((await sendNow(t, OWNER.tokenIdentifier)).status).toBe("sent");
  });

  test("no account", async () => {
    const { t } = await setup();
    expect(await sendNow(t, "clerk|nobody")).toEqual({ status: "no_account", sites: 0 });
  });
});

describe("the switches and the unsubscribe link", () => {
  async function setup() {
    const t = newTest();
    vi.stubEnv("INSIGHT_UNSUBSCRIBE_SECRET", UNSUB_SECRET);
    vi.stubEnv("APP_URL", "https://app.example");
    const owner = t.withIdentity(OWNER);
    const stranger = t.withIdentity(STRANGER);
    await owner.mutation(api.accounts.ensure, {});
    await stranger.mutation(api.accounts.ensure, {});
    const id = (await account(t, OWNER.tokenIdentifier))._id;
    return { t, owner, stranger, id };
  }

  test("defaults, and each switch only changes the signed-in user's own account", async () => {
    const { t, owner, stranger } = await setup();
    expect(await owner.query(api.insights.prefs, {})).toEqual({ daily: false, weekly: true, monthly: true });
    await owner.mutation(api.insights.setPref, { cadence: "daily", on: true });
    await owner.mutation(api.insights.setPref, { cadence: "monthly", on: false });
    expect(await owner.query(api.insights.prefs, {})).toEqual({ daily: true, weekly: true, monthly: false });
    expect(await stranger.query(api.insights.prefs, {})).toEqual({ daily: false, weekly: true, monthly: true });
    await expect(t.query(api.insights.prefs, {})).rejects.toThrow(/Not signed in/);
    await expect(t.mutation(api.insights.setPref, { cadence: "weekly", on: false })).rejects.toThrow(/Not signed in/);
  });

  test("a valid link turns off only its cadence, and the switches show it", async () => {
    const { t, owner, id } = await setup();
    const token = await signUnsubscribe(UNSUB_SECRET, id, "weekly");
    const res = await t.fetch(`/email/unsubscribe?t=${encodeURIComponent(token)}`, { method: "GET" });
    expect(res.status).toBe(200);
    const page = await res.text();
    expect(page).toContain("Unsubscribed from weekly emails");
    expect(page).toContain("https://app.example/settings");
    expect(await owner.query(api.insights.prefs, {})).toEqual({ daily: false, weekly: false, monthly: true });
  });

  test("the one-click POST works the same", async () => {
    const { t, owner, id } = await setup();
    const token = await signUnsubscribe(UNSUB_SECRET, id, "monthly");
    const res = await t.fetch(`/email/unsubscribe?t=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "List-Unsubscribe=One-Click",
    });
    expect(res.status).toBe(200);
    expect(await owner.query(api.insights.prefs, {})).toEqual({ daily: false, weekly: true, monthly: false });
  });

  test("a tampered, wrong-cadence, foreign-secret or unknown-account token changes nothing", async () => {
    const { t, owner, id } = await setup();
    const weekly = await signUnsubscribe(UNSUB_SECRET, id, "weekly");
    const [, , sig] = weekly.split(".");
    const strangerId = (await account(t, STRANGER.tokenIdentifier))._id;
    const bad = [
      weekly.slice(0, -1) + (weekly.at(-1) === "A" ? "B" : "A"), // tampered
      `${id}.monthly.${sig}`, // another cadence under the weekly signature
      `${strangerId}.weekly.${sig}`, // another account
      await signUnsubscribe("other-secret", id, "weekly"),
      await signUnsubscribe(UNSUB_SECRET, "not-an-id", "weekly"), // signed, but no such account
      "",
    ];
    for (const token of bad) {
      const res = await t.fetch(`/email/unsubscribe?t=${encodeURIComponent(token)}`, { method: "GET" });
      expect(res.status).toBe(400);
      expect(await res.text()).toContain("This link isn't valid");
    }
    expect(await owner.query(api.insights.prefs, {})).toEqual({ daily: false, weekly: true, monthly: true });
    expect(await t.withIdentity(STRANGER).query(api.insights.prefs, {})).toEqual({ daily: false, weekly: true, monthly: true });
  });
});
