"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { SearchIcon } from "lucide-react";
import { cn } from "cn";
import { api } from "../../../convex/_generated/api";
import { rankEntries, type Dim } from "../../../convex/lib/dims";
import { canFilter, toggleFilter, type Filter } from "../../../convex/lib/filters";
import {
  JOURNEY_CAP,
  PAYMENT_ROWS,
  revenueTiles,
  type PaymentRow,
  type PaymentSort,
} from "../../../convex/lib/payments";
import type { DateRange } from "../../../convex/lib/ranges";
import type { BreakdownResult } from "../../../convex/lib/statsShapes";
import {
  countryFlag,
  countryName,
  deviceLabel,
  formatDateTime,
  formatElapsed,
  formatMoney,
  formatNumber,
} from "@/lib/format";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import PageHeader from "@/components/PageHeader";
import { sitePath } from "@/components/TopBar";
import { Label, rowHref, rowIcon } from "@/components/dashboard/Breakdowns";
import CountChart from "@/components/dashboard/CountChart";
import SiteHeader, { BlockedNotice } from "@/components/dashboard/SiteHeader";
import SiteShell from "@/components/dashboard/SiteShell";
import StatsCard, { type StatsRow } from "@/components/dashboard/StatsCard";
import { ChangeNote, LoadingRows, SortHeader, Tile, type Column } from "@/components/dashboard/TableParts";
import { useSiteRange } from "@/components/dashboard/useSiteRange";
import { Source } from "@/components/customers/Source";
import VisitorAvatar from "@/components/customers/VisitorAvatar";
import VisitorDrawer from "@/components/users/VisitorDrawer";

type Listed = Extract<FunctionReturnType<typeof api.revenue.list>, { status: "ok" }>;

// The search box waits this long after the last key before asking again
const SEARCH_DELAY_MS = 200;
// Journey dots drawn before the count says the rest
const MAX_DOTS = 5;

const COLUMNS: (Column<PaymentSort> | { sort: null; label: string; numeric: boolean })[] = [
  { sort: "customer", label: "Customer", numeric: false },
  { sort: "location", label: "Location", numeric: false },
  { sort: "source", label: "Source", numeric: false },
  { sort: null, label: "Journey", numeric: false },
  { sort: "took", label: "Took", numeric: true },
  { sort: "amount", label: "Amount", numeric: true },
  { sort: "paid", label: "Paid", numeric: true },
];

export default function RevenueView() {
  return (
    <SiteShell section="revenue">
      {(site) =>
        site.revenueSource === "none" ? (
          <Setup domain={site.domain} />
        ) : (
          <Revenue
            domain={site.domain}
            timezone={site.timezone}
            keyGoal={site.keyGoal}
            tracking={site.trackingStartedAt !== null}
            currency={site.currency}
          />
        )
      }
    </SiteShell>
  );
}

/** A site without a payments provider: what the tab needs, and where to set it up. */
function Setup({ domain }: { domain: string }) {
  return (
    <div className="flex flex-col gap-10">
      <PageHeader title="Revenue" />
      <div className="flex flex-col gap-2 rounded-lg border border-border px-5 py-6 text-sm">
        <h2 className="font-medium">Connect your payments to see revenue</h2>
        <p className="max-w-prose text-muted-foreground">
          The Revenue tab shows what each source and country brings in, and every payment with the visit that led to
          it. It needs Stripe or the payments API, set up for this site in Settings.
        </p>
        <p>
          <Link
            href={`${sitePath(domain, "settings")}?section=revenue`}
            className="text-muted-foreground underline hover:text-foreground"
          >
            Set up revenue attribution
          </Link>
        </p>
      </div>
    </div>
  );
}

