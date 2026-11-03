import { describe, expect, test } from "vitest";
import { formatNumber, formatRate } from "@/lib/format";
import { funnelSteps } from "@/lib/mockCharts";
import { funnelMock, goalsMock } from "./fixtures";

// The typed tiles must agree with the rows they summarise, so an edit to one shows up here

describe("goalsMock", () => {
  const rates = goalsMock.rows.map((r) => r.conversions / goalsMock.visitors);
  const tile = (label: string) => goalsMock.tiles.find((t) => t.label === label)?.value;

  test("its tiles match the rows", () => {
    expect(tile("Goals tracked")).toBe(String(goalsMock.rows.length));
    expect(tile("Conversions")).toBe(formatNumber(goalsMock.rows.reduce((sum, r) => sum + r.conversions, 0)));
    expect(tile("Avg. rate")).toBe(formatRate(rates.reduce((a, b) => a + b, 0) / rates.length));
  });

  test("rows are sorted by conversions and one is the key goal", () => {
    const counts = goalsMock.rows.map((r) => r.conversions);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
    expect(goalsMock.rows.filter((r) => r.key)).toHaveLength(1);
  });
});

describe("funnelMock", () => {
  test("has two to eight steps, each reached by no more visitors than the one before", () => {
    const counts = funnelMock.steps.map((s) => s.visitors);
    expect(counts.length).toBeGreaterThanOrEqual(2);
    expect(counts.length).toBeLessThanOrEqual(8);
    expect(funnelSteps(counts).map((s) => s.count)).toEqual(counts);
  });
});
