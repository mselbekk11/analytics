"use client";

import type { ReactNode } from "react";
import { MAX_FILTER_DAYS, type Filter } from "../../../convex/lib/filters";
import { PRESET_LABELS, type DateRange, type Preset } from "../../../convex/lib/ranges";
import { formatRangeLabel } from "@/lib/format";
import FilterBar from "./FilterBar";
import RangeControls from "./RangeControls";

/**
 * A site view's title with the range in words, the range controls (and `actions`), and the filter chips
 * with anything to say under them (`note`).
 */
export default function SiteHeader({
  title,
  range,
  preset,
  today,
  onRange,
  filters,
  onFilters,
  note,
  actions,
}: {
  title: string;
  range: DateRange;
  preset: Preset | null;
  today: string;
  onRange: (next: Preset | DateRange) => void;
  filters: Filter[];
  onFilters: (next: Filter[]) => void;
  note?: ReactNode;
  /** Buttons after the range controls */
  actions?: ReactNode;
}) {
  return (
    <header className="-mb-2 flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">
            {preset !== null ? PRESET_LABELS[preset] : formatRangeLabel(range)}
          </p>
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">
            <RangeControls range={range} preset={preset} today={today} onChange={onRange} />
            {actions}
          </div>
        ) : (
          <RangeControls range={range} preset={preset} today={today} onChange={onRange} />
        )}
      </div>
      {filters.length > 0 && (
        <div className="flex flex-col gap-2">
          <FilterBar
            filters={filters}
            onRemove={(dim) => onFilters(filters.filter((f) => f.dim !== dim))}
            onClear={() => onFilters([])}
          />
          {note}
        </div>
      )}
    </header>
  );
}

/** Shown in place of a view's numbers when a filtered range is too long or has too many rows. */
export function BlockedNotice({ blocked, hourly }: { blocked: "range" | "tooMany"; hourly: boolean }) {
  return (
    <p className="w-full rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
      {blocked === "range"
        ? `Filters work on ranges of up to ${MAX_FILTER_DAYS} days. Pick a shorter range, or remove the filters to see the whole period.`
        : hourly
          ? "There are too many visits in this period to count by the hour. Pick a day range such as Last 7 days."
          : "There are too many visits in this range to filter. Pick a shorter range, or remove the filters."}
    </p>
  );
}
