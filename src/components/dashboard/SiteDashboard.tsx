"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { UserButton } from "@clerk/nextjs";
import { FiActivity } from "react-icons/fi";
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
import { formatDuration, formatNumber } from "@/lib/format";
import Breakdowns from "./Breakdowns";
import RangePicker from "./RangePicker";
import SiteSwitcher from "./SiteSwitcher";
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
      <header className="border-b border-line bg-panel/40">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pt-8 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <Favicon domain={domain} />
              <Authenticated>
                <SiteSwitcher current={domain} />
              </Authenticated>
            </div>
            <UserButton />
          </div>
          <nav className="flex gap-8 text-sm">
            <span className="flex items-center gap-2 border-b-2 border-strong pb-3 text-strong">
              <FiActivity aria-hidden /> Visitors
            </span>
            <Link href="/" className="pb-3 text-muted hover:text-strong">
              All sites
            </Link>
          </nav>
        </div>
      </header>
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

/** The site's own favicon in a white tile, as SA shows it; a letter if there is none. */
function Favicon({ domain }: { domain: string }) {
  const [failed, setFailed] = useState(domain === "localhost");
  return (
    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white text-lg font-medium text-zinc-700">
      {failed ? (
        domain[0]?.toUpperCase()
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- external favicon, any size
        <img
          src={`https://${domain}/favicon.ico`}
          alt=""
          className="size-6"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}

function Site({ domain }: { domain: string }) {
  const site = useQuery(api.sites.get, { domain });
  if (site === undefined) return <p className="text-sm text-muted">Loading…</p>;
  if (site === null) {
    return (
      <p className="text-sm text-muted">
        No site called <span className="font-mono">{domain}</span> in your account.{" "}
        <Link href="/" className="underline">
          Back to your sites
        </Link>
      </p>
    );
  }
  return <Dashboard domain={site.domain} timezone={site.timezone} />;
}

function Dashboard({ domain, timezone }: { domain: string; timezone: string }) {
  const now = useNow(LIVE_REFRESH_MS);
  const today = localDate(now, timezone);

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
  const live = useQuery(api.stats.live, { domain, since: now - LIVE_WINDOW_MS });

  const cur = summary?.current;
  const prev = summary?.previous;

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
        <div className="flex flex-wrap gap-x-10 gap-y-6">
          <StatTile
            label="visitors"
            value={cur && formatNumber(cur.visitors)}
            change={cur && prev && percentChange(cur.visitors, prev.visitors)}
          />
          <StatTile
            label="pageviews"
            value={cur && formatNumber(cur.pageviews)}
            change={cur && prev && percentChange(cur.pageviews, prev.pageviews)}
          />
          <StatTile
            label="time on page"
            value={cur && (cur.timeOnPageMs === null ? "–" : formatDuration(cur.timeOnPageMs))}
            change={
              cur?.timeOnPageMs != null && prev?.timeOnPageMs != null
                ? percentChange(cur.timeOnPageMs, prev.timeOnPageMs)
                : null
            }
          />
          <StatTile
            label={
              <span className="flex items-center gap-1.5" title="Pageviews in the last 5 minutes">
                <span className="size-2 animate-pulse rounded-full bg-down" />
                live pageviews
              </span>
            }
            value={live === undefined ? undefined : formatNumber(live)}
          />
        </div>
        <RangePicker range={range} preset={preset} today={today} onChange={setRange} />
      </div>

      <TrafficChart data={series} />
      <Breakdowns domain={domain} range={range} />
    </div>
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
