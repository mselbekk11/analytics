import { describe, expect, test } from "vitest";
import { pricing } from "@/components/home/content";
import { fittingTierIndex, lookupKey, stripePrices, tierByEvents } from "../../convex/lib/tiers";
import { formatEvents, formatPrice, STEPS, stepLabel, stepValueText, tierAt, tierPrice, TIERS } from "./pricing";

describe("the tiers (decided 2026-11-10)", () => {
  test("are 500k $5, 1M $8, 2.5M $15, 5M $25 and 10M $39 a month", () => {
    expect(pricing.tiers.map((t) => [t.label, t.events, t.monthly])).toEqual([
      ["500k", 500_000, 5],
      ["1M", 1_000_000, 8],
      ["2.5M", 2_500_000, 15],
      ["5M", 5_000_000, 25],
      ["10M", 10_000_000, 39],
    ]);
  });

  test("yearly is 10× monthly (2 months free)", () => {
    for (const t of pricing.tiers) expect(t.yearly).toBe(t.monthly * 10);
  });

  test("the homepage, /billing and the Stripe script share one list", () => {
    expect(pricing.tiers).toBe(TIERS);
  });
});

describe("the Stripe prices", () => {
  test("are one per tier and interval, ten in all, with unique lookup keys", () => {
    const prices = stripePrices();
    expect(prices).toHaveLength(10);
    expect(new Set(prices.map((p) => p.lookupKey)).size).toBe(10);
    expect(prices.map((p) => p.lookupKey)).toEqual([
      "events_500k_month",
      "events_500k_year",
      "events_1m_month",
      "events_1m_year",
      "events_2_5m_month",
      "events_2_5m_year",
      "events_5m_month",
      "events_5m_year",
      "events_10m_month",
      "events_10m_year",
    ]);
  });

  test("charge what the homepage shows, for all ten pairs", () => {
    for (const p of stripePrices()) {
      const tier = tierByEvents(p.events)!;
      expect(p.lookupKey).toBe(lookupKey(tier, p.interval));
      const shown = tierPrice(tier, p.interval).amount;
      expect(shown).toBe(formatPrice(p.unitAmount / 100));
    }
  });
});

describe("the slider", () => {
  test("has the five tiers then 10M+", () => {
    expect(STEPS).toBe(6);
    expect(Array.from({ length: STEPS }, (_, i) => stepLabel(i))).toEqual(["500k", "1M", "2.5M", "5M", "10M", "10M+"]);
    expect(tierAt(5)).toBeNull();
  });

  test("shows the right price and event count at every step, in both intervals", () => {
    expect(TIERS.map((t) => [tierPrice(t, "month").amount, tierPrice(t, "year").amount])).toEqual([
      ["$5", "$50"],
      ["$8", "$80"],
      ["$15", "$150"],
      ["$25", "$250"],
      ["$39", "$390"],
    ]);
    expect(tierPrice(TIERS[1], "month")).toEqual({ amount: "$8", unit: "/ month", note: "or $80 a year, 2 months free" });
    expect(tierPrice(TIERS[1], "year")).toEqual({ amount: "$80", unit: "/ year", note: "$6.67 a month, billed yearly" });
    expect(stepValueText(2)).toBe("2,500,000 events a month");
    expect(stepValueText(5)).toBe("More than 10,000,000 events a month");
  });

  test("starts on the tier that fits, 500k with no traffic, and Get in touch above 10M", () => {
    expect(fittingTierIndex(0)).toBe(0);
    expect(fittingTierIndex(500_000)).toBe(0);
    expect(fittingTierIndex(500_001)).toBe(1);
    expect(fittingTierIndex(3_000_000)).toBe(3);
    expect(fittingTierIndex(10_000_000)).toBe(4);
    expect(fittingTierIndex(10_000_001)).toBe(5);
  });

  test("groups thousands", () => {
    expect(formatPrice(1290)).toBe("$1,290");
    expect(formatEvents(2_500_000)).toBe("2,500,000");
  });
});