function Revenue({
  domain,
  timezone,
  keyGoal,
  tracking,
  currency,
}: {
  domain: string;
  timezone: string;
  keyGoal: string | null;
  tracking: boolean;
  currency: string;
}) {
  const { today, range, preset, hourly, hourNow, filters, searchParams, navigate, setRange, setFilters } =
    useSiteRange(timezone, tracking);
  // The drawer's visitor, in `?visitor=` as on the Users tab
  const openId = searchParams.get("visitor") || null;
  const openVisitor = (visitorId: string | null) => navigate({ set: { visitor: visitorId } });

  const [sort, setSort] = useState<{ by: PaymentSort; desc: boolean }>({ by: "paid", desc: true });
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

  const result = useQuery(api.revenue.list, {
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

  const onSort = (by: PaymentSort) =>
    // A new column starts largest (or newest, or Z) first for numbers, A first for text
    setSort((s) =>
      s.by === by ? { by, desc: !s.desc } : { by, desc: by === "took" || by === "amount" || by === "paid" },
    );

  const filtering = filters.length > 0;
  const raw = filtering || hourly !== null;
  return (
    <div className="flex flex-col gap-10">
      <SiteHeader
        title="Revenue"
        range={range}
        preset={preset}
        today={today}
        onRange={setRange}
        filters={filters}
        onFilters={setFilters}
        note={
          <p className="text-xs text-muted-foreground">
            Filters keep the payments credited to matching visits; payments not linked to a visit drop out.
          </p>
        }
      />
      {shown !== undefined && shown.status !== "ok" ? (
        shown.status === "none" ? null : raw || shown.status === "range" ? (
          <BlockedNotice blocked={shown.status} hourly={hourly !== null} />
        ) : (
          <p className="w-full rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            There are too many payments in this range to list. Pick a shorter range.
          </p>
        )
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Overview view={view} currency={currency} />
            <div className="flex overflow-hidden rounded-lg border border-border [&>section]:flex-1">
              <Lists
                domain={domain}
                range={range}
                raw={raw}
                lists={view?.lists ?? undefined}
                currency={currency}
                filters={filters}
                onSelect={tracking ? (dim, key) => setFilters(toggleFilter(filters, dim, key)) : null}
              />
            </div>
          </div>
          <section aria-labelledby="payments" className="overflow-hidden rounded-lg border border-border">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
              <h2 id="payments" className="flex items-baseline gap-2 font-medium">
                Payments
                <span className="text-xs font-normal text-muted-foreground tabular-nums">
                  {view === undefined ? "" : formatNumber(view.totals.payments)}
                </span>
              </h2>
              <InputGroup className="w-full sm:w-72">
                <InputGroupAddon>
                  <SearchIcon aria-hidden />
                </InputGroupAddon>
                <InputGroupInput
                  type="search"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder="Search customer, source, country, page…"
                  aria-label="Search payments by customer, source, country or landing page"
                />
              </InputGroup>
            </div>
            {view !== undefined && view.otherCurrency > 0 && (
              <p className="border-t border-border bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground sm:px-5">
                {formatNumber(view.otherCurrency)} {view.otherCurrency === 1 ? "payment" : "payments"} in another
                currency than {currency} {view.otherCurrency === 1 ? "isn't" : "aren't"} counted or listed here.
              </p>
            )}
            {/* relative: keeps the sr-only text inside the scroll box on phones */}
            <div className="relative overflow-x-auto border-t border-border">
              <table className={cn("w-full min-w-[920px] text-sm", loading && view !== undefined && "opacity-60")}>
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    {COLUMNS.map((c) =>
                      c.sort === null ? (
                        <th key={c.label} scope="col" className="px-4 py-3 text-left font-normal">
                          {c.label}
                        </th>
                      ) : (
                        <SortHeader key={c.sort} column={c} sort={sort} onSort={onSort} />
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {view === undefined ? (
                    <LoadingRows columns={COLUMNS.length} />
                  ) : view.rows.length === 0 ? (
                    <tr>
                      <td colSpan={COLUMNS.length} className="px-4 py-12 text-center text-muted-foreground sm:px-5">
                        {search.trim() !== "" ? (
                          `No payments match “${search.trim()}”.`
                        ) : filtering ? (
                          "No payments match these filters in this range."
                        ) : (
                          <>
                            No payments in this range.
                            <span className="mt-1 block text-xs">
                              Payments show up here within seconds of Stripe or the payments API reporting them.
                            </span>
                          </>
                        )}
                      </td>
                    </tr>
                  ) : (
                    view.rows.map((row) => (
                      <Row
                        key={row.id}
                        row={row}
                        currency={currency}
                        timezone={timezone}
                        open={row.visitorId !== null && row.visitorId === openId}
                        onOpen={row.visitorId === null ? null : () => openVisitor(row.visitorId)}
                      />
                    ))
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
                    onClick={() => setPaging({ listing, offset: Math.max(0, view.offset - PAYMENT_ROWS) })}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={view.offset + PAYMENT_ROWS >= view.matched}
                    onClick={() => setPaging({ listing, offset: view.offset + PAYMENT_ROWS })}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </section>
        </>
      )}
      <VisitorDrawer
        domain={domain}
        timezone={timezone}
        keyGoal={keyGoal}
        visitorId={openId}
        onClose={() => openVisitor(null)}
      />
    </div>
  );
}

/**
 * Revenue, Conversions, Avg. order value and Avg. time to convert, each with its change,
 * joined over the daily (or hourly) revenue chart. Without `view`, the loading state.
 */
function Overview({ view, currency }: { view: Listed | undefined; currency: string }) {
  const tiles = view && revenueTiles(view.totals);
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="grid grid-cols-2 gap-px border-b border-border bg-border sm:grid-cols-4">
        <Tile
          label="Revenue"
          value={tiles && formatMoney(tiles.revenue.value, currency, true)}
          note={tiles && <ChangeNote change={tiles.revenue.change} />}
        />
        <Tile
          label="Conversions"
          value={tiles && formatNumber(tiles.conversions.value)}
          note={tiles && <ChangeNote change={tiles.conversions.change} />}
        />
        <Tile
          label="Avg. order value"
          value={tiles && (tiles.aov.value === null ? "–" : formatMoney(Math.round(tiles.aov.value), currency, true))}
          note={tiles && <ChangeNote change={tiles.aov.change} />}
        />
        <Tile
          label="Avg. time to convert"
          value={tiles && (tiles.took.value === null ? "–" : formatElapsed(tiles.took.value))}
          note={tiles && <ChangeNote change={tiles.took.change} invert />}
        />
      </div>
      <div className="px-2 pt-6 pb-4 sm:px-4">
        {view === undefined ? (
          <div className="h-56 animate-pulse rounded-md bg-muted" aria-busy />
        ) : (
          <CountChart
            data={view.chart.map((p) => ({ date: p.date, revenue: p.revenueMinor }))}
            count="revenue" currency={currency} className="aspect-auto h-56 w-full" />
        )}
      </div>
    </div>
  );
}

/**
 * Sources and Countries by revenue: the Analytics cards on "Revenue ⇅" (stats.breakdown
 * on the rollups, the filtered view's lists otherwise), so the two agree. Rows filter, as there.
 */
function Lists({
  domain,
  range,
  raw,
  lists,
  currency,
  filters,
  onSelect,
}: {
  domain: string;
  range: DateRange;
  raw: boolean;
  /** The filtered or hourly view's lists, when `raw` */
  lists: { source: BreakdownResult; country: BreakdownResult } | undefined;
  currency: string;
  filters: Filter[];
  onSelect: ((dim: Dim, key: string) => void) | null;
}) {
  const tabs: { id: "source" | "country"; label: string }[] = [
    { id: "source", label: "Sources" },
    { id: "country", label: "Countries" },
  ];
  const [dim, setDim] = useState<"source" | "country">("source");
  const rollup = useQuery(api.stats.breakdown, raw ? "skip" : { domain, dim, ...range });
  const data = raw ? lists?.[dim] : rollup;
  const active = filters.find((f) => f.dim === dim)?.value;
  const select = onSelect && canFilter(filters, dim) ? onSelect : null;
  const ranked = data && rankEntries(dim, data.rows, "revenue");
  const top = Math.max(0, ...(ranked ?? []).map((r) => r.revenueMinor));
  const rows: StatsRow[] | undefined = ranked?.map((r) => ({
    key: r.key,
    label: <Label dim={dim} value={r.key} />,
    href: rowHref(dim, r.key),
    icon: rowIcon(dim, r.key),
    active: r.key === active,
    ...(select ? { onSelect: () => select(dim, r.key) } : {}),
    value: formatMoney(r.revenueMinor, currency, true),
    share: top <= 0 ? 0 : Math.max(0, r.revenueMinor) / top,
  }));
  return (
    <StatsCard
      title="Where revenue comes from"
      tabs={tabs}
      tab={dim}
      onTab={(id) => setDim(id === "country" ? "country" : "source")}
      metric="Revenue"
      rows={rows}
      empty="No revenue in this range"
    />
  );
}

/**
 * One payment or refund. A payment linked to a visitor opens their drawer from anywhere
 * on the row; the customer cell is the button keyboards reach.
 */
function Row({
  row,
  currency,
  timezone,
  open,
  onOpen,
}: {
  row: PaymentRow;
  currency: string;
  timezone: string;
  open: boolean;
  /** Null for a payment no visitor was matched to */
  onOpen: (() => void) | null;
}) {
  const name = row.customer ?? "Unknown customer";
  const who = (
    <>
      {row.visitorId !== null ? (
        <VisitorAvatar visitorId={row.visitorId} />
      ) : (
        <span aria-hidden className="size-7 shrink-0 rounded-full bg-muted" />
      )}
      <span className="min-w-0">
        <span className={cn("block truncate", row.customer === null && "text-muted-foreground")} title={name}>
          {name}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {row.device !== null ? deviceLabel(row.device) : "No visit linked"}
        </span>
      </span>
    </>
  );
  return (
    <tr
      onClick={onOpen ?? undefined}
      className={cn(
        "border-b border-border transition-colors last:border-b-0",
        onOpen !== null && "cursor-pointer hover:bg-muted/40",
        open && "bg-muted/40",
      )}
    >
      <td className="max-w-64 px-4 py-3 sm:pl-5">
        {onOpen !== null ? (
          <button
            type="button"
            data-visitor-row={row.visitorId}
            aria-haspopup="dialog"
            aria-expanded={open}
            className="flex w-full min-w-0 items-center gap-3 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {who}
          </button>
        ) : (
          <span className="flex min-w-0 items-center gap-3">{who}</span>
        )}
      </td>
      <td className="max-w-52 px-4 py-3">
        {row.country === null ? (
          <Dash />
        ) : (
          <span className="flex min-w-0 items-center gap-2">
            <span aria-hidden className="text-base leading-none">
              {countryFlag(row.country) || "🌐"}
            </span>
            <span className="truncate">{countryName(row.country)}</span>
          </span>
        )}
      </td>
      <td className="max-w-48 px-4 py-3">
        {row.source === null ? (
          <span className="text-muted-foreground">Unattributed</span>
        ) : (
          <Source source={row.source} channel={null} />
        )}
      </td>
      <td className="px-4 py-3">
        <Journey sessions={row.journey} />
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
        {row.tookMs !== null ? (
          formatElapsed(row.tookMs)
        ) : row.kind === "refund" ? (
          <span className="text-muted-foreground">Refund</span>
        ) : row.renewal ? (
          <span className="text-muted-foreground">Renewal</span>
        ) : (
          <Dash />
        )}
      </td>
      <td
        className={cn(
          "px-4 py-3 text-right font-medium whitespace-nowrap tabular-nums",
          row.amountMinor < 0 && "text-down",
        )}
      >
        {formatMoney(row.amountMinor, currency)}
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap text-muted-foreground tabular-nums sm:pr-5">
        {formatDateTime(row.ts, timezone)}
      </td>
    </tr>
  );
}

/** The visitor's sessions up to the payment as dots, the last (the one that paid) filled. */
function Journey({ sessions }: { sessions: number | null }) {
  if (sessions === null || sessions === 0) return <Dash />;
  const label = `${sessions > JOURNEY_CAP ? `${JOURNEY_CAP}+` : sessions} ${sessions === 1 ? "session" : "sessions"} up to this payment`;
  const dots = Math.min(sessions, MAX_DOTS);
  return (
    <span className="flex items-center gap-1" title={label}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: dots }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className={cn(
            "rounded-full",
            i === dots - 1 ? "size-2 bg-foreground" : "size-1.5 bg-muted-foreground/50",
          )}
        />
      ))}
      {sessions > MAX_DOTS && (
        <span aria-hidden className="ml-1 text-xs text-muted-foreground tabular-nums">
          {sessions > JOURNEY_CAP ? `${JOURNEY_CAP}+` : sessions}
        </span>
      )}
    </span>
  );
}

function Dash() {
  return <span className="text-muted-foreground">–</span>;
}
