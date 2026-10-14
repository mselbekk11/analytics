"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDate, formatNumber } from "@/lib/format";

type Point = { date: string; pageviews: number; visitors: number };

const SERIES = [
  { key: "pageviews", label: "Pageviews", color: "#60a5fa" },
  { key: "visitors", label: "Visitors", color: "#f472b6" },
] as const;

type SeriesKey = (typeof SERIES)[number]["key"];

export default function TrafficChart({ data }: { data: Point[] | undefined }) {
  const [shown, setShown] = useState<Record<SeriesKey, boolean>>({
    pageviews: true,
    visitors: true,
  });

  function toggle(key: SeriesKey) {
    const next = { ...shown, [key]: !shown[key] };
    // Keep at least one series on
    if (next.pageviews || next.visitors) setShown(next);
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-panel/40 p-4">
      <div className="h-72">
        {data === undefined ? (
          <div className="h-full animate-pulse rounded bg-line/50" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <defs>
                {SERIES.map((s) => (
                  <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid stroke="#27272a" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(d: string) => formatDate(d)}
                stroke="#71717a"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                minTickGap={24}
              />
              <YAxis
                allowDecimals={false}
                stroke="#71717a"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "#18181b",
                  border: "1px solid #3f3f46",
                  borderRadius: 6,
                  fontSize: 13,
                }}
                labelFormatter={(d) => formatDate(String(d), true)}
                formatter={(value, name) => [formatNumber(Number(value)), name]}
              />
              {SERIES.filter((s) => shown[s.key]).map((s) => (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2}
                  fill={`url(#fill-${s.key})`}
                  isAnimationActive={false}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="flex justify-end gap-4 text-sm">
        {SERIES.map((s) => (
          <label key={s.key} className="flex cursor-pointer items-center gap-2 select-none">
            <input
              type="checkbox"
              checked={shown[s.key]}
              onChange={() => toggle(s.key)}
              className="size-4"
              style={{ accentColor: s.color }}
            />
            <span className={shown[s.key] ? "text-strong" : "text-muted"}>{s.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
