"use client";

import type { ReactNode } from "react";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { cn } from "cn";
import { formatChange } from "@/lib/format";

// Pieces the ranged tabs (Pages, Goals, Outbound, Revenue) share: the joined stat tiles, the
// sortable table header, the trend sparkline, a change against the period before, and
// the table's loading rows.

/** One tile of a joined block; without `value`, its loading state. */
export function Tile({ label, value, note }: { label: string; value: string | undefined; note?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 bg-background px-6 py-6">
      <span className="truncate text-sm text-muted-foreground">{label}</span>
      {value === undefined ? (
        <span className="h-8 w-20 animate-pulse rounded bg-muted" />
      ) : (
        <span className="truncate text-[1.625rem] leading-8 font-semibold tracking-tight tabular-nums">{value}</span>
      )}
      <span className="min-h-4 truncate text-xs leading-4 text-muted-foreground tabular-nums">
        {value === undefined ? null : note}
      </span>
    </div>
  );
}

/**
 * A tile's note: the change "vs previous", green up and red down (the other way round
 * with `invert`, for numbers where less is better), or a dash without one.
 */
export function ChangeNote({ change, invert = false }: { change: number | null; invert?: boolean }) {
  if (change === null) return <>–</>;
  const direction = Math.sign(Math.round(change * 1000)) * (invert ? -1 : 1);
  return (
    <>
      <span className={cn("font-medium", direction > 0 && "text-up", direction < 0 && "text-down")}>
        {formatChange(change)}
      </span>{" "}
      vs previous
    </>
  );
}

/** A row's change against the period before, green up and red down; empty without one. */
export function RowChange({ change }: { change: number | null }) {
  const rounded = change === null ? 0 : Math.round(change * 1000);
  return (
    <span
      className={cn(
        "ml-2 inline-block w-14 text-left text-xs",
        rounded > 0 ? "text-up" : rounded < 0 ? "text-down" : "text-muted-foreground",
      )}
    >
      {change === null ? "" : formatChange(change)}
    </span>
  );
}

export type Column<S extends string> = { sort: S; label: string; numeric: boolean };

export function SortHeader<S extends string>({
  column,
  sort,
  onSort,
}: {
  column: Column<S>;
  sort: { by: S; desc: boolean };
  onSort: (by: S) => void;
}) {
  const active = sort.by === column.sort;
  const Arrow = sort.desc ? ArrowDownIcon : ArrowUpIcon;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.desc ? "descending" : "ascending") : undefined}
      className={cn(
        "px-4 py-3 font-normal sm:first:pl-5 sm:last:pr-5",
        column.numeric ? "text-right" : "text-left",
      )}
    >
      <button
        type="button"
        onClick={() => onSort(column.sort)}
        className={cn(
          "inline-flex items-center gap-1 rounded-sm transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
          active && "text-foreground",
        )}
      >
        {column.label}
        {active && <Arrow aria-hidden className="size-3" />}
      </button>
    </th>
  );
}

const SPARK_W = 96;
const SPARK_H = 24;

/** A row's counts over the range as a small line, with a dot on the last point. */
export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <span className="text-muted-foreground">–</span>;
  const max = Math.max(1, ...values);
  const x = (i: number) => 1 + (i * (SPARK_W - 4)) / (values.length - 1);
  const y = (v: number) => SPARK_H - 3 - (v / max) * (SPARK_H - 6);
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = values.length - 1;
  return (
    <svg width={SPARK_W} height={SPARK_H} viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} aria-hidden className="block">
      <polyline
        points={points}
        fill="none"
        strokeWidth={1.25}
        strokeLinejoin="round"
        strokeLinecap="round"
        className="stroke-muted-foreground"
      />
      <circle cx={x(last)} cy={y(values[last])} r={2} className="fill-foreground" />
    </svg>
  );
}

export function LoadingRows({ columns }: { columns: number }) {
  return (
    <>
      {Array.from({ length: 6 }, (_, i) => (
        <tr key={i} className="border-b border-border last:border-b-0" aria-hidden>
          {Array.from({ length: columns }, (_, j) => (
            <td key={j} className="px-4 py-3.5 sm:first:pl-5 sm:last:pr-5">
              <div className={cn("h-4 animate-pulse rounded bg-muted", j === 0 ? "w-40" : "ml-auto w-12")} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
