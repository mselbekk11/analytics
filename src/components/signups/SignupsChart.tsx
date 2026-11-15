"use client";

import { Bar, BarChart, XAxis, YAxis } from "recharts";
import { formatNumber, formatPoint } from "@/lib/format";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const CONFIG = {
  free: { label: "Free", color: "var(--series-pageviews)" },
  paying: { label: "Paying", color: "var(--series-revenue)" },
};

/**
 * Signups per day (or hour) as stacked bars, paying at the bottom in the revenue green and
 * free on top in the light blue, with both and their total in the tooltip. `cumulative`
 * draws the running totals instead.
 */
export default function SignupsChart({
  data,
  cumulative,
  className,
}: {
  data: { date: string; free: number; paying: number }[];
  cumulative: boolean;
  className?: string;
}) {
  let free = 0;
  let paying = 0;
  const points = cumulative
    ? data.map((p) => {
        free += p.free;
        paying += p.paying;
        return { date: p.date, free, paying };
      })
    : data;
  return (
    <ChartContainer config={CONFIG} className={className ?? "aspect-auto h-56 w-full"}>
      <BarChart data={points} margin={{ top: 4, right: 16, bottom: 0, left: -8 }} barCategoryGap="20%">
        <XAxis
          dataKey="date"
          tickFormatter={(d: string) => formatPoint(d)}
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          minTickGap={32}
        />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={40}
          tickFormatter={(n: number) => formatNumber(n)}
        />
        <ChartTooltip
          cursor={{ fill: "var(--muted)", opacity: 0.5 }}
          content={
            <ChartTooltipContent
              className="min-w-40 rounded-md border-border bg-popover px-3 py-2"
              labelClassName="font-normal text-muted-foreground"
              labelFormatter={(value, payload) => {
                const p = payload?.[0]?.payload as { free: number; paying: number } | undefined;
                const total = p === undefined ? null : p.free + p.paying;
                return (
                  <div className="flex w-full items-center gap-2">
                    <span>{formatPoint(String(value), true)}</span>
                    {total !== null && (
                      <span className="ml-auto pl-4 font-medium text-foreground tabular-nums">
                        {formatNumber(total)}
                      </span>
                    )}
                  </div>
                );
              }}
              formatter={(value, name) => {
                const key = name === "paying" ? "paying" : "free";
                return (
                  <div className="flex w-full items-center gap-2">
                    <span className="size-2 shrink-0 rounded-[2px]" style={{ background: `var(--color-${key})` }} />
                    <span className="text-muted-foreground">{CONFIG[key].label}</span>
                    <span className="ml-auto pl-4 font-medium text-foreground tabular-nums">
                      {formatNumber(Number(value))}
                    </span>
                  </div>
                );
              }}
            />
          }
        />
        <Bar dataKey="paying" stackId="signups" fill="var(--color-paying)" maxBarSize={12} isAnimationActive={false} />
        <Bar
          dataKey="free"
          stackId="signups"
          fill="var(--color-free)"
          radius={[2, 2, 0, 0]}
          maxBarSize={12}
          isAnimationActive={false}
        />
      </BarChart>
    </ChartContainer>
  );
}
