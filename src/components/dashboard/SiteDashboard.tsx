"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Authenticated, AuthLoading, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { localDate } from "../../../convex/lib/dates";
import {
  formatRangeParam,
  parseRangeParam,
  percentChange,
  PRESETS,
  presetRange,
  type DateRange,
  type Preset,
} from "../../../convex/lib/ranges";
import { formatDuration, formatMoney, formatNumber, formatShare } from "@/lib/format";
import Breakdowns from "./Breakdowns";
import RangePicker from "./RangePicker";
import SiteHeader from "./SiteHeader";
import StatTile from "./StatTile";
import TrafficChart from "./TrafficChart";
import { useNow } from "./useNow";

const LIVE_WINDOW_MS = 5 * 60 * 1000;
const LIVE_REFRESH_MS = 30 * 1000;

export default function SiteDashboard() {
  const params = useParams<{ domain: string }>();
  const domain = decodeURIComponent(params.domain);
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader domain={domain} section="visitors" />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <AuthLoading>
          <p className="text-sm text-muted">Connecting…</p>
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
  if (site === undefined) return <p className="text-sm text-muted">Loading…</p>;
  if (site === null) {
    return (
      <p className="text-sm text-muted">
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
  const { range, preset } = parseRangeParam(searchParams.get("range"), today);

  function setRange(next: Preset | DateRange) {
    const params = new URLSearchParams(searchParams);
    params.set("range", typeof next === "string" ? next : toParam(next, today));
    router.push(`${pathname}?${params}`, { scroll: false });
  }

  const summary = useQuery(api.stats.summary, { domain, ...range });
  const series = useQuery(api.stats.timeseries, { domain, ...range });
  const since = now - LIVE_WINDOW_MS;
  const live = useQuery(api.stats.live, tracking ? "skip" : { domain, since });
  const online = useQuery(api.stats.online, tracking ? { domain, since } : "skip");
  // Paying visitors on a site with revenue, otherwise visitors who completed the key goal
  const conversions = useQuery(
    api.stats.conversions,
    currency !== null || keyGoal !== null ? { domain, ...range } : "skip",
  );

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
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
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
        <RangePicker range={range} preset={preset} today={today} onChange={setRange} />
      </div>

      {conversions !== undefined && conversions.otherCurrencyPayments > 0 && (
        <p className="-mt-6 text-sm text-muted">
          {formatNumber(conversions.otherCurrencyPayments)}{" "}
          {conversions.otherCurrencyPayments === 1 ? "payment" : "payments"} in this period{" "}
          {conversions.otherCurrencyPayments === 1 ? "is" : "are"} in a currency other than {currency} and{" "}
          left out of the totals.
        </p>
      )}
      <TrafficChart data={series} trackingStart={trackingStart} currency={currency} />
      <Breakdowns domain={domain} range={range} currency={currency} />
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

/** A range that matches a preset ending today goes back to the preset's short name. */
function toParam(range: DateRange, today: string): string {
  const preset = PRESETS.find((p) => {
    const r = presetRange(p, today);
    return r.from === range.from && r.to === range.to;
  });
  return preset ?? formatRangeParam(range);
}
