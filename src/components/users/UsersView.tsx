"use client";

import { createElement, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { ArrowRightIcon, SearchIcon } from "lucide-react";
import { FiMonitor } from "react-icons/fi";
import { cn } from "cn";
import { api } from "../../../convex/_generated/api";
import type { VisitorRow } from "../../../convex/visitors";
import { countryFlag, countryName, deviceLabel, formatDuration, formatMoney, formatNumber } from "@/lib/format";
import { displayName } from "@/lib/names";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DEVICE_ICONS } from "@/components/dashboard/Breakdowns";
import SiteHeader from "@/components/dashboard/SiteHeader";
import SiteShell from "@/components/dashboard/SiteShell";
import { useSiteRange } from "@/components/dashboard/useSiteRange";
import { Source } from "@/components/customers/Source";
import VisitorAvatar from "@/components/customers/VisitorAvatar";
import { sitePath, visitorPath } from "@/components/TopBar";

// The search box waits this long after the last key before asking again
const SEARCH_DELAY_MS = 200;
// Rows per page; visitors.list's VISITOR_ROWS
const ROWS = 50;

type Kind = "all" | "customers";

export default function UsersView() {
  return (
    <SiteShell section="users">
      {(site) => (
        <Users
          domain={site.domain}
          timezone={site.timezone}
          tracking={site.trackingStartedAt !== null}
          currency={site.revenueSource === "none" ? null : site.currency}
        />
      )}
    </SiteShell>
  );
}

