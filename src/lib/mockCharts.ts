// Chart shapes for the homepage mockups, drawn as inline SVG. Pure functions over fixture
// arrays, unit-tested in mockCharts.test.ts. Every series is split into equal slots (one per
// bucket), so bars and lines line up: a line's points sit at the centre of each slot.

/** The plot area in SVG units, and the value at its top edge. */
export type Box = { width: number; height: number; max: number };

export type Rect = { x: number; y: number; width: number; height: number };

/** Two decimals is plenty in a viewBox, and keeps the paths short. */
const r = (n: number) => Math.round(n * 100) / 100;

/**
 * A round top for a count axis and its step, like Recharts' ticks: the smallest
 * 1, 2, 2.5 or 5 × 10ⁿ step that fits `max` in `ticks` steps. 147 in 4 → { max: 150, step: 50 }.
 */
export function niceScale(max: number, ticks = 4): { max: number; step: number } {
  if (!(max > 0)) return { max: ticks, step: 1 };
  const raw = max / ticks;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? 10 * magnitude;
  return { max: step * Math.ceil(max / step), step };
}

/** The tick values from 0 up to a nice scale's top: { max: 160, step: 40 } → [0, 40, 80, 120, 160]. */
export function ticks({ max, step }: { max: number; step: number }): number[] {
  return Array.from({ length: Math.round(max / step) + 1 }, (_, i) => r(i * step));
}

/** The x of bucket `i`'s centre out of `n`. */
export function slotCenter(i: number, n: number, width: number): number {
  return r(((i + 0.5) * width) / n);
}

/** The y of a value, 0 at the bottom and `max` at the top; values above `max` are clamped. */
export function valueY(value: number, { height, max }: Box): number {
  const share = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return r(height - share * height);
}

/** One point per value at the centre of its slot. */
export function linePoints(values: number[], box: Box): [number, number][] {
  return values.map((v, i) => [slotCenter(i, values.length, box.width), valueY(v, box)]);
}

/** A straight-segment line through every value ("M x y L x y …"); "" with no values. */
export function linePath(values: number[], box: Box): string {
  return linePoints(values, box)
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x} ${y}`)
    .join(" ");
}

/** The line closed down to the baseline, for the soft fill under it; "" with no values. */
export function areaPath(values: number[], box: Box): string {
  const points = linePoints(values, box);
  if (points.length === 0) return "";
  return `${linePath(values, box)} L${points[points.length - 1][0]} ${box.height} L${points[0][0]} ${box.height} Z`;
}

/**
 * Bars for several series side by side in each bucket, as the dashboard's chart draws
 * Revenue and the key goal. `gap` is the share of a slot left empty (Recharts'
 * barCategoryGap), `barGap` the space between bars in a slot and `maxBar` their widest.
 * Each series has its own `max`, so money and counts can share a chart. A zero is a
 * zero-height bar at the baseline. Returns one list of rects per series.
 */
export function groupedBars(
  series: { values: number[]; max: number }[],
  { width, height }: { width: number; height: number },
  { gap = 0.2, barGap = 2, maxBar = 16 }: { gap?: number; barGap?: number; maxBar?: number } = {},
): Rect[][] {
  const n = Math.max(0, ...series.map((s) => s.values.length));
  if (n === 0) return series.map(() => []);
  const slot = width / n;
  const k = series.length;
  const bar = Math.max(0, Math.min(maxBar, (slot * (1 - gap) - barGap * (k - 1)) / k));
  const group = bar * k + barGap * (k - 1);
  return series.map(({ values, max }, s) =>
    values.map((v, i) => {
      const y = valueY(v, { width, height, max });
      return { x: r(i * slot + (slot - group) / 2 + s * (bar + barGap)), y, width: r(bar), height: r(height - y) };
    }),
  );
}

/** Bars for one series: `groupedBars` with a single series. */
export function barRects(
  values: number[],
  box: Box,
  options?: { gap?: number; barGap?: number; maxBar?: number },
): Rect[] {
  return groupedBars([{ values, max: box.max }], box, options)[0];
}

/**
 * A small trend line, as the Pages table draws it: from the first point at the left edge
 * to the last at the right, 0 at the bottom and the largest value at the top, inset by
 * `pad` so the stroke and the end dot aren't clipped. Also returns the last point, for
 * its dot. Fewer than two values give no line.
 */
export function sparkline(
  values: number[],
  { width, height, pad = 3 }: { width: number; height: number; pad?: number },
): { path: string; end: [number, number] | null } {
  if (values.length < 2) return { path: "", end: null };
  const max = Math.max(1, ...values);
  const points = values.map((v, i): [number, number] => [
    r(pad + (i * (width - 2 * pad)) / (values.length - 1)),
    r(height - pad - (Math.max(0, v) / max) * (height - 2 * pad)),
  ]);
  return {
    path: points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x} ${y}`).join(" "),
    end: points[points.length - 1],
  };
}

/**
 * A money axis label in whole units, short as the dashboard's chart ticks: 0 → "$0",
 * 250 → "$250", 1000 → "$1k", 1500 → "$1.5k", 12_000 → "$12k".
 */
export function moneyTick(value: number, symbol = "$"): string {
  const whole = Math.round(value);
  if (Math.abs(whole) < 1000) return `${symbol}${whole}`;
  return `${symbol}${Math.round(whole / 100) / 10}k`;
}
