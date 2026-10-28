/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const SECRET = "test-secret";
const OWNER = { subject: "user_1", tokenIdentifier: "clerk|user_1" };
const STRANGER = { subject: "user_2", tokenIdentifier: "clerk|user_2" };

const VID_A = "0b6f3a52-6c1e-4f7e-9a51-2d3c4b5a6f70";
const VID_B = "0b6f3a52-6c1e-4f7e-9a51-2d3c4b5a6f7b";
const SID1 = "1b6f3a52-6c1e-4f7e-9a51-2d3c4b5a6f71";
const SID2 = "2b6f3a52-6c1e-4f7e-9a51-2d3c4b5a6f72";
const SID3 = "3b6f3a52-6c1e-4f7e-9a51-2d3c4b5a6f73";

type T = ReturnType<typeof convexTest>;

async function setup(revenueSource: "api" | "none" = "api", keyGoal: string | null = null) {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity(OWNER);
  await owner.mutation(api.sites.create, { domain: "picai.so", timezone: "America/Los_Angeles" });
  await owner.mutation(api.sites.setRevenue, { domain: "picai.so", revenueSource, currency: "USD" });
  if (keyGoal !== null) await owner.mutation(api.sites.setKeyGoal, { domain: "picai.so", keyGoal });
  const key = await owner.action(api.sites.createApiKey, { domain: "picai.so" });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  const keyHash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return { t, owner, keyHash };
}

/** A pageview at `iso` with visitor and session ids, through the real ingest mutation. */
async function visit(
  t: T,
  iso: string,
  o: { vid: string; sid: string; pvId: string; path?: string; referrer?: string; utmSource?: string },
) {
  vi.setSystemTime(new Date(iso));
  await t.mutation(api.ingest.pageview, {
    secret: SECRET,
    site: "picai.so",
    hostname: "picai.so",
    path: o.path ?? "/",
    referrer: o.referrer ?? "(direct)",
    unique: true,
    device: "mobile",
    browser: "Mobile Safari",
    os: "iOS",
    country: "US",
    region: "CA",
    city: "San Francisco",
    pvId: o.pvId,
    visitorId: o.vid,
    sessionId: o.sid,
    ...(o.utmSource ? { campaign: { utmSource: o.utmSource } } : {}),
  });
}

async function goal(t: T, iso: string, pvId: string, name: string) {
  vi.setSystemTime(new Date(iso));
  await t.mutation(api.ingest.event, {
    secret: SECRET,
    site: "picai.so",
    hostname: "picai.so",
    pvId,
    event: { type: "goal", name },
  });
}

async function pay(t: T, keyHash: string, iso: string, id: string, amountMinor: number, visitorId?: string) {
  vi.setSystemTime(new Date(iso));
  return await t.mutation(api.payments.recordApi, {
    secret: SECRET,
    keyHash,
    payment: { id, amountMinor, currency: "USD", ...(visitorId ? { visitorId } : {}) },
  });
}

