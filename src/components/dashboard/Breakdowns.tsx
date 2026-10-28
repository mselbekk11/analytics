"use client";

import { createElement, useState, type ReactNode } from "react";
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
import { dimMetric, type Dim } from "../../../convex/lib/dims";
import { canFilter, type Filter } from "../../../convex/lib/filters";
import { parseGeoKey } from "../../../convex/lib/geo";
import type { DateRange } from "../../../convex/lib/ranges";
import type { BreakdownResult, GoalsResult } from "../../../convex/lib/statsShapes";
import { sourceDomain } from "../../../convex/lib/sources";
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
import BreakdownList, { type BreakdownRow } from "./BreakdownList";
import GoalsPanel from "./GoalsPanel";

type Props = {
  domain: string;
  range: DateRange;
  /** The site's currency when it takes payments; adds a revenue column to source and location lists */
  currency: string | null;
  view: View;
};

/**
 * Filters on the dashboard. With any set, the lists read `data` and `goals` (from
 * stats.filtered, undefined while loading) instead of their rollup queries. `onSelect`
 * turns a row into a filter; null where filtering is not possible (cookieless sites).
 */
export type View = {
  filters: Filter[];
  data: Record<string, BreakdownResult> | undefined;
  goals: GoalsResult | undefined;
  onSelect: ((dim: Dim, key: string) => void) | null;
};

type Tab = { dim: Dim; label: string };

const SOURCE_TABS: Tab[] = [
  { dim: "channel", label: "Channels" },
  { dim: "source", label: "Sources" },
  { dim: "utm_campaign", label: "Campaigns" },
  { dim: "referrer", label: "Referrers" },
];

const PAGE_TABS: Tab[] = [
  { dim: "page", label: "Pages" },
  { dim: "entry", label: "Entry" },
  { dim: "exit", label: "Exit" },
];

const DEVICE_TABS: Tab[] = [
  { dim: "device", label: "Devices" },
  { dim: "os", label: "OS" },
];

const COUNTRY_TABS: Tab[] = [
  { dim: "country", label: "Countries" },
  { dim: "region", label: "Regions" },
  { dim: "city", label: "Cities" },
];

// The Campaigns tab can switch to any tag from the landing page's URL
const CAMPAIGN_DIMS: Tab[] = [
  { dim: "utm_campaign", label: "Campaign" },
  { dim: "utm_source", label: "Source" },
  { dim: "utm_medium", label: "Medium" },
  { dim: "utm_term", label: "Term" },
  { dim: "utm_content", label: "Content" },
  { dim: "ref", label: "ref / via" },
];

// Lists that are credited revenue: a payment's session counts on these keys
const REVENUE_DIMS = new Set<Dim>([...SOURCE_TABS, ...CAMPAIGN_DIMS, ...COUNTRY_TABS].map((t) => t.dim));

// Lists that show a count rather than a share bar
const COUNT_DIMS = new Set<Dim>([
  ...[...SOURCE_TABS, ...PAGE_TABS, ...CAMPAIGN_DIMS].map((t) => t.dim),
  "outbound",
]);

/**
 * The four columns under the chart: sources (Channels, Sources, Campaigns, Referrers),
 * pages (Pages, Entry, Exit), devices (Devices, OS) + Browsers, and countries
 * (Countries, Regions, Cities). Goals and Outbound links sit below, two columns each.
 */
export default function Breakdowns({ domain, range, currency, view }: Props) {
  // Remount the lists when the range or the filters change, so paging starts on page 1
  const k = `${range.from}_${range.to}${view.filters.map((f) => `|${f.dim}:${f.value}`).join("")}`;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Tabbed {...{ domain, range, currency, view }} tabs={SOURCE_TABS} title="Sources" />
      <Tabbed {...{ domain, range, currency, view }} tabs={PAGE_TABS} title="Pages" />
      <div className="flex flex-col gap-4">
        <Tabbed {...{ domain, range, currency, view }} tabs={DEVICE_TABS} title="Devices" />
        <Breakdown key={`browser${k}`} {...{ domain, range, currency, view }} dim="browser" title="Browsers" />
      </div>
      <Tabbed {...{ domain, range, currency, view }} tabs={COUNTRY_TABS} title="Countries" />
      <div className="sm:col-span-2">
        <GoalsPanel key={`goal${k}`} {...{ domain, range, view }} />
      </div>
      <div className="sm:col-span-2">
        <Breakdown key={`outbound${k}`} {...{ domain, range, currency, view }} dim="outbound" title="Outbound links" />
      </div>
    </div>
  );
}

