import type { ReactNode } from "react";
import { cn } from "cn";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatChange } from "@/lib/format";

type Props = {
  label: string;
  /** undefined while loading */
  value: string | undefined;
  /** Fraction from percentChange; null shows "–" (nothing to compare against) */
  change: number | null;
  /** Show "–" instead of the change: the previous period used another definition */
  incomparable?: boolean;
  /** For rates where going up is bad (bounce rate): a rise shows red */
  lowerIsBetter?: boolean;
  /** Whether its series is on the chart: the dot takes the series colour */
  on: boolean;
  /** The series colour, for the dot */
  color: string;
  /** Switches the series on or off */
  onToggle: () => void;
  /** Numbers that left the row, one hover away */
  tooltip?: ReactNode;
  /** Less side padding, so labels fit when the row has six or seven tiles */
  dense?: boolean;
};

/**
 * One tile in the joined stat row: a dot and label over a large number and its % change.
 * It is also the chart's legend: pressing it switches its series on or off.
 */
export default function StatTile({
  label,
  value,
  change,
  incomparable,
  lowerIsBetter,
  on,
  color,
  onToggle,
  tooltip,
  dense,
}: Props) {
  const tile = (
    <button
      type="button"
      aria-pressed={on}
      onClick={onToggle}
      className={cn(
        "group flex h-full min-w-0 cursor-pointer flex-col gap-2 bg-background py-6 text-left outline-none focus-visible:ring-2 focus-visible:ring-link focus-visible:ring-inset",
        dense ? "px-5 sm:px-4" : "px-6",
      )}
    >
      <span
        className={cn(
          "flex items-center gap-2 text-sm transition-colors",
          on ? "text-foreground" : "text-muted-foreground group-hover:text-foreground",
        )}
      >
        <span
          className={cn("size-1.5 shrink-0 rounded-full", !on && "bg-muted-foreground/40")}
          style={on ? { background: color } : undefined}
        />
        <span className="truncate">{label}</span>
      </span>
      {value === undefined ? (
        <>
          <span className="h-8 w-20 animate-pulse rounded bg-muted" />
          <span className="h-4 w-10 animate-pulse rounded bg-muted" />
        </>
      ) : (
        <>
          <span className="truncate text-[1.625rem] leading-8 font-semibold tracking-tight tabular-nums">
            {value}
          </span>
          <Change change={incomparable ? null : change} lowerIsBetter={lowerIsBetter} />
        </>
      )}
    </button>
  );
  if (tooltip === undefined) return tile;
  return (
    <Tooltip>
      <TooltipTrigger render={tile} />
      <TooltipContent side="bottom">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

function Change({ change, lowerIsBetter }: { change: number | null; lowerIsBetter?: boolean }) {
  if (change === null) return <span className="text-xs leading-4 font-medium text-muted-foreground">–</span>;
  const rounded = Math.round(change * 1000);
  const good = lowerIsBetter ? -rounded : rounded;
  return (
    <span
      className={cn(
        "text-xs leading-4 font-medium tabular-nums",
        good > 0 ? "text-up" : good < 0 ? "text-down" : "text-muted-foreground",
      )}
    >
      {formatChange(change)}
    </span>
  );
}
