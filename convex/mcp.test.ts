/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import { sha256Hex } from "./lib/keys";
import { LAST_USED_STEP_MS } from "./mcp";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const SECRET = "test-secret";
const OWNER = { subject: "user_1", tokenIdentifier: "clerk|user_1" };
const STRANGER = { subject: "user_2", tokenIdentifier: "clerk|user_2" };
// Los Angeles is UTC-7 in October, so 17:00Z is 10:00 local on the same date
const NOW = Date.parse("2026-10-13T20:00:00Z");

let pvCounter = 0;

async function visit(
  t: ReturnType<typeof convexTest>,
  iso: string,
  h: { visitorId?: string; sessionId?: string; path?: string; device?: "mobile" | "desktop"; country?: string } = {},
) {
  vi.setSystemTime(new Date(iso));
  await t.mutation(api.ingest.pageview, {
    secret: SECRET,
    site: "picai.so",
    hostname: "picai.so",
    path: h.path ?? "/",
    referrer: "(direct)",
    unique: true,
    device: h.device ?? "desktop",
    browser: "Chrome",
    country: h.country ?? "US",
    pvId: `pv-${++pvCounter}`,
    visitorId: h.visitorId,
    sessionId: h.sessionId,
  });
}

/** Two sites, picai.so (the owner's) and other.dev (a stranger's), and a key for each owner. */
async function setup() {
  const t = convexTest(schema, modules);
  await t.withIdentity(OWNER).mutation(api.sites.create, { domain: "picai.so", timezone: "America/Los_Angeles" });
  await t.withIdentity(STRANGER).mutation(api.sites.create, { domain: "other.dev", timezone: "UTC" });
  const { key } = await t.withIdentity(OWNER).action(api.apiKeys.create, { name: "Laptop" });
  const { key: strangerKey } = await t.withIdentity(STRANGER).action(api.apiKeys.create, { name: "Theirs" });
  return { t, keyHash: await sha256Hex(key), strangerHash: await sha256Hex(strangerKey), key };
}

