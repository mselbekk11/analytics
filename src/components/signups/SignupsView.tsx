"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { SearchIcon } from "lucide-react";
import { cn } from "cn";
import { api } from "../../../convex/_generated/api";
import { JOURNEY_CAP } from "../../../convex/lib/payments";
import { SIGNUP_ROWS, signupTiles, type SignupRow } from "../../../convex/lib/signups";
import {
  countryFlag,
  countryName,
  formatDateTime,
  formatElapsed,
  formatMoney,
  formatNumber,
  formatRate,
} from "@/lib/format";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { sitePath } from "@/components/TopBar";
import { Label, rowIcon } from "@/components/dashboard/Breakdowns";
import SiteHeader from "@/components/dashboard/SiteHeader";
import SiteShell from "@/components/dashboard/SiteShell";
import StatsCard, { type StatsRow } from "@/components/dashboard/StatsCard";
import { ChangeNote, LoadingRows, Tile } from "@/components/dashboard/TableParts";
import { useSiteRange } from "@/components/dashboard/useSiteRange";
import { Source } from "@/components/customers/Source";
import VisitorAvatar from "@/components/customers/VisitorAvatar";
import VisitorDrawer from "@/components/users/VisitorDrawer";
import SignupsChart from "./SignupsChart";

type Listed = Extract<FunctionReturnType<typeof api.signups.list>, { status: "ok" }>;

// The search box waits this long after the last key before asking again
const SEARCH_DELAY_MS = 200;
// Journey dots drawn before the count says the rest
const MAX_DOTS = 5;

const COLUMNS: { label: string; numeric: boolean }[] = [
  { label: "Person", numeric: false },
  { label: "Plan", numeric: false },
  { label: "Country", numeric: false },
  { label: "Source", numeric: false },
  { label: "Landing page", numeric: false },
  { label: "Signup page", numeric: false },
  { label: "Time to sign up", numeric: true },
  { label: "Journey", numeric: false },
  { label: "Signed up", numeric: true },
];

export default function SignupsView() {
  return (
    <SiteShell section="signups">
      {(site) => (
        <Signups
          domain={site.domain}
          timezone={site.timezone}
          keyGoal={site.keyGoal}
          tracking={site.trackingStartedAt !== null}
          cookieless={site.cookieless}
          currency={site.currency}
        />
      )}
    </SiteShell>
  );
}

