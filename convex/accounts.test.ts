/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { TRIAL_MS } from "./accounts";
import { accessState, errorText, SUBSCRIPTION_REQUIRED } from "./lib/access";
import { sha256Hex } from "./lib/keys";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const SECRET = "test-secret";
const OWNER = { subject: "user_1", tokenIdentifier: "clerk|user_1" };
const STRANGER = { subject: "user_2", tokenIdentifier: "clerk|user_2" };
// Los Angeles is UTC-7 in October, so 20:00Z is 13:00 local on 2026-10-13
const NOW = Date.parse("2026-10-13T20:00:00Z");
const WEEK = { from: "2026-10-07", to: "2026-10-13" };
const LOCKED = /subscription_required/;

type T = ReturnType<typeof convexTest>;

/** picai.so (the owner's) and other.dev (the stranger's), each with an MCP key and a pageview. */
async function setup() {
  const t = convexTest(schema, modules);
  await t.withIdentity(OWNER).mutation(api.sites.create, { domain: "picai.so", timezone: "America/Los_Angeles" });
  await t.withIdentity(STRANGER).mutation(api.sites.create, { domain: "other.dev", timezone: "UTC" });
  const { key } = await t.withIdentity(OWNER).action(api.apiKeys.create, { name: "Laptop" });
  const { key: strangerKey } = await t.withIdentity(STRANGER).action(api.apiKeys.create, { name: "Theirs" });
  await pageview(t, "picai.so", "pv-seed");
  return { t, keyHash: await sha256Hex(key), strangerHash: await sha256Hex(strangerKey) };
}

async function pageview(t: T, site: string, pvId: string) {
  await t.mutation(api.ingest.pageview, {
    secret: SECRET,
    site,
    hostname: site,
    path: "/",
    referrer: "(direct)",
    unique: true,
    device: "desktop",
    browser: "Chrome",
    country: "US",
    pvId,
    visitorId: "0b6e0c2a-1d6f-4b8e-9a51-0c1f1e2d3a4b",
    sessionId: "5f1d2c3b-4a59-4e6f-8d7c-6b5a4f3e2d1c",
  });
}

const lock = (t: T, ownerId: string) =>
  t.mutation(internal.accounts.setTrialEnd, { ownerId, trialEndsAt: Date.now() - 1 });

async function account(t: T, ownerId: string): Promise<Doc<"accounts"> | null> {
  const rows: Doc<"accounts">[] = await t.run(async (ctx) => ctx.db.query("accounts").collect());
  return rows.find((r) => r.ownerId === ownerId) ?? null;
}

// Every dashboard read behind requireReadableSite, as the signed-in user `c` calls it for `domain`
const dashboardReads = (domain: string) => {
  const range = { domain, ...WEEK };
  return [
    ["stats.summary", (c: T) => c.query(api.stats.summary, range)],
    ["stats.timeseries", (c: T) => c.query(api.stats.timeseries, range)],
    ["stats.breakdown", (c: T) => c.query(api.stats.breakdown, { ...range, dim: "page" })],
    ["stats.goals", (c: T) => c.query(api.stats.goals, range)],
    ["stats.conversions", (c: T) => c.query(api.stats.conversions, range)],
    [
      "stats.filtered",
      (c: T) => c.query(api.stats.filtered, { ...range, filters: [{ dim: "device", value: "desktop" }] }),
    ],
    ["stats.hourly", (c: T) => c.query(api.stats.hourly, { domain, period: "today", now: NOW, filters: [] })],
    ["stats.live", (c: T) => c.query(api.stats.live, { domain, since: 0 })],
    ["stats.online", (c: T) => c.query(api.stats.online, { domain, since: 0 })],
    ["stats.liveFeed", (c: T) => c.query(api.stats.liveFeed, { domain, since: 0, onlineSince: 0 })],
    [
      "pages.list",
      (c: T) =>
        c.query(api.pages.list, { domain, range: WEEK, filters: [], sort: "views", desc: true, search: "", offset: 0 }),
    ],
    ["pages.detail", (c: T) => c.query(api.pages.detail, { domain, range: WEEK, filters: [], path: "/" })],
    [
      "visitors.list",
      (c: T) => c.query(api.visitors.list, { domain, range: WEEK, kind: "all", search: "", offset: 0 }),
    ],
    ["visitors.customers", (c: T) => c.query(api.visitors.customers, { domain })],
    ["visitors.profile", (c: T) => c.query(api.visitors.profile, { domain, visitorId: "nobody" })],
  ] as const;
};