beforeEach(() => {
  vi.stubEnv("INGEST_SECRET", SECRET);
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("apiKeys", () => {
  test("a new key is shown once and stored only as its SHA-256, with a prefix to tell it apart", async () => {
    const { t, key, keyHash } = await setup();
    expect(key).toMatch(/^vamcp_[0-9a-f]{48}$/);
    const rows = await t.run((ctx) => ctx.db.query("apiKeys").collect());
    const mine = rows.find((r) => r.ownerId === OWNER.tokenIdentifier)!;
    expect(mine).toMatchObject({ name: "Laptop", hash: keyHash, prefix: key.slice(0, 12) });
    expect(JSON.stringify(rows)).not.toContain(key);

    const listed = await t.withIdentity(OWNER).query(api.apiKeys.list, {});
    expect(listed).toEqual([{ id: mine._id, name: "Laptop", prefix: key.slice(0, 12), createdAt: NOW, lastUsedAt: null }]);
    expect(JSON.stringify(listed)).not.toContain(keyHash);
  });

  test("names are required and keys are per account", async () => {
    const { t } = await setup();
    await expect(t.withIdentity(OWNER).action(api.apiKeys.create, { name: "  " })).rejects.toThrow(/name/);
    await expect(t.action(api.apiKeys.create, { name: "x" })).rejects.toThrow(/Not signed in/);
    const theirs = await t.withIdentity(STRANGER).query(api.apiKeys.list, {});
    expect(theirs.map((k) => k.name)).toEqual(["Theirs"]);
  });

  test("only the owner can revoke a key, and a revoked key leaves the list", async () => {
    const { t } = await setup();
    const [mine] = await t.withIdentity(OWNER).query(api.apiKeys.list, {});
    await expect(t.withIdentity(STRANGER).mutation(api.apiKeys.revoke, { id: mine.id })).rejects.toThrow(/Key not found/);
    await t.withIdentity(OWNER).mutation(api.apiKeys.revoke, { id: mine.id });
    expect(await t.withIdentity(OWNER).query(api.apiKeys.list, {})).toEqual([]);
  });
});

describe("mcp.authenticate", () => {
  test("accepts an active key and refuses unknown and revoked ones", async () => {
    const { t, keyHash } = await setup();
    expect(await t.mutation(api.mcp.authenticate, { secret: SECRET, keyHash })).toBe(true);
    expect(await t.mutation(api.mcp.authenticate, { secret: SECRET, keyHash: await sha256Hex("vamcp_nope") })).toBe(false);
    const [mine] = await t.withIdentity(OWNER).query(api.apiKeys.list, {});
    await t.withIdentity(OWNER).mutation(api.apiKeys.revoke, { id: mine.id });
    expect(await t.mutation(api.mcp.authenticate, { secret: SECRET, keyHash })).toBe(false);
  });

  test("needs INGEST_SECRET", async () => {
    const { t, keyHash } = await setup();
    await expect(t.mutation(api.mcp.authenticate, { secret: "wrong", keyHash })).rejects.toThrow(/ingest secret/);
    await expect(t.query(api.mcp.sites, { secret: "wrong", keyHash })).rejects.toThrow(/ingest secret/);
  });

  test("moves lastUsedAt at most once a minute", async () => {
    const { t, keyHash } = await setup();
    const lastUsed = async () => (await t.withIdentity(OWNER).query(api.apiKeys.list, {}))[0].lastUsedAt;
    await t.mutation(api.mcp.authenticate, { secret: SECRET, keyHash });
    expect(await lastUsed()).toBe(NOW);
    vi.setSystemTime(NOW + LAST_USED_STEP_MS - 1);
    await t.mutation(api.mcp.authenticate, { secret: SECRET, keyHash });
    expect(await lastUsed()).toBe(NOW);
    vi.setSystemTime(NOW + LAST_USED_STEP_MS);
    await t.mutation(api.mcp.authenticate, { secret: SECRET, keyHash });
    expect(await lastUsed()).toBe(NOW + LAST_USED_STEP_MS);
  });
});

describe("mcp tools", () => {
  test("list_sites returns the key owner's domains only", async () => {
    const { t, keyHash, strangerHash } = await setup();
    const mine = await t.query(api.mcp.sites, { secret: SECRET, keyHash });
    expect(mine.map((s: { domain: string }) => s.domain)).toEqual(["picai.so"]);
    const theirs = await t.query(api.mcp.sites, { secret: SECRET, keyHash: strangerHash });
    expect(theirs.map((s: { domain: string }) => s.domain)).toEqual(["other.dev"]);
  });

  test("someone else's domain reads exactly like a missing one", async () => {
    const { t, keyHash } = await setup();
    const call = (domain: string) => t.query(api.mcp.summary, { secret: SECRET, keyHash, domain, now: NOW });
    await expect(call("other.dev")).rejects.toThrow(/Site not found/);
    await expect(call("nowhere.example")).rejects.toThrow(/Site not found/);
    for (const query of [api.mcp.live, api.mcp.timeseries, api.mcp.pages, api.mcp.visitors]) {
      await expect(t.query(query, { secret: SECRET, keyHash, domain: "other.dev", now: NOW })).rejects.toThrow(
        /Site not found/,
      );
    }
    await expect(
      t.query(api.mcp.breakdown, { secret: SECRET, keyHash, domain: "other.dev", now: NOW, dim: "page" }),
    ).rejects.toThrow(/Site not found/);
    await expect(
      t.query(api.mcp.journey, { secret: SECRET, keyHash, domain: "other.dev", now: NOW, visitorId: "x" }),
    ).rejects.toThrow(/Site not found/);
  });

  test("a revoked key is refused by every tool at once", async () => {
    const { t, keyHash } = await setup();
    await t.query(api.mcp.sites, { secret: SECRET, keyHash });
    const [mine] = await t.withIdentity(OWNER).query(api.apiKeys.list, {});
    await t.withIdentity(OWNER).mutation(api.apiKeys.revoke, { id: mine.id });
    await expect(t.query(api.mcp.sites, { secret: SECRET, keyHash })).rejects.toThrow(/Unauthorized/);
    await expect(
      t.query(api.mcp.summary, { secret: SECRET, keyHash, domain: "picai.so", now: NOW }),
    ).rejects.toThrow(/Unauthorized/);
  });

  test("the numbers are the dashboard's, with the range and timezone echoed back", async () => {
    const { t, keyHash } = await setup();
    await visit(t, "2026-10-12T17:00:00Z", { visitorId: "v1", sessionId: "s1", path: "/" });
    await visit(t, "2026-10-12T17:01:00Z", { visitorId: "v1", sessionId: "s1", path: "/pricing" });
    await visit(t, "2026-10-13T17:00:00Z", { visitorId: "v2", sessionId: "s2", path: "/", device: "mobile", country: "NO" });
    vi.setSystemTime(NOW);
    const asOwner = t.withIdentity(OWNER);
    const range = { from: "2026-10-07", to: "2026-10-13" };
    const args = { secret: SECRET, keyHash, domain: "picai.so", now: NOW, range: "7d" };

    const summary = await t.query(api.mcp.summary, args);
    const ui = await asOwner.query(api.stats.summary, { domain: "picai.so", ...range });
    expect(summary).toMatchObject({
      domain: "picai.so",
      timezone: "America/Los_Angeles",
      range: { param: "7d", ...range, granularity: "day" },
      filters: "",
      current: ui.current,
      previous: ui.previous,
    });
    expect(summary.current).toMatchObject({ visitors: 2, pageviews: 3 });

    const pages = await t.query(api.mcp.breakdown, { ...args, dim: "page" });
    const uiPages = await asOwner.query(api.stats.breakdown, { domain: "picai.so", ...range, dim: "page" });
    expect(pages.rows.map((r) => [r.key, r.pageviews])).toEqual(
      uiPages.rows.map((r) => [r.key, r.pageviews]),
    );

    // Only the counts a list keeps: countries have no sessions, sources no pageviews
    const countries = await t.query(api.mcp.breakdown, { ...args, dim: "country" });
    expect(Object.keys(countries.rows[0]).sort()).toEqual(["key", "pageviews", "visitors"]);
    expect(Object.keys(countries.totals).sort()).toEqual(["pageviews", "visitors"]);
    const sources = await t.query(api.mcp.breakdown, { ...args, dim: "source" });
    expect(Object.keys(sources.rows[0]).sort()).toEqual(["key", "sessions", "visitors"]);

    // Filtered, through the same view as the dashboard's ?f=
    const filtered = await t.query(api.mcp.summary, { ...args, filters: "device:mobile" });
    const uiFiltered = await asOwner.query(api.stats.filtered, {
      domain: "picai.so",
      ...range,
      filters: [{ dim: "device", value: "mobile" }],
    });
    if (uiFiltered.status !== "ok") throw new Error("expected a filtered view");
    expect(filtered.current).toEqual(uiFiltered.summary.current);
    expect(filtered.filters).toBe("device:mobile");

    const series = await t.query(api.mcp.timeseries, args);
    const uiSeries = await asOwner.query(api.stats.timeseries, { domain: "picai.so", ...range });
    expect(series.points.map((p: { visitors: number }) => p.visitors)).toEqual(uiSeries.map((p) => p.visitors));

    // Today is hourly, as on the dashboard
    const today = await t.query(api.mcp.summary, { ...args, range: "today" });
    expect(today.range).toMatchObject({ granularity: "hour", from: "2026-10-13", to: "2026-10-13" });
    expect(today.current).toMatchObject({ pageviews: 1, visitors: 1 });
  });

  test("visitors, a journey and live go through the Users and Live helpers", async () => {
    const { t, keyHash } = await setup();
    await visit(t, "2026-10-13T19:58:00Z", { visitorId: "v1", sessionId: "s1", path: "/" });
    vi.setSystemTime(NOW);
    const args = { secret: SECRET, keyHash, domain: "picai.so", now: NOW };
    const visitors = await t.query(api.mcp.visitors, { ...args, range: "today" });
    expect(visitors.rows.map((r: { visitorId: string }) => r.visitorId)).toEqual(["v1"]);
    const journey = await t.query(api.mcp.journey, { ...args, visitorId: "v1" });
    expect(journey).toMatchObject({ visitorId: "v1", sessionCount: 1 });
    // No payments on this site, so no currency
    expect(visitors).toMatchObject({ currency: null });
    expect(journey.currency).toBeNull();
    await expect(t.query(api.mcp.journey, { ...args, visitorId: "nobody" })).rejects.toThrow(/Visitor not found/);
    const live = await t.query(api.mcp.live, args);
    expect(live).toMatchObject({ online: 1, visitors: [{ visitorId: "v1", path: "/" }] });
  });

  test("an unreadable range or filter is refused instead of falling back", async () => {
    const { t, keyHash } = await setup();
    const args = { secret: SECRET, keyHash, domain: "picai.so", now: NOW };
    await expect(t.query(api.mcp.summary, { ...args, range: "last week" })).rejects.toThrow(/Invalid range/);
    await expect(t.query(api.mcp.summary, { ...args, filters: "colour:red" })).rejects.toThrow(/Invalid filters/);
  });
});
