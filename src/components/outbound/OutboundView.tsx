"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { SearchIcon } from "lucide-react";
import { cn } from "cn";
import { api } from "../../../convex/_generated/api";
import { localDate } from "../../../convex/lib/dates";
import { LINK_ROWS, linkTiles, splitLinkKey, type LinkRow, type LinkSort } from "../../../convex/lib/outbound";
import { formatDate, formatNumber, formatShare } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import SiteFavicon from "@/components/SiteFavicon";
import CountChart from "@/components/dashboard/CountChart";
import SiteHeader, { BlockedNotice } from "@/components/dashboard/SiteHeader";
import SiteShell from "@/components/dashboard/SiteShell";
import {
  ChangeNote,
  LoadingRows,
  RowChange,
  SortHeader,
  Sparkline,
  Tile,
  type Column,
} from "@/components/dashboard/TableParts";
import { useSiteRange } from "@/components/dashboard/useSiteRange";

type Listed = Extract<FunctionReturnType<typeof api.outbound.list>, { status: "ok" }>;

// The search box waits this long after the last key before asking again
const SEARCH_DELAY_MS = 200;

const COLUMNS: Column<LinkSort>[] = [
  { sort: "link", label: "Link", numeric: false },
  { sort: "trend", label: "Trend", numeric: false },
  { sort: "clicks", label: "Clicks", numeric: true },
  { sort: "visitors", label: "Visitors", numeric: true },
];

export default function OutboundView() {
  return (
    <SiteShell section="outbound">
      {(site) => <Outbound domain={site.domain} timezone={site.timezone} trackingStartedAt={site.trackingStartedAt} />}
    </SiteShell>
  );
}

