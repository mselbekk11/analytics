"use client";

import { useState, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { rankEntries, type Dim } from "../../../convex/lib/dims";
import { canFilter, toggleFilter, type Filter } from "../../../convex/lib/filters";
import { percentChange, type DateRange } from "../../../convex/lib/ranges";
import type { BreakdownResult, Totals } from "../../../convex/lib/statsShapes";
import { formatDuration, formatNumber } from "@/lib/format";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Label, rowHref, rowIcon } from "@/components/dashboard/Breakdowns";
import CountChart from "@/components/dashboard/CountChart";
import { BlockedNotice } from "@/components/dashboard/SiteHeader";
import StatsCard, { type StatsRow } from "@/components/dashboard/StatsCard";
import { Change } from "@/components/dashboard/StatTile";
import type { HourPeriod } from "@/components/dashboard/useSiteRange";

type Props = {
  domain: string;
  range: DateRange;
  hourly: HourPeriod | null;
  hourNow: number;
  filters: Filter[];
  onFilters: (next: Filter[]) => void;
  /** Visitor ids: time on site per visitor, sources and filtering rows */
  tracking: boolean;
};

/**
 * The Users tab's header (design v4): Visitors, Pageviews, Views per visitor and Avg.
 * time on site with their change, a visitors bar chart, and Sources / Countries / Devices
 * by visitors. The same queries as the Analytics tab, so its numbers match: the rollups
 * on day ranges, and stats.filtered or stats.hourly with filters or an hour range.
 */
export default function UsersOverview({ domain, range, hourly, hourNow, filters, onFilters, tracking }: Props) {
  const filtering = filters.length > 0;
  const hourlyView = useQuery(
    api.stats.hourly,
    hourly !== null ? { domain, period: hourly, now: hourNow, filters } : "skip",
  );
  const filtered = useQuery(
    api.stats.filtered,
    hourly === null && filtering ? { domain, ...range, filters } : "skip",
  );
  const raw = hourly !== null || filtering;
  const result = hourly !== null ? hourlyView : filtered;
  const view = result?.status === "ok" ? result : undefined;
  const blocked = result !== undefined && result.status !== "ok" ? result.status : null;
  const rollupSummary = useQuery(api.stats.summary, raw ? "skip" : { domain, ...range });
  const rollupSeries = useQuery(api.stats.timeseries, raw ? "skip" : { domain, ...range });
  const summary = raw ? view?.summary : rollupSummary;
  const series = raw ? view?.timeseries : rollupSeries;

  if (blocked !== null) return <BlockedNotice blocked={blocked} hourly={hourly !== null} />;

  const cur = summary?.current;
  const prev = summary?.previous;
  // Session-based numbers changed definition when visitor tracking started
  const incomparable = summary?.comparable === false;
  const change = (pick: (t: Totals) => number | null) => {
    if (!cur || !prev) return null;
    const a = pick(cur);
    const b = pick(prev);
    return a === null || b === null ? null : percentChange(a, b);
  };
  const approx = summary?.visitorsApprox ? "≈" : "";

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="overflow-hidden rounded-lg border border-border">
        <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
          <Tile
            label="Visitors"
            value={cur && approx + formatNumber(cur.visitors)}
            change={change((t) => t.visitors)}
            incomparable={incomparable}
            tooltip={
              summary?.visitorsApprox
                ? "Too many sessions to count distinct visitors: this is the sum of daily visitors"
                : undefined
            }
          />
          <Tile label="Pageviews" value={cur && formatNumber(cur.pageviews)} change={change((t) => t.pageviews)} />
          <Tile
            label="Views per visitor"
            value={cur && (viewsPerVisitor(cur) === null ? "–" : approx + formatRatio(viewsPerVisitor(cur) ?? 0))}
            change={change(viewsPerVisitor)}
            incomparable={incomparable}
            tooltip="Pageviews ÷ visitors"
          />
          {tracking ? (
            <Tile
              label="Avg. time on site"
              value={cur && (timeOnSite(cur) === null ? "–" : approx + formatDuration(timeOnSite(cur) ?? 0))}
              change={change(timeOnSite)}
              incomparable={incomparable}
              tooltip={
                cur && (
                  <div className="flex flex-col gap-0.5">
                    <span>Visible-tab time over all of a visitor&apos;s sessions</span>
                    {cur.sessionTimeMs !== null && (
                      <span>{formatDuration(cur.sessionTimeMs)} per session (Visit duration on Analytics)</span>
                    )}
                  </div>
                )
              }
            />
          ) : (
            <Tile
              label="Avg. time on page"
              value={cur && (cur.timeOnPageMs === null ? "–" : formatDuration(cur.timeOnPageMs))}
              change={change((t) => t.timeOnPageMs)}
              tooltip="Without visitor ids there are no sessions, so this is the average time on page"
            />
          )}
        </div>
        <div className="border-t border-border px-2 pt-6 pb-3 sm:px-4">
          {series === undefined ? (
            <div className="h-52 animate-pulse rounded-md bg-muted/50" />
          ) : (
            <CountChart data={series} count="visitors" className="aspect-auto h-52 w-full" />
          )}
        </div>
      </div>
      <div className="flex overflow-hidden rounded-lg border border-border [&>section]:flex-1">
        <Lists
          domain={domain}
          range={range}
          raw={raw}
          breakdowns={view?.breakdowns}
          filters={filters}
          onSelect={tracking ? (dim, key) => onFilters(toggleFilter(filters, dim, key)) : null}
          tracking={tracking}
        />
      </div>
    </div>
  );
}

