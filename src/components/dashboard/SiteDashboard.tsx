"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Authenticated, AuthLoading, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { localDate } from "../../../convex/lib/dates";
import type { Dim } from "../../../convex/lib/dims";
import {
  formatFiltersParam,
  MAX_FILTER_DAYS,
  parseFiltersParam,
  toggleFilter,
  type Filter,
} from "../../../convex/lib/filters";
import {
  DEFAULT_PRESET,
  formatRangeParam,
  parseRangeParam,
  percentChange,
  PRESET_LABELS,
  PRESETS,
  presetGranularity,
  presetRange,
  type DateRange,
  type Preset,
} from "../../../convex/lib/ranges";
import {
  formatDate,
  formatDuration,
  formatMoney,
  formatNumber,
  formatRangeLabel,
  formatShare,
} from "@/lib/format";
import Breakdowns from "./Breakdowns";
import FilterBar from "./FilterBar";
import RangeControls from "./RangeControls";
import TopBar from "@/components/TopBar";
import StatTile from "./StatTile";
import TrafficChart from "./TrafficChart";
import { useNow } from "./useNow";

const LIVE_WINDOW_MS = 5 * 60 * 1000;
const LIVE_REFRESH_MS = 30 * 1000;
// Today, Yesterday and 24h need the hourly data source (design v2 Phase 10). Until then
// they show disabled, and their URLs open the default range.
const HOURLY_RANGES = false;

export default function SiteDashboard() {
  const params = useParams<{ domain: string }>();
  const domain = decodeURIComponent(params.domain);
  return (
    <div className="flex flex-1 flex-col">
      <TopBar site={{ domain, section: "analytics" }} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <AuthLoading>
          <p className="text-sm text-muted-foreground">Connecting…</p>
        </AuthLoading>
        <Authenticated>
          <Site domain={domain} />
        </Authenticated>
      </main>
    </div>
  );
}

function Site({ domain }: { domain: string }) {
  const site = useQuery(api.sites.get, { domain });
  if (site === undefined) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (site === null) {
    return (
      <p className="text-sm text-muted-foreground">
        No site called <span className="font-mono">{domain}</span> in your account.{" "}
        <Link href="/websites" className="underline">
          Back to your sites
        </Link>
      </p>
    );
  }
  return (
    <Dashboard
      domain={site.domain}
      timezone={site.timezone}
      trackingStartedAt={site.trackingStartedAt}
      currency={site.revenueSource === "none" ? null : site.currency}
      keyGoal={site.keyGoal}
    />
  );
}

