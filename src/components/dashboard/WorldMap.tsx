"use client";

import { useState, type PointerEvent } from "react";
import { cn } from "cn";
import { countryFlag, countryName } from "@/lib/format";
import world from "./world-dots.json";

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

const centres: Record<string, number[]> = world.centres;
// Bubble radii in map units (the map is 960 wide, so roughly half that in pixels on a card)
const MIN_RADIUS = 6;
const MAX_RADIUS = 24;

/**
 * The Countries card's Map tab: a dot-matrix world (from `npm run build:world-map`) with
 * one bubble per country at its centre, sized by the square root of its share of the top
 * country's count. "Unknown", and the few places without a centre, stay in the list only.
 * Loaded only when the tab opens.
 */
export default function WorldMap({ values, metric, active, onSelect }: Props) {
  const [hover, setHover] = useState<{ code: string; x: number; y: number; width: number } | null>(null);
  const placed = values.filter((v) => v.count > 0 && centres[v.code]);
  const top = Math.max(0, ...placed.map((v) => v.count));
  // Big bubbles first so small neighbours stay on top, and the active one last of all
  const bubbles = placed
    .map((v) => ({ ...v, r: MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * Math.sqrt(v.count / top) }))
    .sort((a, b) => Number(a.code === active) - Number(b.code === active) || b.r - a.r);
  const hovered = hover && placed.find((v) => v.code === hover.code);

  const track = (code: string) => (e: PointerEvent<SVGCircleElement>) => {
    const box = e.currentTarget.ownerSVGElement?.parentElement?.getBoundingClientRect();
    if (box) setHover({ code, x: e.clientX - box.left, y: e.clientY - box.top, width: box.width });
  };

  return (
    <div className="relative flex min-h-40 flex-1 items-center sm:min-h-66">
      <svg
        viewBox={`0 0 ${world.width} ${world.height}`}
        role="img"
        aria-label={`World map of ${metric.toLowerCase()} by country`}
        className="h-auto w-full"
        onPointerLeave={() => setHover(null)}
      >
        <path
          d={world.dots}
          className="fill-none stroke-foreground/25 dark:stroke-foreground/15"
          strokeWidth={world.dotRadius * 2}
          strokeLinecap="round"
        />
        {bubbles.map(({ code, r }) => {
          const [cx, cy] = centres[code];
          return (
            <circle
              key={code}
              cx={cx}
              cy={cy}
              r={r}
              onPointerMove={track(code)}
              onClick={onSelect ? () => onSelect(code) : undefined}
              className={cn(
                "fill-series-visitors transition-[fill-opacity,stroke-opacity]",
                code === active
                  ? "stroke-foreground [stroke-width:2]"
                  : "stroke-series-visitors [stroke-opacity:0.3] [stroke-width:5]",
                code === hover?.code ? "[fill-opacity:1]" : "[fill-opacity:0.85]",
                onSelect && "cursor-pointer",
              )}
            />
          );
        })}
      </svg>
      {hovered && hover && (
        <div
          role="tooltip"
          className={cn(
            "pointer-events-none absolute z-50 flex -translate-y-full items-center gap-1.5 rounded-md bg-popover px-2.5 py-1.5 text-xs whitespace-nowrap text-popover-foreground shadow-md ring-1 ring-line",
            // Opens away from the nearer edge, so it stays on the card on a phone
            hover.x > hover.width / 2 && "-translate-x-full",
          )}
          style={{ left: hover.x > hover.width / 2 ? hover.x - 8 : hover.x + 8, top: hover.y - 8 }}
        >
          {countryFlag(hovered.code) && <span aria-hidden>{countryFlag(hovered.code)}</span>}
          <span className="font-medium">{countryName(hovered.code)}</span>
          <span className="text-muted-foreground">
            · <span className="tabular-nums">{hovered.value}</span>{" "}
            {hovered.count === 1 ? metric.toLowerCase().replace(/s$/, "") : metric.toLowerCase()}
          </span>
        </div>
      )}
    </div>
  );
}
