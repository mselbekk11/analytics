"use client";

import { useRef, useState, type ReactNode } from "react";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { cn } from "cn";
import { api } from "../../../convex/_generated/api";
import {
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
import { displayName } from "@/lib/names";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Source } from "@/components/customers/Source";
import VisitorAvatar from "@/components/customers/VisitorAvatar";

type Profile = NonNullable<FunctionReturnType<typeof api.visitors.profile>>;
type Session = Profile["sessions"][number];
type Item = Session["items"][number];

// visitors.profile refuses longer ids, and no visitor has one
const MAX_VISITOR_ID = 100;

const MATCHED_BY: Record<string, string> = {
  metadata: "checkout metadata",
  return_page: "return page",
  customer: "earlier payment",
  email: "email",
};

// The timeline's marker: round for pages, square for what happened on them
const DOTS: Record<Item["type"], string> = {
  pageview: "rounded-full bg-muted-foreground/60",
  goal: "rounded-[2px] bg-series-goal",
  outbound: "rounded-[2px] bg-muted-foreground",
  identify: "rounded-[2px] bg-muted-foreground",
  claim: "rounded-[2px] bg-muted-foreground",
  payment: "rounded-[2px] bg-up",
  refund: "rounded-[2px] bg-down",
};

type Props = {
  domain: string;
  timezone: string;
  keyGoal: string | null;
  /** The open visitor (`?visitor=`); null when the drawer is closed */
  visitorId: string | null;
  onClose: () => void;
};

/**
 * The visitor drawer (design v4): one visitor from the Users table, from the right (full
 * width on phones). Who they are, Time on site, Sessions, Pages and Events, how their
 * first visit arrived, and the journey of their latest sessions, newest first, each with
 * its pages (Entry and Exit marked), goals, outbound clicks and payments
 * (visitors.profile). Escape, the close button or a click outside close it, and focus
 * goes back to the visitor's row.
 */
