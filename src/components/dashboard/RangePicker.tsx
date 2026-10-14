"use client";

import { useState } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import {
  isValidRange,
  MAX_RANGE_DAYS,
  nextRange,
  PRESETS,
  previousRange,
  rangeDays,
  type DateRange,
  type Preset,
} from "../../../convex/lib/ranges";
import { formatDate } from "@/lib/format";

type Props = {
  range: DateRange;
  preset: Preset | null;
  today: string;
  /** Called with the next `?range=` selection */
  onChange: (next: Preset | DateRange) => void;
};

/** SA-style picker: the dates in small print, then "‹ 30d ›" with a menu on the label. */
export default function RangePicker({ range, preset, today, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const atToday = range.to >= today;
  const sameYear = range.from.slice(0, 4) === range.to.slice(0, 4);
  const dates =
    range.from === range.to
      ? formatDate(range.from, true)
      : `${formatDate(range.from, !sameYear)} - ${formatDate(range.to, true).replace(",", "")}`;

  function choose(next: Preset | DateRange) {
    setOpen(false);
    onChange(next);
  }

  return (
    <div className="relative flex flex-col items-end gap-1">
      <span className="text-sm text-muted tabular-nums">{dates}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(previousRange(range))}
          className="p-1 text-2xl text-muted hover:text-strong"
          aria-label="Previous period"
        >
          <FiChevronLeft />
        </button>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="text-4xl leading-10 text-strong tabular-nums hover:text-accent"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Choose period"
        >
          {rangeDays(range)}d
        </button>
        <button
          type="button"
          onClick={() => onChange(nextRange(range))}
          disabled={atToday}
          className="p-1 text-2xl text-muted hover:text-strong disabled:opacity-30 disabled:hover:text-muted"
          aria-label="Next period"
        >
          <FiChevronRight />
        </button>
      </div>
      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 z-10 mt-2 flex w-72 flex-col gap-3 rounded-md border border-line bg-panel p-3 shadow-xl"
        >
          <div className="flex gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                role="menuitem"
                onClick={() => choose(p)}
                className={`flex-1 rounded px-3 py-1.5 text-sm ${
                  p === preset ? "bg-strong text-background" : "bg-background text-muted hover:text-strong"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <CustomRangeForm initial={range} today={today} onApply={choose} />
        </div>
      )}
    </div>
  );
}

function CustomRangeForm({
  initial,
  today,
  onApply,
}: {
  initial: DateRange;
  today: string;
  onApply: (range: DateRange) => void;
}) {
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const valid = isValidRange({ from, to });
  const input =
    "w-full rounded border border-line bg-background px-2 py-1 text-sm [color-scheme:dark]";

  return (
    <form
      className="flex flex-col gap-2 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onApply({ from, to });
      }}
    >
      <span className="text-muted">Custom</span>
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={from}
          max={to || today}
          onChange={(e) => setFrom(e.target.value)}
          className={input}
          aria-label="From"
        />
        <span className="text-muted">-</span>
        <input
          type="date"
          value={to}
          min={from}
          max={today}
          onChange={(e) => setTo(e.target.value)}
          className={input}
          aria-label="To"
        />
      </div>
      {!valid && from && to && (
        <span className="text-xs text-down">Up to {MAX_RANGE_DAYS} days, start before end</span>
      )}
      <button
        type="submit"
        disabled={!valid}
        className="rounded bg-strong px-3 py-1.5 font-medium text-background disabled:opacity-50"
      >
        Apply
      </button>
    </form>
  );
}
