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
  /** Lines on the hidden axis only: lower is better, so it's drawn upside down (search position) */
  flip?: boolean;
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
  /** "Today" | "24h" | "7d" | "30d" (or one of `segments`), or null for none */
  segment: string | null;
  /** Under the title in place of the range in words (the range menu still shows it) */
  note?: string;
  /** In place of Today | 24h | 7d | 30d */
  segments?: string[];
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

/** A funnel step: a page path or a goal name, and how many visitors reached it. */
export type MockFunnelStep = {
  label: string;
  kind: "Page" | "Goal";
  /** The path or the goal name, as the step is set up */
  target: string;
  visitors: number;
};

/**
 * Fig. 4, a signup funnel on Acme over the last 24 hours: four steps from the home page
 * to the signup goal, each completed within the window. Shares and drop-offs are worked
 * out from the counts (`funnelSteps`), so only the counts are typed here.
 */
export const funnelMock = {
  title: "Funnels",
  note: "Last 24 hours · 3 funnels",
  range: "Last 24 hours",
  action: "New funnel",
  funnel: "Signup funnel",
  window: "4 steps · completed within 24 hours",
  steps: [
    { label: "Visited the home page", kind: "Page", target: "/", visitors: 612 },
    { label: "Viewed pricing", kind: "Page", target: "/pricing", visitors: 274 },
    { label: "Opened sign-up", kind: "Page", target: "/signup", visitors: 88 },
    { label: "Signed up", kind: "Goal", target: "signup", visitors: 41 },
  ] satisfies MockFunnelStep[],
  /** Median time from the first step to the last, for those who finished */
  medianTime: "14m",
};

/** A goal row: its name, how it's counted, conversions, and the source that brought the most. */
export type MockGoalRow = {
  name: string;
  kind: "Event" | "Page";
  conversions: number;
  /** A source name, as the dashboard's Sources card shows it */
  topSource: string;
  key?: boolean;
};

/**
 * Fig. 5, Acme's goals over the last 30 days, by conversions. A goal's rate is its
 * conversions over the site's visitors; the tiles are the count of goals, the sum of
 * conversions and the mean of the rates (pinned in `fixtures.test.ts`).
 */
export const goalsMock = {
  title: "Goals",
  note: "Last 30 days",
  range: "Last 30 days",
  action: "New goal",
  visitors: 5_410,
  tiles: [
    { label: "Goals tracked", value: "5", note: "4 events, 1 page" },
    { label: "Conversions", value: "1,137", change: 0.118, note: "vs previous" },
    { label: "Avg. rate", value: "4.2%", change: 0.036, note: "vs previous" },
  ] satisfies MockPageTile[],
  rows: [
    { name: "signup", kind: "Event", conversions: 412, topSource: "Google", key: true },
    { name: "newsletter", kind: "Event", conversions: 318, topSource: "Hacker News" },
    { name: "start_trial", kind: "Event", conversions: 254, topSource: "Google" },
    { name: "/checkout/success", kind: "Page", conversions: 92, topSource: "Direct" },
    { name: "book_demo", kind: "Event", conversions: 61, topSource: "X" },
  ] satisfies MockGoalRow[],
};

/** A row of the keywords table: the query, its Google and Bing totals and the page it lands on. */
export type MockKeywordRow = {
  keyword: string;
  clicks: number;
  impressions: number;
  /** Average position, impression-weighted; lower is better */
  position: number;
  page: string;
};

// 28 daily buckets, Oct 5 to Nov 1
const DAYS_28 = DAYS.slice(2);

/**
 * Fig. 6, Acme's search traffic from Google and Bing over the last 28 days (not built yet).
 * The tiles are worked out from the daily series (pinned in `fixtures.test.ts`): clicks are
 * both engines' bars summed, the rate is clicks over impressions, and the position is the
 * daily positions weighted by impressions. Position fell, which is good, so it shows green.
 * The keywords are the top five of `keywords.total` by clicks, landing on Fig. 2's pages.
 */