export default function VisitorDrawer({ domain, timezone, keyGoal, visitorId, onClose }: Props) {
  // The last visitor stays in the drawer while it slides out
  const [shownId, setShownId] = useState(visitorId);
  if (visitorId !== null && visitorId !== shownId) setShownId(visitorId);
  const open = visitorId !== null;
  const body = useRef<HTMLDivElement>(null);

  const valid = shownId !== null && shownId.length <= MAX_VISITOR_ID;
  const result = useQuery(api.visitors.profile, valid ? { domain, visitorId: shownId } : "skip");
  // An id no visitor can have is "not found" without asking
  const profile = valid ? result : null;

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        side="right"
        className="gap-0 overflow-y-auto bg-background data-[side=right]:w-full data-[side=right]:sm:max-w-xl"
        initialFocus={body}
        // Back to the row the drawer is for, when it is on screen (not after a reload)
        finalFocus={() =>
          (shownId !== null && document.querySelector<HTMLElement>(`[data-visitor-row="${CSS.escape(shownId)}"]`)) ||
          true
        }
      >
        {/* Focus starts on the header and body together, so a long journey doesn't scroll the header away */}
        <div ref={body} tabIndex={-1} className="outline-none">
          <Header profile={profile} visitorId={shownId} />
          <div className="flex flex-col gap-8 px-5 pt-4 pb-8 sm:px-6">
            {profile === null ? (
              <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                No visitor with this id on {domain}. They may be on another site, or the link may be wrong.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
                  <Tile label="Time on site" value={profile && formatDuration(profile.engagedMs)} />
                  <Tile label="Sessions" value={profile && formatNumber(profile.sessionCount)} />
                  <Tile label="Pages" value={profile && formatNumber(profile.pageviews)} />
                  <Tile
                    label="Events"
                    value={profile && `${formatNumber(profile.events)}${profile.moreEvents ? "+" : ""}`}
                  />
                </div>
                {profile === undefined ? (
                  <div className="flex flex-col gap-3" aria-hidden>
                    <div className="h-16 animate-pulse rounded-md bg-muted/50" />
                    <div className="h-48 animate-pulse rounded-md bg-muted/50" />
                  </div>
                ) : (
                  <>
                    <FirstVisit profile={profile} timezone={timezone} />
                    <Journey profile={profile} timezone={timezone} keyGoal={keyGoal} />
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Avatar, name and "N sessions · N pageviews · time on site", then who they are and what they paid. */
function Header({ profile, visitorId }: { profile: Profile | null | undefined; visitorId: string | null }) {
  const name =
    profile === null || visitorId === null
      ? "Visitor not found"
      : profile === undefined
        ? "Visitor"
        : displayName(profile.visitorId, profile.name, profile.email);
  const identity =
    profile &&
    [profile.name ? profile.email : null, profile.userId && `user ${profile.userId}`].filter(Boolean).join(" · ");
  const paid = profile && (profile.firstPaidAt !== null || profile.revenueMinor !== 0);
  return (
    <SheetHeader className="flex-row items-center gap-3 px-5 pt-6 pr-12 sm:px-6">
      {profile !== null && visitorId !== null && <VisitorAvatar visitorId={visitorId} size="lg" />}
      <div className="flex min-w-0 flex-col gap-0.5">
        <SheetTitle className="truncate text-xl font-semibold tracking-tight">{name}</SheetTitle>
        <SheetDescription className="truncate">
          {profile === undefined ? (
            "Loading…"
          ) : profile === null ? (
            "This visitor isn't on this site."
          ) : (
            <>
              {plural(profile.sessionCount, "session")} · {plural(profile.pageviews, "pageview")} ·{" "}
              {formatDuration(profile.engagedMs)} on site
            </>
          )}
        </SheetDescription>
        {(identity || paid) && profile && (
          <p className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            {identity && <span className="truncate">{identity}</span>}
            {paid && (
              <span className="shrink-0 font-medium text-up tabular-nums">
                {formatMoney(profile.revenueMinor, profile.currency)} paid
              </span>
            )}
          </p>
        )}
      </div>
    </SheetHeader>
  );
}

function plural(n: number, word: string): string {
  return `${formatNumber(n)} ${n === 1 ? word : `${word}s`}`;
}

function Tile({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 bg-background px-4 py-4">
      <span className="truncate text-xs text-muted-foreground">{label}</span>
      {value === undefined ? (
        <span className="h-7 w-14 animate-pulse rounded bg-muted" />
      ) : (
        <span className="truncate text-xl leading-7 font-semibold tracking-tight tabular-nums">{value}</span>
      )}
    </div>
  );
}

/** Where the first session landed, where it came from, and when. */
function FirstVisit({ profile, timezone }: { profile: Profile; timezone: string }) {
  const first = profile.firstVisit;
  return (
    <section aria-labelledby="visitor-first-visit" className="flex flex-col gap-2">
      <h3 id="visitor-first-visit" className="text-sm text-muted-foreground">
        First visit
      </h3>
      {first === null ? (
        <p className="text-sm text-muted-foreground">No sessions recorded.</p>
      ) : (
        <>
          <p className="flex min-w-0 items-center gap-2 text-sm">
            <span className="truncate" title={first.path}>
              {first.path}
            </span>
            <span className="shrink-0 text-muted-foreground">from</span>
            <span className="min-w-0">
              <Source source={first.source} channel={null} />
            </span>
          </p>
          <p className="text-xs text-muted-foreground">{formatDateTime(first.startedAt, timezone)}</p>
        </>
      )}
    </section>
  );
}

/** Every listed session, newest first, numbered in the order they happened. */
function Journey({ profile, timezone, keyGoal }: { profile: Profile; timezone: string; keyGoal: string | null }) {
  const { sessions } = profile;
  // The first listed (oldest) session's number; older ones beyond the limit come before it
  const firstNumber = profile.sessionCount - sessions.length + 1;
  return (
    <section aria-labelledby="visitor-journey" className="flex flex-col gap-4">
      <h3 id="visitor-journey" className="text-sm text-muted-foreground">
        Journey
      </h3>
      {profile.moreSessions && (
        <p className="text-xs text-muted-foreground">Showing the latest {sessions.length} sessions.</p>
      )}
      {sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No sessions recorded.</p>
      ) : (
        <ol className="flex flex-col gap-6">
          {sessions
            .map((s, i) => (
              <SessionBlock
                key={s.sessionId}
                session={s}
                number={firstNumber + i}
                timezone={timezone}
                keyGoal={keyGoal}
                currency={profile.currency}
                sessions={sessions}
              />
            ))
            .reverse()}
        </ol>
      )}
    </section>
  );
}

function SessionBlock({
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
  const place = s.city ?? (s.region ? regionLabel(`${s.country}/${s.region}`) : null) ?? countryName(s.country);
  const facts = [
    place,
    s.browser,
    deviceLabel(s.device),
    s.engagedMs > 0 ? formatDuration(s.engagedMs) : null,
    plural(s.pageviews, "page"),
    plural(s.events, "event"),
  ].filter(Boolean);
  const tags = [
    s.utmCampaign && ["campaign", s.utmCampaign],
    s.utmSource && s.utmSource !== s.source && ["source", s.utmSource],
    s.utmMedium && ["medium", s.utmMedium],
    s.refTag && ["ref", s.refTag],
  ].filter((t): t is [string, string] => Boolean(t));
  // Entry is the first page; Exit the last, when every page of the session is listed
  const pageviews = s.items.flatMap((item, i) => (item.type === "pageview" ? [i] : []));
  const entry = pageviews[0];
  const exit = pageviews.length === s.pageviews ? pageviews.at(-1) : undefined;

  return (
    <li className="flex flex-col gap-3">
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
          <span className="font-medium">
            Session {formatNumber(number)}
            <span className="font-normal text-muted-foreground"> · {formatDateTime(s.startedAt, timezone)}</span>
          </span>
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            via
            <span className="min-w-0 text-foreground">
              <Source source={s.source} channel={null} />
            </span>
          </span>
        </div>
        <p className="text-xs text-muted-foreground" title={s.os ? `${s.browser} on ${s.os}` : undefined}>
          {facts.join(" · ")}
        </p>
        {(tags.length > 0 || s.credited) && (
          <div className="flex flex-wrap gap-1.5 pt-1 text-xs">
            {tags.map(([k, value]) => (
              <span key={k} className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                {k}: <span className="text-foreground">{value}</span>
              </span>
            ))}
            {s.credited && (
              <span
                className="rounded bg-up/15 px-1.5 py-0.5 text-up"
                title="Revenue from this visitor's payments was credited to this session's source"
              >
                credited
                {s.revenueMinor !== 0 && ` ${formatMoney(s.revenueMinor, currency)}`}
              </span>
            )}
          </div>
        )}
      </header>
      <ol className="flex flex-col text-sm">
        {s.items.map((item, i) => (
          <li key={i} className="grid grid-cols-[4.5rem_0.75rem_minmax(0,1fr)] items-start gap-2 py-1.5">
            <time className="pt-0.5 text-xs text-muted-foreground tabular-nums">{formatTime(item.ts, timezone)}</time>
            <span aria-hidden className="flex h-5 items-center justify-center">
              <span className={cn("size-1.5", DOTS[item.type])} />
            </span>
            <TimelineEntry item={item} keyGoal={keyGoal} sessions={sessions} entry={i === entry} exit={i === exit} />
          </li>
        ))}
      </ol>
    </li>
  );
}

function Mark({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 rounded-full border border-border px-2 py-px text-[11px] leading-4 text-muted-foreground">
      {children}
    </span>
  );
}

function TimelineEntry({
  item,
  keyGoal,
  sessions,
  entry,
  exit,
}: {
  item: Item;
  keyGoal: string | null;
  sessions: Session[];
  entry: boolean;
  exit: boolean;
}) {
  const row = (main: ReactNode, sub: ReactNode, aside?: string) => (
    <span className="flex min-w-0 items-start justify-between gap-3">
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-2">{main}</span>
        {sub && <span className="truncate text-xs text-muted-foreground">{sub}</span>}
      </span>
      {aside !== undefined && (
        <span className="shrink-0 pt-0.5 text-xs text-muted-foreground tabular-nums">{aside}</span>
      )}
    </span>
  );
  switch (item.type) {
    case "pageview":
      return row(
        <>
          <span className="truncate" title={item.path}>
            {item.path}
          </span>
          {entry && <Mark>Entry</Mark>}
          {exit && <Mark>Exit</Mark>}
        </>,
        null,
        item.durationMs === null ? undefined : formatDuration(item.durationMs),
      );
    case "goal": {
      const props = Object.entries(item.props ?? {})
        .map(([k, value]) => `${k}=${value}`)
        .join(" · ");
      return row(
        <>
          <span className="truncate">{item.name}</span>
          {item.name === keyGoal && (
            <span className="shrink-0 rounded bg-series-goal/15 px-1.5 py-px text-xs text-series-goal">key goal</span>
          )}
        </>,
        props ? `${props} · ${item.path}` : item.path,
        "goal",
      );
    }
    case "outbound":
      return row(
        <a
          href={item.name}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="truncate rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {outboundLabel(item.name)}
        </a>,
        item.path,
        "click",
      );
    case "identify":
      return row(<span className="text-muted-foreground">Identified</span>, item.path);
    case "claim":
      return row(<span className="text-muted-foreground">Returned from checkout</span>, item.path);
    case "payment":
    case "refund": {
      const credited = sessions.find((s) => s.sessionId === item.creditedSessionId);
      const linked =
        item.matchedBy === null ? "unattributed" : `linked by ${MATCHED_BY[item.matchedBy] ?? item.matchedBy}`;
      return row(
        <span className={cn("font-medium tabular-nums", item.type === "payment" ? "text-up" : "text-down")}>
          {item.type === "payment" ? (item.renewal ? "Renewal" : "Paid") : "Refund"}{" "}
          {formatMoney(item.amountMinor, item.currency)}
        </span>,
        credited ? `${linked}, credited to ${credited.source}` : linked,
        item.type,
      );
    }
  }
}
