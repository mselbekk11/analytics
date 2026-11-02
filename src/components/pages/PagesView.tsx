"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { ArrowDownIcon, ArrowUpIcon, SearchIcon } from "lucide-react";
import { cn } from "cn";
import { api } from "../../../convex/_generated/api";
import { localDate } from "../../../convex/lib/dates";
import { PAGE_ROWS, type PageRow, type PageSort } from "../../../convex/lib/pages";
import type { PageTiles as PageTilesData } from "../../../convex/pages";
import { percentChange } from "../../../convex/lib/ranges";
import {
  formatChange,
  formatDate,
  formatDuration,
  formatMoney,
  formatNumber,
  formatRate,
  formatShare,
} from "@/lib/format";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import SiteHeader, { BlockedNotice } from "@/components/dashboard/SiteHeader";
import SiteShell from "@/components/dashboard/SiteShell";
import { useSiteRange } from "@/components/dashboard/useSiteRange";
import PageDrawer from "./PageDrawer";

// The search box waits this long after the last key before asking again
const SEARCH_DELAY_MS = 200;

export default function PagesView() {
  return (
    <SiteShell section="pages">
      {(site) => (
        <Pages
          domain={site.domain}
          timezone={site.timezone}
          trackingStartedAt={site.trackingStartedAt}
          currency={site.revenueSource === "none" ? null : site.currency}
        />
      )}
    </SiteShell>
  );
}

type Column = { sort: PageSort; label: string; numeric: boolean };