function Signups({
  domain,
  timezone,
  keyGoal,
  tracking,
  cookieless,
  currency,
}: {
  domain: string;
  timezone: string;
  keyGoal: string | null;
  tracking: boolean;
  cookieless: boolean;
  currency: string;
}) {
  // Signups don't take filters; ?f= is kept in the URL for the other tabs
  const { today, range, preset, hourly, hourNow, searchParams, navigate, setRange } = useSiteRange(timezone, tracking);
  // The drawer's visitor, in `?visitor=` as on the Users tab
  const openId = searchParams.get("visitor") || null;
  const openVisitor = (visitorId: string | null) => navigate({ set: { visitor: visitorId } });

  const [typed, setTyped] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setSearch(typed), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [typed]);
  // The table goes back to its first rows whenever what it lists changes
  const listing = JSON.stringify([range, hourly, search]);
  const [paging, setPaging] = useState({ listing, offset: 0 });
  const offset = paging.listing === listing ? paging.offset : 0;

  const result = useQuery(
    api.signups.list,
    cookieless
      ? "skip"
      : { domain, range: hourly !== null ? { period: hourly, now: hourNow } : range, search, offset },
  );
  // Keep the last answer on screen while the next one loads, so paging doesn't flash
  const [last, setLast] = useState(result);
  if (result !== undefined && result !== last) setLast(result);
  const shown = result ?? last;
  const view = shown?.status === "ok" ? shown : undefined;
  const loading = result === undefined;
  const blocked = cookieless || shown?.status === "cookieless";

  return (
    <div className="flex flex-col gap-10">
      <SiteHeader
        title="Signups"
        range={range}
        preset={preset}
        today={today}
        onRange={setRange}
        filters={[]}
        onFilters={() => {}}
      />
      {blocked ? (
        <CookielessNotice domain={domain} />
      ) : shown?.status === "tooMany" ? (
        <p className="w-full rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          There are too many signups in this range to list. Pick a shorter range.
        </p>
      ) : (
        <>
          {/* Full width, unlike Revenue's 2fr | 1fr: five tiles, and "Avg. time to sign up" needs the room */}
          <div className="flex flex-col gap-4">
            <Overview view={view} />
            <div className="flex overflow-hidden rounded-lg border border-border [&>section]:flex-1">
              <Lists lists={view?.lists} />
            </div>
          </div>
          <section aria-labelledby="people" className="overflow-hidden rounded-lg border border-border">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
              <h2 id="people" className="flex items-baseline gap-2 font-medium">
                People who signed up
                <span className="text-xs font-normal text-muted-foreground tabular-nums">
                  {view === undefined ? "" : formatNumber(view.totals.signups)}
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
                  placeholder="Search person, source, country, page…"
                  aria-label="Search signups by person, email, source, country or page"
                />
              </InputGroup>
            </div>
            {/* relative: keeps the sr-only text inside the scroll box on phones */}
            <div className="relative overflow-x-auto border-t border-border">
              <table className={cn("w-full min-w-[1080px] text-sm", loading && view !== undefined && "opacity-60")}>
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    {COLUMNS.map((c, i) => (
                      <th
                        key={c.label}
                        scope="col"
                        className={cn(
                          "px-4 py-3 font-normal whitespace-nowrap",
                          c.numeric ? "text-right" : "text-left",
                          i === 0 && "sm:pl-5",
                          i === COLUMNS.length - 1 && "sm:pr-5",
                        )}
                      >
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {view === undefined ? (
                    <LoadingRows columns={COLUMNS.length} />
                  ) : view.rows.length === 0 ? (
                    <tr>
                      <td colSpan={COLUMNS.length} className="px-4 py-12 text-center text-muted-foreground sm:px-5">
                        {search.trim() !== "" ? (
                          `No signups match “${search.trim()}”.`
                        ) : (
                          <>
                            No signups in this range.
                            <span className="mx-auto mt-1 block max-w-md text-xs">
                              A visitor counts as a signup the first time your site calls{" "}
                              <code className="font-mono">analytics(&quot;identify&quot;, …)</code> with their email or
                              user id.
                            </span>
                          </>
                        )}
                      </td>
                    </tr>
                  ) : (
                    view.rows.map((row) => (
                      <Row
                        key={row.visitorId}
                        row={row}
                        currency={currency}
                        timezone={timezone}
                        open={row.visitorId === openId}
                        onOpen={() => openVisitor(row.visitorId)}
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
                    onClick={() => setPaging({ listing, offset: Math.max(0, view.offset - SIGNUP_ROWS) })}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={view.offset + SIGNUP_ROWS >= view.matched}
                    onClick={() => setPaging({ listing, offset: view.offset + SIGNUP_ROWS })}
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

/** A cookieless site: why there are no signups, and where to switch. */
function CookielessNotice({ domain }: { domain: string }) {
  return (
    <section className="flex flex-col items-start gap-2 rounded-lg border border-border px-5 py-8 sm:px-8">
      <h2 className="font-medium">Signups need visitor ids</h2>
      <p className="max-w-2xl text-sm text-muted-foreground">
        A signup is a visitor your site identifies with <code className="font-mono">analytics(&quot;identify&quot;, …)</code>,
        and that takes the visitor id cookie. This site is cookieless, so identify calls aren&apos;t recorded and no one
        can be followed from their first visit to signing up. Switch it to cookies in{" "}
        <Link href={`${sitePath(domain, "settings")}?section=identity`} className="underline hover:text-foreground">
          Settings → Visitor identity
        </Link>{" "}
        and signups count from then on.
      </p>
    </section>
  );
}

/**
 * Signups, Free, Paying, Free → paid and Avg. time to sign up, each with its change,
 * joined over the stacked Free/Paying chart with its Daily | Cumulative switch.
 */
function Overview({ view }: { view: Listed | undefined }) {
  const [cumulative, setCumulative] = useState(false);
  const tiles = view && signupTiles(view.totals);
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="grid grid-cols-2 gap-px border-b border-border bg-border md:grid-cols-5 [&>*:last-child]:col-span-2 md:[&>*:last-child]:col-span-1">
        <Tile
          label="Signups"
          value={tiles && formatNumber(tiles.signups.value)}
          note={tiles && <ChangeNote change={tiles.signups.change} />}
        />
        <Tile
          label="Free"
          value={tiles && formatNumber(tiles.free.value)}
          note={tiles && <ChangeNote change={tiles.free.change} />}
        />
        <Tile
          label="Paying"
          value={tiles && formatNumber(tiles.paying.value)}
          note={tiles && <ChangeNote change={tiles.paying.change} />}
        />
        <Tile
          label="Free → paid"
          value={tiles && (tiles.paidRate.value === null ? "–" : formatRate(tiles.paidRate.value))}
          note={tiles && <ChangeNote change={tiles.paidRate.change} />}
        />
        <Tile
          label="Avg. time to sign up"
          value={tiles && (tiles.took.value === null ? "–" : formatElapsed(tiles.took.value))}
          note={tiles && <ChangeNote change={tiles.took.change} invert />}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:px-5">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-[2px] bg-series-revenue" />
            Paying
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-[2px] bg-series-pageviews" />
            Free
          </span>
        </div>
        <ToggleGroup
          value={[cumulative ? "cumulative" : "daily"]}
          onValueChange={(value) => {
            // Clicking the pressed one again reports an empty value; keep it
            if (value[0]) setCumulative(value[0] === "cumulative");
          }}
          spacing={0}
          size="sm"
          aria-label="Chart"
          className="rounded-lg border border-border p-0.5"
        >
          <ToggleGroupItem value="daily" className="rounded-md! px-3 text-muted-foreground data-pressed:text-foreground">
            Daily
          </ToggleGroupItem>
          <ToggleGroupItem
            value="cumulative"
            className="rounded-md! px-3 text-muted-foreground data-pressed:text-foreground"
          >
            Cumulative
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="px-2 pt-4 pb-4 sm:px-4">
        {view === undefined ? (
          <div className="h-56 animate-pulse rounded-md bg-muted" aria-busy />
        ) : (
          <SignupsChart data={view.chart} cumulative={cumulative} className="aspect-auto h-56 w-full" />
        )}
      </div>
    </div>
  );
}

type ListTab = "source" | "country" | "landing";

/** Sources, Countries and Landing pages ranked by signups, with how many of them pay on hover. */
function Lists({ lists }: { lists: Listed["lists"] | undefined }) {
  const tabs: { id: ListTab; label: string }[] = [
    { id: "source", label: "Sources" },
    { id: "country", label: "Countries" },
    { id: "landing", label: "Landing pages" },
  ];
  const [tab, setTab] = useState<ListTab>("source");
  const data = lists?.[tab];
  const top = Math.max(0, ...(data ?? []).map((r) => r.signups));
  const rows: StatsRow[] | undefined = data?.map((r) => ({
    key: r.key,
    label:
      tab === "country" ? (
        <Label dim="country" value={r.key} />
      ) : tab === "landing" ? (
        <span className="font-mono text-xs">{r.key}</span>
      ) : (
        r.key
      ),
    icon: tab === "landing" ? undefined : rowIcon(tab, r.key),
    value: formatNumber(r.signups),
    share: top <= 0 ? 0 : r.signups / top,
    tooltip: (
      <span className="tabular-nums">
        {formatNumber(r.paying)} paying · {formatNumber(r.signups - r.paying)} free
      </span>
    ),
  }));
  return (
    <StatsCard
      title="Where signups come from"
      tabs={tabs}
      tab={tab}
      onTab={(id) => setTab(id === "country" ? "country" : id === "landing" ? "landing" : "source")}
      metric="Signups"
      rows={rows}
      empty="No signups in this range"
    />
  );
}

/** One person who signed up; the whole row opens their drawer, the person cell is the button keyboards reach. */
function Row({
  row,
  currency,
  timezone,
  open,
  onOpen,
}: {
  row: SignupRow;
  currency: string;
  timezone: string;
  open: boolean;
  onOpen: () => void;
}) {
  const detail = row.email !== null && row.email !== row.person ? row.email : row.userId;
  return (
    <tr
      onClick={onOpen}
      className={cn(
        "cursor-pointer border-b border-border transition-colors last:border-b-0 hover:bg-muted/40",
        open && "bg-muted/40",
      )}
    >
      <td className="max-w-64 px-4 py-3 sm:pl-5">
        <button
          type="button"
          data-visitor-row={row.visitorId}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="flex w-full min-w-0 items-center gap-3 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <VisitorAvatar visitorId={row.visitorId} />
          <span className="min-w-0">
            <span className="block truncate" title={row.person}>
              {row.person}
            </span>
            {detail !== null && (
              <span className="block truncate text-xs text-muted-foreground" title={detail}>
                {detail}
              </span>
            )}
          </span>
        </button>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {row.paying ? (
          <span className="flex flex-col">
            <span className="font-medium text-up">Paying</span>
            {row.revenueMinor > 0 && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {formatMoney(row.revenueMinor, currency)}
              </span>
            )}
          </span>
        ) : (
          <span className="text-muted-foreground">Free</span>
        )}
      </td>
      <td className="max-w-44 px-4 py-3">
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
      <td className="max-w-44 px-4 py-3">
        <Source source={row.source} channel={null} />
      </td>
      <td className="max-w-44 px-4 py-3">
        <Path path={row.landingPath} />
      </td>
      <td className="max-w-44 px-4 py-3">
        <Path path={row.signupPath} />
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">{formatElapsed(row.tookMs)}</td>
      <td className="px-4 py-3">
        <Journey sessions={row.journey} />
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap text-muted-foreground tabular-nums sm:pr-5">
        {formatDateTime(row.identifiedAt, timezone)}
      </td>
    </tr>
  );
}

function Path({ path }: { path: string | null }) {
  if (path === null) return <Dash />;
  return (
    <span className="block truncate font-mono text-xs" title={path}>
      {path}
    </span>
  );
}

/** The visitor's sessions up to the signup as dots, the last (the one they signed up in) filled. */
function Journey({ sessions }: { sessions: number }) {
  if (sessions === 0) return <Dash />;
  const label = `${sessions > JOURNEY_CAP ? `${JOURNEY_CAP}+` : sessions} ${sessions === 1 ? "session" : "sessions"} up to signing up`;
  const dots = Math.min(sessions, MAX_DOTS);
  return (
    <span className="flex items-center gap-1" title={label}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: dots }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className={cn("rounded-full", i === dots - 1 ? "size-2 bg-foreground" : "size-1.5 bg-muted-foreground/50")}
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