/** A list with tabs in its header; the tab is kept when the range changes. */
function Tabbed({ domain, range, currency, view, tabs, title }: Props & { tabs: Tab[]; title: string }) {
  const [tab, setTab] = useState(tabs[0].dim);
  const [campaignDim, setCampaignDim] = useState<Dim>("utm_campaign");
  const isCampaign = CAMPAIGN_DIMS.some((t) => t.dim === tab);
  const dim = isCampaign ? campaignDim : tab;

  const header = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <div role="tablist" aria-label={title} className="flex flex-wrap gap-x-2.5 gap-y-1 text-sm">
        {tabs.map((t) => (
          <button
            key={t.dim}
            type="button"
            role="tab"
            aria-selected={t.dim === tab}
            onClick={() => setTab(t.dim)}
            className={
              t.dim === tab ? "font-medium text-strong" : "font-medium text-muted-foreground hover:text-strong"
            }
          >
            {t.label}
          </button>
        ))}
      </div>
      {isCampaign && (
        <select
          value={campaignDim}
          onChange={(e) => setCampaignDim(e.target.value as Dim)}
          aria-label="Campaign tag"
          className="ml-auto rounded border border-line bg-panel px-1.5 py-0.5 text-xs text-muted-foreground"
        >
          {CAMPAIGN_DIMS.map((t) => (
            <option key={t.dim} value={t.dim}>
              {t.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );

  return (
    <Breakdown
      key={`${dim}${range.from}_${range.to}${view.filters.map((f) => `|${f.dim}:${f.value}`).join("")}`}
      {...{ domain, range, currency, view, dim, header }}
      title={tabs.find((t) => t.dim === tab)?.label ?? title}
    />
  );
}

function Breakdown({
  domain,
  range,
  currency,
  view,
  dim,
  title,
  header,
}: Props & { dim: Dim; title: string; header?: ReactNode }) {
  const filtering = view.filters.length > 0;
  const rollup = useQuery(api.stats.breakdown, filtering ? "skip" : { domain, dim, ...range });
  const data = filtering ? view.data?.[dim] : rollup;
  const active = view.filters.find((f) => f.dim === dim)?.value;
  const select = view.onSelect && canFilter(view.filters, dim) ? view.onSelect : null;

  // Pages count pageviews, entry and exit pages count sessions, outbound links count
  // clicks, and the source lists count visitors (as SA does); the other lists show each
  // key's share of all visitors.
  const variant = COUNT_DIMS.has(dim) ? "count" : "share";
  const metric = dimMetric(dim);
  const total = data
    ? {
        pageviews: data.totalPageviews,
        visitors: data.totalVisitors,
        sessions: data.totalSessions,
        events: data.totalEvents,
      }[metric]
    : 0;

  const showRevenue = currency !== null && REVENUE_DIMS.has(dim);
  const rows: BreakdownRow[] | undefined = data?.rows.map((r) => {
    const share = total === 0 ? 0 : r[metric] / total;
    return {
      key: r.key,
      label: <Label dim={dim} value={r.key} />,
      href: rowHref(dim, r.key),
      icon: rowIcon(dim, r.key),
      active: r.key === active,
      ...(select ? { onSelect: () => select(dim, r.key) } : {}),
      value: variant === "count" ? formatNumber(r[metric]) : formatShare(share),
      share,
      ...(showRevenue && r.revenueMinor !== 0 ? { revenue: formatMoney(r.revenueMinor, currency, true) } : {}),
    };
  });

  return <BreakdownList title={title} header={header} variant={variant} rows={rows} />;
}

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
        <span className="text-2xl leading-none" aria-hidden>
          {countryFlag(country) || "🌐"}
        </span>
      );
    }
    case "source":
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