/** Pageviews per visitor; null with no visitors. */
function viewsPerVisitor(t: Totals): number | null {
  return t.visitors === 0 ? null : t.pageviews / t.visitors;
}

/**
 * Visible-tab time per visitor, summed over their sessions: the Visit duration tile's
 * per-session average times sessions, over visitors.
 */
function timeOnSite(t: Totals): number | null {
  return t.sessionTimeMs === null || t.visitors === 0 ? null : (t.sessionTimeMs * t.sessions) / t.visitors;
}

/** One decimal: 3.14159 -> "3.1", 1234.5 -> "1,234.5". */
function formatRatio(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** A tile: label over a large number and its change against the period before. */
function Tile({
  label,
  value,
  change,
  incomparable,
  tooltip,
}: {
  label: string;
  /** undefined while loading */
  value: string | undefined;
  change: number | null;
  incomparable?: boolean;
  tooltip?: ReactNode;
}) {
  const tile = (
    <div className="flex h-full min-w-0 flex-col gap-2 bg-background px-5 py-5 sm:px-6">
      <span className="truncate text-sm text-muted-foreground">{label}</span>
      {value === undefined ? (
        <>
          <span className="h-8 w-20 animate-pulse rounded bg-muted" />
          <span className="h-4 w-24 animate-pulse rounded bg-muted" />
        </>
      ) : (
        <>
          <span className="truncate text-[1.625rem] leading-8 font-semibold tracking-tight tabular-nums">{value}</span>
          <span className="flex items-baseline gap-1 text-xs leading-4">
            <Change change={incomparable ? null : change} />
            {!incomparable && change !== null && <span className="truncate text-muted-foreground">vs previous</span>}
          </span>
        </>
      )}
    </div>
  );
  if (tooltip === undefined) return tile;
  return (
    <Tooltip>
      <TooltipTrigger render={tile} />
      <TooltipContent side="bottom">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Sources, Countries and Devices by visitors: the Analytics cards' first tabs (Referrers
 * on a site without visitor ids, whose hits have no source). Rows filter, as there.
 */
function Lists({
  domain,
  range,
  raw,
  breakdowns,
  filters,
  onSelect,
  tracking,
}: {
  domain: string;
  range: DateRange;
  raw: boolean;
  /** The filtered or hourly view's lists, when `raw` */
  breakdowns: Record<string, BreakdownResult> | undefined;
  filters: Filter[];
  onSelect: ((dim: Dim, key: string) => void) | null;
  tracking: boolean;
}) {
  const tabs: { id: string; label: string; dim: Dim }[] = [
    tracking ? { id: "source", label: "Sources", dim: "source" } : { id: "referrer", label: "Referrers", dim: "referrer" },
    { id: "country", label: "Countries", dim: "country" },
    { id: "device", label: "Devices", dim: "device" },
  ];
  const [tabId, setTabId] = useState(tabs[0].id);
  const { dim } = tabs.find((t) => t.id === tabId) ?? tabs[0];
  const rollup = useQuery(api.stats.breakdown, raw ? "skip" : { domain, dim, ...range });
  const data = raw ? breakdowns?.[dim] : rollup;
  const active = filters.find((f) => f.dim === dim)?.value;
  const select = onSelect && canFilter(filters, dim) ? onSelect : null;
  const ranked = data && rankEntries(dim, data.rows, "visitors");
  const top = ranked?.[0]?.visitors ?? 0;
  const rows: StatsRow[] | undefined = ranked?.map((r) => ({
    key: r.key,
    label: <Label dim={dim} value={r.key} />,
    href: rowHref(dim, r.key),
    icon: rowIcon(dim, r.key),
    active: r.key === active,
    ...(select ? { onSelect: () => select(dim, r.key) } : {}),
    value: formatNumber(r.visitors),
    share: top <= 0 ? 0 : r.visitors / top,
  }));
  return (
    <StatsCard
      title="Where visitors come from"
      tabs={tabs}
      tab={tabId}
      onTab={setTabId}
      metric="Visitors"
      rows={rows}
      empty="No visitors in this range"
    />
  );
}
