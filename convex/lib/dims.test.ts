import { describe, expect, test } from "vitest";
import { listCount, listCounts, rankEntries, topEntries, type DimEntry } from "./dims";

const row = (key: string, c: Partial<Omit<DimEntry, "key">>): DimEntry => ({
  key,
  pageviews: 0,
  visitors: 0,
  sessions: 0,
  events: 0,
  revenueMinor: 0,
  ...c,
});

describe("listCount", () => {
  test("uses the card metric where the list has it", () => {
    expect(listCount("page", "visitors")).toBe("visitors");
    expect(listCount("page", "pageviews")).toBe("pageviews");
    expect(listCount("country", "revenue")).toBe("revenueMinor");
    expect(listCount("source", "revenue")).toBe("revenueMinor");
  });

  test("falls back to the list's own count", () => {
    // Session lists have no pageviews in the rollups
    expect(listCount("source", "pageviews")).toBe("visitors");
    expect(listCount("entry", "pageviews")).toBe("sessions");
    expect(listCount("outbound", "pageviews")).toBe("events");
    // Payments aren't credited to pages or devices
    expect(listCount("page", "revenue")).toBe("pageviews");
    expect(listCount("device", "revenue")).toBe("visitors");
    expect(listCount("page")).toBe("pageviews");
  });
});

describe("listCounts", () => {
  test("keeps the counts each kind of list has", () => {
    expect(listCounts("country", false)).toEqual(["pageviews", "visitors"]);
    expect(listCounts("country", true)).toEqual(["pageviews", "visitors", "revenueMinor"]);
    expect(listCounts("page", true)).toEqual(["pageviews", "visitors"]);
    expect(listCounts("source", true)).toEqual(["visitors", "sessions", "revenueMinor"]);
    expect(listCounts("entry", false)).toEqual(["visitors", "sessions"]);
    expect(listCounts("goal", false)).toEqual(["visitors", "events"]);
  });
});

describe("rankEntries", () => {
  const countries = [
    row("US", { pageviews: 9, visitors: 2, revenueMinor: 500 }),
    row("NO", { pageviews: 3, visitors: 3 }),
    row("Unknown", { revenueMinor: 4900 }),
    row("DE", { pageviews: 1, visitors: 1, revenueMinor: -200 }),
  ];

  test("re-ranks by each metric and drops rows without it", () => {
    expect(rankEntries("country", countries, "visitors").map((r) => r.key)).toEqual(["NO", "US", "DE"]);
    expect(rankEntries("country", countries, "pageviews").map((r) => r.key)).toEqual(["US", "NO", "DE"]);
    // A refund-only key keeps its negative amount, at the bottom
    expect(rankEntries("country", countries, "revenue").map((r) => r.key)).toEqual(["Unknown", "US", "DE"]);
  });

  test("without a metric, keeps revenue-only keys under the list's own count", () => {
    expect(rankEntries("country", countries).map((r) => r.key)).toEqual(["NO", "US", "DE", "Unknown"]);
  });
});

describe("topEntries", () => {
  test("keeps every key in the top by any metric, so re-ranking sees the real top", () => {
    const rows = [
      row("/a", { pageviews: 10, visitors: 1 }),
      row("/b", { pageviews: 5, visitors: 5 }),
      row("/c", { pageviews: 4, visitors: 2 }),
    ];
    const top = topEntries("page", rows, 1);
    // /a leads on pageviews, /b on visitors; /c leads on nothing
    expect(top.map((r) => r.key)).toEqual(["/a", "/b"]);
    expect(rankEntries("page", top, "visitors")[0].key).toBe("/b");
  });
});