function Users({
  domain,
  timezone,
  tracking,
  currency,
}: {
  domain: string;
  timezone: string;
  /** The site has sent visitor ids; without them there is no one to list */
  tracking: boolean;
  /** The site's currency when it takes payments */
  currency: string | null;
}) {
  const { today, range, preset, hourly, hourNow, filters, searchParams, navigate, setRange, setFilters } =
    useSiteRange(timezone, tracking);
  const kind: Kind = searchParams.get("kind") === "customers" ? "customers" : "all";

  const [typed, setTyped] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setSearch(typed), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [typed]);
  // The table goes back to its first rows whenever what it lists changes
  const listing = JSON.stringify([range, hourly, kind, search]);
  const [paging, setPaging] = useState({ listing, offset: 0 });
  const offset = paging.listing === listing ? paging.offset : 0;

  const result = useQuery(
    api.visitors.list,
    tracking
      ? { domain, range: hourly !== null ? { period: hourly, now: hourNow } : range, kind, search, offset }
      : "skip",
  );
  // Keep the last answer on screen while the next one loads, so paging doesn't flash
  const [last, setLast] = useState(result);
  if (result !== undefined && result !== last) setLast(result);
  const shown = result ?? last;
  const loading = result === undefined;

  const header = (
    <SiteHeader
      title="Users"
      range={range}
      preset={preset}
      today={today}
      onRange={setRange}
      filters={filters}
      onFilters={setFilters}
      note={<p className="text-xs text-muted-foreground">Filters don&apos;t narrow the visitor table.</p>}
    />
  );
  if (!tracking || shown?.status === "cookieless") {
    return (
      <div className="flex flex-col gap-10">
        {header}
        <Cookieless domain={domain} />
      </div>
    );
  }

  const ok = shown?.status === "ok" ? shown : undefined;
  const revenue = kind === "customers" && currency !== null;
  const columns = ["Visitor", "Location", "Source", "Device", "Sessions", "Pageviews", "Time", "Entry → Exit"];
  if (revenue) columns.push("Revenue");
  const numeric = new Set(["Sessions", "Pageviews", "Time", "Revenue"]);

  return (
    <div className="flex flex-col gap-10">
      {header}
      <section aria-labelledby="all-visitors" className="overflow-hidden rounded-lg border border-border">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
          <div className="flex items-center gap-4">
            <h2 id="all-visitors" className="flex items-baseline gap-2 font-medium">
              {kind === "customers" ? "Customers" : "All visitors"}
              <span className="text-xs font-normal text-muted-foreground tabular-nums">
                {ok === undefined ? "" : `${formatNumber(ok.matched)}${ok.truncated ? "+" : ""}`}
              </span>
            </h2>
            <ToggleGroup
              value={[kind]}
              onValueChange={(value) => {
                // Clicking the pressed one again reports an empty value; keep it
                const next = value[0] as Kind | undefined;
                if (next) navigate({ set: { kind: next === "all" ? null : next } });
              }}
              spacing={0}
              size="sm"
              aria-label="Visitors to list"
              className="rounded-lg border border-border p-0.5"
            >
              <ToggleGroupItem value="all" className="rounded-md! px-3 text-muted-foreground data-pressed:text-foreground">
                All
              </ToggleGroupItem>
              <ToggleGroupItem
                value="customers"
                className="rounded-md! px-3 text-muted-foreground data-pressed:text-foreground"
              >
                Customers
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <InputGroup className="w-full sm:w-72">
            <InputGroupAddon>
              <SearchIcon aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Search name, email, id, country, page…"
              aria-label="Search visitors by name, email, visitor id, country or page"
            />
          </InputGroup>
        </div>
        {ok?.truncated && (
          <p className="border-t border-border bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground sm:px-5">
            This range has more visitors than one list can read. The list, its count and search cover the 5,000
            seen most recently; pick a shorter range to see the rest.
          </p>
        )}
        <div className="overflow-x-auto border-t border-border">
          <table className={cn("w-full min-w-[960px] text-sm", loading && shown !== undefined && "opacity-60")}>
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                {columns.map((c) => (
                  <th
                    key={c}
                    scope="col"
                    className={cn(
                      "px-4 py-3 font-normal whitespace-nowrap sm:first:pl-5 sm:last:pr-5",
                      numeric.has(c) ? "text-right" : "text-left",
                    )}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ok === undefined ? (
                <LoadingRows columns={columns.length} />
              ) : ok.rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-12 text-center text-muted-foreground sm:px-5">
                    <Empty kind={kind} search={search} customerKinds={ok.customerKinds} domain={domain} />
                  </td>
                </tr>
              ) : (
                ok.rows.map((row) => (
                  <Row key={row.visitorId} row={row} domain={domain} currency={revenue ? ok.currency : null} />
                ))
              )}
            </tbody>
          </table>
        </div>
        {ok !== undefined && ok.matched > 0 && (
          <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-muted-foreground sm:px-5">
            <span className="tabular-nums">
              {formatNumber(ok.offset + 1)}–{formatNumber(ok.offset + ok.rows.length)} of {formatNumber(ok.matched)}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={ok.offset === 0}
                onClick={() => setPaging({ listing, offset: Math.max(0, ok.offset - ROWS) })}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={ok.offset + ROWS >= ok.matched}
                onClick={() => setPaging({ listing, offset: ok.offset + ROWS })}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

/** Why the table is empty: nobody in the range, no match, or no customers (and what makes one). */
function Empty({
  kind,
  search,
  customerKinds,
  domain,
}: {
  kind: Kind;
  search: string;
  customerKinds: string[];
  domain: string;
}) {
  if (search.trim() !== "") return <>No visitors match “{search.trim()}”.</>;
  if (kind === "all") return <>No visitors in this range.</>;
  if (customerKinds.length > 0) return <>No customers were seen in this range.</>;
  return (
    <>
      Customers are visitors who paid, or who completed the site&apos;s key goal. Connect Stripe or the payments
      API, or pick a key goal, in{" "}
      <Link href={sitePath(domain, "settings")} className="underline hover:text-foreground">
        Settings
      </Link>
      .
    </>
  );
}

/** In place of the table on a site without visitor ids. */
function Cookieless({ domain }: { domain: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border px-5 py-6 text-sm">
      <h2 className="font-medium">No visitor ids on this site</h2>
      <p className="max-w-prose text-muted-foreground">
        Users lists people by the visitor id the snippet keeps in a cookie. This site hasn&apos;t sent one yet:
        either it runs in cookieless mode (<code className="font-mono text-xs">data-cookieless</code>), which counts
        pageviews but not visitors, sessions or journeys, or it has had no visits since the snippet was added.
      </p>
      <p className="text-muted-foreground">
        <Link href={`${sitePath(domain, "settings")}?section=identity`} className="underline hover:text-foreground">
          Visitor identity settings
        </Link>
      </p>
    </div>
  );
}

/**
 * One visitor. Clicking anywhere on the row opens their profile; the name is the link
 * keyboards reach.
 */
function Row({ row, domain, currency }: { row: VisitorRow; domain: string; currency: string | null }) {
  const router = useRouter();
  const href = visitorPath(domain, row.visitorId);
  const name = displayName(row.visitorId, row.name, row.email);
  return (
    <tr
      onClick={() => router.push(href)}
      className="cursor-pointer border-b border-border transition-colors last:border-b-0 hover:bg-muted/40"
    >
      <td className="max-w-56 px-4 py-3 sm:pl-5">
        <Link
          href={href}
          onClick={(e) => e.stopPropagation()}
          className="flex min-w-0 items-center gap-3 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <VisitorAvatar visitorId={row.visitorId} />
          <span className="truncate" title={name}>
            {name}
          </span>
        </Link>
      </td>
      <td className="max-w-52 px-4 py-3">
        {row.country === null ? (
          <Dash />
        ) : (
          <span className="flex min-w-0 items-center gap-2">
            <span aria-hidden className="text-base leading-none">
              {countryFlag(row.country) || "🌐"}
            </span>
            <span className="truncate">
              {countryName(row.country)}
              {row.city && <span className="text-muted-foreground"> · {row.city}</span>}
            </span>
          </span>
        )}
      </td>
      <td className="max-w-48 px-4 py-3">
        <Source source={row.firstSource} channel={null} />
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {row.device === null ? (
          <Dash />
        ) : (
          <span className="flex items-center gap-2">
            {createElement(DEVICE_ICONS[row.device] ?? FiMonitor, { "aria-hidden": true, className: "shrink-0 text-muted-foreground" })}
            {deviceLabel(row.device)}
            {row.browser && <span className="text-muted-foreground">· {row.browser}</span>}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-right tabular-nums">{formatNumber(row.sessions)}</td>
      <td className="px-4 py-3 text-right tabular-nums">{row.pageviews === 0 ? <Dash /> : formatNumber(row.pageviews)}</td>
      <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
        {row.engagedMs === 0 ? <Dash /> : formatDuration(row.engagedMs)}
      </td>
      <td className={cn("max-w-72 px-4 py-3", currency === null && "sm:pr-5")}>
        {row.entryPath === null ? (
          <Dash />
        ) : (
          <span className="flex min-w-0 items-center gap-1.5" title={`${row.entryPath} → ${row.exitPath ?? row.entryPath}`}>
            <span className="truncate">{row.entryPath}</span>
            {row.exitPath !== null && row.exitPath !== row.entryPath && (
              <>
                <ArrowRightIcon aria-label="then" className="size-3 shrink-0 text-muted-foreground" />
                <span className="truncate">{row.exitPath}</span>
              </>
            )}
          </span>
        )}
      </td>
      {currency !== null && (
        <td className="px-4 py-3 text-right tabular-nums sm:pr-5">
          {row.revenueMinor === 0 ? <Dash /> : <span className="text-up">{formatMoney(row.revenueMinor, currency)}</span>}
        </td>
      )}
    </tr>
  );
}

function Dash() {
  return <span className="text-muted-foreground">–</span>;
}

function LoadingRows({ columns }: { columns: number }) {
  return (
    <>
      {Array.from({ length: 6 }, (_, i) => (
        <tr key={i} className="border-b border-border last:border-b-0" aria-hidden>
          {Array.from({ length: columns }, (_, j) => (
            <td key={j} className="px-4 py-3.5 sm:first:pl-5 sm:last:pr-5">
              <div className={cn("h-4 animate-pulse rounded bg-muted", j === 0 ? "w-32" : j < 4 ? "w-24" : "ml-auto w-10")} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
