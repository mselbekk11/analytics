import { describe, expect, test } from "vitest";
import {
  areaPath,
  barRects,
  flipValues,
  funnelSteps,
  groupedBars,
  linePath,
  mapPoint,
  moneyTick,
  niceScale,
  sparkline,
  ticks,
  valueY,
} from "./mockCharts";

const box = { width: 100, height: 50, max: 10 };

describe("niceScale", () => {
  test("rounds the top up to a whole number of nice steps", () => {
    expect(niceScale(147)).toEqual({ max: 150, step: 50 });
    expect(niceScale(155)).toEqual({ max: 200, step: 50 });
    expect(niceScale(100)).toEqual({ max: 100, step: 25 });
    expect(niceScale(9)).toEqual({ max: 10, step: 2.5 });
    expect(niceScale(3071, 5)).toEqual({ max: 4000, step: 1000 });
  });

  test("gives a usable scale for zero or no data", () => {
    expect(niceScale(0)).toEqual({ max: 4, step: 1 });
    expect(niceScale(Number.NaN)).toEqual({ max: 4, step: 1 });
  });
});

describe("ticks", () => {
  test("counts from zero to the top in steps", () => {
    expect(ticks({ max: 160, step: 40 })).toEqual([0, 40, 80, 120, 160]);
    expect(ticks({ max: 10, step: 2.5 })).toEqual([0, 2.5, 5, 7.5, 10]);
  });
});

describe("valueY", () => {
  test("puts zero on the baseline and the max on the top edge, clamping beyond", () => {
    expect(valueY(0, box)).toBe(50);
    expect(valueY(10, box)).toBe(0);
    expect(valueY(5, box)).toBe(25);
    expect(valueY(20, box)).toBe(0);
    expect(valueY(-3, box)).toBe(50);
  });
});

describe("linePath", () => {
  test("joins the slot centres with straight segments", () => {
    expect(linePath([0, 5, 10, 5], box)).toBe("M12.5 50 L37.5 25 L62.5 0 L87.5 25");
  });

  test("is empty with no values and a single move with one", () => {
    expect(linePath([], box)).toBe("");
    expect(linePath([5], box)).toBe("M50 25");
  });

  test("rounds to two decimals", () => {
    expect(linePath([1, 2, 3], { width: 100, height: 30, max: 7 })).toBe("M16.67 25.71 L50 21.43 L83.33 17.14");
  });
});

describe("areaPath", () => {
  test("closes the line down to the baseline", () => {
    expect(areaPath([0, 10], box)).toBe("M25 50 L75 0 L75 50 L25 50 Z");
    expect(areaPath([], box)).toBe("");
  });
});

describe("barRects", () => {
  test("centres one bar per slot, gap 20%, rising from the baseline", () => {
    const rects = barRects([10, 5, 0, 2.5], box, { maxBar: 100 });
    // Slots are 25 wide; 80% of that is 20
    expect(rects).toEqual([
      { x: 2.5, y: 0, width: 20, height: 50 },
      { x: 27.5, y: 25, width: 20, height: 25 },
      { x: 52.5, y: 50, width: 20, height: 0 },
      { x: 77.5, y: 37.5, width: 20, height: 12.5 },
    ]);
  });

  test("caps the bar width and keeps it centred", () => {
    const [first] = barRects([10, 10], box, { maxBar: 16 });
    expect(first).toEqual({ x: 17, y: 0, width: 16, height: 50 });
  });

  test("is empty with no values", () => {
    expect(barRects([], box)).toEqual([]);
  });
});

describe("groupedBars", () => {
  test("puts each series side by side in a slot, each on its own scale", () => {
    const [revenue, goal] = groupedBars(
      [
        { values: [100, 50], max: 100 },
        { values: [2, 4], max: 4 },
      ],
      { width: 100, height: 40 },
      { gap: 0.2, barGap: 2, maxBar: 16 },
    );
    // Slot 50, room 40 minus the 2px gap for two bars → 16 each (at the cap), group 34
    expect(revenue[0]).toEqual({ x: 8, y: 0, width: 16, height: 40 });
    expect(goal[0]).toEqual({ x: 26, y: 20, width: 16, height: 20 });
    expect(revenue[1]).toEqual({ x: 58, y: 20, width: 16, height: 20 });
    expect(goal[1]).toEqual({ x: 76, y: 0, width: 16, height: 40 });
  });

  test("lines bars up with the line points' slots", () => {
    const [[bar]] = groupedBars([{ values: [3, 3, 3], max: 3 }], { width: 90, height: 10 });
    expect(bar.x + bar.width / 2).toBe(15);
    expect(linePath([3, 3, 3], { width: 90, height: 10, max: 3 }).startsWith("M15 ")).toBe(true);
  });
});

