"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { localDate } from "../../../convex/lib/dates";
import type { Dim } from "../../../convex/lib/dims";
import { toggleFilter } from "../../../convex/lib/filters";
import { formatDate, formatNumber, goalLabel } from "@/lib/format";
import Breakdowns, { cardMetrics } from "./Breakdowns";
import SiteHeader, { BlockedNotice } from "./SiteHeader";
import SiteShell from "./SiteShell";
import { useChartSeries, type SeriesKey } from "./series";
import StatRow from "./StatRow";
import TrafficChart from "./TrafficChart";
import { useSiteRange } from "./useSiteRange";

export default function SiteDashboard() {
  return (
    <SiteShell section="analytics">
      {(site) => (
        <Dashboard
          domain={site.domain}
          timezone={site.timezone}
          trackingStartedAt={site.trackingStartedAt}
          currency={site.revenueSource === "none" ? null : site.currency}
          keyGoal={site.keyGoal}
        />
      )}
    </SiteShell>
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
  // Sites with visitor ids get session tiles and "online now"; cookieless sites keep
  // the Phase 2 row
  const tracking = trackingStartedAt !== null;
  const trackingStart = tracking ? localDate(trackingStartedAt, timezone) : null;
  const { today, range, preset, hourly, hourNow, filters, searchParams, navigate, setRange, setFilters } =
    useSiteRange(timezone, tracking);
  const filtering = filters.length > 0;
  const selectRow = tracking ? (dim: Dim, key: string) => setFilters(toggleFilter(filters, dim, key)) : null;

  // The cards' metric; Revenue on a site without payments reads as Visitors
  const metrics = cardMetrics(currency);
  const metric = metrics.find((m) => m === searchParams.get("metric")) ?? "visitors";
  const cycleMetric = () => {
    const next = metrics[(metrics.indexOf(metric) + 1) % metrics.length];
    // Visitors, the default, leaves the URL without one
    navigate({ set: { metric: next === "visitors" ? null : next } });
  };

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
      <SiteHeader
        title="Analytics"
        range={range}
        preset={preset}
        today={today}
        onRange={setRange}
        filters={filters}
        onFilters={setFilters}
        note={
          trackingStart !== null &&
          trackingStart > range.from &&
          blocked === null && (
            <p className="text-xs text-muted-foreground">
              Filtered numbers count visits from {formatDate(trackingStart, true)}, when visitor tracking started.
            </p>
          )
        }
      />
      {blocked !== null && <BlockedNotice blocked={blocked} hourly={hourly !== null} />}
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
            metric={metric}
            onMetric={cycleMetric}
          />
        </>
      )}
    </div>
  );
}