// Every MCP tool's query, for the key `keyHash` on `domain`
const mcpTools = (keyHash: string, domain: string) => {
  const site = { secret: SECRET, keyHash, domain, now: NOW };
  return [
    ["list_sites", (t: T) => t.query(api.mcp.sites, { secret: SECRET, keyHash })],
    ["get_summary", (t: T) => t.query(api.mcp.summary, site)],
    ["get_timeseries", (t: T) => t.query(api.mcp.timeseries, site)],
    ["get_breakdown", (t: T) => t.query(api.mcp.breakdown, { ...site, dim: "page" })],
    ["get_pages", (t: T) => t.query(api.mcp.pages, site)],
    ["get_visitors", (t: T) => t.query(api.mcp.visitors, site)],
    ["get_journey", (t: T) => t.query(api.mcp.journey, { ...site, visitorId: "0b6e0c2a-1d6f-4b8e-9a51-0c1f1e2d3a4b" })],
    ["get_live", (t: T) => t.query(api.mcp.live, site)],
  ] as const;
};

beforeEach(() => {
  vi.stubEnv("INGEST_SECRET", SECRET);
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("access state", () => {
  const row = (fields: Partial<Doc<"accounts">>) =>
    ({ _id: "x", _creationTime: 0, ownerId: "o", trialEndsAt: 0, ...fields }) as Doc<"accounts">;

  test("works out every state from the account row", () => {
    expect(accessState(null)).toBe("locked");
    expect(accessState(row({}))).toBe("trialing");
    expect(accessState(row({ trialEnded: true }))).toBe("locked");
    expect(accessState(row({ trialEnded: true, comped: true }))).toBe("comped");
    expect(accessState(row({ trialEnded: true, status: "active" }))).toBe("active");
    expect(accessState(row({ trialEnded: true, status: "trialing" }))).toBe("active");
    expect(accessState(row({ trialEnded: true, status: "past_due" }))).toBe("past_due");
    expect(accessState(row({ trialEnded: true, status: "canceled" }))).toBe("locked");
    expect(accessState(row({ trialEnded: true, status: "unpaid" }))).toBe("locked");
    expect(accessState(row({ trialEnded: true, status: "incomplete" }))).toBe("locked");
    // Comped wins over anything Stripe says
    expect(accessState(row({ comped: true, status: "canceled" }))).toBe("comped");
  });

  test("the lock reads as a sentence in MCP tool output", () => {
    expect(errorText(SUBSCRIPTION_REQUIRED)).toMatch(/^Subscription required: pick a plan at https:\/\/www\.simplestats\.ai\/billing$/);
    expect(errorText("Site not found")).toBe("Site not found");
  });
});

describe("accounts", () => {
  test("ensure starts a 7-day trial once", async () => {
    const t = convexTest(schema, modules);
    const asOwner = t.withIdentity(OWNER);
    await expect(t.mutation(api.accounts.ensure, {})).rejects.toThrow(/Not signed in/);
    expect(await asOwner.query(api.accounts.me, {})).toBeNull();

    await asOwner.mutation(api.accounts.ensure, {});
    vi.setSystemTime(NOW + 60_000);
    await asOwner.mutation(api.accounts.ensure, {});

    expect(await asOwner.query(api.accounts.me, {})).toEqual({ access: "trialing", trialEndsAt: NOW + TRIAL_MS, events: null, interval: null });
    const rows = await t.run((ctx) => ctx.db.query("accounts").collect());
    expect(rows).toHaveLength(1);
  });

  test("adding a site makes the account too", async () => {
    const t = convexTest(schema, modules);
    await t.withIdentity(OWNER).mutation(api.sites.create, { domain: "picai.so", timezone: "UTC" });
    expect(await account(t, OWNER.tokenIdentifier)).toMatchObject({ trialEndsAt: NOW + TRIAL_MS });
  });

  test("the trial locks when the job scheduled for its end runs", async () => {
    const t = convexTest(schema, modules);
    const asOwner = t.withIdentity(OWNER);
    await asOwner.mutation(api.accounts.ensure, {});
    vi.setSystemTime(NOW + TRIAL_MS - 1000);
    expect((await asOwner.query(api.accounts.me, {}))?.access).toBe("trialing");
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await asOwner.query(api.accounts.me, {}))?.access).toBe("locked");
  });

  test("ensure locks a trial whose end was moved into the past by hand", async () => {
    const t = convexTest(schema, modules);
    const asOwner = t.withIdentity(OWNER);
    await asOwner.mutation(api.accounts.ensure, {});
    const row = (await account(t, OWNER.tokenIdentifier))!;
    await t.run((ctx) => ctx.db.patch("accounts", row._id, { trialEndsAt: NOW - 1 }));
    expect((await asOwner.query(api.accounts.me, {}))?.access).toBe("trialing");
    await asOwner.mutation(api.accounts.ensure, {});
    expect((await asOwner.query(api.accounts.me, {}))?.access).toBe("locked");
  });

  test("setTrialEnd locks at once in the past and unlocks for a later end", async () => {
    const t = convexTest(schema, modules);
    const asOwner = t.withIdentity(OWNER);
    await lock(t, OWNER.tokenIdentifier);
    expect((await asOwner.query(api.accounts.me, {}))?.access).toBe("locked");
    await t.mutation(internal.accounts.setTrialEnd, { ownerId: OWNER.tokenIdentifier, trialEndsAt: NOW + 3_600_000 });
    expect(await asOwner.query(api.accounts.me, {})).toEqual({ access: "trialing", trialEndsAt: NOW + 3_600_000, events: null, interval: null });
    // The first trial's job, still scheduled for a week out, finds the later end passed and locks again
    vi.setSystemTime(NOW + 3_600_000);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await asOwner.query(api.accounts.me, {}))?.access).toBe("locked");
  });

  test("setComped comps an owner who hasn't signed in yet, and clears it", async () => {
    const t = convexTest(schema, modules);
    const asOwner = t.withIdentity(OWNER);
    await t.mutation(internal.accounts.setComped, { ownerId: OWNER.tokenIdentifier, comped: true });
    expect((await asOwner.query(api.accounts.me, {}))?.access).toBe("comped");
    // Comped outlives the trial
    vi.setSystemTime(NOW + 2 * TRIAL_MS);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    await asOwner.mutation(api.accounts.ensure, {});
    expect((await asOwner.query(api.accounts.me, {}))?.access).toBe("comped");

    await t.mutation(internal.accounts.setComped, { ownerId: OWNER.tokenIdentifier, comped: false });
    expect((await account(t, OWNER.tokenIdentifier))?.comped).toBeUndefined();
    expect((await asOwner.query(api.accounts.me, {}))?.access).toBe("locked");
  });
});

