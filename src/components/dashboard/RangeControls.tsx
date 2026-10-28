"use client";

import { useRef, useState } from "react";
import type { DateRange as DayPickerRange } from "react-day-picker";
import { CheckIcon, ChevronDownIcon, SlidersHorizontalIcon } from "lucide-react";
import {
  isValidRange,
  MAX_RANGE_DAYS,
  PRESET_LABELS,
  PRESETS,
  rangeDays,
  type DateRange,
  type Preset,
} from "../../../convex/lib/ranges";
import { formatRangeLabel } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** The one-click ranges in the segmented control. */
const SEGMENTS: { preset: Preset; label: string }[] = [
  { preset: "today", label: "Today" },
  { preset: "24h", label: "24h" },
  { preset: "7d", label: "7d" },
  { preset: "30d", label: "30d" },
];

type Props = {
  range: DateRange;
  preset: Preset | null;
  /** The site's local date, the last day a custom range can end on */
  today: string;
  onChange: (next: Preset | DateRange) => void;
};

/** Segmented Today | 24h | 7d | 30d, the full range menu with Custom range…, and the (not yet working) Filter button. */
export default function RangeControls({ range, preset, today, onChange }: Props) {
  const [customOpen, setCustomOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ToggleGroup
        // Only highlights when the range is one of the four
        value={preset !== null && SEGMENTS.some((s) => s.preset === preset) ? [preset] : []}
        onValueChange={(value) => {
          // Clicking the pressed segment again reports an empty value; keep the range
          const next = SEGMENTS.find((s) => s.preset === value[0]);
          if (next) onChange(next.preset);
        }}
        spacing={0}
        size="sm"
        aria-label="Range"
        className="rounded-lg border border-border p-0.5"
      >
        {SEGMENTS.map((s) => (
          <ToggleGroupItem
            key={s.preset}
            value={s.preset}
            className="rounded-md! px-3 text-muted-foreground data-pressed:text-foreground"
          >
            {s.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <div ref={anchor}>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="h-8 gap-1.5 px-3" />}>
            {preset !== null ? PRESET_LABELS[preset] : "Custom range"}
            <ChevronDownIcon aria-hidden className="text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuGroup>
              {PRESETS.map((p) => (
                <DropdownMenuItem key={p} onClick={() => onChange(p)} className="py-1.5">
                  {PRESET_LABELS[p]}
                  {p === preset && <CheckIcon aria-label="Current range" className="ml-auto" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setCustomOpen(true)} className="py-1.5">
              Custom range…
              {preset === null && <CheckIcon aria-label="Current range" className="ml-auto" />}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Popover open={customOpen} onOpenChange={setCustomOpen}>
          <PopoverContent anchor={anchor} align="end" sideOffset={6} className="w-auto p-0">
            {customOpen && (
              <CustomRange
                initial={range}
                today={today}
                onCancel={() => setCustomOpen(false)}
                onApply={(next) => {
                  setCustomOpen(false);
                  onChange(next);
                }}
              />
            )}
          </PopoverContent>
        </Popover>
      </div>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              disabled
              focusableWhenDisabled
              // Focusable when disabled sets data-disabled, not :disabled, so dim it here
              className="h-8 gap-1.5 px-3 data-disabled:cursor-default data-disabled:opacity-60 data-disabled:hover:bg-transparent"
            />
          }
        >
          <SlidersHorizontalIcon aria-hidden />
          Filter
        </TooltipTrigger>
        <TooltipContent>Coming soon</TooltipContent>
      </Tooltip>
    </div>
  );
}

/** Two months of calendar; Apply takes any span of up to MAX_RANGE_DAYS that ends by today. */
function CustomRange({
  initial,
  today,
  onApply,
  onCancel,
}: {
  initial: DateRange;
  today: string;
  onApply: (range: DateRange) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<DayPickerRange | undefined>({
    from: toDate(initial.from),
    to: toDate(initial.to),
  });
  const picked =
    selected?.from !== undefined
      ? { from: fromDate(selected.from), to: fromDate(selected.to ?? selected.from) }
      : null;
  const valid = picked !== null && isValidRange(picked) && picked.to <= today;
  const last = toDate(today);

  return (
    <div className="flex flex-col">
      <Calendar
        mode="range"
        numberOfMonths={2}
        selected={selected}
        onSelect={setSelected}
        // Open on the month before the range ends, so the end month is on the right
        defaultMonth={monthBefore(initial.to)}
        endMonth={last}
        disabled={{ after: last }}
        resetOnSelect
        className="p-3"
      />
      <div className="flex items-center justify-between gap-4 border-t border-border p-3 text-sm">
        <span className={picked !== null && !valid ? "text-down" : "text-muted-foreground"}>
          {picked === null
            ? "Pick a start and end date"
            : valid
              ? `${formatRangeLabel(picked)} (${rangeDays(picked)} ${rangeDays(picked) === 1 ? "day" : "days"})`
              : `Up to ${MAX_RANGE_DAYS} days`}
        </span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" disabled={!valid} onClick={() => picked && valid && onApply(picked)}>
            Apply
          </Button>
        </div>
      </div>
    </div>
  );
}

/** "2026-10-14" as a local-midnight Date, which is what the calendar shows and returns. */
function toDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function monthBefore(date: string): Date {
  const d = toDate(date);
  return new Date(d.getFullYear(), d.getMonth() - 1, 1);
}

function fromDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