function Dashboard({
  domain,
  timezone,
  trackingStartedAt,
  currency,
  keyGoal,
}: {
  domain: string;
  timezone: string;
  trackingStartedAt: number | null;
  /** The site's currency when it takes payments (Stripe or API); null hides revenue */
  currency: string | null;
  keyGoal: string | null;
}) {
  const now = useNow(LIVE_REFRESH_MS);
  const today = localDate(now, timezone);
  // Sites with visitor ids get session tiles and "online now"; cookieless sites keep
  // the Phase 2 row
  const tracking = trackingStartedAt !== null;
  const trackingStart = tracking ? localDate(trackingStartedAt, timezone) : null;

  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const parsed = parseRangeParam(searchParams.get("range"), today);
  const { range, preset } =
    !HOURLY_RANGES && presetGranularity(parsed.preset) === "hour"
      ? { range: presetRange(DEFAULT_PRESET, today), preset: DEFAULT_PRESET }
      : parsed;
  // Filters pick sessions, so they need visitor ids; cookieless sites ignore ?f=
  const filters = tracking ? parseFiltersParam(searchParams.get("f")) : [];
  const filtering = filters.length > 0;

  function navigate(next: { range?: string; filters?: Filter[] }) {
    const params = new URLSearchParams(searchParams);
    if (next.range !== undefined) params.set("range", next.range);
    params.delete("f");
    const f = formatFiltersParam(next.filters ?? filters);
    const query = [params.toString(), f && `f=${f}`].filter(Boolean).join("&");
    router.push(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  }
  const setRange = (next: Preset | DateRange) =>
    navigate({ range: typeof next === "string" ? next : toParam(next, today) });
  const setFilters = (next: Filter[]) => navigate({ filters: next });
  const selectRow = tracking ? (dim: Dim, key: string) => setFilters(toggleFilter(filters, dim, key)) : null;

  // With filters, one query returns everything the rollup queries would, from raw sessions
  const filtered = useQuery(api.stats.filtered, filtering ? { domain, ...range, filters } : "skip");
  const view = filtered?.status === "ok" ? filtered : undefined;
  const blocked = filtered !== undefined && filtered.status !== "ok";
  const rollupSummary = useQuery(api.stats.summary, filtering ? "skip" : { domain, ...range });
  const rollupSeries = useQuery(api.stats.timeseries, filtering ? "skip" : { domain, ...range });
  const summary = filtering ? view?.summary : rollupSummary;
  const series = filtering ? view?.timeseries : rollupSeries;
  const since = now - LIVE_WINDOW_MS;
  const live = useQuery(api.stats.live, tracking ? "skip" : { domain, since });
  const online = useQuery(api.stats.online, tracking ? { domain, since } : "skip");
  // Paying visitors on a site with revenue, otherwise visitors who completed the key goal
  const rollupConversions = useQuery(
    api.stats.conversions,
    !filtering && (currency !== null || keyGoal !== null) ? { domain, ...range } : "skip",
  );
  const conversions = filtering ? view?.conversions : rollupConversions;

  const cur = summary?.current;
  const prev = summary?.previous;
  const incomparable = summary?.comparable === false;
  const change = (pick: (t: NonNullable<typeof cur>) => number | null) => {
    if (!cur || !prev) return null;
    const a = pick(cur);
    const b = pick(prev);
    return a === null || b === null ? null : percentChange(a, b);
  };
  const rate = (converted: number | null | undefined, t: typeof cur) =>
    converted == null || !t || t.visitors === 0 ? null : Math.min(1, converted / t.visitors);
  const curRate = rate(conversions?.current, cur);
  const prevRate = rate(conversions?.previous, prev);
  const conversionTile = conversions?.kind != null && (
    <StatTile
      label="conversion rate"
      value={cur && (curRate === null ? "–" : formatShare(curRate))}
      change={curRate === null || prevRate === null ? null : percentChange(curRate, prevRate)}
      incomparable={incomparable}
      title={
        conversions.kind === "revenue"
          ? "Visitors who paid ÷ visitors"
          : `Visitors who completed the key goal "${keyGoal}" ÷ visitors`
      }
    />
  );

  return (
    <div className="flex flex-col gap-10">
      <header className="-mb-2 flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-semibold tracking-tight">Analytics</h1>
            <p className="text-sm text-muted-foreground">
              {preset !== null ? PRESET_LABELS[preset] : formatRangeLabel(range)}
            </p>
          </div>
          <RangeControls range={range} preset={preset} today={today} hourly={HOURLY_RANGES} onChange={setRange} />
        </div>
        {filtering && (
          <div className="flex flex-col gap-2">
            <FilterBar
              filters={filters}
              onRemove={(dim) => setFilters(filters.filter((f) => f.dim !== dim))}
              onClear={() => setFilters([])}
            />
            {trackingStart !== null && trackingStart > range.from && !blocked && (
              <p className="text-xs text-muted-foreground">
                Filtered numbers count visits from {formatDate(trackingStart, true)}, when visitor tracking started.
              </p>
            )}
          </div>
        )}
      </header>
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
        {blocked ? (
          <p className="w-full rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            {filtered.status === "range"
              ? `Filters work on ranges of up to ${MAX_FILTER_DAYS} days. Pick a shorter range, or remove the filters to see the whole period.`
              : "There are too many visits in this range to filter. Pick a shorter range, or remove the filters."}
          </p>
        ) : (
          <div className="flex flex-wrap gap-x-10 gap-y-6">
            <StatTile
              label="visitors"
              value={cur && (summary.visitorsApprox ? "≈" : "") + formatNumber(cur.visitors)}
              change={change((t) => t.visitors)}
              incomparable={incomparable}
              title={
                summary?.visitorsApprox
                  ? "Too many sessions to count distinct visitors: this is the sum of daily visitors"
                  : undefined
              }
            />
            {tracking && (
              <StatTile
                label="sessions"
                value={cur && formatNumber(cur.sessions)}
                change={change((t) => t.sessions)}
                incomparable={incomparable}
              />
            )}
            <StatTile
              label="pageviews"
              value={cur && formatNumber(cur.pageviews)}
              change={change((t) => t.pageviews)}
            />
            {tracking && (
              <StatTile
                label="bounce rate"
                value={cur && (cur.bounceRate === null ? "–" : formatShare(cur.bounceRate))}
                change={change((t) => t.bounceRate)}
                incomparable={incomparable}
                lowerIsBetter
                title="Sessions with one pageview and no goal"
              />
            )}
            {tracking && (
              <StatTile
                label="session time"
                value={cur && (cur.sessionTimeMs === null ? "–" : formatDuration(cur.sessionTimeMs))}
                change={change((t) => t.sessionTimeMs)}
                incomparable={incomparable}
                title="Average visible-tab time per session"
              />
            )}
            {currency !== null && (
              <StatTile
                label="revenue"
                value={cur && formatMoney(cur.revenueMinor, currency)}
                change={change((t) => t.revenueMinor)}
                title={
                  cur && cur.refundsMinor > 0
                    ? `Net of ${formatMoney(cur.refundsMinor, currency)} in refunds; ${formatNumber(cur.payments)} payments`
                    : cur && `${formatNumber(cur.payments)} payments`
                }
              />
            )}
            {conversionTile}
            {currency !== null && (
              <StatTile
                label="revenue / visitor"
                value={
                  cur && (cur.visitors === 0 ? "–" : formatMoney(Math.round(cur.revenueMinor / cur.visitors), currency))
                }
                change={change((t) => (t.visitors === 0 ? null : t.revenueMinor / t.visitors))}
                incomparable={incomparable}
              />
            )}
            <StatTile
              label="time on page"
              value={cur && (cur.timeOnPageMs === null ? "–" : formatDuration(cur.timeOnPageMs))}
              change={change((t) => t.timeOnPageMs)}
            />
            {tracking ? (
              <StatTile
                label={<LiveLabel text="online now" />}
                value={online === undefined ? undefined : formatNumber(online)}
                title="Visitors with a pageview or ping in the last 5 minutes"
              />
            ) : (
              <StatTile
                label={<LiveLabel text="live pageviews" />}
                value={live === undefined ? undefined : formatNumber(live)}
                title="Pageviews in the last 5 minutes"
              />
            )}
          </div>
        )}
      </div>

      {!blocked && conversions !== undefined && conversions.otherCurrencyPayments > 0 && (
        <p className="-mt-6 text-sm text-muted-foreground">
          {formatNumber(conversions.otherCurrencyPayments)}{" "}
          {conversions.otherCurrencyPayments === 1 ? "payment" : "payments"} in this period{" "}
          {conversions.otherCurrencyPayments === 1 ? "is" : "are"} in a currency other than {currency} and{" "}
          left out of the totals.
        </p>
      )}
      {!blocked && (
        <>
          <TrafficChart data={series} trackingStart={trackingStart} currency={currency} />
          <Breakdowns
            domain={domain}
            range={range}
            currency={currency}
            view={{ filters, data: view?.breakdowns, goals: view?.goals, onSelect: selectRow }}
          />
        </>
      )}
    </div>
  );
}

function LiveLabel({ text }: { text: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="size-2 animate-pulse rounded-full bg-down" />
      {text}
    </span>
  );
}

/** A custom range that matches a day preset ending today goes back to the preset's short name. */
function toParam(range: DateRange, today: string): string {
  const preset = PRESETS.find((p) => {
    if (presetGranularity(p) === "hour") return false;
    const r = presetRange(p, today);
    return r.from === range.from && r.to === range.to;
  });
  return preset ?? formatRangeParam(range);
}
