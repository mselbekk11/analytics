"use client";

import { useId, useState } from "react";
import { hero } from "./content";

// Illustrative data, as fractions of the chart's height from the bottom: visitors over a
// week, and the share of those visits that ended in a payment
const VISITORS = [0.6, 0.86, 0.82, 0.68, 0.7, 0.47, 0.6];
const REVENUE = [0.26, 0.68, 0.5, 0.4, 0.54, 0.2, 0.36];

const W = 600;
const H = 360;

function linePath(values: number[]) {
  return values
    .map((v, i) => `${i === 0 ? "M" : "L"}${((i * W) / (values.length - 1)).toFixed(1)},${(H - v * H).toFixed(1)}`)
    .join(" ");
}

function areaPath(values: number[]) {
  return `${linePath(values)} L${W},${H} L0,${H} Z`;
}

/**
 * The hero's chart card: a labelled card holding visitors (solid, filled) against the
 * visits that brought in revenue (dashed), with a legend, a rotated axis label and a
 * switch that shows or hides the revenue line. Illustrative only, so the chart itself is
 * hidden from screen readers; the switch stays usable.
 */
export default function HeroChart() {
  const [showRevenue, setShowRevenue] = useState(true);
  const id = useId();
  const visitorsFill = `${id}-visitors`;
  const revenueFill = `${id}-revenue`;
  const { chart } = hero;

  return (
    <figure className="relative">
      <div className="relative aspect-4/3 overflow-hidden rounded-3xl bg-card shadow-xl ring-1 shadow-black/10 ring-foreground/10 sm:aspect-3/2">
        <div className="absolute top-5 right-5 left-5 z-10 flex flex-wrap justify-end gap-x-5 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-full bg-foreground" />
            {chart.visitors}
          </span>
          <span
            className={`flex items-center gap-1.5 transition-opacity duration-300 motion-reduce:transition-none ${showRevenue ? "" : "opacity-40"}`}
          >
            <span aria-hidden className="size-2 rounded-full border border-dashed border-foreground/60" />
            {chart.revenue}
          </span>
        </div>

        <span
          aria-hidden
          className="absolute top-1/2 left-6 z-10 origin-center -translate-x-1/2 -translate-y-1/2 -rotate-90 text-[11px] text-muted-foreground"
        >
          {chart.axis}
        </span>

        <svg
          aria-hidden
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="absolute inset-x-0 top-14 bottom-0 h-[calc(100%-3.5rem)] w-full text-foreground"
        >
          <defs>
            <linearGradient id={visitorsFill} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.16" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id={revenueFill} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.1" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath(VISITORS)} fill={`url(#${visitorsFill})`} />
          <path
            d={linePath(VISITORS)}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          <g
            className={`transition-opacity duration-300 motion-reduce:transition-none ${showRevenue ? "opacity-100" : "opacity-0"}`}
          >
            <path d={areaPath(REVENUE)} fill={`url(#${revenueFill})`} />
            <path
              d={linePath(REVENUE)}
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.6"
              strokeWidth="2"
              strokeDasharray="6 6"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </svg>

        <div className="absolute bottom-5 left-1/2 z-10 -translate-x-1/2">
          <button
            type="button"
            role="switch"
            aria-checked={showRevenue}
            onClick={() => setShowRevenue((v) => !v)}
            className="flex cursor-pointer items-center gap-2.5 rounded-full bg-background/80 py-1.5 pr-4 pl-1.5 text-sm font-medium shadow-sm ring-1 ring-foreground/10 backdrop-blur outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span
              aria-hidden
              className={`relative h-5 w-9 rounded-full transition-colors duration-200 motion-reduce:transition-none ${showRevenue ? "bg-primary" : "bg-foreground/15"}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-background shadow-sm transition-transform duration-200 motion-reduce:transition-none ${showRevenue ? "translate-x-4" : ""}`}
              />
            </span>
            {chart.toggle}
          </button>
        </div>
      </div>

      <span
        aria-hidden
        className="absolute -top-3.5 left-8 z-20 rounded-full bg-background px-4 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase ring-1 ring-foreground/15"
      >
        {chart.label}
      </span>

      <figcaption className="mt-4 text-center text-xs text-muted-foreground">{chart.note}</figcaption>
    </figure>
  );
}
