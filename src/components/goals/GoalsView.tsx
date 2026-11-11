"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { ChevronRightIcon } from "lucide-react";
import { cn } from "cn";
import { api } from "../../../convex/_generated/api";
import { localDate } from "../../../convex/lib/dates";
import { canFilter, formatFiltersParam, type Filter } from "../../../convex/lib/filters";
import { goalRate, goalTiles, type GoalRow, type OtherEvent } from "../../../convex/lib/goals";
import { formatDate, formatNumber, formatRate, formatShare } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import CopyButton from "@/components/CopyButton";
import { Label, rowIcon } from "@/components/dashboard/Breakdowns";
import SiteHeader, { BlockedNotice } from "@/components/dashboard/SiteHeader";
import SiteShell from "@/components/dashboard/SiteShell";
import { useSiteRange } from "@/components/dashboard/useSiteRange";
import { sitePath } from "@/components/TopBar";

type Overview = Extract<FunctionReturnType<typeof api.goals.overview>, { status: "ok" }>;
type Kind = "all" | "event" | "page";

/** The one line that sends an event, shown when a site has none yet */
export const EVENT_SNIPPET = `analytics("goal", "signup");`;

export default function GoalsView() {
  return (
    <SiteShell section="goals">
      {(site) => (
        <Goals
          domain={site.domain}
          timezone={site.timezone}
          trackingStartedAt={site.trackingStartedAt}
          keyGoal={site.keyGoal}
        />
      )}
    </SiteShell>
  );
}

function Goals({
  domain,
  timezone,
  trackingStartedAt,
  keyGoal,
}: {
  domain: string;
  timezone: string;
  trackingStartedAt: number | null;
  keyGoal: string | null;
}) {
  const tracking = trackingStartedAt !== null;
  const trackingStart = tracking ? localDate(trackingStartedAt, timezone) : null;
  const { today, range, preset, hourly, hourNow, filters, searchParams, navigate, setRange, setFilters } =
    useSiteRange(timezone, tracking);
  const kindParam = searchParams.get("type");
  const kind: Kind = kindParam === "event" || kindParam === "page" ? kindParam : "all";

  const result = useQuery(api.goals.overview, {
    domain,
    range: hourly !== null ? { period: hourly, now: hourNow } : range,
    filters,
  });
  // Keep the last answer on screen while the next one loads
  const [last, setLast] = useState(result);
  if (result !== undefined && result !== last) setLast(result);
  const shown = result ?? last;
  const view = shown?.status === "ok" ? shown : undefined;
  const settings = `${sitePath(domain, "settings")}?section=goals`;

  // A goal's row opens Analytics filtered by it, with this view's range and filters
  const router = useRouter();
  const analyticsHref = (row: GoalRow): string | null => {
    const dim = row.kind === "event" ? "goal" : "page";
    if (!tracking || !canFilter(filters, dim)) return null;
    const next: Filter[] = [...filters.filter((f) => f.dim !== dim), { dim, value: row.key }];
    const params = new URLSearchParams();
    const r = searchParams.get("range");
    if (r) params.set("range", r);
    const metric = searchParams.get("metric");
    if (metric) params.set("metric", metric);
    const query = [params.toString(), `f=${formatFiltersParam(next)}`].filter(Boolean).join("&");
    return `${sitePath(domain, "analytics")}?${query}`;
  };

  return (
    <div className="flex flex-col gap-10">
      <SiteHeader
        title="Goals"
        range={range}
        preset={preset}
        today={today}
        onRange={setRange}
        filters={filters}
        onFilters={setFilters}
        actions={
          <Link href={settings} className={buttonVariants({ variant: "default" })}>
            Manage goals
          </Link>
        }
        note={
          trackingStart !== null &&
          trackingStart > range.from &&
          view !== undefined && (
            <p className="text-xs text-muted-foreground">
              Filtered numbers count visits from {formatDate(trackingStart, true)}, when visitor tracking started.
            </p>
          )
        }
      />
      {shown !== undefined && shown.status !== "ok" ? (
        <BlockedNotice blocked={shown.status} hourly={hourly !== null} />
      ) : view !== undefined && view.rows.length === 0 && view.others.length === 0 && filters.length === 0 ? (
        <EmptyState settings={settings} />
      ) : (
        <>
          <GoalTiles view={view} />
          <GoalsTable
            view={view}
            kind={kind}
            onKind={(next) => navigate({ set: { type: next === "all" ? null : next } })}
            keyGoal={keyGoal}
            loading={result === undefined}
            hrefOf={analyticsHref}
            onOpen={(href) => router.push(href)}
            settings={settings}
          />
          {view !== undefined && view.others.length > 0 && <OtherEvents domain={domain} others={view.others} />}
        </>
      )}
    </div>
  );
}

