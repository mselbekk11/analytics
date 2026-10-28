"use client";

import { useState } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";

type Point = { date: string; pageviews: number; visitors: number; revenueMinor?: number };

const SERIES = [
  { key: "pageviews", label: "Pageviews", color: "#60a5fa" },
  { key: "visitors", label: "Visitors", color: "#f472b6" },
] as const;

const REVENUE = { key: "revenueMinor", label: "Revenue", color: "#34d399" } as const;

type SeriesKey = (typeof SERIES)[number]["key"] | typeof REVENUE.key;

type Props = {
  data: Point[] | undefined;
  /** The day visitor tracking started, marked on the chart when it is in range */
  trackingStart?: string | null;
  /** Shows daily revenue as bars under the lines, on a site that takes payments */
  currency?: string | null;
};

export default function TrafficChart({ data, trackingStart, currency }: Props) {
  const [shown, setShown] = useState<Record<SeriesKey, boolean>>({
    pageviews: true,
    visitors: true,
    revenueMinor: true,
  });
  const toggles = currency ? [REVENUE, ...SERIES] : SERIES;

  function toggle(key: SeriesKey) {
    const next = { ...shown, [key]: !shown[key] };
    // Keep at least one series on
    if (next.pageviews || next.visitors || (currency && next.revenueMinor)) setShown(next);
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-panel/40 p-4">
      <div className="h-72">
        {data === undefined ? (
          <div className="h-full animate-pulse rounded bg-line/50" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <defs>
                {toggles.map((s) => (
                  <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(d: string) => formatDate(d)}
                stroke="var(--muted-foreground)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                minTickGap={24}
              />
              <YAxis
                yAxisId="count"
                allowDecimals={false}
                stroke="var(--muted-foreground)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  color: "var(--popover-foreground)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  fontSize: 13,
                }}
                labelFormatter={(d) => formatDate(String(d), true)}
                formatter={(value, name) => [
                  name === REVENUE.label && currency
                    ? formatMoney(Number(value), currency)
                    : formatNumber(Number(value)),
                  name,
                ]}
              />
              {/* Revenue has its own hidden scale; bars come first so the lines draw over them */}
              {/* Twice the tallest bar, so the bars stay in the lower half */}
              {currency && (
                <YAxis yAxisId="revenue" orientation="right" hide domain={[0, (max: number) => max * 2]} />
              )}
              {currency && shown.revenueMinor && (
                <Bar
                  yAxisId="revenue"
                  dataKey={REVENUE.key}
                  name={REVENUE.label}
                  fill={REVENUE.color}
                  fillOpacity={0.45}
                  radius={[2, 2, 0, 0]}
                  maxBarSize={24}
                  isAnimationActive={false}
                />
              )}
              {trackingStart != null && data.some((p) => p.date === trackingStart) && (
                <ReferenceLine
                  yAxisId="count"
                  x={trackingStart}
                  stroke="var(--muted-foreground)"
                  strokeDasharray="3 3"
                  label={{
                    value: "visitor tracking on",
                    position: "insideTopLeft",
                    fill: "var(--muted-foreground)",
                    fontSize: 11,
                  }}
                />
              )}
              {SERIES.filter((s) => shown[s.key]).map((s) => (
                <Area
                  key={s.key}
                  yAxisId="count"
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2}
                  fill={`url(#fill-${s.key})`}
                  isAnimationActive={false}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="flex justify-end gap-4 text-sm">
        {toggles.map((s) => (
          <label key={s.key} className="flex cursor-pointer items-center gap-2 select-none">
            <input
              type="checkbox"
              checked={shown[s.key]}
              onChange={() => toggle(s.key)}
              className="size-4"
              style={{ accentColor: s.color }}
            />
            <span className={shown[s.key] ? "text-strong" : "text-muted-foreground"}>{s.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
