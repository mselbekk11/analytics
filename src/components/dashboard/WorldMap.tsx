"use client";

import { useState, type PointerEvent } from "react";
import { cn } from "cn";
import { countryName } from "@/lib/format";
import world from "./world-110m.json";

export type MapValue = {
  /** ISO alpha-2, as the Countries list keys its rows */
  code: string;
  count: number;
  /** The formatted number for the tooltip */
  value: string;
};

type Props = {
  values: MapValue[];
  /** What the numbers count, after the value in the tooltip ("Visitors", "Revenue") */
  metric: string;
  /** The country of the current filter, outlined */
  active?: string;
  /** Adds the country as a filter; null where filtering is not possible */
  onSelect: ((code: string) => void) | null;
};

/**
 * The Countries card's Map tab: 110m outlines (from `npm run build:world-map`), each
 * country shaded by its share of the top country's count, from faint to the foreground
 * colour. Loaded only when the tab opens, as the outlines are ~110 KB.
 */
export default function WorldMap({ values, metric, active, onSelect }: Props) {
  const [hover, setHover] = useState<{ code: string; x: number; y: number } | null>(null);
  const byCode = new Map(values.map((v) => [v.code, v]));
  // Only countries with an outline set the scale ("Unknown" and tiny islands don't)
  const top = Math.max(0, ...world.countries.map((c) => byCode.get(c.code)?.count ?? 0));
  const hovered = hover && (byCode.get(hover.code) ?? { code: hover.code, count: 0, value: "0" });

  const track = (code: string) => (e: PointerEvent<SVGPathElement>) => {
    const box = e.currentTarget.ownerSVGElement?.parentElement?.getBoundingClientRect();
    if (box) setHover({ code, x: e.clientX - box.left, y: e.clientY - box.top });
  };

  return (
    <div className="relative flex min-h-66 flex-1 items-center">
      <svg
        viewBox={`0 0 ${world.width} ${world.height}`}
        role="img"
        aria-label={`World map of ${metric.toLowerCase()} by country`}
        className="h-auto w-full"
        onPointerLeave={() => setHover(null)}
      >
        {/* The active country last, so its outline isn't covered by its neighbours */}
        {[...world.countries].sort((a, b) => Number(a.code === active) - Number(b.code === active)).map(({ code, d }) => {
          const v = byCode.get(code);
          // Square root, so a few large countries don't wash out the rest
          const shade = v && top > 0 && v.count > 0 ? 0.25 + 0.75 * Math.sqrt(v.count / top) : 0;
          const clickable = onSelect !== null && v !== undefined && v.count > 0;
          return (
            <path
              key={code}
              d={d}
              onPointerMove={track(code)}
              onClick={clickable ? () => onSelect(code) : undefined}
              className={cn(
                "transition-[fill-opacity] [vector-effect:non-scaling-stroke]",
                code === active ? "stroke-ring [stroke-width:1.5]" : "stroke-background [stroke-width:0.5]",
                shade > 0 ? "fill-foreground" : code === hover?.code ? "fill-foreground/20" : "fill-foreground/10",
                clickable && "cursor-pointer",
              )}
              style={shade > 0 && code !== hover?.code ? { fillOpacity: shade } : undefined}
            />
          );
        })}
      </svg>
      {hovered && hover && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-50 -translate-x-1/2 -translate-y-full rounded-md bg-foreground px-3 py-1.5 text-xs whitespace-nowrap text-background"
          style={{ left: hover.x, top: hover.y - 10 }}
        >
          {countryName(hovered.code)} · <span className="tabular-nums">{hovered.value}</span>{" "}
          {hovered.count === 1 ? metric.toLowerCase().replace(/s$/, "") : metric.toLowerCase()}
        </div>
      )}
    </div>
  );
}