beforeEach(() => {
  vi.stubEnv("INGEST_SECRET", SECRET);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

test("customers and profiles belong to the site's owner", async () => {
  const { t } = await setup();
  await visit(t, "2026-10-13T17:00:00Z", { vid: VID_A, sid: SID1, pvId: "pv-1" });
  const calls = [
    (c: T) => c.query(api.visitors.customers, { domain: "picai.so" }),
    (c: T) => c.query(api.visitors.profile, { domain: "picai.so", visitorId: VID_A }),
  ];
  for (const call of calls) {
    await expect(call(t)).rejects.toThrow(/Not signed in/);
    await expect(call(t.withIdentity(STRANGER) as T)).rejects.toThrow(/Site not found/);
    await expect(call(t.withIdentity(OWNER) as T)).resolves.toBeDefined();
  }
});

describe("customers", () => {
  test("lists paying visitors newest first, with first and credited source", async () => {
    const { t, owner, keyHash } = await setup();
    // A: arrives from a tagged link, comes back Direct and pays; B: from Google, pays later
    await visit(t, "2026-10-10T17:00:00Z", { vid: VID_A, sid: SID1, pvId: "pv-1", utmSource: "test" });
    await visit(t, "2026-10-12T17:00:00Z", { vid: VID_A, sid: SID2, pvId: "pv-2" });
    await pay(t, keyHash, "2026-10-12T17:05:00Z", "order_a", 4900, VID_A);
    await visit(t, "2026-10-13T16:00:00Z", { vid: VID_B, sid: SID3, pvId: "pv-3", referrer: "google.com" });
    await pay(t, keyHash, "2026-10-13T17:00:00Z", "order_b", 1500, VID_B);
    await pay(t, keyHash, "2026-10-13T17:10:00Z", "order_b2", 1500, VID_B);
    // Unattributed payments and visitors who never paid are not customers
    await pay(t, keyHash, "2026-10-13T18:00:00Z", "order_x", 999);

    const result = await owner.query(api.visitors.customers, { domain: "picai.so" });
    expect(result).toMatchObject({ kinds: ["revenue"], kind: "revenue", currency: "USD", more: false });
    expect(result.rows).toEqual([
      {
        visitorId: VID_B,
        name: null,
        email: null,
        firstSeen: Date.parse("2026-10-13T16:00:00Z"),
        firstSource: "Google",
        firstChannel: "Organic Search",
        creditedSource: "Google",
        creditedChannel: "Organic Search",
        country: "US",
        revenueMinor: 3000,
        convertedAt: Date.parse("2026-10-13T17:00:00Z"),
      },
      expect.objectContaining({
        visitorId: VID_A,
        firstSource: "test",
        // The Direct return visit is not credited; the tagged one is
        creditedSource: "test",
        revenueMinor: 4900,
        convertedAt: Date.parse("2026-10-12T17:05:00Z"),
        firstSeen: Date.parse("2026-10-10T17:00:00Z"),
      }),
    ]);
  });

  test("a site without revenue lists visitors who completed the key goal, at their first completion", async () => {
    const { t, owner } = await setup("none", "signup");
    await visit(t, "2026-10-12T17:00:00Z", { vid: VID_A, sid: SID1, pvId: "pv-1", referrer: "chatgpt.com" });
    await goal(t, "2026-10-12T17:01:00Z", "pv-1", "signup");
    await visit(t, "2026-10-13T17:00:00Z", { vid: VID_A, sid: SID2, pvId: "pv-2" });
    await goal(t, "2026-10-13T17:01:00Z", "pv-2", "signup");
    await visit(t, "2026-10-13T17:00:00Z", { vid: VID_B, sid: SID3, pvId: "pv-3" });
    await goal(t, "2026-10-13T17:02:00Z", "pv-3", "newsletter");

    const result = await owner.query(api.visitors.customers, { domain: "picai.so" });
    expect(result).toMatchObject({ kinds: ["goal"], kind: "goal", keyGoal: "signup" });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      visitorId: VID_A,
      creditedSource: "ChatGPT",
      creditedChannel: "AI",
      convertedAt: Date.parse("2026-10-12T17:01:00Z"),
    });
  });

  test("a site with both picks revenue by default and the key goal when asked; one with neither has none", async () => {
    const { t, owner, keyHash } = await setup("api", "signup");
    await visit(t, "2026-10-13T17:00:00Z", { vid: VID_A, sid: SID1, pvId: "pv-1" });
    await goal(t, "2026-10-13T17:01:00Z", "pv-1", "signup");
    await visit(t, "2026-10-13T17:00:00Z", { vid: VID_B, sid: SID2, pvId: "pv-2" });
    await pay(t, keyHash, "2026-10-13T17:05:00Z", "order_b", 1500, VID_B);

    const paying = await owner.query(api.visitors.customers, { domain: "picai.so" });
    expect(paying.kinds).toEqual(["revenue", "goal"]);
    expect(paying.rows.map((r) => r.visitorId)).toEqual([VID_B]);
    const signedUp = await owner.query(api.visitors.customers, { domain: "picai.so", kind: "goal" });
    expect(signedUp.rows.map((r) => r.visitorId)).toEqual([VID_A]);

    await owner.mutation(api.sites.setRevenue, { domain: "picai.so", revenueSource: "none", currency: "USD" });
    await owner.mutation(api.sites.setKeyGoal, { domain: "picai.so", keyGoal: null });
    const none = await owner.query(api.visitors.customers, { domain: "picai.so", kind: "revenue" });
    expect(none).toMatchObject({ kinds: [], kind: null, rows: [] });
  });
});

