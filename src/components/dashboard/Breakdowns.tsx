"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { createElement, useState, type ReactNode } from "react";
import { CircleSlash } from "lucide-react";
import { useQuery } from "convex/react";
import type { IconType } from "react-icons";
import {
  FaAndroid,
  FaApple,
  FaChrome,
  FaEdge,
  FaFacebook,
  FaGlobe,
  FaInstagram,
  FaLinux,
  FaUbuntu,
  FaWindows,
} from "react-icons/fa";
import { FiMonitor, FiSmartphone, FiTablet } from "react-icons/fi";
import {
  SiBrave,
  SiDuckduckgo,
  SiFirefoxbrowser,
  SiGooglechrome,
  SiOpera,
  SiSafari,
  SiSamsung,
  SiVivaldi,
} from "react-icons/si";
import { api } from "../../../convex/_generated/api";
import { breakdownKey, dimMetric, type Dim, type ListChannel } from "../../../convex/lib/dims";
import { canFilter, type Filter } from "../../../convex/lib/filters";
import { parseGeoKey } from "../../../convex/lib/geo";
import type { DateRange } from "../../../convex/lib/ranges";
import type { BreakdownResult, GoalsResult } from "../../../convex/lib/statsShapes";
import { DIRECT, sourceDomain } from "../../../convex/lib/sources";
import {
  cityLabel,
  countryFlag,
  countryName,
  deviceLabel,
  formatMoney,
  formatNumber,
  formatShare,
  outboundLabel,
  referrerLabel,
  regionLabel,
} from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import StatsCard, { type CardTab, type StatsRow } from "./StatsCard";

type Props = {
  domain: string;
  range: DateRange;
  /** The site's currency when it takes payments; Sources and Countries can then show revenue */
  currency: string | null;
  view: View;
};

/**
 * Filters on the dashboard. With `raw` (filters set, or an hour range), the lists read
 * `data` and `goals` (from stats.filtered or stats.hourly, undefined while loading)
 * instead of their rollup queries. `onSelect` turns a row into a filter; null where
 * filtering is not possible (cookieless sites).
 */
export type View = {
  filters: Filter[];
  raw: boolean;
  data: Record<string, BreakdownResult> | undefined;
  goals: GoalsResult | undefined;
  onSelect: ((dim: Dim, key: string) => void) | null;
};

/**
 * A tab's id is the list's key in the filtered view ("source", "source:AI", ...), or
 * "country:map" for the Map tab, which draws the country list.
 */
type Tab = CardTab & { dim: Dim; channel?: ListChannel; map?: true };

const tab = (dim: Dim, label: string, channel?: ListChannel): Tab => ({
  id: breakdownKey(dim, channel),
  label,
  dim,
  channel,
});

// The outlines load with the tab, not with the dashboard
const WorldMap = dynamic(() => import("./WorldMap"), {
  ssr: false,
  loading: () => <div className="min-h-66 flex-1 animate-pulse rounded-md bg-muted" aria-busy />,
});

/** `revenue`: its lists are credited revenue (a payment's session counts on their keys). */
type Card = { title: string; tabs: Tab[]; more?: Tab[]; revenue?: boolean };

const SOURCES: Card = {
  title: "Sources",
  tabs: [tab("source", "Sources"), tab("channel", "Channels"), tab("referrer", "Referrers"), tab("source", "AI", "AI")],
  // The campaign tags from the landing page's URL
  more: [
    tab("utm_campaign", "Campaign"),
    tab("utm_source", "UTM source"),
    tab("utm_medium", "UTM medium"),
    tab("utm_term", "UTM term"),
    tab("utm_content", "UTM content"),
    tab("ref", "ref / via"),
  ],
  revenue: true,
};

const PAGES: Card = {
  title: "Pages",
  tabs: [tab("page", "Pages"), tab("entry", "Entry"), tab("exit", "Exit"), tab("outbound", "Outbound")],
};

const COUNTRIES: Card = {
  title: "Countries",
  tabs: [tab("country", "Countries"), tab("city", "Cities"), { ...tab("country", "Map"), id: "country:map", map: true }],
  more: [tab("region", "Regions")],
  revenue: true,
};

const DEVICES: Card = {
  title: "Devices",
  tabs: [tab("device", "Devices"), tab("browser", "Browsers"), tab("os", "OS")],
};

const METRIC_LABELS = {
  pageviews: "Pageviews",
  visitors: "Visitors",
  sessions: "Sessions",
  events: "Clicks",
} as const;

/**
 * The cards under the chart, in one bordered block: Sources | Pages, Countries | Devices,
 * Events | Funnels, in two columns with dividers (one column on phones).
 */
