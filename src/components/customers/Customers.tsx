"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Authenticated, AuthLoading, useQuery } from "convex/react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { api } from "../../../convex/_generated/api";
import { SourceIcon } from "@/components/dashboard/Breakdowns";
import TopBar from "@/components/TopBar";
import { countryFlag, formatDateTime, formatElapsed, formatMoney, formatNumber } from "@/lib/format";
import { displayName } from "@/lib/names";
import VisitorAvatar from "./VisitorAvatar";

const PAGE_SIZE = 25;

type Kind = "revenue" | "goal";

export function visitorPath(domain: string, visitorId: string): string {
  return `/sites/${encodeURIComponent(domain)}/visitors/${encodeURIComponent(visitorId)}`;
}

/**
 * Every paying visitor (or, on a site without revenue, every visitor who completed the
 * key goal), newest first. A site with both gets tabs, kept in the URL as `?by=goal`.
 */
export default function Customers() {
  const params = useParams<{ domain: string }>();
  const domain = decodeURIComponent(params.domain);
  return (
    <div className="flex flex-1 flex-col">
      <TopBar site={{ domain, section: "customers" }} />
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
  return <CustomerList domain={site.domain} timezone={site.timezone} />;
}

function CustomerList({ domain, timezone }: { domain: string; timezone: string }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const by = searchParams.get("by");
  const data = useQuery(api.visitors.customers, {
    domain,
    ...(by === "goal" || by === "revenue" ? { kind: by } : {}),
  });
  const [page, setPage] = useState(0);

  function setKind(kind: Kind) {
    const next = new URLSearchParams(searchParams);
    if (kind === "goal") next.set("by", "goal");
    else next.delete("by");
    setPage(0);
    router.push(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  }

  if (data === undefined) {
    return (
      <ul className="flex flex-col gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <li key={i} className="h-10 animate-pulse rounded bg-line" />
        ))}
      </ul>
    );
  }
  if (data.kind === null) {
    return (
      <p className="text-sm text-muted-foreground">
        Customers are visitors who paid, or who completed the site&apos;s key goal. Connect Stripe or the
        payments API, or pick a key goal, in{" "}
        <Link href={`/sites/${encodeURIComponent(domain)}/settings`} className="underline hover:text-strong">
          Settings
        </Link>
        .
      </p>
    );
  }

  const revenue = data.kind === "revenue";
  const pages = Math.max(1, Math.ceil(data.rows.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = data.rows.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  const label = (k: Kind) => (k === "revenue" ? "Paying" : `Key goal: ${data.keyGoal}`);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-xl text-strong">
          {formatNumber(data.rows.length)}
          {data.more ? "+" : ""}{" "}
          {revenue
            ? data.rows.length === 1 ? "paying customer" : "paying customers"
            : `${data.rows.length === 1 ? "visitor" : "visitors"} completed ${data.keyGoal}`}
        </h1>
        {data.kinds.length > 1 && (
          <div className="flex gap-1 rounded-md bg-panel p-1 text-sm">
            {data.kinds.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                aria-pressed={k === data.kind}
                className={`rounded px-3 py-1 ${k === data.kind ? "bg-line text-strong" : "text-muted-foreground hover:text-strong"}`}
              >
                {label(k)}
              </button>
            ))}
          </div>
        )}
      </div>

      {data.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {revenue
            ? "No payments linked to a visitor yet."
            : `No visitor has completed the key goal "${data.keyGoal}" yet.`}
        </p>
      ) : (
        <section className="overflow-x-auto rounded-lg border border-line bg-panel/40">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-normal">Customer</th>
                <th className="hidden px-4 py-2 font-normal md:table-cell">First source</th>
                <th className="px-4 py-2 font-normal" title={revenue ? "Source of the session the first payment was credited to" : "Source of the session the key goal was first completed in"}>
                  Credited source
                </th>
                {revenue && <th className="px-4 py-2 text-right font-normal">Total paid</th>}
                <th className="hidden px-4 py-2 font-normal sm:table-cell">
                  {revenue ? "First payment" : "Converted"}
                </th>
                <th className="hidden px-4 py-2 text-right font-normal sm:table-cell" title="From the first visit to the conversion">
                  Time to convert
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => {
                const href = visitorPath(domain, c.visitorId);
                return (
                  <tr
                    key={c.visitorId}
                    onClick={() => router.push(href)}
                    className="cursor-pointer border-b border-line/60 last:border-0 hover:bg-line/40"
                  >
                    <td className="max-w-64 min-w-44 px-4 py-2">
                      <Link href={href} className="flex min-w-0 items-center gap-3" onClick={(e) => e.stopPropagation()}>
                        <VisitorAvatar visitorId={c.visitorId} />
                        <span className="truncate text-strong">{displayName(c.visitorId, c.name, c.email)}</span>
                        {c.country && <span aria-hidden>{countryFlag(c.country)}</span>}
                      </Link>
                    </td>
                    <td className="hidden px-4 py-2 md:table-cell">
                      <Source source={c.firstSource} channel={c.firstChannel} />
                    </td>
                    <td className="px-4 py-2">
                      <Source source={c.creditedSource} channel={c.creditedChannel} />
                    </td>
                    {revenue && (
                      <td className="px-4 py-2 text-right font-medium text-up tabular-nums">
                        {formatMoney(c.revenueMinor, data.currency)}
                      </td>
                    )}
                    <td className="hidden px-4 py-2 whitespace-nowrap text-muted-foreground sm:table-cell">
                      {formatDateTime(c.convertedAt, timezone)}
                    </td>
                    <td className="hidden px-4 py-2 text-right tabular-nums sm:table-cell">
                      {formatElapsed(c.convertedAt - c.firstSeen)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {pages > 1 && (
        <footer className="flex items-center gap-1 text-sm">
          <button
            type="button"
            onClick={() => setPage(current - 1)}
            disabled={current === 0}
            className="rounded bg-line p-1.5 text-muted-foreground hover:text-strong disabled:opacity-30"
            aria-label="Previous page"
          >
            <FiChevronLeft />
          </button>
          <span className="px-1 tabular-nums">page {current + 1}</span>
          <button
            type="button"
            onClick={() => setPage(current + 1)}
            disabled={current === pages - 1}
            className="rounded bg-line p-1.5 text-muted-foreground hover:text-strong disabled:opacity-30"
            aria-label="Next page"
          >
            <FiChevronRight />
          </button>
        </footer>
      )}
      {data.more && <p className="text-xs text-muted-foreground">Showing the newest {formatNumber(data.rows.length)}.</p>}
    </div>
  );
}

/** A source with its favicon and channel; "–" before sources were tracked. */
export function Source({ source, channel }: { source: string | null; channel: string | null }) {
  if (source === null) return <span className="text-muted-foreground">–</span>;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <SourceIcon key={source} source={source} />
      <span className="truncate">{source}</span>
      {channel && channel !== source && <span className="hidden text-xs text-muted-foreground lg:inline">{channel}</span>}
    </span>
  );
}
