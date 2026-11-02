"use client";

import { Area, Bar, ComposedChart, Line, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { Series } from "../../../convex/lib/statsShapes";
import { formatDuration, formatMoney, formatNumber, formatPoint, formatRate } from "@/lib/format";
import { SERIES_COLOR, SERIES_KEYS, type SeriesKey } from "./series";

type Props = {
  data: Series | undefined;
  /** Series switched on by the tiles */
  shown: SeriesKey[];
  /** Tile labels, for the tooltip */
  labels: Record<SeriesKey, string>;
  /** The day visitor tracking started, marked on the chart when it is in range */
  trackingStart?: string | null;
  /** The site's currency, for revenue amounts */
  currency: string | null;
  /** Visit duration is session time with visitor ids, time on page without */
  tracking: boolean;
};

// Hidden scales: Revenue and key-goal bars stay in the lower part of the chart, lines
// use most of its height
const barDomain = [0, (max: number) => (max > 0 ? max * 1.5 : 1)] as [number, (max: number) => number];
const lineDomain = [0, (max: number) => (max > 0 ? max * 1.1 : 1)] as [number, (max: number) => number];

const DASH: Partial<Record<SeriesKey, string>> = {
  conversionRate: "4 4",
  bounceRate: "1 3",
  visitDuration: "8 4",
};

/**
 * The chart under the tiles, the same for hours and days: Visitors as blue bars and
 * Pageviews as a light-blue line with a soft fill, both on the visible scale; Revenue
 * (green) and the key goal (purple) as bars beside Visitors in each bucket, and the rates
 * and duration as grey dashed lines, each on its own hidden scale. Bars are drawn first,
 * so the lines sit on top. The tooltip lists the series in tile order.
 */
export default function TrafficChart({ data, shown, labels, trackingStart, currency, tracking }: Props) {
  if (data === undefined) {
    return <div className="h-72 animate-pulse rounded-md bg-muted/50" />;
  }

  const points = data.map((p) => ({
    date: p.date,
    visitors: p.visitors,
    pageviews: p.pageviews,
    revenue: p.revenueMinor,
    goal: p.goal,
    conversionRate: p.conversionRate,
    bounceRate: p.bounceRate,
    visitDuration: tracking ? p.sessionTimeMs : p.timeOnPageMs,
  }));
  const config = Object.fromEntries(
    shown.map((k) => [k, { label: labels[k], color: SERIES_COLOR[k] }]),
  ) satisfies ChartConfig;
  const on = (k: SeriesKey) => shown.includes(k);
  const marker = trackingStart == null ? -1 : points.findIndex((p) => p.date === trackingStart);
  const counts = on("visitors") || on("pageviews");

  const format = (key: SeriesKey, value: number | null): string => {
    if (value === null) return "–";
    switch (key) {
      case "revenue":
        return currency ? formatMoney(value, currency) : formatNumber(value);
      case "conversionRate":
      case "bounceRate":
        return formatRate(value);
      case "visitDuration":
        return formatDuration(value);
      default:
        return formatNumber(value);
    }
  };

  return (
    <ChartContainer config={config} className="aspect-auto h-72 w-full">
      <ComposedChart
        data={points}
        margin={{ top: 8, right: 4, bottom: 0, left: counts ? -8 : 4 }}
        barGap={2}
        barCategoryGap="20%"
      >
        <defs>
          <linearGradient id="fill-pageviews" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-pageviews)" stopOpacity={0.14} />
            <stop offset="100%" stopColor="var(--color-pageviews)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          tickFormatter={(d: string) => formatPoint(d)}
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          minTickGap={32}
        />
        <YAxis
          yAxisId="count"
          hide={!counts}
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={44}
        />
        {(["revenue", "goal"] as const).filter(on).map((k) => (
          <YAxis key={k} yAxisId={k} hide width={0} domain={barDomain} />
        ))}
        {(["conversionRate", "bounceRate", "visitDuration"] as const).filter(on).map((k) => (
          <YAxis key={k} yAxisId={k} hide width={0} domain={lineDomain} />
        ))}
        <ChartTooltip
          cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
          content={(props) => (
            <ChartTooltipContent
              active={props.active}
              label={props.label}
              payload={[...(props.payload ?? [])].sort(
                (a, b) => SERIES_KEYS.indexOf(a.name as SeriesKey) - SERIES_KEYS.indexOf(b.name as SeriesKey),
              )}
              className="min-w-44 gap-2.5 rounded-md border-border bg-popover px-3 py-2.5"
              labelClassName="font-normal text-muted-foreground"
              labelFormatter={(value) => formatPoint(String(value), true)}
              formatter={(value, name, item) => (
                <div className="flex w-full items-center gap-2">
                  <span className="size-2 shrink-0 rounded-[2px]" style={{ background: item.color }} />
                  <span className="text-muted-foreground">{labels[name as SeriesKey]}</span>
                  <span className="ml-auto pl-4 font-medium text-foreground tabular-nums">
                    {format(name as SeriesKey, typeof value === "number" ? value : null)}
                  </span>
                </div>
              )}
            />
          )}
        />
        {marker >= 0 && (
          <ReferenceLine
            yAxisId="count"
            x={points[marker].date}
            stroke="var(--border)"
            strokeDasharray="3 3"
            label={{
              value: "visitor tracking on",
              // On the side with room
              position: marker > points.length / 2 ? "insideTopRight" : "insideTopLeft",
              fill: "var(--muted-foreground)",
              fillOpacity: 0.6,
              fontSize: 10,
            }}
          />
        )}
        {(["visitors", "revenue", "goal"] as const).filter(on).map((k) => (
          <Bar
            key={k}
            yAxisId={k === "visitors" ? "count" : k}
            dataKey={k}
            name={k}
            fill={`var(--color-${k})`}
            radius={[2, 2, 0, 0]}
            maxBarSize={16}
            isAnimationActive={false}
          />
        ))}
        {(["conversionRate", "bounceRate", "visitDuration"] as const).filter(on).map((k) => (
          <Line
            key={k}
            yAxisId={k}
            type="linear"
            dataKey={k}
            name={k}
            stroke={`var(--color-${k})`}
            strokeWidth={1.5}
            strokeDasharray={DASH[k]}
            strokeLinecap="round"
            dot={false}
            activeDot={{ r: 3, fill: `var(--color-${k})`, stroke: "var(--background)", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        ))}
        {on("pageviews") && (
          <Area
            yAxisId="count"
            type="linear"
            dataKey="pageviews"
            name="pageviews"
            stroke="var(--color-pageviews)"
            strokeWidth={1.5}
            fill="url(#fill-pageviews)"
            dot={false}
            activeDot={{ r: 3.5, fill: "var(--color-pageviews)", stroke: "var(--background)", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        )}
      </ComposedChart>
    </ChartContainer>
  );
}
