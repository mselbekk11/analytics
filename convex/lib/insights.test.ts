import { describe, expect, test } from "vitest";
import type { Doc } from "../_generated/dataModel";
import {
  clerkUserId,
  insightPeriod,
  recipientAllowed,
  signUnsubscribe,
  verifyUnsubscribe,
  wantsCadence,
} from "./insights";

// Insight emails (launch v1 Phase 15): the periods, the switches' defaults and the
// unsubscribe token.

const at = (iso: string) => Date.parse(iso);

describe("insightPeriod", () => {
  test("daily is the latest whole local day", () => {
    const now = at("2026-11-16T07:00:00Z"); // the daily cron
    expect(insightPeriod("daily", now, "UTC")).toEqual({ from: "2026-11-15", to: "2026-11-15" });
    expect(insightPeriod("daily", now, "Europe/Oslo")).toEqual({ from: "2026-11-15", to: "2026-11-15" });
    expect(insightPeriod("daily", now, "Asia/Tokyo")).toEqual({ from: "2026-11-15", to: "2026-11-15" });
    // 23:00 on the 15th in Los Angeles: the 15th hasn't ended, so the 14th
    expect(insightPeriod("daily", now, "America/Los_Angeles")).toEqual({ from: "2026-11-14", to: "2026-11-14" });
    // In summer (UTC-7) 07:00 UTC is midnight there, so it is yesterday again
    expect(insightPeriod("daily", at("2026-07-16T07:00:00Z"), "America/Los_Angeles")).toEqual({
      from: "2026-07-15",
      to: "2026-07-15",
    });
  });

  test("weekly is the Monday-to-Sunday week that ended", () => {
    const now = at("2026-11-16T09:00:00Z"); // Monday, the weekly cron
    const lastWeek = { from: "2026-11-09", to: "2026-11-15" };
    expect(insightPeriod("weekly", now, "UTC")).toEqual(lastWeek);
    expect(insightPeriod("weekly", now, "America/Los_Angeles")).toEqual(lastWeek); // 01:00 Monday
    expect(insightPeriod("weekly", now, "Pacific/Auckland")).toEqual(lastWeek); // 22:00 Monday
    expect(insightPeriod("weekly", now, "Pacific/Kiritimati")).toEqual(lastWeek); // UTC+14, 23:00 Monday
    // 23:00 Sunday in Honolulu: that week hasn't ended, so the one before
    expect(insightPeriod("weekly", now, "Pacific/Honolulu")).toEqual({ from: "2026-11-02", to: "2026-11-08" });
    // Any day of the week gives the last whole week
    expect(insightPeriod("weekly", at("2026-11-21T12:00:00Z"), "UTC")).toEqual(lastWeek); // Saturday
  });

  test("weekly across the end of daylight saving time", () => {
    // US clocks went back on Sunday 2026-11-01; Monday 09:00 UTC is 01:00 PST
    expect(insightPeriod("weekly", at("2026-11-02T09:00:00Z"), "America/Los_Angeles")).toEqual({
      from: "2026-10-26",
      to: "2026-11-01",
    });
  });

  test("monthly is the calendar month that ended", () => {
    expect(insightPeriod("monthly", at("2026-12-01T09:00:00Z"), "UTC")).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    expect(insightPeriod("monthly", at("2026-12-01T09:00:00Z"), "Asia/Tokyo")).toEqual({
      from: "2026-11-01",
      to: "2026-11-30",
    });
    // Still November 30th in Honolulu
    expect(insightPeriod("monthly", at("2026-12-01T09:00:00Z"), "Pacific/Honolulu")).toEqual({
      from: "2026-10-01",
      to: "2026-10-31",
    });
    expect(insightPeriod("monthly", at("2027-01-01T09:00:00Z"), "UTC")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
    expect(insightPeriod("monthly", at("2028-03-01T09:00:00Z"), "UTC")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
  });
});

describe("wantsCadence", () => {
  const account = (fields: Partial<Doc<"accounts">> = {}) => ({ ownerId: "x", trialEndsAt: 0, ...fields }) as Doc<"accounts">;

  test("a missing field means daily off, weekly and monthly on", () => {
    expect(wantsCadence(account(), "daily")).toBe(false);
    expect(wantsCadence(account(), "weekly")).toBe(true);
    expect(wantsCadence(account(), "monthly")).toBe(true);
  });

  test("a set field wins", () => {
    const a = account({ emailDaily: true, emailWeekly: false, emailMonthly: false });
    expect(wantsCadence(a, "daily")).toBe(true);
    expect(wantsCadence(a, "weekly")).toBe(false);
    expect(wantsCadence(a, "monthly")).toBe(false);
  });
});

describe("unsubscribe token", () => {
  const SECRET = "s3cret";
  const ID = "k17abc123";

  test("a valid token names its account and cadence", async () => {
    const token = await signUnsubscribe(SECRET, ID, "weekly");
    expect(await verifyUnsubscribe(SECRET, token)).toEqual({ accountId: ID, cadence: "weekly" });
  });

  test("a tampered signature is refused", async () => {
    const token = await signUnsubscribe(SECRET, ID, "weekly");
    const last = token.at(-1) === "A" ? "B" : "A";
    expect(await verifyUnsubscribe(SECRET, token.slice(0, -1) + last)).toBeNull();
    expect(await verifyUnsubscribe(SECRET, token.slice(0, -2))).toBeNull();
  });

  test("another cadence or account under the same signature is refused", async () => {
    const [, , sig] = (await signUnsubscribe(SECRET, ID, "weekly")).split(".");
    expect(await verifyUnsubscribe(SECRET, `${ID}.daily.${sig}`)).toBeNull();
    expect(await verifyUnsubscribe(SECRET, `${ID}.monthly.${sig}`)).toBeNull();
    expect(await verifyUnsubscribe(SECRET, `k17other.weekly.${sig}`)).toBeNull();
  });

  test("a token signed with another secret is refused", async () => {
    expect(await verifyUnsubscribe(SECRET, await signUnsubscribe("other", ID, "weekly"))).toBeNull();
  });

  test("malformed tokens are refused", async () => {
    for (const bad of ["", "x", `${ID}.weekly`, `${ID}.yearly.abc`, `.weekly.abc`, `${ID}.weekly.abc.def`]) {
      expect(await verifyUnsubscribe(SECRET, bad)).toBeNull();
    }
  });
});

describe("helpers", () => {
  test("clerkUserId takes the part after the issuer", () => {
    expect(clerkUserId("https://clerk.simplestats.ai|user_2abc")).toBe("user_2abc");
    expect(clerkUserId("no-bar")).toBeNull();
    expect(clerkUserId("https://issuer|")).toBeNull();
  });

  test("recipientAllowed: no list allows anyone, a list only those on it", () => {
    expect(recipientAllowed("a@b.co", undefined)).toBe(true);
    expect(recipientAllowed("a@b.co", " ")).toBe(true);
    expect(recipientAllowed("A@b.co", "x@y.co, a@b.co")).toBe(true);
    expect(recipientAllowed("c@b.co", "x@y.co,a@b.co")).toBe(false);
  });
});
