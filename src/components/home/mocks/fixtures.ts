import { formatDate } from "@/lib/format";

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

/** A Pages tile: a label, the number, then a muted note, with a coloured change before it if given. */
export type MockPageTile = {
  label: string;
  value: string;
  /** Fraction, shown green or red ahead of the note */
  change?: number;
  /** A fall shows green (time to convert) */
  lowerIsBetter?: boolean;
  note?: string;
};

/** A row of the All pages table, in the units the dashboard's PageRow uses. */
export type MockPageRow = {
  /** null shows the path alone, as for a page that never sent a title */
  title: string | null;
  path: string;
  views: number;
  /** Views per day over the range, for the sparkline; sums to `views` */
  trend: number[];
  sessions: number;
  /** Fraction against the period before; null leaves it blank */
  sessionsChange: number | null;
  bounceRate: number | null;
  durationMs: number | null;
  /** In cents; 0 shows "–" */
  revenueMinor: number;
};

/**
 * Fig. 2, the Pages tab of Acme over the last 30 days. The rows are the top six of 14
 * pages, ranked by views; each trend sums to the row's views and the shares are taken
 * of `totalPageviews`, which the Pageviews tile shows.
 */
export const pagesMock = {
  header: { title: "Pages", rangeLabel: "Last 30 days", segment: "30d" } satisfies MockHeader,
  totalPageviews: 15_640,
  pages: 14,
  currency: "USD",
  tiles: [
    { label: "Pages viewed", value: "14", note: "unique paths" },
    { label: "Pageviews", value: "15,640", change: 0.082, note: "vs previous" },
    { label: "Sessions", value: "6,918" },
    { label: "Avg. bounce", value: "41.3%" },
    { label: "Avg. duration", value: "1m 43s" },
  ] satisfies MockPageTile[],
  rows: [
    {
      title: "Acme · Invoicing for small teams",
      path: "/",
      views: 4812,
      trend: [
        113, 153, 129, 128, 153, 110, 105, 161, 164, 156, 165, 165, 132, 113, 160, 179, 181, 151, 186, 133, 153, 200,
        164, 188, 214, 203, 152, 151, 224, 226,
      ],
      sessions: 3906,
      sessionsChange: 0.112,
      bounceRate: 0.34,
      durationMs: 81_000,
      revenueMinor: 128_400,
    },
    {
      title: "Pricing",
      path: "/pricing",
      views: 2236,
      trend: [
        56, 57, 68, 60, 58, 49, 52, 64, 79, 73, 78, 83, 52, 57, 81, 81, 80, 76, 96, 60, 68, 85, 95, 104, 94, 86, 75, 74,
        96, 99,
      ],
      sessions: 1804,
      sessionsChange: 0.186,
      bounceRate: 0.41,
      durationMs: 138_000,
      revenueMinor: 214_600,
    },
    {
      title: "Docs",
      path: "/docs",
      views: 1418,
      trend: [
        32, 35, 37, 34, 43, 35, 40, 43, 44, 43, 44, 47, 47, 41, 51, 45, 51, 48, 50, 47, 53, 61, 50, 63, 51, 57, 49, 48,
        71, 58,
      ],
      sessions: 1127,
      sessionsChange: 0.224,
      bounceRate: 0.46,
      durationMs: 69_000,
      revenueMinor: 0,
    },
    {
      title: "Changelog",
      path: "/changelog",
      views: 1062,
      trend: [
        33, 29, 32, 34, 29, 32, 32, 38, 38, 39, 38, 33, 26, 28, 32, 32, 39, 35, 41, 33, 35, 37, 45, 37, 39, 46, 31, 35,
        36, 48,
      ],
      sessions: 811,
      sessionsChange: 0.079,
      bounceRate: 0.37,
      durationMs: 52_000,
      revenueMinor: 0,
    },
    {
      title: "How we cut invoice time in half",
      path: "/blog/invoice-time",
      views: 958,
      trend: [
        42, 44, 33, 43, 34, 38, 34, 38, 33, 32, 31, 35, 26, 32, 35, 35, 32, 27, 27, 31, 24, 31, 32, 24, 31, 30, 27, 26,
        27, 24,
      ],
      sessions: 802,
      sessionsChange: -0.042,
      bounceRate: 0.58,
      durationMs: 184_000,
      revenueMinor: 14_700,
    },
    {
      title: "Log in",
      path: "/login",
      views: 794,
      trend: [
        24, 28, 29, 26, 24, 18, 21, 27, 26, 28, 29, 26, 20, 20, 26, 27, 33, 33, 31, 23, 23, 27, 31, 27, 30, 31, 23, 24,
        31, 28,
      ],
      sessions: 652,
      sessionsChange: 0.026,
      bounceRate: 0.61,
      durationMs: 38_000,
      revenueMinor: 0,
    },
  ] satisfies MockPageRow[],
};

/** A row of a Sources or Countries card ranked by revenue: the dashboard's key and revenue in cents. */
export type MockRevenueRow = { key: string; revenueMinor: number };

// 30 daily buckets, Oct 3 to Nov 1
const DAYS = Array.from({ length: 30 }, (_, i) =>
  formatDate(new Date(Date.UTC(2026, 9, 3 + i)).toISOString().slice(0, 10)),
);

/**
 * Fig. 3, Acme's revenue over the last 30 days. The daily bars (whole dollars) sum to the
 * Revenue tile, Avg. order value is Revenue ÷ Conversions, and each card's rows are its top
 * six by revenue (they sum to less than the total, as the rest are below the fold). Source
 * keys are the dashboard's source names, country keys ISO codes.
 */
export const revenueMock = {
  header: { title: "Revenue", rangeLabel: "Last 30 days", segment: "30d" } satisfies MockHeader,
  currency: "USD",
  tiles: [
    { label: "Revenue", value: "$4,821", change: 0.142, note: "vs previous" },
    { label: "Conversions", value: "92", change: 0.095, note: "vs previous" },
    { label: "Avg. order value", value: "$52.40", change: 0.043, note: "vs previous" },
    { label: "Avg. time to convert", value: "1d 7h", change: -0.061, lowerIsBetter: true, note: "first visit to payment" },
  ] satisfies MockPageTile[],
  chart: {
    labels: DAYS,
    labelEvery: 3,
    lines: [],
    bars: [
      {
        label: "Revenue",
        color: "revenue",
        axis: "count",
        values: [
          96, 148, 0, 49, 212, 178, 98, 147, 245, 0, 49, 196, 302, 147, 98, 245, 149, 0, 196, 98, 349, 147, 245, 98, 49,
          196, 398, 147, 245, 294,
        ],
      },
    ],
  } satisfies MockChart,
  sources: [
    { key: "Direct", revenueMinor: 141_200 },
    { key: "Google", revenueMinor: 103_600 },
    { key: "Hacker News", revenueMinor: 68_400 },
    { key: "Claude", revenueMinor: 45_200 },
    { key: "X", revenueMinor: 31_800 },
    { key: "GitHub", revenueMinor: 24_600 },
  ] satisfies MockRevenueRow[],
  countries: [
    { key: "US", revenueMinor: 196_400 },
    { key: "GB", revenueMinor: 61_200 },
    { key: "DE", revenueMinor: 49_800 },
    { key: "CA", revenueMinor: 37_700 },
    { key: "IN", revenueMinor: 28_900 },
    { key: "FR", revenueMinor: 24_100 },
  ] satisfies MockRevenueRow[],
};