describe("profile", () => {
  test("Done when: a journey runs from the tagged visit to the payment", async () => {
    const { t, owner, keyHash } = await setup();
    await visit(t, "2026-10-10T17:00:00Z", { vid: VID_A, sid: SID1, pvId: "pv-1", utmSource: "test" });
    vi.setSystemTime(new Date("2026-10-10T17:00:30Z"));
    await t.mutation(api.ingest.ping, { secret: SECRET, site: "picai.so", hostname: "picai.so", pvId: "pv-1", ms: 30_000 });
    await visit(t, "2026-10-10T17:01:00Z", { vid: VID_A, sid: SID1, pvId: "pv-2", path: "/pricing" });
    await t.mutation(api.ingest.event, {
      secret: SECRET,
      site: "picai.so",
      hostname: "picai.so",
      pvId: "pv-2",
      event: { type: "outbound", url: "https://github.com/" },
    });
    await visit(t, "2026-10-12T17:00:00Z", { vid: VID_A, sid: SID2, pvId: "pv-3", path: "/checkout" });
    await t.mutation(api.ingest.event, {
      secret: SECRET,
      site: "picai.so",
      hostname: "picai.so",
      pvId: "pv-3",
      event: { type: "identify", email: "Jo@Example.com", name: "Jo" },
    });
    await pay(t, keyHash, "2026-10-12T17:05:00Z", "order_a", 4900, VID_A);

    const p = await owner.query(api.visitors.profile, { domain: "picai.so", visitorId: VID_A });
    expect(p).toMatchObject({
      visitorId: VID_A,
      name: "Jo",
      email: "jo@example.com",
      sessionCount: 2,
      firstSource: "test",
      revenueMinor: 4900,
      firstPaidAt: Date.parse("2026-10-12T17:05:00Z"),
      currency: "USD",
      moreSessions: false,
    });
    const [first, second] = p!.sessions;
    expect(first).toMatchObject({
      sessionId: SID1,
      source: "test",
      utmSource: "test",
      pageviews: 2,
      credited: true,
      revenueMinor: 4900,
      os: "iOS",
      city: "San Francisco",
    });
    expect(first.items).toEqual([
      { type: "pageview", ts: Date.parse("2026-10-10T17:00:00Z"), path: "/", durationMs: 30_000 },
      { type: "pageview", ts: Date.parse("2026-10-10T17:01:00Z"), path: "/pricing", durationMs: null },
      { type: "outbound", ts: Date.parse("2026-10-10T17:01:00Z"), name: "https://github.com/", path: "/pricing" },
    ]);
    // The payment shows where it happened, and points at the session it was credited to
    expect(second).toMatchObject({ sessionId: SID2, source: "Direct", credited: false });
    expect(second.items.map((i) => i.type)).toEqual(["pageview", "identify", "payment"]);
    expect(second.items[2]).toEqual({
      type: "payment",
      ts: Date.parse("2026-10-12T17:05:00Z"),
      amountMinor: 4900,
      currency: "USD",
      renewal: false,
      matchedBy: "metadata",
      creditedSessionId: SID1,
    });
  });

  test("an unknown visitor, or another site's, is null", async () => {
    const { t, owner } = await setup();
    await owner.mutation(api.sites.create, { domain: "other.com", timezone: "UTC" });
    await visit(t, "2026-10-13T17:00:00Z", { vid: VID_A, sid: SID1, pvId: "pv-1" });
    expect(await owner.query(api.visitors.profile, { domain: "picai.so", visitorId: VID_B })).toBeNull();
    expect(await owner.query(api.visitors.profile, { domain: "other.com", visitorId: VID_A })).toBeNull();
  });
});
