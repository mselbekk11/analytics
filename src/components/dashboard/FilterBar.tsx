"use client";

import { XIcon } from "lucide-react";
import type { Dim } from "../../../convex/lib/dims";
import type { Filter } from "../../../convex/lib/filters";
import { Badge } from "@/components/ui/badge";
import { cityLabel, countryName, deviceLabel, outboundLabel, referrerLabel, regionLabel } from "@/lib/format";

const DIM_LABELS: Record<Dim, string> = {
  channel: "Channel",
  source: "Source",
  utm_campaign: "Campaign",
  utm_source: "UTM source",
  utm_medium: "Medium",
  utm_term: "Term",
  utm_content: "Content",
  ref: "ref / via",
  referrer: "Referrer",
  page: "Page",
  entry: "Entry page",
  exit: "Exit page",
  device: "Device",
  os: "OS",
  browser: "Browser",
  country: "Country",
  region: "Region",
  city: "City",
  goal: "Goal",
  outbound: "Outbound link",
};

function valueLabel({ dim, value }: Filter): string {
  switch (dim) {
    case "country":
      return countryName(value);
    case "region":
      return regionLabel(value);
    case "city":
      return cityLabel(value);
    case "device":
      return deviceLabel(value);
    case "referrer":
      return referrerLabel(value);
    case "outbound":
      return outboundLabel(value);
    default:
      return value;
  }
}

/** The active filters as small badges, each with a remove button, and "Clear" for all of them. */
export default function FilterBar({
  filters,
  onRemove,
  onClear,
}: {
  filters: Filter[];
  onRemove: (dim: Dim) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {filters.map((f) => (
        <Badge key={f.dim} variant="outline" className="h-6 max-w-full gap-1 pr-0.5 pl-2.5 font-normal">
          <span className="text-muted-foreground">{DIM_LABELS[f.dim]}:</span>
          <span className="truncate">{valueLabel(f)}</span>
          <button
            type="button"
            onClick={() => onRemove(f.dim)}
            aria-label={`Remove filter ${DIM_LABELS[f.dim]}: ${valueLabel(f)}`}
            className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <XIcon aria-hidden className="size-3" />
          </button>
        </Badge>
      ))}
      {filters.length > 1 && (
        <button type="button" onClick={onClear} className="px-1 text-xs text-muted-foreground hover:text-foreground">
          Clear all
        </button>
      )}
    </div>
  );
}
