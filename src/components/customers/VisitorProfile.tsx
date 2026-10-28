"use client";

import Link from "next/link";
import { createElement, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { Authenticated, AuthLoading, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  FiArrowLeft,
  FiCornerDownLeft,
  FiDollarSign,
  FiExternalLink,
  FiFileText,
  FiFlag,
  FiMonitor,
  FiRotateCcw,
  FiUserCheck,
} from "react-icons/fi";
import { api } from "../../../convex/_generated/api";
import { browserIcon, DEVICE_ICONS, osIcon } from "@/components/dashboard/Breakdowns";
import TopBar from "@/components/TopBar";
import {
  countryFlag,
  countryName,
  deviceLabel,
  formatDateTime,
  formatDuration,
  formatMoney,
  formatNumber,
  formatTime,
  outboundLabel,
  regionLabel,
} from "@/lib/format";
import { displayName, persona } from "@/lib/names";
import { Source } from "./Customers";
import VisitorAvatar from "./VisitorAvatar";

type Profile = NonNullable<FunctionReturnType<typeof api.visitors.profile>>;
type Session = Profile["sessions"][number];
type Item = Session["items"][number];

const MATCHED_BY: Record<string, string> = {
  metadata: "checkout metadata",
  return_page: "return page",
  customer: "earlier payment",
  email: "email",
};

/** One visitor: who they are, where they visit from, and a timeline of their sessions. */
export default function VisitorProfile() {
  const params = useParams<{ domain: string; visitorId: string }>();
  const domain = decodeURIComponent(params.domain);
  const visitorId = decodeURIComponent(params.visitorId);
  return (
    <div className="flex flex-1 flex-col">
      <TopBar site={{ domain, section: "customers" }} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <AuthLoading>
          <p className="text-sm text-muted-foreground">Connecting…</p>
        </AuthLoading>
        <Authenticated>
          <Site domain={domain} visitorId={visitorId} />
        </Authenticated>
      </main>
    </div>
  );
}

function Site({ domain, visitorId }: { domain: string; visitorId: string }) {
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
  return <Visitor domain={site.domain} timezone={site.timezone} keyGoal={site.keyGoal} visitorId={visitorId} />;
}

function Visitor({
  domain,
  timezone,
  keyGoal,
  visitorId,
}: {
  domain: string;
  timezone: string;
  keyGoal: string | null;
  visitorId: string;
}) {
  const profile = useQuery(api.visitors.profile, { domain, visitorId });
  const back = (
    <Link
      href={`/sites/${encodeURIComponent(domain)}/customers`}
      className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-strong"
    >
      <FiArrowLeft aria-hidden /> Customers
    </Link>
  );
  if (profile === undefined) {
    return (
      <>
        {back}
        <div className="h-40 animate-pulse rounded-lg bg-line" />
      </>
    );
  }
  if (profile === null) {
    return (
      <>
        {back}
        <p className="text-sm text-muted-foreground">No visitor with this id on {domain}.</p>
      </>
    );
  }

  const latest = profile.sessions.at(-1);
  const paid = profile.firstPaidAt !== null || profile.revenueMinor !== 0;
  const name = displayName(profile.visitorId, profile.name, profile.email);
  const anonymous = name === persona(profile.visitorId).name;

  return (
    <>
      {back}
      <section className="flex flex-col gap-6 rounded-lg border border-line bg-panel/40 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <VisitorAvatar visitorId={profile.visitorId} size="lg" />
            <div className="min-w-0">
              <h1 className="truncate text-2xl text-strong">{name}</h1>
              <p className="truncate text-sm text-muted-foreground">
                {anonymous
                  ? "Anonymous visitor"
                  : [profile.name ? profile.email : null, profile.userId && `user ${profile.userId}`]
                      .filter(Boolean)
                      .join(" · ") || "Identified visitor"}
              </p>
            </div>
          </div>
          {paid && (
            <div className="text-right">
              <div className="text-xs text-muted-foreground">total paid</div>
              <div className="text-2xl font-medium text-up tabular-nums">
                {formatMoney(profile.revenueMinor, profile.currency)}
              </div>
            </div>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
          <Fact label="Location">{latest ? <Location session={latest} /> : "–"}</Fact>
          <Fact label="Device">{latest ? <Device session={latest} /> : "–"}</Fact>
          <Fact label="First source">
            <Source source={profile.firstSource} channel={null} />
          </Fact>
          <Fact label="First seen">{formatDateTime(profile.firstSeen, timezone)}</Fact>
          <Fact label="Last seen">{formatDateTime(profile.lastSeen, timezone)}</Fact>
          <Fact label="Sessions">{formatNumber(profile.sessionCount)}</Fact>
        </dl>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-medium text-strong">Journey</h2>
        {profile.moreSessions && (
          <p className="text-xs text-muted-foreground">Showing the latest {profile.sessions.length} sessions.</p>
        )}
        {profile.sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sessions recorded.</p>
        ) : (
          <ol className="flex flex-col gap-4">
            {profile.sessions.map((s, i) => (
              <SessionCard
                key={s.sessionId}
                session={s}
                number={profile.sessionCount - profile.sessions.length + i + 1}
                timezone={timezone}
                keyGoal={keyGoal}
                currency={profile.currency}
                sessions={profile.sessions}
              />
            ))}
          </ol>
        )}
      </section>
    </>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-strong">{children}</dd>
    </div>
  );
}

function Location({ session: s }: { session: Session }) {
  const place = [s.city, s.region && regionLabel(`${s.country}/${s.region}`), countryName(s.country)]
    .filter(Boolean)
    .filter((part, i, all) => all.indexOf(part) === i);
  return (
    <span title={place.join(", ")}>
      {countryFlag(s.country) && <span className="mr-1.5">{countryFlag(s.country)}</span>}
      {s.city ?? countryName(s.country)}
    </span>
  );
}

function Device({ session: s }: { session: Session }) {
  return (
    <span className="flex items-center gap-1.5" title={[deviceLabel(s.device), s.browser, s.os].filter(Boolean).join(" · ")}>
      {createElement(DEVICE_ICONS[s.device] ?? FiMonitor, { "aria-hidden": true })}
      {createElement(browserIcon(s.browser), { "aria-hidden": true })}
      {s.os && createElement(osIcon(s.os), { "aria-hidden": true })}
      <span className="truncate">{s.browser}</span>
    </span>
  );
}

function SessionCard({
  session: s,
  number,
  timezone,
  keyGoal,
  currency,
  sessions,
}: {
  session: Session;
  number: number;
  timezone: string;
  keyGoal: string | null;
  currency: string;
  sessions: Session[];
}) {
  const tags = [
    s.utmCampaign && ["campaign", s.utmCampaign],
    s.utmSource && s.utmSource !== s.source && ["source", s.utmSource],
    s.utmMedium && ["medium", s.utmMedium],
    s.refTag && ["ref", s.refTag],
  ].filter((t): t is [string, string] => Boolean(t));

  return (
    <li className="rounded-lg border border-line bg-panel/40">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-3 text-sm">
        <span className="text-muted-foreground">Session {number}</span>
        <span className="text-strong">{formatDateTime(s.startedAt, timezone)}</span>
        <span className="flex items-center gap-1.5">
          <Source source={s.source} channel={null} />
          <span className="text-xs text-muted-foreground">{s.channel}</span>
        </span>
        {tags.map(([k, value]) => (
          <span key={k} className="rounded bg-line px-1.5 py-0.5 text-xs text-muted-foreground">
            {k}: <span className="text-strong">{value}</span>
          </span>
        ))}
        <span className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          {s.credited && (
            <span
              className="rounded bg-up/15 px-1.5 py-0.5 text-up"
              title="Revenue from this visitor's payments was credited to this session's source"
            >
              credited{s.revenueMinor !== 0 && ` ${formatMoney(s.revenueMinor, currency)}`}
            </span>
          )}
          <span>
            {formatNumber(s.pageviews)} {s.pageviews === 1 ? "page" : "pages"}
          </span>
          {s.engagedMs > 0 && <span>{formatDuration(s.engagedMs)}</span>}
        </span>
      </header>
      <ol className="flex flex-col py-2 text-sm">
        {s.items.map((item, i) => (
          <li key={i} className="flex items-baseline gap-3 px-4 py-1">
            <time className="w-16 shrink-0 text-xs text-muted-foreground tabular-nums">{formatTime(item.ts, timezone)}</time>
            <TimelineEntry item={item} keyGoal={keyGoal} sessions={sessions} />
          </li>
        ))}
      </ol>
    </li>
  );
}

function TimelineEntry({ item, keyGoal, sessions }: { item: Item; keyGoal: string | null; sessions: Session[] }) {
  const row = (icon: ReactNode, body: ReactNode, aside?: ReactNode, tone = "") => (
    <span className={`flex min-w-0 flex-1 items-baseline gap-2 ${tone}`}>
      <span className="shrink-0 self-center text-muted-foreground">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{body}</span>
      {aside !== undefined && <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{aside}</span>}
    </span>
  );
  switch (item.type) {
    case "pageview":
      return row(
        <FiFileText aria-hidden />,
        <span className="text-strong">{item.path}</span>,
        item.durationMs === null ? undefined : formatDuration(item.durationMs),
      );
    case "goal":
      return row(
        <FiFlag aria-hidden className="text-link" />,
        <>
          <span className="text-link">{item.name}</span>
          {item.name === keyGoal && (
            <span className="ml-2 rounded bg-link/15 px-1.5 py-0.5 text-xs text-link">key goal</span>
          )}
        </>,
        item.path,
      );
    case "outbound":
      return row(
        <FiExternalLink aria-hidden />,
        <a href={item.name} target="_blank" rel="noopener noreferrer nofollow" className="hover:text-link">
          {outboundLabel(item.name)}
        </a>,
        item.path,
      );
    case "identify":
      return row(<FiUserCheck aria-hidden />, "Identified", item.path);
    case "claim":
      return row(<FiCornerDownLeft aria-hidden />, "Returned from checkout", item.path);
    case "payment":
    case "refund": {
      const credited = sessions.find((s) => s.sessionId === item.creditedSessionId);
      const linked = item.matchedBy === null ? "unattributed" : `linked by ${MATCHED_BY[item.matchedBy] ?? item.matchedBy}`;
      return row(
        item.type === "payment" ? <FiDollarSign aria-hidden className="text-up" /> : <FiRotateCcw aria-hidden className="text-down" />,
        <span className={`font-medium tabular-nums ${item.type === "payment" ? "text-up" : "text-down"}`}>
          {item.type === "payment" ? (item.renewal ? "Renewal" : "Paid") : "Refund"}{" "}
          {formatMoney(item.amountMinor, item.currency)}
        </span>,
        credited ? `${linked}, credited to ${credited.source}` : linked,
      );
    }
  }
}

