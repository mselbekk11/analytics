import type { ReactNode } from "react";
import { formatChange } from "@/lib/format";

type Props = {
  label: ReactNode;
  /** undefined while loading */
  value: string | undefined;
  /** Fraction from percentChange; null when there is nothing to compare against */
  change?: number | null;
  /** Show "–" instead of the change: the previous period used another definition */
  incomparable?: boolean;
  /** For rates where going up is bad (bounce rate): a rise shows red */
  lowerIsBetter?: boolean;
  title?: string;
};

/** One figure in the stat row: small lowercase label over a large number and its % change. */
export default function StatTile({
  label,
  value,
  change,
  incomparable,
  lowerIsBetter,
  title,
}: Props) {
  return (
    <div className="flex flex-col gap-1" title={title}>
      <span className="text-sm text-muted">{label}</span>
      <div className="flex items-center gap-2">
        {value === undefined ? (
          <div className="h-10 w-20 animate-pulse rounded bg-panel" />
        ) : (
          <span className="text-4xl leading-10 text-strong tabular-nums">{value}</span>
        )}
        {value !== undefined && incomparable && (
          <span
            className="rounded bg-panel px-1.5 py-0.5 text-xs text-muted"
            title="Not comparable: visitor tracking started during the previous period"
          >
            –
          </span>
        )}
        {value !== undefined && !incomparable && change != null && (
          <ChangeBadge change={change} lowerIsBetter={lowerIsBetter} />
        )}
      </div>
    </div>
  );
}

function ChangeBadge({ change, lowerIsBetter }: { change: number; lowerIsBetter?: boolean }) {
  const rounded = Math.round(change * 100);
  const good = lowerIsBetter ? -rounded : rounded;
  const tone =
    good > 0
      ? "bg-up/15 text-up"
      : good < 0
        ? "bg-down/15 text-down"
        : "bg-panel text-muted";
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-xs tabular-nums ${tone}`}
      title="Compared with the previous period"
    >
      {formatChange(change)}
    </span>
  );
}