/** Goals tracked (events · pageviews), Total conversions and Avg. conversion rate. */
function GoalTiles({ view }: { view: Overview | undefined }) {
  const tiles = view && goalTiles(view.rows, view.visitors);
  return (
    <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
      <Tile
        label="Goals tracked"
        value={tiles && formatNumber(tiles.tracked)}
        note={
          tiles &&
          `${formatNumber(tiles.events)} ${tiles.events === 1 ? "event" : "events"} · ${formatNumber(tiles.pageviews)} ${
            tiles.pageviews === 1 ? "pageview" : "pageviews"
          }`
        }
      />
      <Tile label="Total conversions" value={tiles && formatNumber(tiles.conversions)} />
      <Tile
        label="Avg. conversion rate"
        value={tiles && (tiles.avgRate === null ? "–" : formatRate(tiles.avgRate))}
        note={tiles && tiles.tracked > 0 ? "the goals' rates, averaged" : undefined}
      />
    </div>
  );
}

function Tile({ label, value, note }: { label: string; value: string | undefined; note?: ReactNode }) {
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

const KINDS: { value: Kind; label: string }[] = [
  { value: "all", label: "All" },
  { value: "event", label: "Events" },
  { value: "page", label: "Pageviews" },
];

function GoalsTable({
  view,
  kind,
  onKind,
  keyGoal,
  loading,
  hrefOf,
  onOpen,
  settings,
}: {
  view: Overview | undefined;
  kind: Kind;
  onKind: (kind: Kind) => void;
  keyGoal: string | null;
  loading: boolean;
  hrefOf: (row: GoalRow) => string | null;
  onOpen: (href: string) => void;
  settings: string;
}) {
  const rows = view?.rows.filter((r) => kind === "all" || r.kind === kind);
  // Bars are relative to the highest rate
  const rates = rows?.map((r) => goalRate(r.visitors, view?.visitors ?? 0) ?? 0) ?? [];
  const topRate = Math.max(0, ...rates);
  return (
    <section aria-labelledby="goals-table" className="overflow-hidden rounded-lg border border-border">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
        <h2 id="goals-table" className="flex items-baseline gap-2 font-medium">
          Goals
          <span className="text-xs font-normal text-muted-foreground tabular-nums">
            {view === undefined ? "" : formatNumber(view.rows.length)}
          </span>
        </h2>
        <ToggleGroup
          value={[kind]}
          onValueChange={(value) => {
            // Clicking the pressed one again reports an empty value; keep it
            const next = value[0] as Kind | undefined;
            if (next) onKind(next);
          }}
          spacing={0}
          size="sm"
          aria-label="Goals to list"
          className="rounded-lg border border-border p-0.5"
        >
          {KINDS.map((k) => (
            <ToggleGroupItem
              key={k.value}
              value={k.value}
              className="rounded-md! px-3 text-muted-foreground data-pressed:text-foreground"
            >
              {k.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      {/* relative: keeps the sr-only header text inside the scroll box on phones */}
      <div className="relative overflow-x-auto border-t border-border">
        <table className={cn("w-full min-w-[720px] text-sm", loading && view !== undefined && "opacity-60")}>
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th scope="col" className="px-4 py-3 text-left font-normal sm:pl-5">
                Goal
              </th>
              <th scope="col" className="px-4 py-3 text-left font-normal">
                Type
              </th>
              <th scope="col" className="px-4 py-3 text-right font-normal">
                Conversions
              </th>
              <th scope="col" className="px-4 py-3 text-left font-normal">
                Rate
              </th>
              <th scope="col" className="px-4 py-3 text-left font-normal">
                Top source
              </th>
              <th scope="col" className="w-10 px-4 py-3 sm:pr-5">
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows === undefined ? (
              <LoadingRows />
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground sm:px-5">
                  {view?.rows.length === 0 ? (
                    <>
                      No goals yet. Make one from the events below, or{" "}
                      <Link href={settings} className="underline hover:text-foreground">
                        add one in Manage goals
                      </Link>
                      .
                    </>
                  ) : kind === "event" ? (
                    "No event goals."
                  ) : (
                    "No pageview goals."
                  )}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <GoalTableRow
                  key={row.id}
                  row={row}
                  rate={goalRate(row.visitors, view?.visitors ?? 0)}
                  bar={topRate > 0 ? rates[i] / topRate : 0}
                  isKeyGoal={row.kind === "event" && row.key === keyGoal}
                  href={hrefOf(row)}
                  onOpen={onOpen}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function GoalTableRow({
  row,
  rate,
  bar,
  isKeyGoal,
  href,
  onOpen,
}: {
  row: GoalRow;
  rate: number | null;
  /** 0 to 1, the rate against the highest */
  bar: number;
  isKeyGoal: boolean;
  /** Analytics filtered by this goal; null when it can't be filtered (cookieless, no room) */
  href: string | null;
  onOpen: (href: string) => void;
}) {
  const name = (
    <>
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate" title={row.name}>
          {row.name}
        </span>
        {isKeyGoal && (
          <Badge variant="outline" className="shrink-0 bg-background">
            Key goal
          </Badge>
        )}
      </span>
      <span className="block truncate font-mono text-xs text-muted-foreground" title={row.key}>
        {row.key}
      </span>
    </>
  );
  return (
    <tr
      onClick={href === null ? undefined : () => onOpen(href)}
      className={cn(
        "border-b border-border last:border-b-0",
        href !== null && "cursor-pointer transition-colors hover:bg-muted/40",
      )}
    >
      <td className="max-w-[320px] px-4 py-3 sm:pl-5">
        {href === null ? (
          <div className="min-w-0">{name}</div>
        ) : (
          <Link
            href={href}
            title={`Analytics for visits with ${row.name}`}
            onClick={(e) => e.stopPropagation()}
            className="block min-w-0 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {name}
          </Link>
        )}
      </td>
      <td className="px-4 py-3 text-muted-foreground">{row.kind === "event" ? "Event" : "Pageview"}</td>
      <td className="px-4 py-3 text-right tabular-nums">{formatNumber(row.conversions)}</td>
      <td className="px-4 py-3">
        <span className="flex items-center gap-3">
          <span aria-hidden className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-muted">
            <span className="block h-full rounded-full bg-foreground" style={{ width: `${Math.round(bar * 100)}%` }} />
          </span>
          <span className="tabular-nums">{rate === null ? "–" : formatShare(rate)}</span>
        </span>
      </td>
      <td className="max-w-[220px] px-4 py-3">
        {row.topSource === null ? (
          <span className="text-muted-foreground">–</span>
        ) : (
          <span className="flex min-w-0 items-center gap-2">
            <span className="flex size-4 shrink-0 items-center justify-center">{rowIcon("source", row.topSource)}</span>
            <span className="truncate">
              <Label dim="source" value={row.topSource} />
            </span>
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-muted-foreground sm:pr-5">
        {href !== null && <ChevronRightIcon aria-hidden className="ml-auto size-4" />}
      </td>
    </tr>
  );
}

/** Recorded events that aren't goals yet, with a button that makes one a goal. */
function OtherEvents({ domain, others }: { domain: string; others: OtherEvent[] }) {
  const create = useMutation(api.goals.create);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function makeGoal(name: string) {
    setPending(name);
    setError(null);
    try {
      await create({ domain, kind: "event", key: name });
    } catch (err) {
      setError(err instanceof ConvexError ? String(err.data) : "Could not make it a goal");
    } finally {
      setPending(null);
    }
  }

  return (
    <section aria-labelledby="other-events" className="overflow-hidden rounded-lg border border-border">
      <div className="flex flex-col gap-1 px-4 py-4 sm:px-5">
        <h2 id="other-events" className="flex items-baseline gap-2 font-medium">
          Other events
          <span className="text-xs font-normal text-muted-foreground tabular-nums">{formatNumber(others.length)}</span>
        </h2>
        <p className="text-sm text-muted-foreground">Custom events your site sent in this period that aren&apos;t goals.</p>
        {error && <p className="text-sm text-down">{error}</p>}
      </div>
      <ul className="divide-y divide-border border-t border-border text-sm">
        {others.map((o) => (
          <li key={o.name} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
            <span className="min-w-0 flex-1 truncate font-mono text-xs" title={o.name}>
              {o.name}
            </span>
            <span className="shrink-0 text-muted-foreground tabular-nums">
              {formatNumber(o.events)} {o.events === 1 ? "time" : "times"}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pending !== null}
              onClick={() => makeGoal(o.name)}
              aria-label={`Make ${o.name} a goal`}
            >
              {pending === o.name ? "Adding…" : "Make goal"}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** No goals and no events: the one line that sends an event. */
function EmptyState({ settings }: { settings: string }) {
  return (
    <section className="flex flex-col items-start gap-4 rounded-lg border border-border px-5 py-8 sm:px-8">
      <div className="flex flex-col gap-1">
        <h2 className="font-medium">No events yet</h2>
        <p className="text-sm text-muted-foreground">
          Send one from your site when someone signs up, books a call or buys. Any name works; it shows up here,
          and you can make it a goal.
        </p>
      </div>
      <div className="flex w-full max-w-xl items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
        <code className="min-w-0 flex-1 truncate font-mono text-xs">{EVENT_SNIPPET}</code>
        <CopyButton text={EVENT_SNIPPET} />
      </div>
      <p className="text-sm text-muted-foreground">
        It needs the tracking snippet on the page.{" "}
        <Link href={settings} className="underline hover:text-foreground">
          Manage goals
        </Link>{" "}
        has the <code className="font-mono">data-goal</code> attribute, pageview goals and a prompt for your coding agent.
      </p>
    </section>
  );
}

function LoadingRows() {
  return (
    <>
      {Array.from({ length: 3 }, (_, i) => (
        <tr key={i} className="border-b border-border last:border-b-0" aria-hidden>
          {Array.from({ length: 6 }, (_, j) => (
            <td key={j} className="px-4 py-3.5 sm:first:pl-5 sm:last:pr-5">
              <div className={cn("h-4 animate-pulse rounded bg-muted", j === 0 ? "w-40" : "w-12")} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
