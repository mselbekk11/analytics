import { describe, expect, test } from "vitest";
import { formatNumber, formatRate } from "@/lib/format";
import { funnelSteps } from "@/lib/mockCharts";
import { funnelMock, goalsMock, liveMock, searchMock } from "./fixtures";

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

describe("searchMock", () => {
  const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
  const tile = (label: string) => searchMock.tiles.find((t) => t.label === label);
  const series = (label: string) =>
    [...searchMock.chart.bars, ...searchMock.chart.lines].find((s) => s.label === label)?.values ?? [];
  const clicks = sum(series("Google clicks")) + sum(series("Bing clicks"));
  const impressions = sum(series("Impressions"));

  test("its tiles match the daily series", () => {
    expect(tile("Clicks")?.value).toBe(formatNumber(clicks));
    expect(tile("Impressions")?.value).toBe(`${(impressions / 1000).toFixed(1)}k`);
    expect(tile("Click-through rate")?.value).toBe(formatRate(clicks / impressions));
    const position = sum(series("Avg. position").map((p, i) => p * series("Impressions")[i])) / impressions;
    expect(tile("Avg. position")?.value).toBe(position.toFixed(1));
  });

  test("the rate's change follows from the clicks' and impressions'", () => {
    const change = (label: string) => tile(label)?.change ?? 0;
    const implied = (1 + change("Clicks")) / (1 + change("Impressions")) - 1;
    expect(change("Click-through rate")).toBeCloseTo(implied, 3);
  });

  test("every series covers each day, and the keywords fit inside the totals", () => {
    for (const s of [...searchMock.chart.bars, ...searchMock.chart.lines]) {
      expect(s.values).toHaveLength(searchMock.chart.labels.length);
    }
    const { rows, filters, total } = searchMock.keywords;
    const counts = rows.map((r) => r.clicks);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
    expect(sum(counts)).toBeLessThanOrEqual(clicks);
    const count = (label: string) => filters.find((f) => f.label === label)?.count;
    expect(count("All")).toBe(total);
    expect((count("Branded") ?? 0) + (count("Non-branded") ?? 0)).toBe(total);
  });
});

describe("liveMock", () => {
  const bySource = new Map<string, number>();
  for (const v of liveMock.visitors) bySource.set(v.source, (bySource.get(v.source) ?? 0) + 1);

  test("its Sources rows count the visitors online, largest first, with none left out above the last", () => {
    for (const row of liveMock.sources) expect(row.visitors).toBe(bySource.get(row.key));
    const counts = liveMock.sources.map((r) => r.visitors);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
    const shown = new Set(liveMock.sources.map((r) => r.key));
    const rest = [...bySource].filter(([key]) => !shown.has(key)).map(([, n]) => n);
    expect(Math.max(0, ...rest)).toBeLessThanOrEqual(counts[counts.length - 1]);
  });

  test("covers the last 30 minutes and has a place for every visitor", () => {
    expect(liveMock.perMinute).toHaveLength(30);
    for (const v of liveMock.visitors) {
      expect(Math.abs(v.lon)).toBeLessThanOrEqual(180);
      expect(Math.abs(v.lat)).toBeLessThanOrEqual(90);
    }
  });
});