describe("sparkline", () => {
  test("runs edge to edge inside the padding, zero at the bottom", () => {
    expect(sparkline([0, 4, 2], { width: 46, height: 24, pad: 3 })).toEqual({
      path: "M3 21 L23 3 L43 12",
      end: [43, 12],
    });
  });

  test("draws nothing with fewer than two values", () => {
    expect(sparkline([5], { width: 46, height: 24 })).toEqual({ path: "", end: null });
  });

  test("keeps an all-zero trend flat on the bottom", () => {
    expect(sparkline([0, 0], { width: 10, height: 10, pad: 1 }).path).toBe("M1 9 L9 9");
  });
});

describe("moneyTick", () => {
  test("keeps amounts under a thousand whole", () => {
    expect(moneyTick(0)).toBe("$0");
    expect(moneyTick(250)).toBe("$250");
    expect(moneyTick(499.6)).toBe("$500");
  });

  test("shortens thousands to k with at most one decimal", () => {
    expect(moneyTick(1000)).toBe("$1k");
    expect(moneyTick(999.6)).toBe("$1k");
    expect(moneyTick(1500)).toBe("$1.5k");
    expect(moneyTick(2250)).toBe("$2.3k");
    expect(moneyTick(12_000)).toBe("$12k");
  });

  test("takes another currency symbol", () => {
    expect(moneyTick(2000, "€")).toBe("€2k");
  });
});

describe("funnelSteps", () => {
  test("gives each step's share of the first and previous step, and the drop-off", () => {
    expect(funnelSteps([200, 80, 20])).toEqual([
      { count: 200, ofFirst: 1, ofPrevious: 1, dropped: 0 },
      { count: 80, ofFirst: 0.4, ofPrevious: 0.4, dropped: 120 },
      { count: 20, ofFirst: 0.1, ofPrevious: 0.25, dropped: 60 },
    ]);
  });

  test("caps a step at the one before and never goes below zero", () => {
    expect(funnelSteps([50, 60, -3]).map((s) => s.count)).toEqual([50, 50, 0]);
    expect(funnelSteps([50, 60])[1]).toEqual({ count: 50, ofFirst: 1, ofPrevious: 1, dropped: 0 });
  });

  test("gives zero shares after an empty step, and nothing for no steps", () => {
    expect(funnelSteps([0, 0])).toEqual([
      { count: 0, ofFirst: 1, ofPrevious: 1, dropped: 0 },
      { count: 0, ofFirst: 0, ofPrevious: 0, dropped: 0 },
    ]);
    expect(funnelSteps([])).toEqual([]);
  });
});

describe("flipValues", () => {
  test("draws the lowest value highest, from 1 for the worst to 2 for the best", () => {
    expect(flipValues([14, 12, 10, 13])).toEqual([1, 1.5, 2, 1.25]);
  });

  test("keeps a flat series at 1, and an empty one empty", () => {
    expect(flipValues([8, 8, 8])).toEqual([1, 1, 1]);
    expect(flipValues([])).toEqual([]);
  });
});

describe("mapPoint", () => {
  // d3-geo's geoEqualEarth fitted as `npm run build:world-map` fits it, unrounded
  const fitted = { scale: 180.76109775261077, translate: [480, 235.93996454785622] as [number, number] };

  test("matches d3-geo's Equal Earth projection", () => {
    expect(mapPoint(-122.42, 37.77, fitted)).toEqual([181.07, 103.04]); // San Francisco
    expect(mapPoint(-0.13, 51.51, fitted)).toEqual([479.71, 61.48]); // London
    expect(mapPoint(139.69, 35.69, fitted)).toEqual([825.15, 109.8]); // Tokyo
  });

  test("puts 0°, 0° on the origin and mirrors east and west, north and south", () => {
    const projection = { scale: 100, translate: [480, 200] as [number, number] };
    expect(mapPoint(0, 0, projection)).toEqual([480, 200]);
    const [x, y] = mapPoint(60, 40, projection);
    const [mx, my] = mapPoint(-60, -40, projection);
    expect(mx).toBeCloseTo(960 - x, 2);
    expect(my).toBeCloseTo(400 - y, 2);
  });
});
