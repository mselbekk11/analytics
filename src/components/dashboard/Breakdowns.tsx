"use client";

import { createElement, type ReactNode } from "react";
import { useQuery } from "convex/react";
import type { IconType } from "react-icons";
import { FaEdge, FaFacebook, FaGlobe, FaInstagram } from "react-icons/fa";
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
import type { DateRange } from "../../../convex/lib/ranges";
import {
  countryFlag,
  countryName,
  deviceLabel,
  formatNumber,
  formatShare,
  referrerLabel,
} from "@/lib/format";
import BreakdownList, { type BreakdownRow } from "./BreakdownList";

type Dim = "page" | "referrer" | "device" | "browser" | "country";

type Props = { domain: string; range: DateRange };

/** The four columns under the chart: Referrals, Pages, Devices + Browsers, Countries. */
export default function Breakdowns({ domain, range }: Props) {
  // Remount the lists when the range changes, so paging starts on page 1
  const k = `${range.from}_${range.to}`;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Breakdown key={`referrer${k}`} {...{ domain, range }} dim="referrer" title="Referrals" />
      <Breakdown key={`page${k}`} {...{ domain, range }} dim="page" title="Pages" />
      <div className="flex flex-col gap-4">
        <Breakdown key={`device${k}`} {...{ domain, range }} dim="device" title="Devices" />
        <Breakdown key={`browser${k}`} {...{ domain, range }} dim="browser" title="Browsers" />
      </div>
      <Breakdown key={`country${k}`} {...{ domain, range }} dim="country" title="Countries" />
    </div>
  );
}

function Breakdown({ domain, range, dim, title }: Props & { dim: Dim; title: string }) {
  const data = useQuery(api.stats.breakdown, { domain, dim, ...range });

  // Pages count pageviews and Referrals count visitors (as SA does); the other
  // lists show each key's share of all visitors.
  const variant = dim === "page" || dim === "referrer" ? "count" : "share";
  const metric = dim === "page" ? "pageviews" : "visitors";
  const total = data ? (dim === "page" ? data.totalPageviews : data.totalVisitors) : 0;

  const rows: BreakdownRow[] | undefined = data?.rows.map((r) => {
    const share = total === 0 ? 0 : r[metric] / total;
    return {
      key: r.key,
      label: <Label dim={dim} value={r.key} />,
      icon: <RowIcon dim={dim} value={r.key} />,
      value: variant === "count" ? formatNumber(r[metric]) : formatShare(share),
      share,
    };
  });

  return <BreakdownList title={title} variant={variant} rows={rows} />;
}

function Label({ dim, value }: { dim: Dim; value: string }): ReactNode {
  switch (dim) {
    case "referrer":
      return value === "(direct)" ? (
        referrerLabel(value)
      ) : (
        <a
          href={`https://${value}`}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="hover:text-accent"
        >
          {value}
        </a>
      );
    case "page":
      return value;
    case "device":
      return deviceLabel(value);
    case "browser":
      return value;
    case "country":
      return countryName(value);
  }
}

function RowIcon({ dim, value }: { dim: Dim; value: string }): ReactNode {
  switch (dim) {
    case "device":
      return createElement(DEVICE_ICONS[value] ?? FiMonitor, { "aria-hidden": true });
    case "browser":
      return createElement(browserIcon(value), { "aria-hidden": true });
    case "country":
      return (
        <span className="text-2xl leading-none" aria-hidden>
          {countryFlag(value) || "🌐"}
        </span>
      );
    default:
      return null;
  }
}

const DEVICE_ICONS: Record<string, IconType> = {
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

function browserIcon(name: string): IconType {
  return BROWSER_ICONS.find(([re]) => re.test(name))?.[1] ?? FaGlobe;
}