function Outbound({
  domain,
  timezone,
  trackingStartedAt,
}: {
  domain: string;
  timezone: string;
  trackingStartedAt: number | null;
}) {
  const tracking = trackingStartedAt !== null;
  const trackingStart = tracking ? localDate(trackingStartedAt, timezone) : null;
  const { today, range, preset, hourly, hourNow, filters, setRange, setFilters } = useSiteRange(timezone, tracking);

  const [sort, setSort] = useState<{ by: LinkSort; desc: boolean }>({ by: "clicks", desc: true });
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

  const result = useQuery(api.outbound.list, {
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
  const view = shown?.status === "ok" ? shown : undefined;
  const loading = result === undefined;

  const onSort = (by: LinkSort) =>
    // A new column starts largest first (links A to Z); the same one flips
    setSort((s) => (s.by === by ? { by, desc: !s.desc } : { by, desc: by !== "link" }));

  const filtering = filters.length > 0;
  return (
    <div className="flex flex-col gap-10">
      <SiteHeader
        title="Outbound"
        range={range}
        preset={preset}
        today={today}
        onRange={setRange}
        filters={filters}
        onFilters={setFilters}
        note={
          trackingStart !== null &&
          trackingStart > range.from &&
          (filtering || hourly !== null) &&
          view !== undefined && (
            <p className="text-xs text-muted-foreground">
              Filtered numbers count visits from {formatDate(trackingStart, true)}, when visitor tracking started.
            </p>
          )
        }
      />
      {shown !== undefined && shown.status !== "ok" ? (
        filtering || hourly !== null || shown.status === "range" ? (
          <BlockedNotice blocked={shown.status} hourly={hourly !== null} />
        ) : (
          <p className="w-full rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            There are too many links in this range to list. Pick a shorter range.
          </p>
        )
      ) : (
        <>
          <Overview view={view} />
          <section aria-labelledby="links" className="overflow-hidden rounded-lg border border-border">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
              <h2 id="links" className="flex items-baseline gap-2 font-medium">
                Links
                <span className="text-xs font-normal text-muted-foreground tabular-nums">
                  {view === undefined ? "" : formatNumber(view.links)}
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
                  placeholder="Search links…"
                  aria-label="Search links by domain or path"
                />
              </InputGroup>
            </div>
            {/* relative: keeps the sr-only text inside the scroll box on phones */}
            <div className="relative overflow-x-auto border-t border-border">
              <table className={cn("w-full min-w-[640px] text-sm", loading && view !== undefined && "opacity-60")}>
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    {COLUMNS.map((c) => (
                      <SortHeader key={c.sort} column={c} sort={sort} onSort={onSort} />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {view === undefined ? (
                    <LoadingRows columns={COLUMNS.length} />
                  ) : view.rows.length === 0 ? (
                    <tr>
                      <td colSpan={COLUMNS.length} className="px-4 py-12 text-center text-muted-foreground sm:px-5">
                        {view.links > 0 ? (
                          `No links match “${search.trim()}”.`
                        ) : filtering ? (
                          "No outbound clicks match these filters in this range."
                        ) : (
                          <>
                            No outbound clicks in this range.
                            <span className="mt-1 block text-xs">
                              The tracking snippet records clicks on links to other sites by itself.
                            </span>
                          </>
                        )}
                      </td>
                    </tr>
                  ) : (
                    view.rows.map((row) => <Row key={row.key} row={row} total={view.totals.clicks} />)
                  )}
                </tbody>
              </table>
            </div>
            {view !== undefined && view.matched > 0 && (
              <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-muted-foreground sm:px-5">
                <span className="tabular-nums">
                  {formatNumber(view.offset + 1)}–{formatNumber(view.offset + view.rows.length)} of{" "}
                  {formatNumber(view.matched)}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={view.offset === 0}
                    onClick={() => setPaging({ listing, offset: Math.max(0, view.offset - LINK_ROWS) })}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={view.offset + LINK_ROWS >= view.matched}
                    onClick={() => setPaging({ listing, offset: view.offset + LINK_ROWS })}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

/** Clicks per link: one decimal below 10 ("2.5"), whole above. */
function formatPerLink(n: number): string {
  return n < 10 ? String(Math.round(n * 10) / 10) : formatNumber(Math.round(n));
}

/**
 * Total clicks, Unique clicks, Links tracked and Clicks per link, each with its change,
 * joined over the clicks chart. Without `view`, the loading state.
 */
function Overview({ view }: { view: Listed | undefined }) {
  const tiles = view && linkTiles(view.totals, view.comparable);
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="grid grid-cols-2 gap-px border-b border-border bg-border sm:grid-cols-4">
        <Tile
          label="Total clicks"
          value={tiles && formatNumber(tiles.clicks.value)}
          note={tiles && <ChangeNote change={tiles.clicks.change} />}
        />
        <Tile
          label="Unique clicks"
          value={tiles && formatNumber(tiles.unique.value)}
          note={tiles && <ChangeNote change={tiles.unique.change} />}
        />
        <Tile
          label="Links tracked"
          value={tiles && formatNumber(tiles.links.value)}
          note={tiles && <ChangeNote change={tiles.links.change} />}
        />
        <Tile
          label="Clicks per link"
          value={tiles && (tiles.perLink.value === null ? "–" : formatPerLink(tiles.perLink.value))}
          note={tiles && <ChangeNote change={tiles.perLink.change} />}
        />
      </div>
      <div className="px-2 pt-6 pb-4 sm:px-4">
        {view === undefined ? (
          <div className="h-56 animate-pulse rounded-md bg-muted" aria-busy />
        ) : (
          <CountChart data={view.chart} count="clicks" className="aspect-auto h-56 w-full" />
        )}
      </div>
    </div>
  );
}

/** One link: favicon, host over path (opening the link in a new tab), trend, clicks and visitors. */
function Row({ row, total }: { row: LinkRow; total: number }) {
  const { host, path } = splitLinkKey(row.key);
  return (
    <tr className="border-b border-border last:border-b-0">
      <td className="max-w-[360px] px-4 py-3 sm:pl-5">
        <a
          href={row.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          title={`Open ${row.url}`}
          className="flex min-w-0 items-center gap-3 rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <SiteFavicon domain={host.replace(/:\d+$/, "")} />
          <span className="min-w-0">
            <span className="block truncate">{host}</span>
            {path !== "" && <span className="block truncate text-xs text-muted-foreground">{path}</span>}
          </span>
        </a>
      </td>
      <td className="px-4 py-3">
        <Sparkline values={row.trend} />
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
        {formatNumber(row.clicks)}
        <span className="ml-2 inline-block w-10 text-xs text-muted-foreground">
          {total > 0 ? formatShare(row.clicks / total) : ""}
        </span>
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums sm:pr-5">
        {row.visitors === 0 ? (
          <span className="text-muted-foreground">–</span>
        ) : (
          <>
            {formatNumber(row.visitors)}
            <RowChange change={row.visitorsChange} />
          </>
        )}
      </td>
    </tr>
  );
}
