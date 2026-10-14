"use client";

import { useState, type ReactNode } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

export type BreakdownRow = {
  key: string;
  label: ReactNode;
  /** Formatted number: a count, or a percentage for share lists */
  value: string;
  /** 0 to 1, sets the bar width in share lists */
  share: number;
  /** Leading icon or flag in share lists */
  icon?: ReactNode;
};

const PAGE_SIZE = 10;

type Props = {
  title: string;
  /**
   * "count": cyan number then label (Referrals, Pages).
   * "share": icon then a bar holding the percentage (Devices, Browsers, Countries).
   */
  variant: "count" | "share";
  rows: BreakdownRow[] | undefined;
};

export default function BreakdownList({ title, variant, rows }: Props) {
  const [page, setPage] = useState(0);
  const pages = rows ? Math.max(1, Math.ceil(rows.length / PAGE_SIZE)) : 1;
  const current = Math.min(page, pages - 1);
  const visible = rows?.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-line bg-panel/40 p-4">
      <h2 className="font-medium text-strong">{title}</h2>
      {visible === undefined ? (
        <ul className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <li key={i} className="h-7 animate-pulse rounded bg-line" />
          ))}
        </ul>
      ) : visible.length === 0 ? (
        <p className="py-2 text-sm text-muted">No data for this period</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((row) =>
            variant === "count" ? <CountRow key={row.key} row={row} /> : <ShareRow key={row.key} row={row} />,
          )}
        </ul>
      )}
      {pages > 1 && (
        <footer className="flex items-center gap-1 text-sm">
          <button
            type="button"
            onClick={() => setPage(current - 1)}
            disabled={current === 0}
            className="rounded bg-line p-1.5 text-muted hover:text-strong disabled:opacity-30"
            aria-label={`Previous ${title} page`}
          >
            <FiChevronLeft />
          </button>
          <span className="px-1 tabular-nums">page {current + 1}</span>
          <button
            type="button"
            onClick={() => setPage(current + 1)}
            disabled={current === pages - 1}
            className="rounded bg-line p-1.5 text-muted hover:text-strong disabled:opacity-30"
            aria-label={`Next ${title} page`}
          >
            <FiChevronRight />
          </button>
        </footer>
      )}
    </section>
  );
}

function CountRow({ row }: { row: BreakdownRow }) {
  return (
    <li className="flex h-7 items-center gap-3">
      <span className="w-10 shrink-0 font-medium text-accent tabular-nums text-sm">{row.value}</span>
      <span className="min-w-0 truncate text-sm">{row.label}</span>
    </li>
  );
}

function ShareRow({ row }: { row: BreakdownRow }) {
  return (
    <li className="flex h-7 items-center gap-3">
      <span className="flex w-7 shrink-0 justify-center text-lg text-muted">{row.icon}</span>
      <div className="relative flex h-full min-w-0 flex-1 items-center">
        <div
          className="absolute inset-y-0 left-0 rounded bg-bar/60"
          style={{ width: `${Math.max(row.share * 100, 1)}%` }}
        />
        <span className="relative truncate px-2 text-sm tabular-nums text-strong">
          {row.value} <span className="text-strong/60">{row.label}</span>
        </span>
      </div>
    </li>
  );
}