function Pages({
  domain,
  timezone,
  trackingStartedAt,
  currency,
}: {
  domain: string;
  timezone: string;
  trackingStartedAt: number | null;
  /** The site's currency when it takes payments; null hides the Revenue column */
  currency: string | null;
}) {
  const tracking = trackingStartedAt !== null;
  const trackingStart = tracking ? localDate(trackingStartedAt, timezone) : null;
  const { today, range, preset, hourly, hourNow, filters, searchParams, navigate, setRange, setFilters } =
    useSiteRange(timezone, tracking);
  // The drawer's page, in `?page=` so it can be reloaded and shared
  const openPath = searchParams.get("page") || null;
  const openPage = (path: string | null) => navigate({ set: { page: path } });

  const [sort, setSort] = useState<{ by: PageSort; desc: boolean }>({ by: "views", desc: true });
  const [typed, setTyped] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setSearch(typed), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [typed]);
  // The table goes back to its first rows whenever what it lists changes
  const listing = JSON.stringify([range, hourly, filters, search, sort]);
  const [paging, setPaging] = useState({ listing, offset: 0 });
  const offset = paging.listing === listing ? paging.offset : 0;

  const result = useQuery(api.pages.list, {
    domain,
    range: hourly !== null ? { period: hourly, now: hourNow } : range,
    filters,
    sort: sort.by,
    desc: sort.desc,
    search,
    offset,
  });
  // Keep the last answer on screen while the next one loads, so paging doesn't flash
  const [last, setLast] = useState(result);
  if (result !== undefined && result !== last) setLast(result);
  const shown = result ?? last;
  const loading = result === undefined;

  const columns: Column[] = [
    { sort: "path", label: "Page", numeric: false },
    { sort: "trend", label: "Trend", numeric: false },
    { sort: "views", label: "Views", numeric: true },
    { sort: "sessions", label: "Sessions", numeric: true },
    { sort: "bounce", label: "Bounce", numeric: true },
    { sort: "duration", label: "Duration", numeric: true },
    ...(currency !== null ? [{ sort: "revenue" as const, label: "Revenue", numeric: true }] : []),
  ];
  const onSort = (by: PageSort) =>
    // A new column starts largest first (paths A to Z); the same one flips
    setSort((s) => (s.by === by ? { by, desc: !s.desc } : { by, desc: by !== "path" }));

  const filtering = filters.length > 0;
  return (
    <div className="flex flex-col gap-10">
      <SiteHeader
        title="Pages"
        range={range}
        preset={preset}
        today={today}
        onRange={setRange}
        filters={filters}
        onFilters={setFilters}
        note={
          trackingStart !== null &&
          trackingStart > range.from &&
          shown?.status === "ok" && (
            <p className="text-xs text-muted-foreground">
              Filtered numbers count visits from {formatDate(trackingStart, true)}, when visitor tracking started.
            </p>
          )
        }
      />
      {shown === undefined ? <PageTiles /> : shown.status === "ok" && <PageTiles pages={shown.pages} tiles={shown.tiles} />}
      {shown !== undefined && shown.status !== "ok" ? (
        filtering || hourly !== null || shown.status === "range" ? (
          <BlockedNotice blocked={shown.status} hourly={hourly !== null} />
        ) : (
          <p className="w-full rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            There are too many pages in this range to list. Pick a shorter range.
          </p>
        )
      ) : (
        <section aria-labelledby="all-pages" className="overflow-hidden rounded-lg border border-border">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
            <h2 id="all-pages" className="flex items-baseline gap-2 font-medium">
              All pages
              <span className="text-xs font-normal text-muted-foreground tabular-nums">
                {shown === undefined ? "" : formatNumber(shown.pages)}
              </span>
            </h2>
            <InputGroup className="w-full sm:w-64">
              <InputGroupAddon>
                <SearchIcon aria-hidden />
              </InputGroupAddon>
              <InputGroupInput
                type="search"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="Search pages…"
                aria-label="Search pages by path or title"
              />
            </InputGroup>
          </div>
          <div className="overflow-x-auto border-t border-border">
            <table className={cn("w-full min-w-[760px] text-sm", loading && shown !== undefined && "opacity-60")}>
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  {columns.map((c) => (
                    <SortHeader key={c.sort} column={c} sort={sort} onSort={onSort} />
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown === undefined ? (
                  <LoadingRows columns={columns.length} />
                ) : shown.rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-12 text-center text-muted-foreground sm:px-5">
                      {shown.pages === 0
                        ? filtering
                          ? "No pageviews match these filters in this range."
                          : "No pageviews in this range."
                        : `No pages match “${search.trim()}”.`}
                    </td>
                  </tr>
                ) : (
                  shown.rows.map((row) => (
                    <Row
                      key={row.path}
                      row={row}
                      total={shown.totalPageviews}
                      currency={currency}
                      open={row.path === openPath}
                      onOpen={() => openPage(row.path)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
          {shown !== undefined && shown.matched > 0 && (
            <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-muted-foreground sm:px-5">
              <span className="tabular-nums">
                {formatNumber(shown.offset + 1)}–{formatNumber(shown.offset + shown.rows.length)} of{" "}
                {formatNumber(shown.matched)}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={shown.offset === 0}
                  onClick={() => setPaging({ listing, offset: Math.max(0, shown.offset - PAGE_ROWS) })}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={shown.offset + PAGE_ROWS >= shown.matched}
                  onClick={() => setPaging({ listing, offset: shown.offset + PAGE_ROWS })}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </section>
      )}
      <PageDrawer
        domain={domain}
        path={openPath}
        range={range}
        hourly={hourly}
        hourNow={hourNow}
        filters={filters}
        tracking={tracking}
        onClose={() => openPage(null)}
      />
    </div>
  );
}

function SortHeader({
  column,
  sort,
  onSort,
}: {
  column: Column;
  sort: { by: PageSort; desc: boolean };
  onSort: (by: PageSort) => void;
}) {
  const active = sort.by === column.sort;
  const Arrow = sort.desc ? ArrowDownIcon : ArrowUpIcon;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.desc ? "descending" : "ascending") : undefined}
      className={cn(
        "px-4 py-3 font-normal sm:first:pl-5 sm:last:pr-5",
        column.numeric ? "text-right" : "text-left",
      )}
    >
      <button
        type="button"
        onClick={() => onSort(column.sort)}
        className={cn(
          "inline-flex items-center gap-1 rounded-sm transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
          active && "text-foreground",
        )}
      >
        {column.label}
        {active && <Arrow aria-hidden className="size-3" />}
      </button>
    </th>
  );
}

/**
 * Pages viewed, Pageviews (with its change), Sessions, Avg. bounce and Avg. duration over
 * the range, in one joined block. Without props, the loading state.
 */
function PageTiles({ pages, tiles }: { pages?: number; tiles?: PageTilesData }) {
  const change = tiles && percentChange(tiles.pageviews, tiles.previousPageviews);
  const direction = change ? Math.sign(Math.round(change * 1000)) : 0;
  const dash = (n: number | null | undefined, format: (n: number) => string) =>
    tiles && (n === null || n === undefined ? "–" : format(n));
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-5 [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1">
      <PageTile label="Pages viewed" value={tiles && formatNumber(pages ?? 0)} note="unique paths" />
      <PageTile
        label="Pageviews"
        value={tiles && formatNumber(tiles.pageviews)}
        note={
          change === null || change === undefined ? (
            "–"
          ) : (
            <>
              <span className={cn("font-medium", direction > 0 && "text-up", direction < 0 && "text-down")}>
                {formatChange(change)}
              </span>{" "}
              vs previous
            </>
          )
        }
      />
      <PageTile label="Sessions" value={dash(tiles?.sessions || null, formatNumber)} />
      <PageTile label="Avg. bounce" value={dash(tiles?.bounceRate, formatRate)} />
      <PageTile label="Avg. duration" value={dash(tiles?.timeOnPageMs, formatDuration)} />
    </div>
  );
}

function PageTile({ label, value, note }: { label: string; value: string | undefined; note?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 bg-background px-6 py-6">
      <span className="truncate text-sm text-muted-foreground">{label}</span>
      {value === undefined ? (
        <span className="h-8 w-20 animate-pulse rounded bg-muted" />
      ) : (
        <span className="truncate text-[1.625rem] leading-8 font-semibold tracking-tight tabular-nums">{value}</span>
      )}
      <span className="min-h-4 truncate text-xs leading-4 text-muted-foreground tabular-nums">
        {value === undefined ? null : note}
      </span>
    </div>
  );
}

/**
 * One page of the table. Clicking anywhere on it opens its drawer; the page cell is the
 * button keyboards reach, and focus comes back to it when the drawer closes.
 */
function Row({
  row,
  total,
  currency,
  open,
  onOpen,
}: {
  row: PageRow;
  total: number;
  currency: string | null;
  /** Its drawer is open */
  open: boolean;
  onOpen: () => void;
}) {
  return (
    <tr
      onClick={onOpen}
      className={cn(
        "cursor-pointer border-b border-border transition-colors last:border-b-0 hover:bg-muted/40",
        open && "bg-muted/40",
      )}
    >
      <td className="max-w-[320px] px-4 py-3 sm:pl-5">
        <button
          type="button"
          data-page-row={row.path}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="block w-full min-w-0 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {row.title === null ? (
            <span className="block truncate" title={row.path}>
              {row.path}
            </span>
          ) : (
            <>
              <span className="block truncate" title={row.title}>
                {row.title}
              </span>
              <span className="block truncate text-xs text-muted-foreground" title={row.path}>
                {row.path}
              </span>
            </>
          )}
        </button>
      </td>
      <td className="px-4 py-3">
        <Sparkline values={row.trend} />
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
        {formatNumber(row.views)}
        <span className="ml-2 inline-block w-10 text-xs text-muted-foreground">
          {total > 0 ? formatShare(row.views / total) : ""}
        </span>
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
        {row.sessions === 0 ? (
          <Dash />
        ) : (
          <>
            {formatNumber(row.sessions)}
            <SessionsChange change={row.sessionsChange} />
          </>
        )}
      </td>
      <td className="px-4 py-3 text-right tabular-nums">
        {row.bounceRate === null ? <Dash /> : formatShare(row.bounceRate)}
      </td>
      <td className={cn("px-4 py-3 text-right whitespace-nowrap tabular-nums", currency === null && "sm:pr-5")}>
        {row.durationMs === null ? <Dash /> : formatDuration(row.durationMs)}
      </td>
      {currency !== null && (
        <td className="px-4 py-3 text-right tabular-nums sm:pr-5">
          {row.revenueMinor === 0 ? (
            <Dash />
          ) : (
            formatMoney(row.revenueMinor, currency, true)
          )}
        </td>
      )}
    </tr>
  );
}

function Dash() {
  return <span className="text-muted-foreground">–</span>;
}

/** The sessions change against the period before, green up and red down; empty without one. */
function SessionsChange({ change }: { change: number | null }) {
  const rounded = change === null ? 0 : Math.round(change * 1000);
  return (
    <span
      className={cn(
        "ml-2 inline-block w-14 text-left text-xs",
        rounded > 0 ? "text-up" : rounded < 0 ? "text-down" : "text-muted-foreground",
      )}
    >
      {change === null ? "" : formatChange(change)}
    </span>
  );
}

const SPARK_W = 96;
const SPARK_H = 24;

/** The page's views over the range as a small line, with a dot on the last point. */
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <span className="text-muted-foreground">–</span>;
  const max = Math.max(1, ...values);
  const x = (i: number) => 1 + (i * (SPARK_W - 4)) / (values.length - 1);
  const y = (v: number) => SPARK_H - 3 - (v / max) * (SPARK_H - 6);
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = values.length - 1;
  return (
    <svg width={SPARK_W} height={SPARK_H} viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} aria-hidden className="block">
      <polyline
        points={points}
        fill="none"
        strokeWidth={1.25}
        strokeLinejoin="round"
        strokeLinecap="round"
        className="stroke-muted-foreground"
      />
      <circle cx={x(last)} cy={y(values[last])} r={2} className="fill-foreground" />
    </svg>
  );
}

function LoadingRows({ columns }: { columns: number }) {
  return (
    <>
      {Array.from({ length: 6 }, (_, i) => (
        <tr key={i} className="border-b border-border last:border-b-0" aria-hidden>
          {Array.from({ length: columns }, (_, j) => (
            <td key={j} className="px-4 py-3.5 sm:first:pl-5 sm:last:pr-5">
              <div className={cn("h-4 animate-pulse rounded bg-muted", j === 0 ? "w-40" : "ml-auto w-12")} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
