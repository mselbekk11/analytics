// The made-up numbers behind the homepage mockups, kept apart from their layout so they
// can be edited without touching it. Values are what the dashboard would show: tile values
// are display strings, changes are fractions (0.124 → "+12.4%"), and chart series are one
// number per bucket. Each figure adds its own export below.

/** The dashboard's colour tokens a mockup series can take (see `MOCK_COLOR` in parts.tsx). */
export type MockColor = "visitors" | "pageviews" | "revenue" | "goal" | "muted";

/** One joined stat tile. `on` gives its dot the series colour, as when its series is on the chart. */
export type MockTile = {
  label: string;
  value: string;
  /** Fraction; null shows "–" */
  change: number | null;
  /** A rise shows red (bounce rate) */
  lowerIsBetter?: boolean;
  color?: MockColor;
  on?: boolean;
};

/**
 * A chart series. On the "count" axis it shares the visible scale (and the y labels) with
 * the other count series; on "hidden" it gets its own, as Revenue and the key goal do on
 * the dashboard (bars top out at 1.5× their max, lines at 1.1×).
 */
export type MockSeries = {
  label: string;
  color: MockColor;
  values: number[];
  axis: "count" | "hidden";
  /** Lines only: a soft fill under the line, this opaque at the top (the dashboard uses 0.18 and 0.08) */
  fill?: number;
  /** Lines only: a dashed line ("4 4") */
  dash?: string;
};

/**
 * A bar-and-line chart: bucket labels, bars (side by side per bucket) and lines over them.
 * The legend lists lines then bars in this order, and the first line is drawn on top.
 */
export type MockChart = {
  labels: string[];
  bars: MockSeries[];
  lines: MockSeries[];
  /** Show every nth bucket label on the x axis */
  labelEvery: number;
};

/** The header over a view: title, the range in words and which segment is pressed. */
export type MockHeader = {
  title: string;
  rangeLabel: string;
  /** "Today" | "24h" | "7d" | "30d", or null for none */
  segment: string | null;
};

// 24 hourly buckets, ending at 18:00
const HOURS = Array.from({ length: 24 }, (_, i) => `${String((i + 19) % 24).padStart(2, "0")}:00`);

/** Fig. 1, the Analytics tab of a site called Acme over the last 24 hours. */
export const analyticsMock = {
  site: "Acme",
  online: 12,
  initials: "JD",
  header: { title: "Analytics", rangeLabel: "Last 24 hours", segment: "24h" } satisfies MockHeader,
  tiles: [
    { label: "Visitors", value: "868", change: 0.124, color: "visitors", on: true },
    { label: "Pageviews", value: "2,138", change: 0.093, color: "pageviews", on: true },
    { label: "Revenue", value: "$541", change: 0.318, color: "revenue", on: true },
    { label: "Conv. rate", value: "1.4%", change: 0.061 },
    { label: "Signups", value: "41", change: 0.205, color: "goal", on: true },
    { label: "Bounce rate", value: "38.2%", change: 0.034, lowerIsBetter: true },
    { label: "Visit duration", value: "1m 52s", change: -0.021 },
  ] satisfies MockTile[],
  chart: {
    labels: HOURS,
    labelEvery: 3,
    bars: [
      {
        label: "Revenue",
        color: "revenue",
        axis: "hidden",
        values: [0, 0, 0, 0, 0, 0, 0, 29, 0, 49, 0, 79, 29, 0, 129, 49, 0, 99, 0, 49, 29, 0, 0, 0],
      },
      {
        label: "Signups",
        color: "goal",
        axis: "hidden",
        values: [1, 0, 0, 0, 0, 0, 1, 2, 1, 3, 2, 4, 3, 2, 5, 4, 3, 2, 3, 2, 1, 1, 0, 1],
      },
    ],
    lines: [
      {
        label: "Visitors",
        color: "visitors",
        axis: "count",
        fill: 0.18,
        values: [23, 19, 15, 12, 10, 11, 15, 25, 37, 48, 55, 58, 61, 59, 62, 60, 57, 52, 47, 44, 40, 36, 31, 27],
      },
      {
        label: "Pageviews",
        color: "pageviews",
        axis: "count",
        fill: 0.08,
        values: [54, 43, 33, 26, 22, 25, 35, 61, 92, 121, 138, 143, 146, 139, 144, 141, 133, 121, 108, 101, 93, 84, 72, 63],
      },
    ],
  } satisfies MockChart,
};