export const searchMock = {
  header: {
    title: "Search",
    rangeLabel: "Last 28 days",
    segment: "Performance",
    segments: ["Performance", "Indexing"],
    note: "Google Search Console and Bing Webmaster Tools · synced 23m ago",
  } satisfies MockHeader,
  tiles: [
    { label: "Clicks", value: "2,539", change: 0.114, note: "vs previous" },
    { label: "Impressions", value: "136.3k", change: 0.062, note: "vs previous" },
    { label: "Click-through rate", value: "1.9%", change: 0.049, note: "vs previous" },
    { label: "Avg. position", value: "13.2", change: -0.074, lowerIsBetter: true, note: "vs previous" },
  ] satisfies MockPageTile[],
  chart: {
    labels: DAYS_28,
    labelEvery: 3,
    bars: [
      {
        label: "Google clicks",
        color: "visitors",
        axis: "count",
        values: [
          62, 75, 76, 78, 77, 59, 59, 83, 83, 76, 83, 80, 63, 60, 80, 79, 91, 87, 94, 63, 67, 79, 99, 88, 98, 96, 60, 70,
        ],
      },
      {
        label: "Bing clicks",
        color: "pageviews",
        axis: "count",
        values: [15, 13, 13, 12, 11, 11, 10, 16, 13, 13, 16, 14, 8, 12, 13, 15, 15, 15, 15, 10, 13, 15, 14, 17, 19, 15, 9, 12],
      },
    ],
    lines: [
      {
        label: "Impressions",
        color: "goal",
        axis: "hidden",
        fill: 0.08,
        values: [
          4500, 4560, 4840, 4640, 4890, 4140, 4510, 4750, 4620, 5220, 4600, 4900, 4470, 4600, 4940, 5160, 5370, 5130, 5310,
          4620, 4490, 4960, 5370, 5000, 5630, 4950, 5010, 5090,
        ],
      },
      {
        label: "Avg. position",
        color: "muted",
        axis: "hidden",
        dash: "4 4",
        flip: true,
        values: [
          13.8, 14.5, 14.3, 14.3, 13.9, 13.9, 13.9, 13.5, 13.4, 13.7, 13.2, 13, 13.1, 12.8, 13.1, 12.8, 13.3, 13.3, 12.6,
          12.7, 13.2, 12.1, 12.2, 13.2, 13.1, 12.1, 12, 11.9,
        ],
      },
    ],
  } satisfies MockChart,
  keywords: {
    total: 48,
    /** The table's quick filters with their counts; All is pressed */
    filters: [
      { label: "All", count: 48 },
      { label: "Rising", count: 14 },
      { label: "Falling", count: 6 },
      { label: "Near page one", count: 9 },
      { label: "New", count: 5 },
      { label: "Lost", count: 2 },
      { label: "Branded", count: 4 },
      { label: "Non-branded", count: 44 },
    ],
    rows: [
      { keyword: "acme invoicing", clicks: 412, impressions: 2_180, position: 1.2, page: "/" },
      { keyword: "invoice software for small teams", clicks: 236, impressions: 18_940, position: 6.8, page: "/" },
      {
        keyword: "how long do clients take to pay an invoice",
        clicks: 171,
        impressions: 9_320,
        position: 4.1,
        page: "/blog/invoice-time",
      },
      { keyword: "acme pricing", clicks: 128, impressions: 640, position: 1.0, page: "/pricing" },
      { keyword: "simple invoicing app", clicks: 97, impressions: 12_410, position: 9.6, page: "/" },
    ] satisfies MockKeywordRow[],
  },
};

/** A visitor online now: a persona seed for the avatar, their page, place, source and setup. */
export type MockLiveVisitor = {
  /** Seed for the persona generator (emoji on a colour), not a real person */
  seed: string;
  path: string;
  /** ISO alpha-2 */
  country: string;
  city: string;
  /** Degrees, for the dot on the map */
  lon: number;
  lat: number;
  /** A source name, as the dashboard's Sources card shows it */
  source: string;
  browser: string;
  /** A device key, as `deviceLabel` reads it */
  device: "desktop" | "mobile" | "tablet";
  /** How long ago their last pageview was */
  ago: string;
};

/** A ranked row of the live panel's lists: the dashboard's key and its visitors online now. */
export type MockLiveRow = { key: string; visitors: number };

/**
 * Fig. 7, Acme's live view: the 12 visitors of the last 5 minutes (as Fig. 1's "12 online"),
 * latest first, on the map and in the feed. The Sources rows are the top five of those
 * visitors' sources (pinned in `fixtures.test.ts`). Pages are Fig. 2's.
 */