export default function Breakdowns(props: Props) {
  return (
    <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-2">
      <Breakdown {...props} card={SOURCES} />
      <Breakdown {...props} card={PAGES} />
      <Breakdown {...props} card={COUNTRIES} />
      <Breakdown {...props} card={DEVICES} />
      <Events {...props} />
      <StatsCard
        title="Funnels"
        tabs={[{ id: "funnels", label: "Funnels" }]}
        tab="funnels"
        onTab={() => {}}
        rows={[]}
        empty="Funnels are coming soon"
      />
    </div>
  );
}

/**
 * Goals by completions, with the key goal marked (stats.goals lists it even at 0). The
 * tooltip adds visitors and the conversion rate (the share of daily visitors who
 * completed the goal). Clicking a goal filters to the sessions that completed it.
 */
function Events({ domain, range, view }: Props) {
  const rollup = useQuery(api.stats.goals, view.raw ? "skip" : { domain, ...range });
  const data = view.raw ? view.goals : rollup;
  const active = view.filters.find((f) => f.dim === "goal")?.value;
  const select = view.onSelect && canFilter(view.filters, "goal") ? view.onSelect : null;
  const top = data?.rows[0]?.completions ?? 0;
  const rows: StatsRow[] | undefined = data?.rows.map((r) => ({
    key: r.name,
    label: r.name,
    active: r.name === active,
    ...(select ? { onSelect: () => select("goal", r.name) } : {}),
    badge:
      r.name === data.keyGoal ? (
        <Badge variant="outline" className="shrink-0 bg-background">
          Key goal
        </Badge>
      ) : undefined,
    tooltip: (
      <span className="tabular-nums">
        {formatNumber(r.completions)} {r.completions === 1 ? "completion" : "completions"} ·{" "}
        {formatNumber(r.visitors)} {r.visitors === 1 ? "visitor" : "visitors"} ·{" "}
        {data.visitors > 0 ? formatShare(Math.min(1, r.visitors / data.visitors)) : "–"} conversion
      </span>
    ),
    value: formatNumber(r.completions),
    share: top <= 0 ? 0 : r.completions / top,
  }));

  return (
    <StatsCard
      title="Events"
      tabs={[{ id: "goal", label: "Events" }]}
      tab="goal"
      onTab={() => {}}
      metric="Completions"
      rows={rows}
      empty={
        <>
          No goals completed in this period.{" "}
          <Link
            href={`/sites/${encodeURIComponent(domain)}/settings#goals`}
            className="ml-1 underline hover:text-foreground"
          >
            Set up goals
          </Link>
        </>
      }
    />
  );
}

/**
 * One card; its tab is kept when the range or the filters change. On a site with revenue,
 * the Sources and Countries cards switch between Visitors and Revenue (rows with revenue,
 * largest amount first).
 */
function Breakdown({ domain, range, currency, view, card }: Props & { card: Card }) {
  const tabs = [...card.tabs, ...(card.more ?? [])];
  const [tabId, setTabId] = useState(card.tabs[0].id);
  const [byRevenue, setByRevenue] = useState(false);
  const { dim, channel, map } = tabs.find((t) => t.id === tabId) ?? card.tabs[0];
  const rollup = useQuery(api.stats.breakdown, view.raw ? "skip" : { domain, dim, channel, ...range });
  const data = view.raw ? view.data?.[breakdownKey(dim, channel)] : rollup;
  const active = view.filters.find((f) => f.dim === dim)?.value;
  const select = view.onSelect && canFilter(view.filters, dim) ? view.onSelect : null;

  // Pages count pageviews, entry and exit pages count sessions, outbound links count
  // clicks, and the other lists count visitors. Bars are relative to the top row.
  const metric = dimMetric(dim);
  const revenueCurrency = card.revenue ? currency : null;
  const revenue = revenueCurrency !== null && byRevenue;
  const ranked = revenue
    ? data?.rows.filter((r) => r.revenueMinor !== 0).sort((a, b) => b.revenueMinor - a.revenueMinor)
    : data?.rows;
  const count = (r: BreakdownRow) => (revenue ? r.revenueMinor : r[metric]);
  const top = ranked?.[0] ? count(ranked[0]) : 0;
  const rows: StatsRow[] | undefined = ranked?.map((r) => ({
    key: r.key,
    label: <Label dim={dim} value={r.key} />,
    href: rowHref(dim, r.key),
    icon: rowIcon(dim, r.key),
    active: r.key === active,
    ...(select ? { onSelect: () => select(dim, r.key) } : {}),
    value: revenue ? formatMoney(r.revenueMinor, revenueCurrency, true) : formatNumber(r[metric]),
    share: top <= 0 ? 0 : Math.max(0, count(r) / top),
  }));

  const metricLabel = revenue ? "Revenue" : METRIC_LABELS[metric];

  return (
    <StatsCard
      title={card.title}
      tabs={card.tabs}
      more={card.more}
      tab={tabId}
      onTab={setTabId}
      metric={metricLabel}
      onMetricSwitch={revenueCurrency !== null ? () => setByRevenue(!byRevenue) : undefined}
      rows={rows}
      body={
        map && ranked ? (
          <WorldMap
            values={ranked.map((r) => ({
              code: r.key,
              count: count(r),
              value: revenue ? formatMoney(r.revenueMinor, revenueCurrency, true) : formatNumber(r[metric]),
            }))}
            metric={metricLabel}
            active={active}
            onSelect={select ? (code) => select(dim, code) : null}
          />
        ) : undefined
      }
    />
  );
}

