"use client";

import { FiFilter, FiX } from "react-icons/fi";
import type { Dim } from "../../../convex/lib/dims";
import type { Filter } from "../../../convex/lib/filters";
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

/** The active filters as chips, each with a remove button, and "Clear" for all of them. */
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
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <FiFilter aria-hidden className="text-muted" />
      {filters.map((f) => (
        <span
          key={f.dim}
          className="flex max-w-full items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 py-0.5 pr-1 pl-3"
        >
          <span className="text-muted">{DIM_LABELS[f.dim]}:</span>
          <span className="truncate text-strong">{valueLabel(f)}</span>
          <button
            type="button"
            onClick={() => onRemove(f.dim)}
            aria-label={`Remove filter ${DIM_LABELS[f.dim]}: ${valueLabel(f)}`}
            className="rounded-full p-1 text-muted hover:bg-line hover:text-strong"
          >
            <FiX aria-hidden className="size-3.5" />
          </button>
        </span>
      ))}
      {filters.length > 1 && (
        <button type="button" onClick={onClear} className="px-1 text-muted hover:text-strong">
          Clear
        </button>
      )}
    </div>
  );
}
