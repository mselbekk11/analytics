"use client";

import { useState, type ReactNode } from "react";
import { FiChevronLeft, FiChevronRight, FiExternalLink } from "react-icons/fi";

export type BreakdownRow = {
  key: string;
  label: ReactNode;
  /** Formatted number: a count, or a percentage for share lists */
  value: string;
  /** 0 to 1, sets the bar width in share lists */
  share: number;
  /** Leading icon or flag in share lists; a favicon after the count in count lists */
  icon?: ReactNode;
  /** Formatted revenue credited to this key, shown at the end of the row */
  revenue?: string;
  /** An external page for the row (a referrer, an outbound link), opened from a small icon */
  href?: string;
  /** Adds this row as a filter when clicked */
  onSelect?: () => void;
  /** The row is the current filter of its list */
  active?: boolean;
};

const PAGE_SIZE = 10;

type Props = {
  title: string;
  /** Replaces the title, e.g. with tabs; `title` still names the paging buttons */
  header?: ReactNode;
  /**
   * "count": cyan number then label (Referrals, Pages).
   * "share": icon then a bar holding the percentage (Devices, Browsers, Countries).
   */
  variant: "count" | "share";
  rows: BreakdownRow[] | undefined;
};

export default function BreakdownList({ title, header, variant, rows }: Props) {
  const [page, setPage] = useState(0);
  const pages = rows ? Math.max(1, Math.ceil(rows.length / PAGE_SIZE)) : 1;
  const current = Math.min(page, pages - 1);
  const visible = rows?.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-line bg-panel/40 p-4">
      {header ?? <h2 className="font-medium text-strong">{title}</h2>}
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
      <Selectable row={row} className="gap-3">
        <span className="w-10 shrink-0 font-medium text-accent tabular-nums text-sm">{row.value}</span>
        {row.icon && <span className="flex size-4 shrink-0 items-center justify-center">{row.icon}</span>}
        <span className="min-w-0 truncate text-sm">{row.label}</span>
      </Selectable>
      <External row={row} />
      <Revenue row={row} />
    </li>
  );
}

function ShareRow({ row }: { row: BreakdownRow }) {
  return (
    <li className="flex h-7 items-center gap-3">
      <span className="flex w-7 shrink-0 justify-center text-lg text-muted">{row.icon}</span>
      <Selectable row={row} className="relative h-full">
        <div
          className="absolute inset-y-0 left-0 rounded bg-bar/60"
          style={{ width: `${Math.max(row.share * 100, 1)}%` }}
        />
        <span className="relative truncate px-2 text-sm tabular-nums text-strong">
          {row.value} <span className="text-strong/60">{row.label}</span>
        </span>
      </Selectable>
      <External row={row} />
      <Revenue row={row} />
    </li>
  );
}

/** The row's main part: a button that filters by the row when it can, else plain. */
function Selectable({ row, className, children }: { row: BreakdownRow; className: string; children: ReactNode }) {
  const base = `flex min-w-0 flex-1 items-center rounded ${className}`;
  if (!row.onSelect) return <div className={base}>{children}</div>;
  return (
    <button
      type="button"
      onClick={row.onSelect}
      aria-pressed={row.active}
      title={row.active ? "Remove this filter" : "Filter by this"}
      className={`${base} -mx-1 px-1 text-left hover:bg-line/50 ${row.active ? "ring-1 ring-accent/60" : ""}`}
    >
      {children}
    </button>
  );
}

function External({ row }: { row: BreakdownRow }) {
  if (row.href === undefined) return null;
  return (
    <a
      href={row.href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      aria-label="Open in a new tab"
      className="shrink-0 text-muted hover:text-accent"
    >
      <FiExternalLink aria-hidden className="size-3.5" />
    </a>
  );
}

function Revenue({ row }: { row: BreakdownRow }) {
  if (row.revenue === undefined) return null;
  return (
    <span className="ml-auto shrink-0 pl-2 text-sm text-up tabular-nums" title="Revenue credited to this row">
      {row.revenue}
    </span>
  );
}
