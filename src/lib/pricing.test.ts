import { describe, expect, test } from "vitest";
import { pricing } from "@/components/home/content";
import { formatEvents, formatPrice, maxYearlySaving, planPrice, yearlySaving, type Plan } from "./pricing";

const plan = (monthly: number, yearly: number): Plan => ({ name: "P", audience: "", monthly, yearly, events: 1 });

describe("planPrice", () => {
  const growth = { name: "Growth", audience: "", monthly: 8, yearly: 69, events: 1_000_000 };

  test("shows the monthly price with the yearly one under it", () => {
    expect(planPrice(growth, "monthly")).toEqual({ amount: "$8", unit: "/ month", note: "or $69 billed yearly" });
  });

  test("shows the yearly price with the monthly one under it", () => {
    expect(planPrice(growth, "yearly")).toEqual({
      amount: "$69",
      unit: "/ year",
      note: "or $8 / month billed monthly",
    });
  });

  test("groups thousands", () => {
    expect(formatPrice(1290)).toBe("$1,290");
    expect(formatEvents(2_500_000)).toBe("2,500,000");
  });
});

describe("yearly saving", () => {
  test("is the share of twelve monthly payments saved", () => {
    expect(yearlySaving(plan(8, 69))).toBeCloseTo(28.125);
    expect(yearlySaving(plan(10, 120))).toBe(0);
    expect(yearlySaving(plan(0, 0))).toBe(0);
  });

  test("'up to' is the best plan's saving, rounded down", () => {
    expect(maxYearlySaving([plan(5, 49), plan(8, 69), plan(19, 179)])).toBe(28);
    expect(maxYearlySaving([plan(10, 100)])).toBe(16); // 16.67%, never shown as 17
    expect(maxYearlySaving([])).toBe(0);
  });
});

describe("the homepage plans", () => {
  test("are Starter, Growth (popular) and Scale at $5 / $8 / $19 a month and $49 / $69 / $179 a year", () => {
    expect(pricing.plans.map((p) => [p.name, p.monthly, p.yearly, p.events, !!p.popular])).toEqual([
      ["Starter", 5, 49, 500_000, false],
      ["Growth", 8, 69, 1_000_000, true],
      ["Scale", 19, 179, 2_500_000, false],
    ]);
  });

  test("save up to 28% yearly", () => {
    expect(maxYearlySaving(pricing.plans)).toBe(28);
  });

  test("show every plan's monthly and yearly strings", () => {
    expect(pricing.plans.map((p) => planPrice(p, "monthly"))).toEqual([
      { amount: "$5", unit: "/ month", note: "or $49 billed yearly" },
      { amount: "$8", unit: "/ month", note: "or $69 billed yearly" },
      { amount: "$19", unit: "/ month", note: "or $179 billed yearly" },
    ]);
    expect(pricing.plans.map((p) => planPrice(p, "yearly").amount + " " + planPrice(p, "yearly").note)).toEqual([
      "$49 or $5 / month billed monthly",
      "$69 or $8 / month billed monthly",
      "$179 or $19 / month billed monthly",
    ]);
  });
});