type BreakdownRow = BreakdownResult["rows"][number];

function Label({ dim, value }: { dim: Dim; value: string }): ReactNode {
  switch (dim) {
    case "referrer":
      return referrerLabel(value);
    case "device":
      return deviceLabel(value);
    case "browser":
      return value;
    case "country":
      return countryName(value);
    case "region":
      return regionLabel(value);
    case "city":
      return cityLabel(value);
    case "outbound":
      return outboundLabel(value);
    default:
      return value;
  }
}

/** Referrers and outbound links open in a new tab. */
function rowHref(dim: Dim, value: string): string | undefined {
  if (dim === "referrer" && value !== "(direct)") return `https://${value}`;
  if (dim === "outbound") return value;
  return undefined;
}

function rowIcon(dim: Dim, value: string): ReactNode {
  switch (dim) {
    case "device":
      return createElement(DEVICE_ICONS[value] ?? FiMonitor, { "aria-hidden": true });
    case "browser":
      return createElement(browserIcon(value), { "aria-hidden": true });
    case "os":
      return createElement(osIcon(value), { "aria-hidden": true });
    case "country":
    case "region":
    case "city": {
      const country = dim === "country" ? value : (parseGeoKey(value)?.country ?? "");
      return (
        <span className="text-base leading-none" aria-hidden>
          {countryFlag(country) || "🌐"}
        </span>
      );
    }
    case "source":
      if (value === DIRECT) return <CircleSlash aria-hidden className="size-3.5" />;
      return <SourceIcon key={value} source={value} />;
    default:
      return null;
  }
}

/** A source's favicon, loaded from its own domain; a globe for tags and failed loads. */
export function SourceIcon({ source }: { source: string }) {
  const domain = sourceDomain(source);
  const [failed, setFailed] = useState(domain === null);
  if (failed || domain === null) return <FaGlobe aria-hidden className="text-muted-foreground" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- external favicon, any size
    <img
      src={`https://${domain}/favicon.ico`}
      alt=""
      className="size-4"
      onError={() => setFailed(true)}
      // The server-rendered <img> can fail before React hydrates and misses onError
      ref={(img) => {
        if (img?.complete && img.naturalWidth === 0) setFailed(true);
      }}
    />
  );
}

export const DEVICE_ICONS: Record<string, IconType> = {
  mobile: FiSmartphone,
  tablet: FiTablet,
  desktop: FiMonitor,
};

// Browser names come from ua-parser-js v1 ("Chrome", "Mobile Safari", "Samsung Browser", ...)
const BROWSER_ICONS: [RegExp, IconType][] = [
  [/edge/i, FaEdge],
  [/samsung/i, SiSamsung],
  [/opera/i, SiOpera],
  [/brave/i, SiBrave],
  [/vivaldi/i, SiVivaldi],
  [/duckduckgo/i, SiDuckduckgo],
  [/firefox/i, SiFirefoxbrowser],
  [/instagram/i, FaInstagram],
  [/facebook/i, FaFacebook],
  [/safari/i, SiSafari],
  [/chrom/i, SiGooglechrome],
];

export function browserIcon(name: string): IconType {
  return BROWSER_ICONS.find(([re]) => re.test(name))?.[1] ?? FaGlobe;
}

// OS names come from ua-parser-js v1 ("Mac OS", "iOS", "Windows", "Chromium OS", ...)
const OS_ICONS: [RegExp, IconType][] = [
  [/mac|ios/i, FaApple],
  [/windows/i, FaWindows],
  [/android/i, FaAndroid],
  [/chrom/i, FaChrome],
  [/ubuntu/i, FaUbuntu],
  [/linux|debian|fedora|arch|mint/i, FaLinux],
];

export function osIcon(name: string): IconType {
  return OS_ICONS.find(([re]) => re.test(name))?.[1] ?? FaGlobe;
}
