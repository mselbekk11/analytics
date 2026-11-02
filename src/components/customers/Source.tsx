import { SourceIcon } from "@/components/dashboard/Breakdowns";

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
