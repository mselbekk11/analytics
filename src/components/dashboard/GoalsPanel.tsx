"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "convex/react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { api } from "../../../convex/_generated/api";
import type { DateRange } from "../../../convex/lib/ranges";
import { formatNumber, formatShare } from "@/lib/format";

const PAGE_SIZE = 10;

/**
 * Each goal's completions, visitors and conversion rate (the share of daily visitors who
 * completed it, see stats.goals). The site's key goal is marked and always listed.
 */
export default function GoalsPanel({ domain, range }: { domain: string; range: DateRange }) {
  const data = useQuery(api.stats.goals, { domain, ...range });
  const [page, setPage] = useState(0);
  const rows = data?.rows;
  const pages = rows ? Math.max(1, Math.ceil(rows.length / PAGE_SIZE)) : 1;
  const current = Math.min(page, pages - 1);
  const visible = rows?.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-line bg-panel/40 p-4">
      <h2 className="font-medium text-strong">Goals</h2>
      {visible === undefined ? (
        <ul className="flex flex-col gap-2">
          {Array.from({ length: 3 }, (_, i) => (
            <li key={i} className="h-7 animate-pulse rounded bg-line" />
          ))}
        </ul>
      ) : visible.length === 0 ? (
        <p className="py-2 text-sm text-muted">
          No goals completed in this period.{" "}
          <Link href={`/sites/${encodeURIComponent(domain)}/settings#goals`} className="underline hover:text-strong">
            Set up goals
          </Link>
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="pb-1 font-normal">Goal</th>
              <th className="pb-1 text-right font-normal">Completions</th>
              <th className="pb-1 text-right font-normal">Visitors</th>
              <th
                className="pb-1 text-right font-normal"
                title="Share of daily visitors who completed the goal"
              >
                Conversion
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.name} className="h-7">
                <td className="max-w-0 truncate pr-3">
                  <span className="text-strong">{row.name}</span>
                  {row.name === data?.keyGoal && (
                    <span className="ml-2 rounded bg-accent/15 px-1.5 py-0.5 text-xs text-accent">
                      key goal
                    </span>
                  )}
                </td>
                <td className="w-24 text-right font-medium text-accent tabular-nums">
                  {formatNumber(row.completions)}
                </td>
                <td className="w-20 text-right tabular-nums">{formatNumber(row.visitors)}</td>
                <td className="w-24 text-right tabular-nums">
                  {data && data.visitors > 0 ? formatShare(Math.min(1, row.visitors / data.visitors)) : "–"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {pages > 1 && (
        <footer className="flex items-center gap-1 text-sm">
          <button
            type="button"
            onClick={() => setPage(current - 1)}
            disabled={current === 0}
            className="rounded bg-line p-1.5 text-muted hover:text-strong disabled:opacity-30"
            aria-label="Previous Goals page"
          >
            <FiChevronLeft />
          </button>
          <span className="px-1 tabular-nums">page {current + 1}</span>
          <button
            type="button"
            onClick={() => setPage(current + 1)}
            disabled={current === pages - 1}
            className="rounded bg-line p-1.5 text-muted hover:text-strong disabled:opacity-30"
            aria-label="Next Goals page"
          >
            <FiChevronRight />
          </button>
        </footer>
      )}
    </section>
  );
}