describe("the lock", () => {
  test("every dashboard read works while trialing, comped or past due", async () => {
    const { t } = await setup();
    const asOwner = t.withIdentity(OWNER) as T;
    const reads = dashboardReads("picai.so");
    const allowed = async () => {
      for (const [, call] of reads) await expect(call(asOwner)).resolves.toBeDefined();
    };
    await allowed();
    await lock(t, OWNER.tokenIdentifier);
    await t.mutation(internal.accounts.setComped, { ownerId: OWNER.tokenIdentifier, comped: true });
    await allowed();
    await t.mutation(internal.accounts.setComped, { ownerId: OWNER.tokenIdentifier, comped: false });
    const row = (await account(t, OWNER.tokenIdentifier))!;
    await t.run((ctx) => ctx.db.patch("accounts", row._id, { status: "past_due" }));
    await allowed();
  });

  test("every dashboard read refuses a locked account", async () => {
    const { t } = await setup();
    await lock(t, OWNER.tokenIdentifier);
    for (const [name, call] of dashboardReads("picai.so")) {
      await expect(call(t.withIdentity(OWNER) as T), name).rejects.toThrow(LOCKED);
    }
  });

  test("a locked account is refused on someone else's site too, and ownership still holds when unlocked", async () => {
    const { t } = await setup();
    await lock(t, OWNER.tokenIdentifier);
    for (const [name, call] of dashboardReads("other.dev")) {
      // The lock comes first, so a locked account learns nothing about other domains
      await expect(call(t.withIdentity(OWNER) as T), name).rejects.toThrow(LOCKED);
    }
    // The stranger is trialing, but the locked owner's site still isn't theirs
    for (const [name, call] of dashboardReads("picai.so")) {
      await expect(call(t.withIdentity(STRANGER) as T), name).rejects.toThrow(/Site not found/);
    }
  });

  test("every MCP tool works while trialing and refuses a locked account's key", async () => {
    const { t, keyHash } = await setup();
    for (const [name, call] of mcpTools(keyHash, "picai.so")) {
      await expect(call(t), name).resolves.toBeDefined();
    }
    await lock(t, OWNER.tokenIdentifier);
    for (const [name, call] of mcpTools(keyHash, "picai.so")) {
      await expect(call(t), name).rejects.toThrow(LOCKED);
    }
    // The key itself is still valid, so the route doesn't answer 401
    expect(await t.mutation(api.mcp.authenticate, { secret: SECRET, keyHash })).toBe(true);
  });

  test("MCP keys are refused across accounts, locked or not", async () => {
    const { t, keyHash, strangerHash } = await setup();
    await lock(t, OWNER.tokenIdentifier);
    // A locked key asking for someone else's site gets the lock, not their data
    for (const [name, call] of mcpTools(keyHash, "other.dev").slice(1)) {
      await expect(call(t), name).rejects.toThrow(LOCKED);
    }
    // A trialing key asking for the locked owner's site gets "Site not found"
    for (const [name, call] of mcpTools(strangerHash, "picai.so").slice(1)) {
      await expect(call(t), name).rejects.toThrow(/Site not found/);
    }
  });

  test("a locked account's site still records pageviews, events and pings", async () => {
    const { t } = await setup();
    await lock(t, OWNER.tokenIdentifier);
    await pageview(t, "picai.so", "pv-locked");
    await t.mutation(api.ingest.event, {
      secret: SECRET,
      site: "picai.so",
      hostname: "picai.so",
      pvId: "pv-locked",
      event: { type: "goal", name: "signup" },
    });
    await t.mutation(api.ingest.ping, { secret: SECRET, site: "picai.so", hostname: "picai.so", pvId: "pv-locked", ms: 15_000 });

    const { pageviews, events, dailyStats } = await t.run(async (ctx) => ({
      pageviews: await ctx.db.query("pageviews").collect(),
      events: await ctx.db.query("events").collect(),
      dailyStats: await ctx.db.query("dailyStats").collect(),
    }));
    expect(pageviews.map((p) => p.pvId).sort()).toEqual(["pv-locked", "pv-seed"]);
    expect(pageviews.find((p) => p.pvId === "pv-locked")?.durationMs).toBe(15_000);
    expect(events.map((e) => e.name)).toEqual(["signup"]);
    expect(dailyStats[0].pageviews).toBe(2);

    // And it all shows once the account is unlocked again
    await t.mutation(internal.accounts.setComped, { ownerId: OWNER.tokenIdentifier, comped: true });
    const summary = await t.withIdentity(OWNER).query(api.stats.summary, { domain: "picai.so", ...WEEK });
    expect(summary.current.pageviews).toBe(2);
  });

  test("account pages and site management keep working when locked", async () => {
    const { t } = await setup();
    const asOwner = t.withIdentity(OWNER);
    await lock(t, OWNER.tokenIdentifier);
    expect(await asOwner.query(api.accounts.me, {})).toMatchObject({ access: "locked" });
    expect(await asOwner.query(api.sites.list, {})).toHaveLength(1);
    expect(await asOwner.query(api.sites.listWithStats, { now: NOW })).toHaveLength(1);
    expect(await asOwner.query(api.sites.get, { domain: "picai.so" })).not.toBeNull();
    expect(await asOwner.query(api.sites.hasPageview, { domain: "picai.so" })).toBe(true);
    expect(await asOwner.query(api.sites.goalNames, { domain: "picai.so" })).toEqual([]);
    expect(await asOwner.query(api.apiKeys.list, {})).toHaveLength(1);
    await asOwner.mutation(api.sites.create, { domain: "second.dev", timezone: "UTC" });
    await asOwner.mutation(api.sites.remove, { domain: "second.dev" });
    expect(await asOwner.query(api.sites.list, {})).toHaveLength(1);
  });
});