export const liveMock = {
  site: "Acme",
  /** Pageviews a minute over the last 30 minutes, oldest first */
  perMinute: [3, 5, 4, 6, 4, 3, 5, 7, 6, 4, 5, 8, 6, 5, 7, 9, 6, 4, 6, 8, 7, 5, 6, 9, 11, 8, 7, 9, 12, 10],
  /** The list tabs; the first is pressed */
  tabs: ["Sources", "Countries", "Devices"],
  sources: [
    { key: "Google", visitors: 4 },
    { key: "Hacker News", visitors: 3 },
    { key: "Direct", visitors: 2 },
    { key: "X", visitors: 1 },
    { key: "Claude", visitors: 1 },
  ] satisfies MockLiveRow[],
  visitors: [
    {
      seed: "live-1",
      path: "/pricing",
      country: "US",
      city: "San Francisco",
      lon: -122.42,
      lat: 37.77,
      source: "Google",
      browser: "Chrome",
      device: "desktop",
      ago: "now",
    },
    {
      seed: "live-2",
      path: "/",
      country: "GB",
      city: "London",
      lon: -0.13,
      lat: 51.51,
      source: "Hacker News",
      browser: "Safari",
      device: "mobile",
      ago: "4s ago",
    },
    {
      seed: "live-3",
      path: "/blog/invoice-time",
      country: "IN",
      city: "Bengaluru",
      lon: 77.59,
      lat: 12.97,
      source: "X",
      browser: "Chrome",
      device: "mobile",
      ago: "9s ago",
    },
    {
      seed: "live-4",
      path: "/docs",
      country: "DE",
      city: "Berlin",
      lon: 13.4,
      lat: 52.52,
      source: "Direct",
      browser: "Firefox",
      device: "desktop",
      ago: "15s ago",
    },
    {
      seed: "live-5",
      path: "/",
      country: "CA",
      city: "Toronto",
      lon: -79.38,
      lat: 43.65,
      source: "Claude",
      browser: "Chrome",
      device: "desktop",
      ago: "22s ago",
    },
    {
      seed: "live-6",
      path: "/pricing",
      country: "FR",
      city: "Paris",
      lon: 2.35,
      lat: 48.86,
      source: "Google",
      browser: "Edge",
      device: "desktop",
      ago: "31s ago",
    },
    {
      seed: "live-7",
      path: "/login",
      country: "US",
      city: "New York",
      lon: -74.01,
      lat: 40.71,
      source: "Google",
      browser: "Safari",
      device: "desktop",
      ago: "48s ago",
    },
    {
      seed: "live-8",
      path: "/",
      country: "BR",
      city: "São Paulo",
      lon: -46.63,
      lat: -23.55,
      source: "Direct",
      browser: "Chrome",
      device: "mobile",
      ago: "1m ago",
    },
    {
      seed: "live-9",
      path: "/blog/invoice-time",
      country: "AU",
      city: "Sydney",
      lon: 151.21,
      lat: -33.87,
      source: "Hacker News",
      browser: "Safari",
      device: "tablet",
      ago: "1m ago",
    },
    {
      seed: "live-10",
      path: "/changelog",
      country: "JP",
      city: "Tokyo",
      lon: 139.69,
      lat: 35.69,
      source: "GitHub",
      browser: "Chrome",
      device: "desktop",
      ago: "2m ago",
    },
    {
      seed: "live-11",
      path: "/",
      country: "NL",
      city: "Amsterdam",
      lon: 4.9,
      lat: 52.37,
      source: "Hacker News",
      browser: "Firefox",
      device: "desktop",
      ago: "3m ago",
    },
    {
      seed: "live-12",
      path: "/docs",
      country: "US",
      city: "Austin",
      lon: -97.74,
      lat: 30.27,
      source: "Google",
      browser: "Chrome",
      device: "mobile",
      ago: "4m ago",
    },
  ] satisfies MockLiveVisitor[],
};

/**
 * 06 Ask AI's example card: a question someone could ask through the MCP server today
 * (`get_breakdown` of sources ranked by revenue), a one-line answer, and the rows it
 * draws on: Fig. 3's top three sources, so the two figures agree.
 */
export const askAiMock = {
  question: "Which sources brought in the most revenue this month?",
  answer: "Direct led with $1,412, then Google with $1,036. Hacker News was third at $684.",
  currency: revenueMock.currency,
  rows: revenueMock.sources.slice(0, 3) satisfies MockRevenueRow[],
};
