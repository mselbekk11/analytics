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
  formatRangeParam,
  parseRangeParam,
  PRESET_LABELS,
  PRESETS,
  presetGranularity,
  presetRange,
  type DateRange,
  type Preset,
} from "../../../convex/lib/ranges";
import {
  formatDate,
  formatNumber,
  formatRangeLabel,
  goalLabel,
} from "@/lib/format";
import Breakdowns from "./Breakdowns";
import FilterBar from "./FilterBar";
import RangeControls from "./RangeControls";
import TopBar from "@/components/TopBar";
import { useChartSeries, type SeriesKey } from "./series";
import StatRow from "./StatRow";
import TrafficChart from "./TrafficChart";
import { useNow } from "./useNow";

const LIVE_REFRESH_MS = 30 * 1000;
// Hour ranges pass the clock to stats.hourly snapped to this, so the query's arguments
// stay the same between steps. Local hours start on a 15-minute grid in every timezone,
// so a 5-minute step never lands in the wrong hour; the window moves on within 5 minutes.
const HOURLY_STEP_MS = 5 * 60 * 1000;

export default function SiteDashboard() {
  const params = useParams<{ domain: string }>();
  const domain = decodeURIComponent(params.domain);
  return (
    <div className="flex flex-1 flex-col">
      <TopBar site={{ domain, section: "analytics" }} />
      <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 px-4 pt-10 pb-20 sm:px-6 lg:px-8">
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
  const hourNow = useNow(HOURLY_STEP_MS);
  const today = localDate(now, timezone);
  // Sites with visitor ids get session tiles and "online now"; cookieless sites keep
  // the Phase 2 row
  const tracking = trackingStartedAt !== null;
  const trackingStart = tracking ? localDate(trackingStartedAt, timezone) : null;

  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { range, preset } = parseRangeParam(searchParams.get("range"), today);
  const hourly = preset === "today" || preset === "yesterday" || preset === "24h" ? preset : null;
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

  // Hour ranges, and day ranges with filters, read raw rows: one query returns everything
  // the rollup queries would, in the same shapes
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
  // Paying visitors on a site with revenue, otherwise visitors who completed the key goal
  const rollupConversions = useQuery(
    api.stats.conversions,
    !raw && (currency !== null || keyGoal !== null) ? { domain, ...range } : "skip",
  );
  const conversions = raw ? view?.conversions : rollupConversions;
  // The key goal's tile; the same query the goals list makes, so it is shared
  const rollupGoals = useQuery(api.stats.goals, !raw && keyGoal !== null ? { domain, ...range } : "skip");
  const goals = raw ? view?.goals : rollupGoals;

  // The tiles this site shows, and so the series the chart can draw
  const available: SeriesKey[] = [
    "visitors",
    "pageviews",
    ...(currency !== null ? (["revenue"] as const) : []),
    ...(currency !== null || keyGoal !== null ? (["conversionRate"] as const) : []),
    ...(keyGoal !== null ? (["goal"] as const) : []),
    ...(tracking ? (["bounceRate"] as const) : []),
    "visitDuration",
  ];
  const { shown, toggle } = useChartSeries(available);
  const labels: Record<SeriesKey, string> = {
    visitors: "Visitors",
    pageviews: "Pageviews",
    revenue: "Revenue",
    conversionRate: "Conv. rate",
    goal: keyGoal === null ? "Key goal" : goalLabel(keyGoal),
    bounceRate: "Bounce rate",
    visitDuration: "Visit duration",
  };

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
          <RangeControls range={range} preset={preset} today={today} onChange={setRange} />
        </div>
        {filtering && (
          <div className="flex flex-col gap-2">
            <FilterBar
              filters={filters}
              onRemove={(dim) => setFilters(filters.filter((f) => f.dim !== dim))}
              onClear={() => setFilters([])}
            />
            {trackingStart !== null && trackingStart > range.from && blocked === null && (
              <p className="text-xs text-muted-foreground">
                Filtered numbers count visits from {formatDate(trackingStart, true)}, when visitor tracking started.
              </p>
            )}
          </div>
        )}
      </header>
      {blocked !== null && (
        <p className="w-full rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          {blocked === "range"
            ? `Filters work on ranges of up to ${MAX_FILTER_DAYS} days. Pick a shorter range, or remove the filters to see the whole period.`
            : hourly !== null
              ? "There are too many visits in this period to count by the hour. Pick a day range such as Last 7 days."
              : "There are too many visits in this range to filter. Pick a shorter range, or remove the filters."}
        </p>
      )}
      {blocked === null && (
        <>
          <div className="overflow-hidden rounded-lg border border-border">
            <StatRow
              summary={summary}
              conversions={conversions}
              goals={goals}
              currency={currency}
              keyGoal={keyGoal}
              tracking={tracking}
              on={shown}
              onToggle={toggle}
            />
            <div className="border-t border-border px-4 pt-8 pb-4 sm:px-6">
              <TrafficChart
                data={series}
                shown={shown}
                labels={labels}
                trackingStart={trackingStart}
                currency={currency}
                tracking={tracking}
              />
            </div>
          </div>
          {conversions !== undefined && conversions.otherCurrencyPayments > 0 && (
            <p className="-mt-6 text-sm text-muted-foreground">
              {formatNumber(conversions.otherCurrencyPayments)}{" "}
              {conversions.otherCurrencyPayments === 1 ? "payment" : "payments"} in this period{" "}
              {conversions.otherCurrencyPayments === 1 ? "is" : "are"} in a currency other than {currency} and{" "}
              left out of the totals.
            </p>
          )}
          <Breakdowns
            domain={domain}
            range={range}
            currency={currency}
            view={{ filters, raw, data: view?.breakdowns, goals: view?.goals, onSelect: selectRow }}
          />
        </>
      )}
    </div>
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
