"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Authenticated, AuthLoading, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { visitorPath } from "@/components/customers/Customers";
import VisitorAvatar from "@/components/customers/VisitorAvatar";
import SiteHeader from "@/components/dashboard/SiteHeader";
import { useNow } from "@/components/dashboard/useNow";
import { countryFlag, countryName, formatMoney, formatNumber, formatTime } from "@/lib/format";
import { displayName } from "@/lib/names";
import LiveMap from "./LiveMap";

// Online now means a hit in the last 5 minutes, as on the dashboard. The feed goes
// back a day, so a quiet site still shows its latest activity.
const ONLINE_WINDOW_MS = 5 * 60 * 1000;
const FEED_WINDOW_MS = 24 * 60 * 60 * 1000;
const REFRESH_MS = 30 * 1000;

export type LiveData = FunctionReturnType<typeof api.stats.liveFeed>;
type FeedRow = LiveData["feed"][number];

/** A map of the visitors online now and a feed of the latest pageviews, goals and payments. */
export default function Live() {
  const params = useParams<{ domain: string }>();
  const domain = decodeURIComponent(params.domain);
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader domain={domain} section="live" />
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
  return <LiveView domain={site.domain} timezone={site.timezone} tracking={site.trackingStartedAt !== null} />;
}

function LiveView({ domain, timezone, tracking }: { domain: string; timezone: string; tracking: boolean }) {
  const now = useNow(REFRESH_MS);
  const data = useQuery(api.stats.liveFeed, {
    domain,
    since: now - FEED_WINDOW_MS,
    onlineSince: now - ONLINE_WINDOW_MS,
  });
  const visitors = data?.visitors ?? [];
  const unplaced = visitors.filter((v) => v.lat === null || v.lon === null).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="flex items-center gap-2 text-xl text-strong">
          <span className="size-2 animate-pulse rounded-full bg-down" />
          {data === undefined
            ? "…"
            : `${formatNumber(visitors.length)}${data.moreVisitors ? "+" : ""} online now`}
        </h1>
        {unplaced > 0 && (
          <p className="text-xs text-muted">
            {formatNumber(unplaced)} without a location {unplaced === 1 ? "is" : "are"} not on the map
          </p>
        )}
      </div>
      {!tracking && (
        <p className="text-sm text-muted">
          This site has no visitor ids yet (cookieless, or no hit from the current script), so the map
          stays empty. The feed still shows its pageviews.
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="h-80 overflow-hidden rounded-lg border border-line bg-panel/40 sm:h-[28rem] lg:col-span-2">
          <LiveMap domain={domain} visitors={visitors} />
        </div>
        <Feed domain={domain} timezone={timezone} rows={data?.feed} />
      </div>
    </div>
  );
}

function Feed({ domain, timezone, rows }: { domain: string; timezone: string; rows: FeedRow[] | undefined }) {
  return (
    <section className="flex max-h-[28rem] flex-col rounded-lg border border-line bg-panel/40">
      <h2 className="border-b border-line px-4 py-2 text-xs text-muted">Last 24 hours</h2>
      {rows === undefined ? (
        <ul className="flex flex-col gap-2 p-4">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="h-8 animate-pulse rounded bg-line" />
          ))}
        </ul>
      ) : rows.length === 0 ? (
        <p className="p-4 text-sm text-muted">Nothing yet. New pageviews show here as they happen.</p>
      ) : (
        <ul className="flex flex-col overflow-y-auto">
          {rows.map((row) => (
            <FeedItem key={row.id} domain={domain} timezone={timezone} row={row} />
          ))}
        </ul>
      )}
    </section>
  );
}

function FeedItem({ domain, timezone, row }: { domain: string; timezone: string; row: FeedRow }) {
  const name = row.visitorId === null ? (row.email ?? "Anonymous") : displayName(row.visitorId, row.name, row.email);
  const place = row.city ?? (row.country !== null ? countryName(row.country) : null);
  return (
    <li className="flex items-start gap-3 border-b border-line/60 px-4 py-2 text-sm last:border-b-0">
      {row.visitorId === null ? (
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-line text-muted" aria-hidden>
          ?
        </span>
      ) : (
        <VisitorAvatar visitorId={row.visitorId} />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-baseline justify-between gap-2">
          {row.visitorId === null ? (
            <span className="truncate text-strong">{name}</span>
          ) : (
            <Link href={visitorPath(domain, row.visitorId)} className="truncate text-strong hover:underline">
              {name}
            </Link>
          )}
          <time className="shrink-0 text-xs text-muted">{formatTime(row.ts, timezone)}</time>
        </div>
        <span className="truncate text-muted">
          <Action row={row} />
        </span>
        {place !== null && (
          <span className="truncate text-xs text-muted">
            {row.country !== null && `${countryFlag(row.country)} `}
            {place}
          </span>
        )}
      </div>
    </li>
  );
}

function Action({ row }: { row: FeedRow }) {
  switch (row.kind) {
    case "pageview":
      return (
        <>
          viewed <span className="font-mono text-foreground">{row.path}</span>
        </>
      );
    case "goal":
      return (
        <>
          completed <span className="text-accent">{row.goal}</span>
        </>
      );
    case "payment":
    case "refund":
      return (
        <>
          {row.kind === "payment" ? "paid " : "refunded "}
          <span className={row.kind === "payment" ? "text-up" : "text-down"}>
            {formatMoney(Math.abs(row.amountMinor ?? 0), row.currency ?? "USD")}
          </span>
        </>
      );
  }
}
