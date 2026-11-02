"use client";

import { Bar, BarChart, XAxis, YAxis } from "recharts";
import { formatNumber, formatPoint } from "@/lib/format";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

type Count = "visitors" | "pageviews";

const LABELS: Record<Count, string> = { visitors: "Visitors", pageviews: "Pageviews" };

/**
 * Bars of one count per day (or hour, for points like "2026-11-02T14"), in its series
 * colour, with a tooltip. The page drawer's pageviews and the Users tab's visitors.
 */
export default function CountChart({
  data,
  count,
  className,
}: {
  data: ({ date: string } & Partial<Record<Count, number>>)[];
  count: Count;
  /** Sets the height; h-44 by default */
  className?: string;
}) {
  const config = { [count]: { label: LABELS[count], color: `var(--series-${count})` } };
  return (
    <ChartContainer config={config} className={className ?? "aspect-auto h-44 w-full"}>
      <BarChart data={data} margin={{ top: 4, right: 16, bottom: 0, left: -8 }} barCategoryGap="20%">
        <XAxis
          dataKey="date"
          tickFormatter={(d: string) => formatPoint(d)}
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          minTickGap={32}
        />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tickMargin={8} width={40} />
        <ChartTooltip
          cursor={{ fill: "var(--muted)", opacity: 0.5 }}
          content={
            <ChartTooltipContent
              className="min-w-36 rounded-md border-border bg-popover px-3 py-2"
              labelClassName="font-normal text-muted-foreground"
              labelFormatter={(value) => formatPoint(String(value), true)}
              formatter={(value) => (
                <div className="flex w-full items-center gap-2">
                  <span className="size-2 shrink-0 rounded-[2px]" style={{ background: `var(--color-${count})` }} />
                  <span className="text-muted-foreground">{LABELS[count]}</span>
                  <span className="ml-auto pl-4 font-medium text-foreground tabular-nums">
                    {formatNumber(Number(value))}
                  </span>
                </div>
              )}
            />
          }
        />
        <Bar
          dataKey={count}
          fill={`var(--color-${count})`}
          radius={[2, 2, 0, 0]}
          maxBarSize={12}
          isAnimationActive={false}
        />
      </BarChart>
    </ChartContainer>
  );
}
